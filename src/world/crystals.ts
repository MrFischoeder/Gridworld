// (0.222) The crystal forests in the world (gen/crystals.ts): every field within sight is drawn as one group at its
// middle (small local vertices): six- or five-sided columns rising from below the ground, each with its prism
// faces, a pointed tip and faint inner facet lines, filled with a dark tint of its colour so it hides what stands
// behind it. The lines breathe slowly. The tall ones are solid (`crystalHit`: the player, the foes, vehicles), and
// at night the biggest give a soft light round them and a glow seen from afar.
import * as THREE from 'three';
import { scene, lineMat, fillMat } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { crystalFieldsNear, fieldCrystals, CRYSTAL_HUES, CRYSTAL_SOLID, type CrystalField } from '../gen/crystals';
import { nearX, worldDist, latitude } from '../gen/regions';
import { daylight, sunTilt } from '../core/time';
import { addLights, addGlows } from './light';
import { TL } from '../i18n';
import { rayRod, type V3 } from '../gen/cover';

const NEAR = 900, DROP = 1100;
/** A solid crystal in world coordinates (on the drawn copy of the planet): root, direction, length, radius. */
interface Solid { x: number; y: number; z: number; d: [number, number, number]; len: number; w: number }
interface Live { f: CrystalField; g: THREE.Group; ox: number; line: THREE.LineBasicMaterial; inner: THREE.LineBasicMaterial; glow: THREE.LineSegments; solids: Solid[]; lights: [number, number, number][]; base: THREE.Color }
const live = new Map<string, Live>();
const fills = new Map<number, THREE.MeshBasicMaterial>();
let tick = 0, time = 0;

function build(f: CrystalField): Live {
  const T = OW.terrain!, ox = nearX(f.x, G.pos.x), y0 = T.heightAt(ox, f.z), [lc, ic] = CRYSTAL_HUES[f.hue];
  const tri: number[] = [], seg: number[] = [], inn: number[] = [], solids: Solid[] = [];
  const all = fieldCrystals(f);
  for (const c of all) {
    const wx = ox + c.dx, wz = f.z + c.dz, gy = T.heightAt(wx, wz) - y0, [dx, dy, dz] = c.d;
    const b = [c.dx, gy - 0.25 - c.w * 0.6, c.dz]; // root a little under the ground
    if (c.len >= CRYSTAL_SOLID) solids.push({ x: wx, y: y0 + b[1], z: wz, d: c.d, len: c.len, w: c.w });
    // two axes across the crystal
    const ux = Math.abs(dy) > 0.9 ? [1, 0, 0] : [0, 1, 0];
    let e1 = [dy * ux[2] - dz * ux[1], dz * ux[0] - dx * ux[2], dx * ux[1] - dy * ux[0]];
    const l1 = Math.hypot(e1[0], e1[1], e1[2]); e1 = e1.map((v) => v / l1);
    const e2 = [dy * e1[2] - dz * e1[1], dz * e1[0] - dx * e1[2], dx * e1[1] - dy * e1[0]];
    const ring = (t: number, r: number) => Array.from({ length: c.sides }, (_, s) => {
      const q = c.rot + (s / c.sides) * 6.283, cq = Math.cos(q) * r, sq = Math.sin(q) * r;
      return [b[0] + dx * t + e1[0] * cq + e2[0] * sq, b[1] + dy * t + e1[1] * cq + e2[1] * sq, b[2] + dz * t + e1[2] * cq + e2[2] * sq];
    });
    const shaft = c.len * (0.74 + ((c.rot * 7) % 1) * 0.1), lo = ring(0, c.w), hi = ring(shaft, c.w * 0.92);
    const tip = [b[0] + dx * c.len, b[1] + dy * c.len, b[2] + dz * c.len];
    const S = (arr: number[], p: number[], q: number[]) => arr.push(p[0], p[1], p[2], q[0], q[1], q[2]);
    for (let s = 0; s < c.sides; s++) {
      const s1 = (s + 1) % c.sides;
      tri.push(...lo[s], ...lo[s1], ...hi[s1], ...lo[s], ...hi[s1], ...hi[s], ...hi[s], ...hi[s1], ...tip);
      S(seg, lo[s], hi[s]); S(seg, hi[s], hi[s1]); S(seg, hi[s], tip);
      if (c.len > 4) { // facet lines: a stripe up each face and a band, the shimmer inside the glass
        const m0 = lo[s].map((v, k) => (v + lo[s1][k]) / 2), m1 = hi[s].map((v, k) => (v + hi[s1][k]) / 2);
        const a = m0.map((v, k) => v + (m1[k] - v) * 0.15), z = m0.map((v, k) => v + (m1[k] - v) * (0.55 + (s % 3) * 0.12));
        S(inn, a, z);
        const band = ring(shaft * (0.35 + ((c.rot * 13) % 1) * 0.3), c.w * 1.003);
        S(inn, band[s], band[s1]);
      }
    }
  }
  const g = new THREE.Group();
  const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
  let fm = fills.get(f.hue);
  if (!fm) { const col = new THREE.Color(lc).multiplyScalar(0.07); fills.set(f.hue, (fm = fillMat(col.getHex()))); }
  g.add(new THREE.Mesh(fg, fm));
  const line = lineMat(lc), inner = lineMat(ic);
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(seg, 3)); g.add(new THREE.LineSegments(lg, line));
  const ig = new THREE.BufferGeometry(); ig.setAttribute('position', new THREE.Float32BufferAttribute(inn, 3)); g.add(new THREE.LineSegments(ig, inner));
  // by night the edges glow (fog-free, added light): the crystals shine in the dark
  const gm = new THREE.LineBasicMaterial({ color: lc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const glow = new THREE.LineSegments(lg, gm); glow.visible = false; g.add(glow);
  g.position.set(ox, y0, f.z); scene.add(g);
  // the biggest give light at night
  const lights = [...solids].sort((p, q) => q.len - p.len).slice(0, 3).map((s): [number, number, number] => [s.x + s.d[0] * s.len * 0.45, s.y + s.d[1] * s.len * 0.45, s.z + s.d[2] * s.len * 0.45]);
  return { f, g, ox, line, inner, glow, solids, lights, base: new THREE.Color(lc) };
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); L.line.dispose(); L.inner.dispose(); (L.glow.material as THREE.Material).dispose(); }
export function dropCrystals() { for (const L of live.values()) drop(L); live.clear(); }

