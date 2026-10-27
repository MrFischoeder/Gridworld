// (0.266, shared since 0.267) Sky falls: now and then a container comes down out of orbit like a meteor. A player entering
// a new area rolls for it; a hit writes one shared record (Char.skyfalls, gen/skyfall.ts) and from then on every game in
// the place animates the same fall from the game clock: the roar, a burning streak crossing the sky, the flare and the
// boom of the impact. The container lies wrecked 380-820 m from where it was rolled, a column of smoke over it (seen
// from far, hidden behind buildings like the crash site's) and a glow by night, and anyone can search it (one shared
// container). Console `meteor` brings one at once.
import * as THREE from 'three';
import { G } from '../game';
import { scene, camera, lineMat, fillMat, V } from './render';
import { OW, groundAt } from './overworld';
import { play } from './sound';
import { seen } from './weather';
import { addGlows } from './light';
import { makeColumn, stepColumn, placeFar, clearView, dropColumn, WRECK_SMOKE, type Column } from './smokecolumn';
import { viewBlocked } from './smokeview';
import { addBlast } from './fx';
import { FALL, fallSlot, fallCell, fallId, fallRolls, fallSpot, fallFrom, fallLoot, fallGold, fallPath, type SkyFall } from '../gen/skyfall';
import { villageDist } from '../gen/regions';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { putItems } from '../inventory';
import type { Container } from '../save';
import { logLine, showToast } from '../ui/hud';
import { bearingTo, point8, fmtDist } from '../ui/compass';
import { TL, tl } from '../i18n';
import { saveChar as persist } from '../character';

const tex = (() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 64;
  const g = cv.getContext('2d')!, r = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  r.addColorStop(0, 'rgba(255,240,200,1)'); r.addColorStop(0.35, 'rgba(255,170,70,0.7)'); r.addColorStop(1, 'rgba(255,100,20,0)');
  g.fillStyle = r; g.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(cv);
})();
const STREAK = 16, streak: THREE.Sprite[] = [];
const streakGroup = new THREE.Group(); streakGroup.visible = false; streakGroup.frustumCulled = false;
for (let i = 0; i < STREAK; i++) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, fog: false, blending: THREE.AdditiveBlending }));
  s.frustumCulled = false; s.renderOrder = 30; streakGroup.add(s); streak.push(s);
}
scene.add(streakGroup);
const SKY_D = 120;
/** Put a sprite at the true direction of a far point, but SKY_D metres away, so the camera's reach never hides it. */
function project(s: THREE.Sprite, p: { x: number; y: number; z: number }, size: number, op: number) {
  const c = camera.position, d = Math.hypot(p.x - c.x, p.y - c.y, p.z - c.z) || 1;
  s.position.set(c.x + (p.x - c.x) / d * SKY_D, c.y + (p.y - c.y) / d * SKY_D, c.z + (p.z - c.z) / d * SKY_D);
  s.scale.setScalar(size); (s.material as THREE.SpriteMaterial).opacity = op;
}

// the containers lying on the ground (by record id)
interface Crate { id: string; x: number; y: number; z: number; g: THREE.Group; col: Column; seen: boolean }
const crates = new Map<string, Crate>();
let viewT = 0, syncT = 0, lastCell = '';
/** What this game has already played of each fall (id → 1 streak begun, 2 impact flared, 3 boom heard). */
const played = new Map<string, number>();
let flare = 0, flareAt: THREE.Vector3 | null = null;

function crateModel(): THREE.Group {
  const g = new THREE.Group();
  const box = (w: number, h: number, d: number, x: number, y: number, z: number, rz = 0) => {
    const geo = new THREE.BoxGeometry(w, h, d);
    const m = new THREE.Mesh(geo, fillMat(0x1a0d04)); m.position.set(x, y, z); m.rotation.z = rz;
    const l = new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(0xffb060)); l.position.copy(m.position); l.rotation.copy(m.rotation);
    g.add(m, l);
  };
  box(2.6, 1.5, 1.5, 0, 0.55, 0, 0.14); // the shipping container, tilted in its crater
  box(0.5, 0.3, 1.6, -1.1, 1.35, 0); // buckled lid
  // a ring of thrown earth
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i < 28; i++) { const a = i / 28 * 6.283, b = (i + 1) / 28 * 6.283, r = 5 + Math.sin(i * 2.3) * 0.8; pts.push(V(Math.cos(a) * r, 0.1, Math.sin(a) * r), V(Math.cos(b) * r, 0.1, Math.sin(b) * r)); }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0xb07040)));
  return g;
}

