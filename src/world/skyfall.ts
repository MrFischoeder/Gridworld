// (0.266) Sky falls: now and then a container comes down out of orbit like a meteor. The boom is heard, a burning streak
// crosses the sky for a few seconds, and the container lies wrecked somewhere 400-800 m from where you stood, a column of
// smoke over it (seen from far, hidden behind buildings like the crash site's) and a glow by night. E at it opens the
// crate. The schedule is the game clock's (gen/skyfall.ts), so every player hears the same boom; each has their own
// container, drawn and opened only on their own game. Console `meteor` brings one at once.
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
import { FALL, fallSlot, fallIn, fallSpot, fallFrom, fallLoot, fallGold, fallPath } from '../gen/skyfall';
import { villageDist } from '../gen/regions';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { putItems } from '../inventory';
import type { Container } from '../save';
import { logLine, showToast } from '../ui/hud';
import { bearingTo, point8, fmtDist } from '../ui/compass';
import { TL, tl } from '../i18n';
import { saveChar as persist } from '../character';

interface Live { t: number; to: THREE.Vector3; from: number; booms: boolean; slot: number; bang: number }
let live: Live | null = null;

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

// the container lying on the ground
interface Crate { id: string; x: number; y: number; z: number; g: THREE.Group; col: Column; seen: boolean }
let crate: Crate | null = null;
let viewT = 0, syncT = 0;

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

function dropCrate() {
  if (!crate) return;
  scene.remove(crate.g); dropColumn(crate.col); crate = null;
}
function showCrate(c: NonNullable<NonNullable<typeof G.char.fall>['crate']>) {
  const y = groundAt(c.x, c.z);
  if (!Number.isFinite(y)) return;
  const g = crateModel(); g.position.set(c.x, y, c.z); g.rotation.y = (c.x * 7.1 + c.z * 3.3) % 6.28;
  const col = makeColumn(WRECK_SMOKE); scene.add(g, col.g);
  crate = { id: c.id, x: c.x, y, z: c.z, g, col, seen: true };
}

function containerFor(slot: number, id: string): Container {
  const w = G.char.world;
  if (!G.char.containers[id]) {
    const items: (Container['items'][number])[] = Array(12).fill(null);
    for (const [k, n] of fallLoot(w, slot)) putItems(items, k as never, n);
    G.char.containers[id] = { items, gold: fallGold(w, slot) };
  }
  return G.char.containers[id];
}

/** Begin a fall for the player where they stand. `force` (console) ignores the schedule and lands it nearer. */
export function startFall(force = false): string {
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain || live) return tl('A fall needs the open sky and no other one in flight.');
  const slot = fallSlot(c.time), w = c.world;
  let spot: { x: number; z: number } | null = null;
  for (let k = 0; k < 14 && !spot; k++) {
    const p = force ? fallSpot(w, slot + 1000, G.pos.x, G.pos.z, k, 200, 420) : fallSpot(w, slot, G.pos.x, G.pos.z, k);
    const y = groundAt(p.x, p.z);
    if (!Number.isFinite(y) || OW.terrain.water(p.x, p.z) || villageDist(w, p.x, p.z, 160) < Infinity) continue;
    if (Math.abs(groundAt(p.x + 8, p.z) - y) > 3.5 || Math.abs(groundAt(p.x, p.z + 8) - y) > 3.5) continue;
    spot = p;
  }
  if (!spot) return tl('No clear ground for it to fall on here.');
  const y = groundAt(spot.x, spot.z);
  live = { t: 0, to: new THREE.Vector3(spot.x, y, spot.z), from: fallFrom(w, slot), booms: false, slot: force ? slot + 1000 : slot, bang: -1 };
  streakGroup.visible = true;
  play('thunder', { vol: 0.7, rate: 0.45 });
  showToast(tl('A roar from above: something is coming down.'));
  return '';
}

const bearingText = (x: number, z: number) => point8(bearingTo(x, z));

function land() {
  const L = live!, c = G.char;
  const id = 'fall:' + L.slot + ':' + (c.pid ?? 'me');
  if (c.fall?.crate) delete c.containers[c.fall.crate.id];
  c.fall = { slot: c.fall?.slot ?? fallSlot(c.time), crate: { id, x: Math.round(L.to.x), z: Math.round(L.to.z), t: c.time } };
  containerFor(L.slot, id);
  persist();
  addBlast(L.to.clone(), 10, 0xffa040, L.to.y);
  seen.flash = Math.max(seen.flash, 0.7);
  const d = Math.hypot(L.to.x - G.pos.x, L.to.z - G.pos.z);
  L.bang = Math.min(FALL.lag, d / FALL.sound);
  L.booms = true;
  dropCrate(); showCrate(c.fall.crate!);
  logLine(TL`Something heavy fell from orbit, ${fmtDist(d)} to the ${bearingText(L.to.x, L.to.z)}. Follow the smoke.`);
}