/** Main loop: the fields within sight drawn (checked twice a second), their lines breathing. */
export function updateCrystals(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { if (live.size) dropCrystals(); return; }
  time += dt;
  const night = 1 - daylight(G.char.time, sunTilt(latitude(G.pos.z)));
  for (const L of live.values()) {
    const k = 0.78 + 0.22 * Math.sin(time * 0.6 + L.f.seed % 7);
    L.line.color.copy(L.base).multiplyScalar(k);
    const m = L.glow.material as THREE.LineBasicMaterial;
    L.glow.visible = night > 0.3; m.opacity = Math.max(0, night - 0.3) * 0.75 * k;
  }
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const seen = new Set<string>();
  for (const f of crystalFieldsNear(T.world, G.pos.x, G.pos.z, DROP)) {
    if (!live.has(f.id) && worldDist(f.x, f.z, G.pos.x, G.pos.z) > NEAR + f.r) continue;
    seen.add(f.id);
    const L = live.get(f.id);
    if (L && L.ox === nearX(f.x, G.pos.x)) continue;
    if (L) drop(L);
    live.set(f.id, build(f));
  }
  for (const [id, L] of live) if (!seen.has(id)) { drop(L); live.delete(id); }
}
/** A body (feet at y, r wide) runs into a tall crystal: its axis passes within its radius at the knee or the chest. */
export function crystalHit(x: number, y: number, z: number, r: number): boolean {
  for (const L of live.values()) {
    if (Math.abs(x - L.ox) > L.f.r + 40 || Math.abs(z - L.f.z) > L.f.r + 40) continue;
    for (const s of L.solids) {
      if (Math.abs(x - s.x) > s.len + r || Math.abs(z - s.z) > s.len + r) continue;
      for (const h of [y + 0.4, y + 1.3]) {
        const t = (h - s.y) / s.d[1];
        if (t < 0 || t > s.len * 0.9) continue;
        if (Math.hypot(s.x + s.d[0] * t - x, s.z + s.d[2] * t - z) < s.w * 0.92 + r) return true;
      }
    }
  }
  return false;
}
/** (0.224) Where a ray first meets a tall crystal (cover: shots, sight lines and bolts stop there), or maxT. */
export function crystalRay(o: V3, d: V3, maxT: number): number {
  let best = maxT;
  for (const L of live.values()) {
    const mx = o.x + d.x * maxT / 2, mz = o.z + d.z * maxT / 2;
    if (Math.hypot(mx - L.ox, mz - L.f.z) > L.f.r + 40 + maxT / 2) continue;
    for (const s of L.solids) {
      if (Math.abs(mx - s.x) > s.len + maxT / 2 + s.w || Math.abs(mz - s.z) > s.len + maxT / 2 + s.w) continue;
      best = rayRod(o, d, best, s, { x: s.d[0], y: s.d[1], z: s.d[2] }, s.len * 0.9, s.w * 0.92);
    }
  }
  return best;
}
/** The name of the crystal forest you stand in, for the HUD's place name. */
export function crystalName(x: number, z: number): string | null {
  for (const L of live.values()) if (Math.hypot(x - L.ox, z - L.f.z) < L.f.r) return TL`Crystal forest: ${L.f.name}`;
  return null;
}
addLights((out) => {
  if (G.char.loc !== 'overworld') return;
  for (const L of live.values()) if (Math.hypot(G.pos.x - L.ox, G.pos.z - L.f.z) < L.f.r + 120) for (const [x, y, z] of L.lights) out.push({ x, y, z, r: 12, k: 'electric' });
});
addGlows((out) => {
  if (G.char.loc !== 'overworld') return;
  for (const L of live.values()) for (const [x, y, z] of L.lights.slice(0, 1)) out.push({ x, y, z, c: L.base.getHex(), s: 0.05, a: 0.5 });
});
