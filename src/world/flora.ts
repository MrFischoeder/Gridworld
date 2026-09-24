// Edible plants (RF-01 alien flora sheet): F-01 Nutrient Mushroom Cluster and F-02 Alien Fruit Pod Tree on the
// surface (placed by gen/flora.ts), F-03 Nutrient Crystals in the dungeons (gen/dungeon.ts crystals). The plant
// itself is part of the chunk's PropBatch; the part you pick (small caps, pods, crystals, drawn lime) is its own
// object that hides once picked and comes back when it has grown again (char.harvest, data/survival FORAGE).
import * as THREE from 'three';
import { scene, GRID } from './render';
import { G } from '../game';
import { rng } from '../core/rng';
import { floorNear } from '../core/voxel';
import { PropBatch } from './props';
import { tube, type P } from './trees';
import { burst } from './fx';
import type { Plant } from '../gen/flora';
import { FORAGE, FOOD_COLOR, type ForageKind } from '../data/survival';
import { ITEMS, PACK } from '../data/items';
import { putItems } from '../inventory';
import { saveChar, dungeonKey } from '../character';
import { logLine } from '../ui/hud';

const FOOD = FOOD_COLOR, STEM = GRID, CAP = 0x3dff6e;

export interface PlantNode {
  key: string; kind: ForageKind; x: number; y: number; z: number;
  /** The part that is picked (hidden until it grows back). */
  fruit: THREE.Object3D;
  /** Pods on a pod tree (one harvest takes them all). */
  n: number;
}
const nodes = new Set<PlantNode>();

// ---------- harvest state ----------
const kindOf = (key: string) => key.split(':')[0] as ForageKind;
/** Whether the plant has fruit now (never picked, or grown back since). Grown-back entries leave the save. */
export function ripe(key: string): boolean {
  const h = G.char.harvest, t = h[key];
  if (t === undefined) return true;
  if (G.char.time - t < FORAGE[kindOf(key)].regrow) return false;
  delete h[key];
  return true;
}