function dropCrate(id: string) {
  const c = crates.get(id); if (!c) return;
  scene.remove(c.g); dropColumn(c.col); crates.delete(id);
}
function showCrate(r: SkyFall) {
  const y = groundAt(r.x, r.z);
  if (!Number.isFinite(y)) return;
  const g = crateModel(); g.position.set(r.x, y, r.z); g.rotation.y = (r.x * 7.1 + r.z * 3.3) % 6.28;
  const col = makeColumn(WRECK_SMOKE); scene.add(g, col.g);
  crates.set(r.id, { id: r.id, x: r.x, y, z: r.z, g, col, seen: true });
}

const boxId = (r: SkyFall) => 'fall:' + r.id;
function containerFor(r: SkyFall): Container {
  const w = G.char.world, id = boxId(r);
  if (!G.char.containers[id]) {
    const items: (Container['items'][number])[] = Array(12).fill(null);
    for (const [k, n] of fallLoot(w, r.slot)) putItems(items, k as never, n);
    G.char.containers[id] = { items, gold: fallGold(w, r.slot) };
  }
  return G.char.containers[id];
}

const bearingText = (x: number, z: number) => point8(bearingTo(x, z));
const landsOn = (r: SkyFall) => { const y = groundAt(r.x, r.z); return new THREE.Vector3(r.x, Number.isFinite(y) ? y : G.pos.y, r.z); };

/** Write a fall for everyone: rolled near the player (or, from the console, forced and closer). Returns why not, or ''. */
export function startFall(force = false): string {
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain) return tl('A fall needs the open sky and no other one in flight.');
  if (Object.values(c.skyfalls).some((r) => c.time - r.t < FALL.secs + 4)) return tl('A fall needs the open sky and no other one in flight.');
  const slot = force ? 100000 + Math.floor(c.time) : fallSlot(c.time), w = c.world;
  let spot: { x: number; z: number } | null = null;
  for (let k = 0; k < 14 && !spot; k++) {
    const p = force ? fallSpot(w, slot, G.pos.x, G.pos.z, k, 200, 420) : fallSpot(w, slot, G.pos.x, G.pos.z, k);
    const y = groundAt(p.x, p.z);
    if (!Number.isFinite(y) || OW.terrain.water(p.x, p.z) || villageDist(w, p.x, p.z, 160) < Infinity) continue;
    if (Math.abs(groundAt(p.x + 8, p.z) - y) > 3.5 || Math.abs(groundAt(p.x, p.z + 8) - y) > 3.5) continue;
    spot = p;
  }
  if (!spot) return tl('No clear ground for it to fall on here.');
  const id = force ? 'sky:dev:' + Math.floor(c.time) : fallId(slot);
  c.skyfalls[id] = { id, slot, x: Math.round(spot.x), z: Math.round(spot.z), t: c.time, by: c.pid };
  persist();
  return '';
}

/** Entering a new area: maybe a fall begins (once a slot, whoever rolls it first). */
function roll() {
  const c = G.char, cell = fallCell(G.pos.x, G.pos.z);
  if (cell === lastCell) return;
  const first = lastCell === ''; lastCell = cell;
  if (first || !G.playing || G.intro || c.skyfalls[fallId(fallSlot(c.time))]) return;
  if (fallRolls(Math.random())) startFall();
}

function expire() {
  const c = G.char;
  for (const r of Object.values(c.skyfalls)) if (c.time - r.t > FALL.life) { delete c.skyfalls[r.id]; delete c.containers[boxId(r)]; dropCrate(r.id); played.delete(r.id); persist(); }
  for (const id of [...crates.keys()]) if (!c.skyfalls[id]) dropCrate(id);
}

