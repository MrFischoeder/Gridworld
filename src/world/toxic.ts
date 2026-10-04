// Toxic fog in the world (gen/toxic.ts): the fog itself (drifting lime banks over the zone, and the air going thick
// and sickly green once you are in it), what it does to you (a burning chest without a gas mask; with one, the filter
// wears down and spares from the backpack are screwed in as each is spent), and the contaminated site in the middle
// of every zone: an old army depot, a research lab or a crashed probe, drawn with a dark fill under its lines, whose
// sealed lockers hold rare things (`char.containers['fog:<zone>:<i>']`, rolled once from the world by `lockerLoot`).
import { environmentalDamage } from './damage';
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { fogsNear, fogAt, fogDensity, lockerLoot, filterWear, fogHarm, MASK, FOG, FOG_SITE, type FogZone } from '../gen/toxic';
import { nearX, worldDist } from '../gen/regions';
import { putItems } from '../inventory';
import { takeOne, saveChar } from '../character';
import { showToast, logLine } from '../ui/hud';
import { showToxic } from '../ui/toxic';
import { tintSky } from './sky';
import type { Slot } from '../save';
import type { Terrain } from '../gen/terrain';

const CONC = 0x7fa08c, RUST = 0x9aa870, METAL = 0xa8c8b8, GLOW = 0xb6ff3a;
/** A locker in the site's frame, and which way its door faces. */
interface Locker { x: number; z: number; yaw: number }
interface Live { f: FogZone; g: THREE.Group; puffs: THREE.Sprite[]; cos: number; sin: number; boxes: [number, number, number, number][]; rings: [number, number, number][]; lockers: Locker[] }
const live = new Map<string, Live>();

