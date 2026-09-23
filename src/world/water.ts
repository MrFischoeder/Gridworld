// Water in the open world: lake surfaces, wells, drinking and filling flasks. The shape of the water (and
// what kind it is) comes from gen/water.ts through Terrain.water(); this module draws it and lets you use it.
import * as THREE from 'three';
import { scene, V, GRID, localize } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { lakesIn, shoreR, type Lake, type WaterKind, type Well } from '../gen/water';
import { addItem, takeOne, hasItem, saveChar } from '../character';
import { PropBatch } from './props';
import { SIP } from '../data/survival';
import { nourish } from './survival';
import { logLine, showToast } from '../ui/hud';

/** Line colours of the three kinds of water (toxic glows). */
export const WATER_LINE: Record<WaterKind, number> = { fresh: 0x2ac8b0, murky: 0x8a9a4a, toxic: 0xb6ff3a };
const WATER_FILL: Record<WaterKind, number> = { fresh: 0x02201c, murky: 0x121604, toxic: 0x142402 };
export const WATER_NAME: Record<WaterKind, string> = { fresh: 'clean water', murky: 'murky water', toxic: 'toxic water' };

interface LakeMesh { lake: Lake; group: THREE.Group; a: THREE.LineBasicMaterial; b: THREE.LineBasicMaterial }
const lakes = new Map<number, LakeMesh>();

/**
 * A lake's surface: a translucent sheet at the water level (the bed shows faintly through it) and two sets of
 * parallel ripple lines, 3 m apart, that fade into each other so the water seems to move. The sheet reaches past
 * the widest shore; the land around stands higher and hides whatever is outside the lake.
 */
function buildLake(l: Lake): LakeMesh {
  const group = new THREE.Group(), R = l.r * 1.36, kind = l.kind;
  // the sheet follows the shore (a little past it: the lip of the bank hides the edge)
  const shape = new THREE.Shape();
  for (let i = 0; i <= 64; i++) { const a = i / 64 * 6.283, rr = shoreR(l, a) * 1.1, px = Math.cos(a) * rr, py = -Math.sin(a) * rr; if (i) shape.lineTo(px, py); else shape.moveTo(px, py); }
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color: WATER_FILL[kind], transparent: true, opacity: 0.86, depthWrite: false, side: THREE.DoubleSide }));
  fill.rotation.x = -Math.PI / 2; fill.position.set(l.x, l.level, l.z); group.add(fill);
  const mat = () => new THREE.LineBasicMaterial({ color: WATER_LINE[kind], transparent: true, opacity: 0.5, ...(kind === 'toxic' ? { blending: THREE.AdditiveBlending } : {}) });
  const a = mat(), b = mat();
  for (const [off, m] of [[0, a], [1.5, b]] as const) {
    const pts: number[] = [];
    for (let z = -R + off; z < R; z += 3) {
      // a ripple line across the lake, broken into short dashes that follow the shore
      const zz = l.z + z;
      for (let x = -R; x < R; x += 2.5) {
        const x0 = l.x + x, x1 = x0 + 1.6, a0 = Math.atan2(zz - l.z, x0 - l.x), a1 = Math.atan2(zz - l.z, x1 - l.x);
        if (Math.hypot(x0 - l.x, zz - l.z) > shoreR(l, a0) * 1.02 || Math.hypot(x1 - l.x, zz - l.z) > shoreR(l, a1) * 1.02) continue;
        pts.push(x0, l.level + 0.02, zz, x1, l.level + 0.02, zz);
      }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    group.add(new THREE.LineSegments(g, m));
  }
  // the shore: a line round the water's edge where it meets the land
  const shore: THREE.Vector3[] = [];
  for (let i = 0; i <= 64; i++) { const ang = i / 64 * 6.283, rr = shoreR(l, ang); shore.push(V(l.x + Math.cos(ang) * rr, l.level + 0.03, l.z + Math.sin(ang) * rr)); }
  group.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(shore), new THREE.LineBasicMaterial({ color: WATER_LINE[kind], transparent: true, opacity: 0.75 })));
  localize(group, l.x, l.z);
  scene.add(group);
  return { lake: l, group, a, b };
}
function dropLake(m: LakeMesh) { scene.remove(m.group); m.group.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); const mt = (o as THREE.Mesh).material as THREE.Material | undefined; mt?.dispose(); }); }

/** Load the lakes around (x, z), drop far ones (called when the player crosses a chunk border). */
export function syncLakes(x: number, z: number) {
  const T = OW.terrain;
  if (!T) return;
  for (const l of lakesIn(T, { x0: x - 220, z0: z - 220, x1: x + 220, z1: z + 220 })) if (!lakes.has(l.id) || lakes.get(l.id)!.lake.x !== l.x) {
    const old = lakes.get(l.id); if (old) dropLake(old);
    lakes.set(l.id, buildLake(l));
  }
  for (const [id, m] of lakes) if (Math.hypot(m.lake.x - x, m.lake.z - z) > 340) { dropLake(m); lakes.delete(id); }
}
export function clearLakes() { for (const m of lakes.values()) dropLake(m); lakes.clear(); }
/** Ripples: the two line sets breathe in turn. */
export function animateWater(time: number) {
  for (const m of lakes.values()) { const s = 0.5 + 0.5 * Math.sin(time * 0.9 + m.lake.x * 0.01); m.a.opacity = 0.15 + 0.45 * s; m.b.opacity = 0.6 - 0.45 * s; }
}