/** Every frame on the surface. */
export function updateSkyFall(dt: number) {
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain) { streakGroup.visible = false; lastCell = ''; for (const id of [...crates.keys()]) dropCrate(id); return; }
  if ((syncT -= dt) <= 0) {
    syncT = 1; roll(); expire();
    for (const r of Object.values(c.skyfalls)) {
      const near = Math.hypot(r.x - G.pos.x, r.z - G.pos.z) < 2600;
      if (c.time - r.t >= FALL.secs && near && !crates.has(r.id)) showCrate(r);
    }
  }
  // the streak and the impact of the fall in flight (or just landed), the same for everyone from the shared clock
  let flying: SkyFall | null = null;
  for (const r of Object.values(c.skyfalls)) {
    const e = c.time - r.t;
    if (e < -1 || e > FALL.secs + 8) continue;
    if (Math.hypot(r.x - G.pos.x, r.z - G.pos.z) > FALL.hear) continue;
    const st = played.get(r.id) ?? 0, to = landsOn(r);
    if (st < 1 && e < FALL.secs) {
      played.set(r.id, 1);
      play('thunder', { vol: 0.7, rate: 0.45 });
      showToast(tl('A roar from above: something is coming down.'));
    }
    if (e >= FALL.secs && st < 2) {
      played.set(r.id, 2);
      addBlast(to.clone(), 10, 0xffa040, to.y);
      seen.flash = Math.max(seen.flash, 0.7);
      flare = 1.4; flareAt = to;
      const d = Math.hypot(r.x - G.pos.x, r.z - G.pos.z);
      logLine(TL`Something heavy fell from orbit, ${fmtDist(d)} to the ${bearingText(r.x, r.z)}. Follow the smoke.`);
    }
    if (e >= FALL.secs && (played.get(r.id) ?? 0) < 3) {
      const d = Math.hypot(r.x - G.pos.x, r.z - G.pos.z);
      if (e - FALL.secs >= Math.min(FALL.lag, d / FALL.sound)) { played.set(r.id, 3); play('impact', { at: to, vol: 1, far: 3000 }); }
    }
    if (e >= 0 && e < FALL.secs) flying = r;
  }
  if (flying) {
    const to = landsOn(flying), from = fallFrom(c.world, flying.slot), u = Math.min(1, (c.time - flying.t) / FALL.secs);
    streakGroup.visible = true;
    for (let i = 0; i < STREAK; i++) {
      streak[i].visible = true;
      project(streak[i], fallPath(to, from, Math.max(0, u - i * 0.006)), (i === 0 ? 7 : 5.5) * (1 - i / STREAK), (0.4 + 0.6 * u) * (1 - i / STREAK));
    }
  } else if (flare > 0 && flareAt) {
    flare -= dt; streakGroup.visible = flare > 0;
    for (let i = 1; i < STREAK; i++) streak[i].visible = false;
    project(streak[0], flareAt, 18 * Math.max(0, flare / 1.4), Math.max(0, flare / 1.4));
  } else streakGroup.visible = false;
  if (crates.size) {
    const refresh = (viewT -= dt) <= 0; if (refresh) viewT = 0.5;
    const day = Math.max(0.2, Math.min(1, daylight(c.time, sunTilt(latitude(G.pos.z))) * 1.6)), edge = Math.min(camera.far * 0.9, 130);
    for (const cr of crates.values()) {
      if (refresh) cr.seen = clearView(camera.position, cr.x, cr.y, cr.z, 12, (x, z) => OW.terrain!.heightAt(x, z), viewBlocked);
      const kk = placeFar(cr.col, cr.x, cr.y + 1.5, cr.z, camera, edge);
      cr.g.visible = Math.hypot(cr.x - G.pos.x, cr.z - G.pos.z) < 500;
      cr.col.g.visible = kk >= 1 || cr.seen;
      if (cr.col.g.visible) stepColumn(cr.col, dt, Math.cos(seen.windDir) * (0.3 + seen.wind), Math.sin(seen.windDir) * (0.3 + seen.wind), day * (1 - seen.fog * 0.4));
    }
  }
}
addGlows((out) => { for (const c of crates.values()) out.push({ x: c.x, y: c.y + 1, z: c.z, c: 0xff8a30, s: 0.07, a: 0.9, far: 2500 }); });

/** The container within reach, if any. */
function nearest(): Crate | null {
  if (G.char.loc !== 'overworld') return null;
  for (const c of crates.values()) if (Math.hypot(c.x - G.pos.x, c.z - G.pos.z) < FALL.reach + 2 && Math.abs(c.y - G.pos.y) < 3) return c;
  return null;
}
export const nearFall = () => !!nearest();
export function fallBox(): Container | null {
  const n = nearest(), r = n && G.char.skyfalls[n.id];
  return r ? containerFor(r) : null;
}
export function clearSkyFall() { streakGroup.visible = false; lastCell = ''; for (const id of [...crates.keys()]) dropCrate(id); }
export const skyFallDebug = () => ({ crates: crates.size, falls: Object.keys(G.char.skyfalls).length });