// ---------- drawing ----------
/** An upright cylinder (a drum, a tank): a dark fill under rings and a few ribs. */
function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, color: number, sides = 8, tilt = 0) {
  const P = (a: number, yy: number) => [x + Math.cos(a) * r + tilt * (yy - y), yy, z + Math.sin(a) * r];
  for (let i = 0; i < sides; i++) {
    const a0 = i / sides * 6.283, a1 = (i + 1) / sides * 6.283;
    pb.face(P(a0, y), P(a1, y), P(a1, y + h), P(a0, y + h));
    pb.seg(color, P(a0, y + h), P(a1, y + h)); pb.seg(color, P(a0, y), P(a1, y));
    if (i % 2 === 0) pb.seg(color, P(a0, y), P(a0, y + h));
  }
  pb.face(...Array.from({ length: sides }, (_, i) => P(i / sides * 6.283, y + h)));
}
/** A steel locker (0.9 x 2 x 0.55) at (x, z) turned by yaw, its door towards +z of its own frame. */
function locker(pb: PropBatch, H: (x: number, z: number) => number, l: Locker) {
  const c = Math.cos(l.yaw), s = Math.sin(l.yaw), y = H(l.x, l.z);
  const P = (u: number, yy: number, v: number) => [l.x + u * c + v * s, y + yy, l.z - u * s + v * c];
  const q = [[-0.45, -0.28], [0.45, -0.28], [0.45, 0.28], [-0.45, 0.28]];
  for (let i = 0; i < 4; i++) { const [a, b] = [q[i], q[(i + 1) % 4]]; pb.face(P(a[0], 0, a[1]), P(b[0], 0, b[1]), P(b[0], 2, b[1]), P(a[0], 2, a[1])); pb.seg(METAL, P(a[0], 2, a[1]), P(b[0], 2, b[1])); pb.seg(METAL, P(a[0], 0, a[1]), P(a[0], 2, a[1])); }
  pb.face(P(-0.45, 2, -0.28), P(0.45, 2, -0.28), P(0.45, 2, 0.28), P(-0.45, 2, 0.28));
  pb.line(GLOW, P(-0.3, 1.2, 0.29), P(0.3, 1.2, 0.29), P(0.3, 1.8, 0.29), P(-0.3, 1.8, 0.29), P(-0.3, 1.2, 0.29)); // the hazard plate
  pb.line(GLOW, P(0, 1.3, 0.29), P(0.15, 1.6, 0.29), P(-0.15, 1.6, 0.29), P(0, 1.3, 0.29));
  pb.seg(METAL, P(0.3, 0.9, 0.29), P(0.3, 1.05, 0.29));
}
/** A leaking drum lying or standing, a lime puddle under it. */
function drum(pb: PropBatch, H: (x: number, z: number) => number, x: number, z: number, fallen: boolean) {
  const y = H(x, z);
  if (fallen) {
    for (let i = 0; i < 8; i++) { const a0 = i / 8 * 6.283, a1 = (i + 1) / 8 * 6.283, P = (a: number, u: number) => [x + u, y + 0.3 + Math.sin(a) * 0.3, z + Math.cos(a) * 0.3]; pb.face(P(a0, -0.45), P(a1, -0.45), P(a1, 0.45), P(a0, 0.45)); pb.seg(RUST, P(a0, -0.45), P(a1, -0.45)); pb.seg(RUST, P(a0, 0.45), P(a1, 0.45)); }
  } else cyl(pb, x, y, z, 0.3, 0.9, RUST, 8);
  for (let i = 0; i < 7; i++) { const a0 = i / 7 * 6.283, a1 = (i + 1) / 7 * 6.283, r0 = 0.9 + ((i * 5) % 3) * 0.2, r1 = 0.9 + (((i + 1) * 5) % 3) * 0.2; pb.seg(GLOW, [x + 0.6 + Math.cos(a0) * r0, y + 0.03, z + Math.sin(a0) * r0], [x + 0.6 + Math.cos(a1) * r1, y + 0.03, z + Math.sin(a1) * r1]); }
}
/** A box building with a dark fill (walls to `h`), its outline and a doorway drawn on the +z face; collides as a box. */
function block(pb: PropBatch, H: (x: number, z: number) => number, x0: number, z0: number, x1: number, z1: number, h: number, color: number, boxes: Live['boxes']) {
  const y = Math.min(H(x0, z0), H(x1, z0), H(x0, z1), H(x1, z1)) - 0.3;
  pb.box(x0, y, z0, x1, y + h + 0.3, z1, color);
  const mx = (x0 + x1) / 2; pb.line(color, [mx - 0.8, y + 0.3, z1 + 0.02], [mx - 0.8, y + 2.5, z1 + 0.02], [mx + 0.8, y + 2.5, z1 + 0.02], [mx + 0.8, y + 0.3, z1 + 0.02]);
  boxes.push([x0, z0, x1, z1]);
}