/** Every frame on the surface. */
let frames = 0;
export function updateSkyFall(dt: number) {
  frames++;
  const c = G.char;
  if (c.loc !== 'overworld' || !OW.terrain) { if (live || crate) { live = null; streakGroup.visible = false; dropCrate(); } return; }
  // the schedule: once a second, the slot's fall when its minute has come
  if ((syncT -= dt) <= 0) {
    syncT = 1;
    const slot = fallSlot(c.time), f = fallIn(c.world, slot);
    if (!live && (c.fall?.slot ?? -1) < slot && c.time >= f.at && G.playing && !G.intro) {
      c.fall = { ...c.fall, slot };
      if (f.go && c.time < f.at + 30 && !c.fall.crate) startFall();
      persist();
    }
    const cr = c.fall?.crate;
    if (cr && c.time - cr.t > FALL.life) { delete c.containers[cr.id]; delete c.fall!.crate; dropCrate(); persist(); }
    else if (cr && !crate && Math.hypot(cr.x - G.pos.x, cr.z - G.pos.z) < 2600) showCrate(cr);
    else if (!cr && crate) dropCrate();
  }
  if (live) {
    live.t += dt;
    const u = Math.min(1, live.t / FALL.secs);
    if (live.t < FALL.secs) {
      for (let i = 0; i < STREAK; i++) {
        const p = fallPath(live.to, live.from, Math.max(0, u - i * 0.006));
        project(streak[i], p, (i === 0 ? 7 : 5.5) * (1 - i / STREAK), (0.4 + 0.6 * u) * (1 - i / STREAK));
      }
    } else if (!live.booms) land();
    if (live.booms) {
      const k = live.t - FALL.secs;
      // the flare of the impact, projected to its true direction, then the boom when the sound arrives
      project(streak[0], live.to, 18 * Math.max(0, 1 - k / 1.4), Math.max(0, 1 - k / 1.4));
      for (let i = 1; i < STREAK; i++) streak[i].visible = false;
      if (live.bang >= 0 && k >= live.bang) { live.bang = -1; play('impact', { at: live.to, vol: 1, far: 3000 }); }
      if (k > 1.6 && live.bang < 0) { live = null; streakGroup.visible = false; for (const s of streak) s.visible = true; }
    }
  }
  if (crate) {
    const k = c.fall?.crate;
    if (k && (viewT -= dt) <= 0) {
      viewT = 0.5;
      crate.seen = clearView(camera.position, crate.x, crate.y, crate.z, 12, (x, z) => OW.terrain!.heightAt(x, z), viewBlocked);
    }
    const day = Math.max(0.2, Math.min(1, daylight(c.time, sunTilt(latitude(crate.z))) * 1.6)), edge = Math.min(camera.far * 0.9, 130);
    const kk = placeFar(crate.col, crate.x, crate.y + 1.5, crate.z, camera, edge);
    crate.g.visible = Math.hypot(crate.x - G.pos.x, crate.z - G.pos.z) < 500;
    crate.col.g.visible = kk >= 1 || crate.seen;
    if (crate.col.g.visible) stepColumn(crate.col, dt, Math.cos(seen.windDir) * (0.3 + seen.wind), Math.sin(seen.windDir) * (0.3 + seen.wind), day * (1 - seen.fog * 0.4));
  }
}
addGlows((out) => { if (crate) out.push({ x: crate.x, y: crate.y + 1, z: crate.z, c: 0xff8a30, s: 0.07, a: 0.9, far: 2500 }); });

/** The container within reach, if any. */
export function nearFall(): boolean {
  return !!crate && G.char.loc === 'overworld' && Math.hypot(crate.x - G.pos.x, crate.z - G.pos.z) < FALL.reach + 2 && Math.abs(crate.y - G.pos.y) < 3;
}
export function fallBox(): Container | null {
  const cr = G.char.fall?.crate;
  if (!cr) return null;
  return G.char.containers[cr.id] ?? containerFor(Number(cr.id.split(':')[1]), cr.id);
}
export function clearSkyFall() { live = null; streakGroup.visible = false; dropCrate(); }
export const skyFallDebug = () => ({ t: live?.t ?? null, crate: !!crate, booms: live?.booms ?? null, frames });
