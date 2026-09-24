// Every village's power plant (gen/town.ts): a diesel generator, a solar array or wind turbines standing outside
// the fence, cabled in on poles. It wears down; its status light shows how it runs (pale green, gold when failing,
// red when down), the turbines stop turning and the village lamps go dark when it is down. E at it mends it with
// the right parts, and the village pays you for the job.
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { add } from './render';
import { hash } from '../core/rng';
import { ITEMS, type ItemKey } from '../data/items';
import { count } from '../data/crafting';
import { saveChar, gainXp, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { POWER, POWER_DOWN, POWER_LOW, powerKind, powerSite, powerCondition, lastFix, type PowerKind } from '../gen/town';
import { raidHurt } from '../gen/raids';
import { findPoi } from '../gen/regions';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, METAL = 0xa8c8b8, PANEL = 0x9dffb4, CABLE = 0x6f8f76;
const LIGHT = { ok: 0x9dffb4, low: 0xffd060, down: 0xff5a3c };
export interface Plant {
  id: number; seed: number; kind: PowerKind; name: string; town: string;
  /** The site (world rect) and its middle. */
  x0: number; z0: number; x1: number; z1: number; cx: number; cz: number;
  light: THREE.LineSegments; rotors: THREE.Object3D[]; lamps: THREE.Object3D[];
}
const plants = new Map<number, Plant>();

/** Draw the plant of village `vm` (id `id`) and remember it; returns its group (added to the village's). */
export function drawPower(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const kind = powerKind(vm.seed), site = powerSite(vm.seed), grp = new THREE.Group(), pb = new PropBatch();
  const x0 = vm.ox + site.x - site.w / 2, z0 = vm.oz + site.z - site.d / 2, x1 = x0 + site.w, z1 = z0 + site.d, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const [fx, fz] = site.face, rx = -fz, rz = fx; // out from the fence, and along it
  const P = (u: number, v: number) => [cx + rx * u + fx * v, cz + rz * u + fz * v] as const; // u along the fence, v outwards
  const ground = (x: number, z: number) => T.heightAt(x, z);
  const box = (u: number, v: number, hw: number, hd: number, y0: number, y1: number, c: number) => {
    const [x, z] = P(u, v), ax = Math.abs(rx) * hw + Math.abs(fx) * hd, az = Math.abs(rz) * hw + Math.abs(fz) * hd;
    pb.box(x - ax, y0, z - az, x + ax, y1, z + az, c);
  };
  const rotors: THREE.Object3D[] = [];
  let lightAt: [number, number, number];
  if (kind === 'generator') {
    const g = ground(cx, cz);
    box(0, 0, 3.4, 2.4, g - 0.3, g + 0.15, METAL);                    // concrete pad
    box(-0.6, 0, 2.2, 1.5, g + 0.15, g + 2.5, METAL);                 // engine house
    const [a0, b0] = P(-2.8, -1.5), [a1, b1] = P(1.6, 1.5);
    pb.gableRoof(Math.min(a0, a1), Math.min(b0, b1), Math.max(a0, a1), Math.max(b0, b1), g + 2.5, 0.7, METAL);
    for (let k = -1.2; k <= 1.21; k += 0.4) { const [a, b] = P(-2.4, k), [c, d] = P(-2.4 + 0.01, k); pb.seg(METAL, [a, g + 0.8, b], [c, g + 1.9, d]); } // louvres
    box(2.6, 0.2, 1.1, 0.55, g + 0.15, g + 1.3, METAL);               // fuel tank on its saddles
    box(2.6, 0.2, 0.35, 0.35, g + 1.3, g + 1.5, METAL);
    const [sx, sz] = P(0.9, -1.0); pb.box(sx - 0.14, g + 2.3, sz - 0.14, sx + 0.14, g + 4.6, sz + 0.14, METAL); // exhaust stack
    pb.box(sx - 0.22, g + 4.6, sz - 0.22, sx + 0.22, g + 4.75, sz + 0.22, METAL);
    const [lx, lz] = P(-0.6, 1.55); lightAt = [lx, g + 2.1, lz];
  } else if (kind === 'solar') {
    for (const v of [-2.2, 1.8]) for (let u = -5; u <= 5.01; u += 2.5) {
      const [x, z] = P(u, v), h = ground(x, z), tilt = 0.55;
      // two posts and a panel leaning back from the fence
      for (const du of [-0.9, 0.9]) { const [a, b] = P(u + du, v); pb.box(a - 0.06, h, b - 0.06, a + 0.06, h + 1.2, b + 0.06, METAL); }
      const c = (du: number, dv: number, dy: number) => { const [a, b] = P(u + du, v + dv); return [a, h + dy, b]; };
      const lo = [c(-1.1, 0.55, 0.75), c(1.1, 0.55, 0.75), c(1.1, 0.55 - 0.04, 0.8), c(-1.1, 0.55 - 0.04, 0.8)];
      const hi = [c(-1.1, -0.55, 0.75 + 1.1 * tilt * 2), c(1.1, -0.55, 0.75 + 1.1 * tilt * 2), c(1.1, -0.59, 0.8 + 1.1 * tilt * 2), c(-1.1, -0.59, 0.8 + 1.1 * tilt * 2)];
      pb.face(lo[0], lo[1], hi[1], hi[0]); pb.face(lo[3], hi[3], hi[2], lo[2]);
      for (let i = 0; i <= 4; i++) { const t = i / 4; pb.seg(PANEL, lerp3(lo[0], lo[1], t), lerp3(hi[0], hi[1], t)); }
      for (let i = 0; i <= 3; i++) { const t = i / 3; pb.seg(PANEL, lerp3(lo[0], hi[0], t), lerp3(lo[1], hi[1], t)); }
    }
    const [ix, iz] = P(0, -3.8), g = ground(ix, iz);
    pb.box(ix - 0.6, g, iz - 0.4, ix + 0.6, g + 1.5, iz + 0.4, METAL);  // inverter cabinet
    lightAt = [ix, g + 1.65, iz];
  } else {
    for (const u of [-3.6, 3.6]) {
      const [x, z] = P(u, 0.5), h = ground(x, z), top = h + 12;
      const legs = [[-1.1, -1.1], [1.1, -1.1], [1.1, 1.1], [-1.1, 1.1]], nar = 0.25;
      const L = (i: number, t: number) => [x + legs[i][0] * (1 - t * (1 - nar)), h + t * 12, z + legs[i][1] * (1 - t * (1 - nar))];
      for (let i = 0; i < 4; i++) {
        pb.seg(METAL, L(i, 0), L(i, 1));
        for (let s = 0; s < 4; s++) { const a = s / 4, b = (s + 1) / 4; pb.seg(METAL, L(i, a), L((i + 1) % 4, b)); pb.seg(METAL, L((i + 1) % 4, a), L(i, b)); }
      }
      pb.box(x - 0.45, top, z - 0.45, x + 0.45, top + 0.8, z + 0.45, METAL); // nacelle
      // the rotor: a hub and three blades, turning about the outward axis (drawn in its own group so it can spin)
      const rb = new PropBatch(), hub = 0.25;
      rb.box(-hub, -hub, -0.2, hub, hub, 0.2, METAL);
      for (let b = 0; b < 3; b++) {
        const a = b * Math.PI * 2 / 3, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
        const pts = [[0.3, 0.18], [4.2, 0.12], [4.3, -0.02], [0.3, -0.1]].map(([r, w]) => [ca * r + px * w, sa * r + py * w]);
        rb.solid8(pts.map(([p, q]) => [p, q, -0.03]), pts.map(([p, q]) => [p, q, 0.03]), PANEL);
      }
      const rotor = rb.build(), [hx, hz] = [x + fx * 0.65, z + fz * 0.65];
      rotor.position.set(hx, top + 0.4, hz); rotor.rotation.y = Math.atan2(fx, fz);
      const spin = new THREE.Group(); spin.add(rotor); grp.add(spin); rotors.push(rotor);
    }
    const [lx, lz] = P(0, -2.2), g = ground(lx, lz);
    pb.box(lx - 0.5, g, lz - 0.35, lx + 0.5, g + 1.3, lz + 0.35, METAL);
    lightAt = [lx, g + 1.45, lz];
  }
  // the cable in: poles from the plant to the fence
  const [ex, ez] = P(0, -site.w / 2 - 0.5);
  let prev: number[] | null = null;
  for (let v = -3; v >= -17; v -= 7) {
    const [px, pz] = P(site.side === 'S' ? 4 : 4, v), h = ground(px, pz);
    pb.box(px - 0.08, h, pz - 0.08, px + 0.08, h + 4.2, pz + 0.08, WOOD);
    pb.box(px - 0.5 * Math.abs(rx) - 0.05, h + 3.9, pz - 0.5 * Math.abs(rz) - 0.05, px + 0.5 * Math.abs(rx) + 0.05, h + 4.0, pz + 0.5 * Math.abs(rz) + 0.05, WOOD);
    const top = [px, h + 4, pz];
    if (prev) { const mid = [(prev[0] + top[0]) / 2, (prev[1] + top[1]) / 2 - 0.35, (prev[2] + top[2]) / 2]; pb.line(CABLE, prev, mid, top); }
    prev = top;
  }
  void ex; void ez;
  grp.add(pb.build());
  const light = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.18)), add(LIGHT.ok));
  light.position.set(...lightAt); grp.add(light);
  const lamps: THREE.Object3D[] = [];
  plants.set(id, { id, seed: vm.seed, kind, name: POWER[kind].name, town: vm.name, x0, z0, x1, z1, cx, cz, light, rotors, lamps });
  return grp;
}
const lerp3 = (a: number[], b: number[], t: number) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
/** The village lamps a plant feeds (they go dark when it is down). */
export function setPlantLamps(id: number, lamps: THREE.Object3D[]) { const p = plants.get(id); if (p) p.lamps = lamps; }
export function forgetPower(id: number) { plants.delete(id); }
export const plantOf = (id: number) => plants.get(id);