function drawDepot(pb: PropBatch, H: (x: number, z: number) => number, L: Live) {
  // a sunken bunker with a sloped earth roof, two sheds, a broken wall round it, drums leaking the fog
  block(pb, H, -5, -8, 5, -2, 3.2, CONC, L.boxes);
  { const y = H(0, -5) + 2.9; pb.face([-5.5, y, -8.5], [5.5, y, -8.5], [5.5, y + 1.2, -5], [-5.5, y + 1.2, -5]); pb.face([-5.5, y + 1.2, -5], [5.5, y + 1.2, -5], [5.5, y, -1.5], [-5.5, y, -1.5]); pb.line(CONC, [-5.5, y, -8.5], [-5.5, y + 1.2, -5], [-5.5, y, -1.5]); pb.line(CONC, [5.5, y, -8.5], [5.5, y + 1.2, -5], [5.5, y, -1.5]); pb.seg(CONC, [-5.5, y + 1.2, -5], [5.5, y + 1.2, -5]);
    cyl(pb, 3, y + 1, -5, 0.35, 1.6, METAL, 6); } // a vent
  block(pb, H, -12, -1, -7, 5, 2.8, RUST, L.boxes);
  block(pb, H, 7, 0, 12, 7, 2.8, RUST, L.boxes);
  for (const [ax, az, bx, bz] of [[-15, -12, 15, -12], [15, -12, 15, 11], [15, 11, 3, 11], [-3, 11, -15, 11], [-15, 11, -15, -12]] as const) {
    const n = Math.round(Math.hypot(bx - ax, bz - az) / 2);
    for (let i = 0; i < n; i++) {
      if ((i * 7 + ax) % 5 === 0) continue; // breaches
      const x0 = ax + (bx - ax) * i / n, z0 = az + (bz - az) * i / n, x1 = ax + (bx - ax) * (i + 1) / n, z1 = az + (bz - az) * (i + 1) / n, h = 1.2 + ((i * 3) % 4) * 0.15, y = H(x0, z0) - 0.2;
      pb.face([x0, y, z0], [x1, y, z1], [x1, y + h, z1], [x0, y + h, z0]); pb.seg(CONC, [x0, y + h, z0], [x1, y + h, z1]); pb.seg(CONC, [x0, y, z0], [x0, y + h, z0]);
    }
  }
  for (const [x, z, f] of [[4, 2, 0], [5.5, 3, 1], [-3, 4, 1], [-6, 7, 0], [9, -4, 1], [-10, -6, 0], [1, 7, 1]] as const) drum(pb, H, x, z, !!f);
}
function drawLab(pb: PropBatch, H: (x: number, z: number) => number, L: Live) {
  // a flat research block with a window band, three tanks behind it (one split open), pipes and a fallen mast
  block(pb, H, -7, -9, 7, -2, 5, CONC, L.boxes);
  { const y = H(0, -2) + 2.8; pb.line(GLOW, [-6, y, -1.98], [-2, y, -1.98], [-2, y + 1, -1.98], [-6, y + 1, -1.98], [-6, y, -1.98]); pb.line(CONC, [2, y, -1.98], [6, y, -1.98], [6, y + 1, -1.98], [2, y + 1, -1.98], [2, y, -1.98]); }
  for (const [x, z, r, h, split] of [[-9, -13, 2, 6, 0], [-4, -13.5, 2.2, 7, 1], [1.5, -13, 2, 6, 0]] as const) {
    const y = H(x, z) - 0.2;
    if (split) { cyl(pb, x, y, z, r, h * 0.55, METAL, 10); for (let k = 0; k < 5; k++) { const a = k * 1.2; pb.seg(GLOW, [x + Math.cos(a) * r, y + h * 0.55, z + Math.sin(a) * r], [x + Math.cos(a) * r * 1.3, y + h * 0.7 + (k % 2), z + Math.sin(a) * r * 1.3]); } }
    else cyl(pb, x, y, z, r, h, METAL, 10);
    L.rings.push([x, z, r]);
    pb.seg(RUST, [x, y + h * 0.5, z + r], [x, y + 2.5, -9]); // a pipe to the block
  }
  { const y = H(9, -4); pb.line(RUST, [9, y, -4], [11, y + 0.6, 4]); pb.line(RUST, [9.4, y, -4], [11.4, y + 0.6, 4]); for (let i = 0; i < 6; i++) pb.seg(RUST, [9 + i * 0.33, y + i * 0.1, -4 + i * 1.33], [9.4 + i * 0.33, y + i * 0.1, -4 + i * 1.33]); }
  for (const [x, z, f] of [[5, 3, 1], [-5, 4, 0], [8, 6, 1], [-9, 1, 1]] as const) drum(pb, H, x, z, !!f);
}
function drawProbe(pb: PropBatch, H: (x: number, z: number) => number, L: Live) {
  // a crater, the probe's octagonal body half buried and tilted, a torn solar wing, split fuel spheres
  const y0 = H(0, -6);
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * 6.283, a1 = (i + 1) / 16 * 6.283; pb.seg(RUST, [Math.cos(a0) * 11, H(Math.cos(a0) * 11, -6 + Math.sin(a0) * 11) + 0.4, -6 + Math.sin(a0) * 11], [Math.cos(a1) * 11, H(Math.cos(a1) * 11, -6 + Math.sin(a1) * 11) + 0.4, -6 + Math.sin(a1) * 11]); }
  cyl(pb, 0, y0 - 1.5, -6, 3.2, 5.5, METAL, 8, 0.35);
  L.rings.push([0.6, -6, 3.4]);
  { const y = y0 + 3.2; pb.face([2.5, y, -6.5], [11, y + 2.5, -8], [11, y + 2.1, -3], [2.5, y - 0.4, -5.5]); pb.line(METAL, [2.5, y, -6.5], [11, y + 2.5, -8], [11, y + 2.1, -3], [2.5, y - 0.4, -5.5]); for (let k = 1; k < 5; k++) pb.seg(METAL, [2.5 + k * 1.7, y + k * 0.5, -6.5 - k * 0.3], [2.5 + k * 1.7, y - 0.4 + k * 0.5, -5.5 + k * 0.5]); }
  for (const [x, z] of [[-6, -1], [-3, 3]] as const) { const y = H(x, z); cyl(pb, x, y, z, 1.2, 2, METAL, 8); L.rings.push([x, z, 1.2]); for (let k = 0; k < 4; k++) pb.seg(GLOW, [x + Math.cos(k * 1.6) * 1.2, y + 2, z + Math.sin(k * 1.6) * 1.2], [x + Math.cos(k * 1.6) * 1.6, y + 2.7, z + Math.sin(k * 1.6) * 1.6]); }
  for (const [x, z, f] of [[6, 4, 1], [-8, 5, 1], [9, -1, 0]] as const) drum(pb, H, x, z, !!f);
}
const LOCKERS: Record<FogZone['site'], Locker[]> = {
  depot: [{ x: -2.5, z: -1.4, yaw: 0 }, { x: 2.5, z: -1.4, yaw: 0 }, { x: -6.4, z: 2, yaw: -Math.PI / 2 }, { x: 6.4, z: 3.5, yaw: Math.PI / 2 }],
  lab: [{ x: -4, z: -1.4, yaw: 0 }, { x: 4, z: -1.4, yaw: 0 }, { x: -7.6, z: -5, yaw: -Math.PI / 2 }],
  probe: [{ x: -3.5, z: -1.8, yaw: 0.5 }, { x: 4, z: -1.5, yaw: -0.4 }, { x: 0, z: 1.2, yaw: 0 }],
};
const DRAW: Record<FogZone['site'], typeof drawDepot> = { depot: drawDepot, lab: drawLab, probe: drawProbe };