// ---------- models ----------
/** A mushroom: a slightly bent, tapering stem and a faceted dome cap with gill lines under it. */
function mushroom(pb: PropBatch, base: P, h: number, capR: number, r: number, lean: number, rot: number, sides: number, stem = STEM, cap = CAP) {
  const lx = Math.cos(rot) * lean, lz = Math.sin(rot) * lean;
  const top: P = [base[0] + lx, base[1] + h, base[2] + lz], mid: P = [base[0] + lx * 0.35, base[1] + h * 0.5, base[2] + lz * 0.35];
  tube(pb, [[base[0], base[1] - 0.1, base[2]], mid, top], [r * 1.5, r * 1.05, r], Math.max(4, sides - 4), stem);
  const ring = (y: number, rr: number): P[] => Array.from({ length: sides }, (_, k) => { const a = rot + k / sides * 6.283; return [top[0] + Math.cos(a) * rr, top[1] + y, top[2] + Math.sin(a) * rr]; });
  const rim = ring(-capR * 0.12, capR), shoulder = ring(capR * 0.22, capR * 0.78), crown = ring(capR * 0.4, capR * 0.4), gills = ring(-capR * 0.02, capR * 0.3);
  const apex: P = [top[0], top[1] + capR * 0.48, top[2]];
  for (let k = 0; k < sides; k++) {
    const k1 = (k + 1) % sides;
    pb.seg(cap, rim[k], rim[k1]); pb.seg(cap, shoulder[k], shoulder[k1]); pb.seg(cap, crown[k], crown[k1]);
    pb.seg(cap, rim[k], shoulder[k]); pb.seg(cap, shoulder[k], crown[k]); pb.seg(cap, crown[k], apex);
    pb.seg(cap, rim[k], gills[k]); // gills underneath
    pb.face(rim[k], rim[k1], shoulder[k1], shoulder[k]); pb.face(shoulder[k], shoulder[k1], crown[k1], crown[k]); pb.face(crown[k], crown[k1], apex);
    pb.face(rim[k1], rim[k], gills[k], gills[k1]);
  }
}
/** F-01: a few big mushrooms (2-3 m) on a rocky base; the small lime caps around their feet are what you pick. */
function drawShroom(pb: PropBatch, fruit: PropBatch, p: Plant, lod: number) {
  const R = rng(p.seed ^ 0x51), sides = lod > 1 ? 6 : 10;
  for (const s of p.stems) mushroom(pb, [p.x + s.dx, p.y, p.z + s.dz], s.h, s.cap, s.r, s.h * 0.12 * (R() - 0.3), Math.atan2(s.dz, s.dx) + R() * 0.5, sides);
  for (let i = 0; i < 5; i++) { const a = R() * 6.283, d = 0.6 + R() * 1.1; pb.rock(p.x + Math.cos(a) * d, p.y - 0.05, p.z + Math.sin(a) * d, 0.2 + R() * 0.25, 0.2 + R() * 0.2, 4, a, GRID); }
  const n = 6 + ((R() * 4) | 0);
  for (let i = 0; i < n; i++) {
    const a = R() * 6.283, d = 0.5 + R() * 1.4, h = 0.35 + R() * 0.4;
    mushroom(fruit, [p.x + Math.cos(a) * d, p.y, p.z + Math.sin(a) * d], h, h * 0.6, 0.04, h * 0.2 * (R() - 0.5), a, lod > 1 ? 5 : 6, FOOD, FOOD);
  }
}
/** A pod: a long faceted ovoid covered in a net of cells, hanging on a short stalk. */
function pod(pb: PropBatch, hang: P, len: number, r: number, sides: number) {
  const top: P = [hang[0], hang[1] - 0.25, hang[2]];
  pb.seg(STEM, hang, top);
  const prof = [0, 0.7, 1, 0.85, 0.45, 0], rings = prof.map((k, i) => Array.from({ length: sides }, (_, s): P => {
    const a = (s + (i % 2) * 0.5) / sides * 6.283; // staggered rings: the lines between them make a net of cells
    return [top[0] + Math.cos(a) * r * k, top[1] - len * i / (prof.length - 1), top[2] + Math.sin(a) * r * k];
  }));
  for (let i = 0; i + 1 < rings.length; i++) for (let s = 0; s < sides; s++) {
    const s1 = (s + 1) % sides, a = rings[i], b = rings[i + 1];
    if (i > 0) pb.seg(FOOD, a[s], a[s1]);
    pb.seg(FOOD, a[s], b[s]); pb.seg(FOOD, a[s1], b[s]);
    pb.face(a[s], a[s1], b[s]); pb.face(a[s1], b[s1], b[s]);
  }
}
/** F-02: a trunk rising and arching over (4-6 m), drooping branches, pods hanging from them. Returns the pod count. */
function drawPodTree(pb: PropBatch, fruit: PropBatch, p: Plant, lod: number): number {
  const R = rng(p.seed ^ 0x9d), dx = Math.cos(p.rot), dz = Math.sin(p.rot), H = 4.2 + R() * 1.6, sides = lod > 1 ? 5 : 7;
  const at = (along: number, up: number, side = 0): P => [p.x + dx * along - dz * side, p.y + up, p.z + dz * along + dx * side];
  // the trunk: up, then over in an arch, the tip hanging down
  const trunk: P[] = [at(0, -0.2), at(0.2, 1.4), at(0.8, 2.8), at(1.8, H - 0.4), at(3, H), at(4, H - 0.5), at(4.5, H - 1.4)];
  tube(pb, trunk, [0.5, 0.36, 0.3, 0.25, 0.2, 0.15, 0.1], sides, STEM);
  // roots flaring out at the foot
  for (let i = 0; i < 5; i++) { const a = p.rot + i / 5 * 6.283 + R() * 0.4, e: P = [p.x + Math.cos(a) * (1 + R() * 0.6), p.y - 0.1, p.z + Math.sin(a) * (1 + R() * 0.6)]; pb.line(STEM, at(0.05, 0.6), [(e[0] + p.x) / 2, p.y + 0.15, (e[2] + p.z) / 2], e); }
  const hangs: P[] = [trunk[4], trunk[5], trunk[6]].map((q) => [q[0], q[1] - 0.1, q[2]] as P);
  // branches from the bend, drooping to either side
  const nb = 2 + ((R() * 2) | 0);
  for (let b = 0; b < nb; b++) {
    const s = b % 2 ? 1 : -1, u = 1.4 + R() * 1.6, base = at(u, H * (0.55 + u * 0.08)), side = s * (1.6 + R() * 1.2);
    const pts: P[] = [base, at(u + 0.4, base[1] - p.y + 0.6, side * 0.5), at(u + 0.8, base[1] - p.y + 0.3, side), at(u + 1, base[1] - p.y - 0.8, side * 1.15)];
    tube(pb, pts, [0.14, 0.1, 0.07, 0.05], 4, STEM);
    hangs.push([pts[1][0], pts[1][1] - 0.05, pts[1][2]], [pts[2][0], pts[2][1] - 0.05, pts[2][2]]);
    // a tuft of leaves at the tip
    const tip = pts[3];
    for (let l = 0; l < 4; l++) { const a = l / 4 * 6.283 + R(); pb.line(CAP, tip, [tip[0] + Math.cos(a) * 0.6, tip[1] + 0.25, tip[2] + Math.sin(a) * 0.6]); }
  }
  const n = Math.min(hangs.length, 4 + ((R() * 4) | 0));
  for (let i = 0; i < n; i++) pod(fruit, hangs[i], 0.8 + R() * 0.35, 0.24 + R() * 0.06, lod > 1 ? 5 : 7);
  return n;
}