/** The plant's condition now: its wear, the damage raids fought here did, and the raids it lost while you were away. */
export function plantCondition(id: number, seed: number): number {
  const c = G.char, s = c.towns[id], poi = findPoi(c.world, id);
  return powerCondition(seed, s, c.time, poi ? raidHurt(c.world, poi, s, lastFix(seed, s), c.time) : 0);
}
const cond = (p: Plant) => plantCondition(p.id, p.seed);
/** Once a frame: turbines turn, status lights and village lamps follow the plant's condition. */
export function updatePower(dt: number) {
  for (const p of plants.values()) {
    const c = cond(p), up = c >= POWER_DOWN;
    for (const r of p.rotors) r.rotateZ(dt * (up ? 1.2 + 0.4 * Math.sin(hash(p.id) + G.char.time * 0.01) : 0));
    ((p.light.material as THREE.LineBasicMaterial).color).setHex(!up ? LIGHT.down : c < POWER_LOW ? LIGHT.low : LIGHT.ok);
    p.light.visible = up || Math.sin(performance.now() / 180) > 0; // a dead plant's light blinks red
    for (const l of p.lamps) l.visible = up;
  }
}
/** The plant you stand at (within a couple of metres of its site). */
export function nearPower(): Plant | null {
  if (G.char.loc !== 'overworld') return null;
  for (const p of plants.values()) {
    const d = Math.hypot(Math.max(p.x0 - G.pos.x, 0, G.pos.x - p.x1), Math.max(p.z0 - G.pos.z, 0, G.pos.z - p.z1));
    if (d < 3) return p;
  }
  return null;
}
const needText = (k: PowerKind) => POWER[k].fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ');
const hasAll = (k: PowerKind) => POWER[k].fix.every(([i, n]) => count(G.char.inv, i) >= n);
export function powerPrompt(p: Plant): string {
  const c = Math.round(cond(p));
  if (c >= 90) return `${p.town}'s ${p.name}: running well (${c}%)`;
  const state = c < POWER_DOWN ? 'DOWN' : c < POWER_LOW ? 'failing' : 'worn';
  return hasAll(p.kind) ? `E — mend the ${p.name} (${state}, ${c}%): uses ${needText(p.kind)}` : `${p.name} ${state} (${c}%) — to mend it bring ${needText(p.kind)}`;
}
/** Mend the plant with the parts from your backpack; the village pays you. */
export function repairPower(p: Plant) {
  const c = cond(p);
  if (c >= 90) { logLine(`The ${p.name} runs fine.`); return; }
  if (!hasAll(p.kind)) { logLine(`To mend the ${p.name} you need ${needText(p.kind)}.`); return; }
  for (const [k, n] of POWER[p.kind].fix) take(k, n);
  const t = (G.char.towns[p.id] ??= {});
  t.fixed = G.char.time; t.hurt = 0;
  const pay = Math.round(POWER[p.kind].pay * (c < POWER_DOWN ? 1.5 : 1));
  G.char.gold += pay; calcStats(); gainXp(c < POWER_DOWN ? 40 : 25); saveChar();
  showToast(`${p.name} mended`);
  logLine(`${p.town} has power ${c < POWER_DOWN ? 'again' : 'to spare'}. The villagers pay you ${pay} gold.`);
}
function take(k: ItemKey, n: number) {
  const inv = G.char.inv;
  for (let i = 0; i < inv.length && n > 0; i++) { const s = inv[i]; if (s?.k === k) { const m = Math.min(n, s.n); s.n -= m; n -= m; if (s.n <= 0) inv[i] = null; } }
}