/** A soft round puff for the fog banks (one texture for all). */
let puffTex: THREE.Texture | null = null;
function puffTexture(): THREE.Texture {
  if (puffTex) return puffTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.5, 'rgba(255,255,255,.45)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 64, 64);
  return (puffTex = new THREE.CanvasTexture(c));
}
const puffMat = () => new THREE.SpriteMaterial({ map: puffTexture(), color: 0xc4e84a, transparent: true, opacity: 0.3, depthWrite: false, fog: false });

function build(T: Terrain, f: FogZone): Live {
  const cos = Math.cos(f.yaw), sin = Math.sin(f.yaw), gx = nearX(f.x, G.pos.x);
  const H = (x: number, z: number) => T.heightAt(f.x + x * cos + z * sin, f.z - x * sin + z * cos) - f.y;
  const pb = new PropBatch(), L: Live = { f, g: new THREE.Group(), puffs: [], cos, sin, boxes: [], rings: [], lockers: LOCKERS[f.site] };
  DRAW[f.site](pb, H, L);
  for (const l of L.lockers) locker(pb, H, l);
  const site = pb.build(); site.rotation.y = f.yaw; L.g.add(site);
  // the fog banks: puffs scattered where the fog is thick, low over the ground (in world axes round the middle)
  const n = Math.round(24 + f.r * 0.25);
  for (let i = 0; i < n; i++) {
    let px = 0, pz = 0;
    for (let k = 0; k < 8; k++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * f.r; px = Math.cos(a) * d; pz = Math.sin(a) * d; if (fogDensity(f, f.x + px, f.z + pz) > Math.random() * 0.8) break; }
    const s = new THREE.Sprite(puffMat()), sz = 18 + Math.random() * 20;
    s.scale.set(sz, sz * 0.4, 1);
    s.position.set(px, T.heightAt(f.x + px, f.z + pz) - f.y + 1 + Math.random() * 4, pz);
    s.userData = { ph: Math.random() * 6.283, sp: 0.03 + Math.random() * 0.05, r: Math.hypot(px, pz), a: Math.atan2(pz, px), y: s.position.y };
    L.puffs.push(s); L.g.add(s);
  }
  L.g.position.set(gx, f.y, f.z);
  scene.add(L.g);
  return L;
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); if (o instanceof THREE.Sprite) o.material.dispose(); }); }
export function dropToxic() { for (const L of live.values()) drop(L); live.clear(); here = 0; seen = 0; }