/** Draws a chunk's plants: the plants go into the chunk's batch, each plant's fruit into its own object. */
export function drawPlants(pb: PropBatch, plants: Plant[], lod: number, parent: THREE.Group): PlantNode[] {
  const out: PlantNode[] = [];
  for (const p of plants) {
    const fb = new PropBatch();
    const n = p.kind === 'pod' ? drawPodTree(pb, fb, p, lod) : (drawShroom(pb, fb, p, lod), 0);
    const fruit = fb.build(); fruit.visible = ripe(p.key); parent.add(fruit);
    const node: PlantNode = { key: p.key, kind: p.kind, x: p.x, y: p.y, z: p.z, fruit, n };
    nodes.add(node); out.push(node);
  }
  return out;
}
export function dropPlants(list: PlantNode[]) { for (const n of list) nodes.delete(n); }

// ---------- F-03 Nutrient Crystals (dungeons) ----------
let crystalGroup: THREE.Group | null = null, crystalNodes: PlantNode[] = [];
/** A cluster of long, pointed six-sided crystals on a rocky base (in a room corner). */
export function placeCrystals(spots: { x: number; z: number }[]) {
  clearCrystals();
  const gr = G.grid, pb = new PropBatch(), g = new THREE.Group();
  spots.forEach((c, i) => {
    const f = floorNear(G.space, c.x, c.z, 0, gr.oy + 1, gr.oy + gr.ny - 1); if (!f) return;
    const x = f[0] + 0.5, y = f[1], z = f[2] + 0.5, R = rng((x * 73856093) ^ (z * 19349663) ^ i), fb = new PropBatch();
    for (let k = 0; k < 4; k++) { const a = R() * 6.283; pb.rock(x + Math.cos(a) * 0.35, y - 0.05, z + Math.sin(a) * 0.35, 0.3, 0.25, 5, a, GRID); }
    const n = 4 + ((R() * 4) | 0);
    for (let k = 0; k < n; k++) {
      const a = R() * 6.283, tilt = k ? 0.25 + R() * 0.45 : R() * 0.15, len = k ? 0.5 + R() * 0.7 : 1.1 + R() * 0.5, w = 0.07 + len * 0.07;
      const d: P = [Math.cos(a) * Math.sin(tilt), Math.cos(tilt), Math.sin(a) * Math.sin(tilt)], b: P = [x + Math.cos(a) * 0.12, y + 0.05, z + Math.sin(a) * 0.12];
      const sides = 6, u: P = Math.abs(d[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
      const ux = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]], ul = Math.hypot(...ux);
      const e1: P = [ux[0] / ul, ux[1] / ul, ux[2] / ul], e2: P = [d[1] * e1[2] - d[2] * e1[1], d[2] * e1[0] - d[0] * e1[2], d[0] * e1[1] - d[1] * e1[0]];
      const ringAt = (t: number): P[] => Array.from({ length: sides }, (_, s) => { const q = s / sides * 6.283; return [b[0] + d[0] * t + (e1[0] * Math.cos(q) + e2[0] * Math.sin(q)) * w, b[1] + d[1] * t + (e1[1] * Math.cos(q) + e2[1] * Math.sin(q)) * w, b[2] + d[2] * t + (e1[2] * Math.cos(q) + e2[2] * Math.sin(q)) * w]; });
      const lo = ringAt(0), hi = ringAt(len * 0.78), tip: P = [b[0] + d[0] * len, b[1] + d[1] * len, b[2] + d[2] * len];
      for (let s = 0; s < sides; s++) {
        const s1 = (s + 1) % sides;
        fb.seg(FOOD, lo[s], hi[s]); fb.seg(FOOD, hi[s], hi[s1]); fb.seg(FOOD, hi[s], tip);
        fb.face(lo[s], lo[s1], hi[s1], hi[s]); fb.face(hi[s], hi[s1], tip);
      }
    }
    const key = `crys:${dungeonKey()}:${i}`, fruit = fb.build();
    fruit.visible = ripe(key); g.add(fruit);
    const node: PlantNode = { key, kind: 'crys', x, y, z, fruit, n: 0 };
    nodes.add(node); crystalNodes.push(node);
  });
  g.add(pb.build()); scene.add(g); crystalGroup = g;
}
export function clearCrystals() {
  dropPlants(crystalNodes); crystalNodes = [];
  if (crystalGroup) { scene.remove(crystalGroup); crystalGroup.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); crystalGroup = null; }
}