// ---------- wells ----------
/** An old stone well: an octagonal wall with dark water inside, two posts, a crossbar and a little roof. */
export function drawWell(pb: PropBatch, w: Well, y: number) {
  const n = 8, r0 = 1.0, r1 = 0.7, h = 0.9;
  const ring = (r: number, yy: number) => Array.from({ length: n }, (_, i) => [w.x + Math.cos(i / n * 6.283) * r, yy, w.z + Math.sin(i / n * 6.283) * r]);
  const ob = ring(r0, y - 0.1), ot = ring(r0, y + h), ib = ring(r1, y + 0.4), it = ring(r1, y + h);
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    pb.face(ob[i], ob[j], ot[j], ot[i]); pb.face(ot[i], ot[j], it[j], it[i]); pb.face(ib[j], ib[i], it[i], it[j]);
    pb.seg(GRID, ob[i], ot[i]); pb.seg(GRID, ot[i], ot[j]); pb.seg(GRID, it[i], it[j]); pb.seg(GRID, ob[i], ob[j]);
    pb.seg(WATER_LINE.fresh, ib[i], ib[j]);
  }
  pb.face(...ib); // the water surface inside
  for (const s of [-1, 1]) pb.box(w.x + s * 0.95 - 0.07, y + h, w.z - 0.07, w.x + s * 0.95 + 0.07, y + 2.3, w.z + 0.07, GRID);
  pb.line(GRID, [w.x - 0.95, y + 2.1, w.z], [w.x + 0.95, y + 2.1, w.z]);
  pb.pyramid(w.x - 1.3, w.z - 0.9, w.x + 1.3, w.z + 0.9, y + 2.3, 0.7, GRID);
  pb.line(WATER_LINE.fresh, [w.x, y + 2.1, w.z], [w.x, y + 1.1, w.z]); // the rope and bucket
  pb.box(w.x - 0.15, y + 0.85, w.z - 0.15, w.x + 0.15, y + 1.15, w.z + 0.15, GRID);
}

// ---------- drinking ----------
export interface WaterSource { kind: WaterKind; where: 'well' | 'lake' }
/** A well (village or wild) or lake water right in front of the player's feet. */
export function waterSource(wells: Well[]): WaterSource | null {
  const p = G.pos;
  const vw = OW.village?.well;
  if (vw && Math.hypot(vw.x + 1 - p.x, vw.z + 1 - p.z) < 2.4) return { kind: 'fresh', where: 'well' };
  if (wells.some((w) => Math.hypot(w.x - p.x, w.z - p.z) < 2.6)) return { kind: 'fresh', where: 'well' };
  const T = OW.terrain;
  if (!T) return null;
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  for (const d of [0, 0.8, 1.6]) { const w = T.water(p.x + fx * d, p.z + fz * d); if (w && w.level > p.y - 0.6) return { kind: w.kind, where: 'lake' }; }
  return null;
}
export const sourcePrompt = (s: WaterSource) =>
  s.kind === 'toxic' ? 'Toxic water: do not drink' : `E — ${hasItem('flask') ? 'fill a flask with' : 'drink'} ${s.where === 'well' ? 'water from the well' : WATER_NAME[s.kind]}`;

let lastSip = 0;
/**
 * Use a water source: with an Empty Flask it fills one; otherwise you drink on the spot.
 * Drinking quenches thirst (data/survival.ts SIP).
 */
export function useWater(s: WaterSource) {
  if (s.kind === 'toxic') { showToast('Toxic'); logLine('The water glows faintly. Drinking it would kill you.'); return; }
  if (takeOne('flask')) {
    if (addItem(s.kind === 'fresh' ? 'waterF' : 'waterM')) logLine(`You fill a flask with ${WATER_NAME[s.kind]}.`);
    else { addItem('flask'); logLine('No room in your backpack.'); }
    saveChar(); return;
  }
  if (performance.now() - lastSip < 1200) return;
  lastSip = performance.now();
  if (G.char.water >= 99) { logLine('You are not thirsty.'); return; }
  if (s.kind === 'fresh') { logLine('You drink the cool water.'); nourish(0, SIP.fresh); }
  else if (Math.random() < 0.35) { G.hp -= 6; G.dmgFlash = 0.35; nourish(0, SIP.murky); logLine('The swamp water turns your stomach. -6 HP'); }
  else { logLine('It tastes of mud, but it is water.'); nourish(0, SIP.murky); }
}