// ---------- the fog on you ----------
let tick = 0, here = 0, seen = 0, zoneHere: FogZone | null = null, warnT = 0;
const TOX = new THREE.Color();
const masked = () => G.char.wear.face === 'gasmask';
/** How thick the fog you are standing in is (0..1). */
export const toxicHere = () => (G.char.loc === 'overworld' ? here : 0);

/** Screws a fresh filter into the mask (a Mask Filter from the backpack). */
export function fitFilter(auto: '' | 'first' | 'spent' = ''): boolean {
  const c = G.char;
  if (!masked()) { if (!auto) logLine('Wear the Gas Mask first (the face slot of your backpack), then screw a filter into it.'); return false; }
  if (!takeOne('filter')) return false;
  const was = c.filter; c.filter = MASK.filter; saveChar();
  if (auto === 'spent') { showToast('Fresh filter'); logLine('Your filter is spent: you screw in a fresh one from your backpack.'); }
  else if (auto) logLine('You screw a filter from your backpack into the mask before breathing in.');
  else logLine(was > 0 ? `You swap the filter (the old one had ${Math.round(was / MASK.filter * 100)}% left) for a fresh one.` : 'You screw a fresh filter into your mask.');
  return true;
}

export function updateToxic(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { if (live.size) dropToxic(); showToxic(null); return; }
  // the sites and fog banks: drawn within reach, dropped behind
  if ((tick -= dt) <= 0) {
    tick = 1;
    const near = fogsNear(T.world, G.pos.x, G.pos.z, 650);
    for (const [id, L] of live) if (!near.some((f) => f.id === id) || worldDist(L.f.x, L.f.z, G.pos.x, G.pos.z) > L.f.r + 800) { drop(L); live.delete(id); }
    for (const f of near) if (!live.has(f.id)) live.set(f.id, build(T, f));
    // found: on the maps from now on
    for (const f of near) if (!G.char.fogs[f.id] && worldDist(f.x, f.z, G.pos.x, G.pos.z) < f.r + 60) {
      G.char.fogs[f.id] = [Math.round(f.x), Math.round(f.z), Math.round(f.r), f.name]; saveChar();
      logLine(`A heavy green fog lies over ${f.name}. Without a gas mask it will burn your lungs.`);
    }
  }
  for (const L of live.values()) for (const s of L.puffs) { // the banks drift round slowly and breathe
    const u = s.userData, a = u.a + (u.ph += dt * u.sp) * 0.2;
    s.position.x = Math.cos(a) * u.r; s.position.z = Math.sin(a) * u.r; s.position.y = u.y + Math.sin(u.ph * 3) * 0.4;
    s.material.opacity = (0.22 + 0.1 * Math.sin(u.ph * 2)) * (1 - 0.7 * seen); // from inside the thick air they fade into it
  }
  const at = fogAt(T.world, G.pos.x, G.pos.z); here = at.d; zoneHere = at.zone;
  seen += (here - seen) * Math.min(1, dt * 1.5);
  // breathing it
  const c = G.char;
  if (here > MASK.faint && G.playing && !G.fly) {
    if (masked() && c.filter <= 0) fitFilter('first');
    if (masked() && c.filter > 0) {
      c.filter = Math.max(0, c.filter - filterWear(here) * dt);
      if (c.filter <= 0 && !fitFilter('spent')) { showToast('Filter spent!'); logLine('Your filter is spent and you have no spare: get out of the fog!'); }
    } else if (!G.god) {
      environmentalDamage(fogHarm(here) * dt); G.dmgFlash = Math.max(G.dmgFlash, 0.15 + 0.2 * here);
      if ((warnT -= dt) <= 0) { warnT = 5; logLine(masked() ? 'The fog seeps through your empty mask: you need a filter!' : 'The green fog burns your throat and eyes! You need a gas mask.'); }
    }
  }
  showToxic(here > 0.01 || seen > 0.05 ? { d: here, masked: masked(), filter: c.filter / MASK.filter, spares: c.inv.reduce((a, s) => a + (s && s.k === 'filter' ? s.n : 0), 0) } : null);
}
/** After the sky has set the fog: in the zone the air goes thick and green. */
export function tintToxic() {
  if (seen < 0.01 || G.char.loc !== 'overworld') return;
  const f = scene.fog as THREE.Fog, bg = scene.background as THREE.Color, k = Math.min(1, seen);
  TOX.setRGB(0.16, 0.24, 0.04).multiplyScalar(0.35 + 0.65 * Math.max(0.25, f.color.g * 1.5));
  f.color.lerp(TOX, k * 0.85); bg.lerp(TOX, k * 0.85);
  f.near *= 1 - 0.85 * k; f.far += (22 - f.far) * k * 0.85;
  tintSky(TOX, k * 0.9);
}
/** The name of the fog you stand in, with the site when you are at it (for the HUD's place name). */
export function toxicName(x: number, z: number): string | null {
  if (!zoneHere || here <= 0) return null;
  const f = zoneHere;
  return (worldDist(f.x, f.z, x, z) < FOG.site + 12 ? FOG_SITE[f.site].name + ', ' : '') + f.name + ' · toxic fog';
}