// ---------- picking ----------
let tick = 0;
/** Fruit grows back while you watch (checked about once a second). */
export function updateFlora(dt: number) {
  tick -= dt; if (tick > 0) return; tick = 1;
  for (const n of nodes) n.fruit.visible = ripe(n.key);
}
const REACH: Record<ForageKind, number> = { shroom: 2.6, pod: 2.8, crys: 1.8 };
/** A ripe plant within reach. */
export function nearPlant(): PlantNode | null {
  const p = G.pos;
  let best: PlantNode | null = null, bd = Infinity;
  for (const n of nodes) {
    if (!n.fruit.visible || Math.abs(n.y - p.y) > 2.5) continue;
    const d = Math.hypot(n.x - p.x, n.z - p.z);
    if (d < REACH[n.kind] && d < bd) { best = n; bd = d; }
  }
  return best;
}
export const plantPrompt = (n: PlantNode) => (n.kind === 'shroom' ? 'E — pick Nutrient Caps' : n.kind === 'pod' ? 'E — pick the Fruit Pods' : 'E — break off Nutrient Crystals');

export function harvest(n: PlantNode) {
  const f = FORAGE[n.kind], k = f.item;
  const want = n.kind === 'pod' ? n.n : f.min + Math.floor(Math.random() * (f.max - f.min + 1));
  const left = putItems(G.char.inv, k, want, PACK.vol), got = want - left;
  if (!got) { logLine('Your backpack is full.'); return; }
  G.char.harvest[n.key] = G.char.time;
  n.fruit.visible = false;
  burst(new THREE.Vector3(n.x, n.y + 0.6, n.z), FOOD, 14, 0.8);
  logLine(`${ITEMS[k].name} ×${got} → backpack` + (left ? ' (no room for the rest)' : ''));
  saveChar();
}