// ---------- the site: collisions and lockers ----------
function local(L: Live, x: number, z: number): [number, number] {
  const dx = x - L.g.position.x, dz = z - L.f.z;
  return [dx * L.cos - dz * L.sin, dx * L.sin + dz * L.cos];
}
/** The buildings, tanks and the probe (for G.obstacle). */
export function toxicHit(px: number, py: number, pz: number, r: number): boolean {
  for (const L of live.values()) {
    if (Math.abs(px - L.g.position.x) > 30 || Math.abs(pz - L.f.z) > 30 || py > L.f.y + 12) continue;
    const [x, z] = local(L, px, pz);
    for (const [cx, cz, cr] of L.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    for (const [x0, z0, x1, z1] of L.boxes) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
    for (const l of L.lockers) if (Math.hypot(x - l.x, z - l.z) < 0.45 + r) return true;
  }
  return false;
}
/** The locker you stand in front of: its zone and number. */
export function nearFogLocker(): { f: FogZone; i: number } | null {
  if (G.char.loc !== 'overworld') return null;
  for (const L of live.values()) {
    const [x, z] = local(L, G.pos.x, G.pos.z);
    for (let i = 0; i < L.lockers.length; i++) {
      const l = L.lockers[i], fx = l.x + Math.sin(l.yaw) * 0.9, fz = l.z + Math.cos(l.yaw) * 0.9;
      if (Math.hypot(x - fx, z - fz) < 1.1) return { f: L.f, i };
    }
  }
  return null;
}
/** A locker's contents: rolled from the world the first time it is opened, then kept as you leave it. */
export function fogLocker(f: FogZone, i: number) {
  const c = G.char, key = `${f.id}:${i}`;
  if (!c.containers[key]) {
    const items: (Slot | null)[] = Array(10).fill(null);
    for (const [k, n] of lockerLoot(c.world, f, i)) putItems(items, k, n);
    c.containers[key] = { items, gold: 0 };
  }
  return c.containers[key];
}
