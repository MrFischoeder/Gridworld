// What dropped things look like lying on the ground: a log is a log (bark, cut ends with rings, a stub of a branch),
// a fang is a curved tooth, a hide a flat pelt with its legs, scrap a bent plate, a cog and a pipe end... Line models
// in the game's vector style, glowing like every pickup; the bigger solids (logs, stones, planks, crates) get a dark
// fill so they hide what is behind them. Origin at the middle of the ground contact, y up; world/loot.ts lays them
// on the ground (`LYING`) instead of letting them hover and spin like the old tokens.
import * as THREE from 'three';
import { add, fillMat, V } from './render';
import { FOOD_COLOR } from '../data/survival';
import type { ItemKey } from '../data/items';

const WOOD = 0xd0b070, BARK = 0xb8a060, BONE = 0xe8e0c0, STONE = 0xc8c8b0, STEEL = 0xb8c4cc, HIDE = 0xd8b080, WING = 0xd8c8e0;
const IRON = 0xd0703c, COPPER = 0x38d0b8, BOARD = 0x9dffb4, CORE = 0xc0a0ff;

const mats = new Map<number, THREE.Material>();
const mat = (c: number) => { let m = mats.get(c); if (!m) { m = add(c); mats.set(c, m); } return m; };
const dark = fillMat();

/** A little builder: line segments per colour, filled solids, all in one group. */
class Model {
  g = new THREE.Group();
  private segs = new Map<number, THREE.Vector3[]>();
  seg(c: number, a: THREE.Vector3, b: THREE.Vector3) { let l = this.segs.get(c); if (!l) this.segs.set(c, (l = [])); l.push(a, b); return this; }
  line(c: number, pts: THREE.Vector3[], closed = false) { for (let i = 0; i + 1 < pts.length; i++) this.seg(c, pts[i], pts[i + 1]); if (closed) this.seg(c, pts[pts.length - 1], pts[0]); return this; }
  /** A solid: its edges in colour c over a dark fill (or openwork without it). */
  solid(c: number, geo: THREE.BufferGeometry, at: THREE.Vector3, rot = new THREE.Euler(), scale = V(1, 1, 1), fill = true) {
    const o = new THREE.Group(); o.position.copy(at); o.rotation.copy(rot); o.scale.copy(scale);
    if (fill) o.add(new THREE.Mesh(geo, dark));
    o.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo, 25), mat(c)));
    this.g.add(o); return o;
  }
  /** A bent tube through pts (tapering by radii), as rings of `sides` joined along its length: teeth, bones, sticks. */
  tube(c: number, pts: THREE.Vector3[], radii: number[], sides = 4) {
    let prev: THREE.Vector3[] | null = null;
    pts.forEach((p, i) => {
      const t = (pts[Math.min(i + 1, pts.length - 1)].clone().sub(pts[Math.max(i - 1, 0)])).normalize();
      const u = Math.abs(t.y) > 0.9 ? V(1, 0, 0) : V(0, 1, 0), a = u.clone().cross(t).normalize(), b = t.clone().cross(a).normalize();
      const ring = Array.from({ length: sides }, (_, k) => { const ang = k / sides * Math.PI * 2; return p.clone().addScaledVector(a, Math.cos(ang) * radii[i]).addScaledVector(b, Math.sin(ang) * radii[i]); });
      if (radii[i] > 0.001) this.line(c, ring, true);
      if (prev) ring.forEach((q, k) => this.seg(c, prev![k], q));
      prev = ring;
    });
    return this;
  }
  done(): THREE.Group {
    for (const [c, pts] of this.segs) this.g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), mat(c)));
    return this.g;
  }
}
const ring = (c: THREE.Vector3, r: number, n: number, axis: 'x' | 'y' | 'z') =>
  Array.from({ length: n }, (_, i) => { const a = i / n * Math.PI * 2, s = Math.sin(a) * r, k = Math.cos(a) * r; return axis === 'x' ? V(c.x, c.y + s, c.z + k) : axis === 'y' ? V(c.x + k, c.y, c.z + s) : V(c.x + k, c.y + s, c.z); });

// ---------- the models ----------
function log(): THREE.Group {
  const m = new Model(), r = 0.13, L = 1.05;
  m.solid(BARK, new THREE.CylinderGeometry(r, r * 0.92, L, 8), V(0, r, 0), new THREE.Euler(0, 0, Math.PI / 2));
  for (const s of [-1, 1]) { // the cut ends: growth rings and a crack
    const e = V(s * (L / 2 + 0.002), r, 0);
    m.line(WOOD, ring(e, r * 0.62, 8, 'x'), true).line(WOOD, ring(e, r * 0.3, 6, 'x'), true).seg(WOOD, e, V(e.x, r + r * 0.7, e.z + r * 0.3));
  }
  // bark: short furrows along it, and the stub of a lopped branch
  for (let i = 0; i < 6; i++) { const a = i * 1.1, x = -0.35 + (i % 3) * 0.3; m.seg(BARK, V(x, r + Math.sin(a) * r * 1.01, Math.cos(a) * r * 1.01), V(x + 0.18, r + Math.sin(a) * r * 1.01, Math.cos(a) * r * 1.01)); }
  m.tube(BARK, [V(0.15, r * 1.6, 0.05), V(0.22, r * 2.3, 0.1)], [0.045, 0.035], 5);
  return m.done();
}
function planks(): THREE.Group {
  const m = new Model(), geo = new THREE.BoxGeometry(1, 0.035, 0.14);
  for (let i = 0; i < 3; i++) m.solid(WOOD, geo, V((i - 1) * 0.04, 0.02 + i * 0.037, (i - 1) * 0.05), new THREE.Euler(0, (i - 1) * 0.12, 0));
  for (let i = 0; i < 3; i++) m.seg(BARK, V(-0.3 + i * 0.25, 0.132, 0.02), V(-0.12 + i * 0.25, 0.132, 0.03)); // grain
  return m.done();
}
function stone(streak?: number): THREE.Group {
  const m = new Model();
  m.solid(STONE, new THREE.DodecahedronGeometry(0.17), V(0, 0.1, 0), new THREE.Euler(0.4, 0.7, 0.2), V(1.3, 0.65, 1));
  if (streak !== undefined) { // veins round the lump (just outside its faces) and a couple of nuggets
    const on = (a: number, b: number) => V(Math.cos(a) * Math.cos(b) * 0.235, 0.1 + Math.sin(b) * 0.125, Math.sin(a) * Math.cos(b) * 0.18);
    m.line(streak, Array.from({ length: 9 }, (_, i) => on(-0.4 + i * 0.45, 0.5 + Math.sin(i * 1.7) * 0.25)));
    m.line(streak, Array.from({ length: 6 }, (_, i) => on(2.2 + i * 0.4, 0.15 + Math.sin(i * 2.3) * 0.2)));
    for (const [a, b] of [[0.5, 0.75], [2.8, 0.3]]) m.solid(streak, new THREE.OctahedronGeometry(0.035), on(a, b), new THREE.Euler(0.3, 0.5, 0), V(1, 1, 1), false);
  }
  return m.done();
}
function scrap(): THREE.Group {
  const m = new Model();
  // a plate bent over, with rivet holes and a torn edge
  const a = V(-0.2, 0.01, -0.12), b = V(0.05, 0.01, -0.14), c = V(0.07, 0.01, 0.12), d = V(-0.18, 0.01, 0.1), e = V(0.18, 0.13, -0.1), f = V(0.2, 0.14, 0.08), g2 = V(0.13, 0.17, 0.0);
  m.line(STEEL, [a, b, c, d], true).line(STEEL, [b, e, g2, f, c]);
  for (const p of [V(-0.14, 0.012, -0.06), V(-0.13, 0.012, 0.05)]) m.line(STEEL, ring(p, 0.015, 5, 'y'), true);
  // a cog
  const cog: THREE.Vector3[] = [], cx = -0.05, cz = 0.22, n = 10;
  for (let i = 0; i < n * 2; i++) { const ang = i / (n * 2) * Math.PI * 2, r = i % 2 ? 0.085 : 0.065; cog.push(V(cx + Math.cos(ang) * r, 0.025, cz + Math.sin(ang) * r)); }
  m.line(STEEL, cog, true).line(STEEL, ring(V(cx, 0.025, cz), 0.025, 6, 'y'), true);
  // a pipe stub
  m.tube(STEEL, [V(0.1, 0.035, 0.25), V(0.3, 0.035, 0.18)], [0.035, 0.035], 6);
  return m.done();
}
function circuit(): THREE.Group {
  const m = new Model();
  m.solid(BOARD, new THREE.BoxGeometry(0.28, 0.015, 0.18), V(0, 0.01, 0));
  m.solid(BOARD, new THREE.BoxGeometry(0.07, 0.02, 0.07), V(-0.05, 0.03, 0.01));
  m.solid(BOARD, new THREE.BoxGeometry(0.04, 0.02, 0.03), V(0.07, 0.03, -0.04));
  for (let i = 0; i < 4; i++) m.line(BOARD, [V(-0.01, 0.019, -0.03 + i * 0.02), V(0.04, 0.019, -0.03 + i * 0.02), V(0.07, 0.019, -0.05 + i * 0.03), V(0.13, 0.019, -0.05 + i * 0.03)]);
  for (let i = 0; i < 5; i++) m.seg(BOARD, V(-0.13 + i * 0.015, 0.019, 0.09), V(-0.13 + i * 0.015, 0.019, 0.07)); // the edge contacts
  return m.done();
}
function pcore(): THREE.Group {
  const m = new Model();
  m.solid(CORE, new THREE.CylinderGeometry(0.08, 0.08, 0.24, 8), V(0, 0.08, 0), new THREE.Euler(0, 0, Math.PI / 2));
  for (const x of [-0.08, 0, 0.08]) m.line(CORE, ring(V(x, 0.08, 0), 0.092, 8, 'x'), true);
  m.seg(CORE, V(-0.14, 0.08, 0), V(0.14, 0.08, 0));
  return m.done();
}
function hide(): THREE.Group {
  const m = new Model(), y = 0.012;
  // a pelt laid flat: body, four leg flaps, the neck and a tail
  const o = [[0, -0.32], [0.08, -0.26], [0.13, -0.3], [0.2, -0.33], [0.17, -0.2], [0.24, -0.08], [0.33, -0.1], [0.3, 0.02], [0.24, 0.12], [0.28, 0.24], [0.16, 0.2], [0.08, 0.3], [0.02, 0.44],
    [-0.04, 0.3], [-0.14, 0.22], [-0.27, 0.26], [-0.24, 0.12], [-0.25, 0.0], [-0.33, -0.08], [-0.24, -0.1], [-0.18, -0.2], [-0.21, -0.33], [-0.09, -0.27]];
  const pts = o.map(([x, z]) => V(x, y, z));
  const shape = new THREE.Shape(o.map(([x, z]) => new THREE.Vector2(x, -z)));
  const fill = new THREE.Mesh(new THREE.ShapeGeometry(shape), dark); fill.rotation.x = -Math.PI / 2; fill.position.y = y - 0.002; m.g.add(fill);
  m.line(HIDE, pts, true);
  m.line(HIDE, [V(0, y, -0.2), V(0.01, y, 0), V(0, y, 0.2)]); // the spine
  for (let i = -3; i <= 3; i++) m.seg(HIDE, V(-0.06, y, i * 0.06), V(0.06, y, i * 0.06 + 0.02)); // fur
  return m.done();
}
function tooth(len: number, curve: number, r: number, c = BONE): THREE.Group {
  const m = new Model(), pts: THREE.Vector3[] = [], radii: number[] = [];
  for (let i = 0; i <= 5; i++) { const t = i / 5; pts.push(V(t * len - len / 2, r + Math.sin(t * Math.PI * 0.5) * curve, 0)); radii.push(r * (1 - t * 0.95)); }
  m.tube(c, pts, radii, 5);
  return m.done();
}
function fang(): THREE.Group {
  const g = new THREE.Group(), a = tooth(0.2, 0.07, 0.03), b = tooth(0.16, 0.05, 0.025);
  a.rotation.y = 0.4; b.position.set(0.02, 0, 0.08); b.rotation.y = -0.9; g.add(a, b); return g;
}
function incisor(): THREE.Group {
  const g = new THREE.Group();
  for (const s of [-1, 1]) { const t = tooth(0.22, 0.09, 0.02); t.position.z = s * 0.025; g.add(t); }
  return g;
}
function plate(): THREE.Group {
  const m = new Model();
  // a curved shell of armour with ridges across it
  m.solid(BONE, new THREE.CylinderGeometry(0.22, 0.22, 0.34, 7, 1, true, -Math.PI / 2, Math.PI), V(0, 0.0, 0), new THREE.Euler(Math.PI / 2, 0, 0), V(1, 1, 0.55));
  for (const z of [-0.08, 0.04, 0.14]) m.line(BONE, Array.from({ length: 8 }, (_, i) => { const a = i / 7 * Math.PI; return V(Math.cos(a) * 0.225, Math.sin(a) * 0.125, z); }));
  return m.done();
}
function membrane(): THREE.Group {
  const m = new Model(), root = V(-0.2, 0.02, 0), tips = [V(0.25, 0.02, -0.18), V(0.3, 0.02, -0.02), V(0.26, 0.02, 0.14), V(0.12, 0.02, 0.24)];
  for (const t of tips) m.seg(WING, root, t);
  const edge = [V(-0.12, 0.02, -0.14), tips[0]];
  for (let i = 1; i < tips.length; i++) { const a = tips[i - 1], b = tips[i]; edge.push(V((a.x + b.x) / 2 - 0.05, 0.02, (a.z + b.z) / 2 - 0.02), b); } // scalloped between the fingers
  edge.push(V(-0.1, 0.02, 0.16));
  m.line(WING, [root, ...edge, root]);
  return m.done();
}
function meat(roast: boolean): THREE.Group {
  const m = new Model();
  m.solid(FOOD_COLOR, new THREE.DodecahedronGeometry(0.13), V(0.02, 0.08, 0), new THREE.Euler(0.3, 0.2, 0), V(1.4, 0.65, 1));
  m.tube(BONE, [V(-0.12, 0.08, 0), V(-0.3, 0.1, 0.02)], [0.025, 0.022], 5); // the bone, with its knuckle
  m.solid(BONE, new THREE.OctahedronGeometry(0.035), V(-0.32, 0.1, 0.02), new THREE.Euler(), V(1, 1, 1), false);
  if (roast) for (let i = 0; i < 3; i++) m.seg(FOOD_COLOR, V(-0.08 + i * 0.08, 0.165, -0.08), V(-0.02 + i * 0.08, 0.165, 0.08)); // grill marks
  return m.done();
}
function caps(): THREE.Group {
  const m = new Model();
  for (const [x, z, s] of [[0, 0, 1], [0.12, 0.06, 0.7], [-0.08, 0.1, 0.55]]) {
    m.solid(FOOD_COLOR, new THREE.SphereGeometry(0.07 * s, 7, 3, 0, Math.PI * 2, 0, Math.PI / 2), V(x, 0.08 * s, z), new THREE.Euler(), V(1, 0.7, 1));
    m.tube(FOOD_COLOR, [V(x, 0, z), V(x, 0.08 * s, z)], [0.018 * s, 0.018 * s], 4);
  }
  return m.done();
}
function pod(): THREE.Group {
  const m = new Model();
  m.solid(FOOD_COLOR, new THREE.SphereGeometry(0.09, 6, 5), V(0, 0.08, 0), new THREE.Euler(0, 0, 0.2), V(1.9, 0.9, 1));
  m.tube(FOOD_COLOR, [V(0.16, 0.1, 0), V(0.23, 0.14, 0.02)], [0.012, 0.008], 4); // the stalk
  return m.done();
}
function crystals(c = FOOD_COLOR): THREE.Group {
  const m = new Model();
  for (const [x, z, h, tx, tz] of [[0, 0, 0.2, 0, 0], [0.06, 0.03, 0.14, 0.4, 0.2], [-0.05, 0.04, 0.12, -0.3, 0.4], [0.02, -0.06, 0.1, 0.2, -0.4]])
    m.solid(c, new THREE.CylinderGeometry(0, 0.03, h, 6), V(x, h / 2, z), new THREE.Euler(tx, 0, tz), V(1, 1, 1), false);
  return m.done();
}
function bread(): THREE.Group {
  const m = new Model();
  m.solid(FOOD_COLOR, new THREE.SphereGeometry(0.1, 8, 4), V(0, 0.055, 0), new THREE.Euler(), V(1.5, 0.6, 0.9));
  for (let i = 0; i < 3; i++) m.seg(FOOD_COLOR, V(-0.08 + i * 0.07, 0.117, -0.04), V(-0.04 + i * 0.07, 0.117, 0.04)); // the scores
  return m.done();
}
function bowl(): THREE.Group {
  const m = new Model();
  m.solid(FOOD_COLOR, new THREE.CylinderGeometry(0.13, 0.08, 0.08, 10, 1, true), V(0, 0.04, 0));
  m.line(FOOD_COLOR, ring(V(0, 0.07, 0), 0.115, 10, 'y'), true);
  return m.done();
}
function flask(): THREE.Group {
  const m = new Model();
  m.solid(0x9dffe0, new THREE.CylinderGeometry(0.06, 0.07, 0.16, 7), V(0, 0.07, 0), new THREE.Euler(0, 0, Math.PI / 2));
  m.tube(0x9dffe0, [V(0.08, 0.07, 0), V(0.14, 0.07, 0)], [0.02, 0.02], 5);
  return m.done();
}
function sticks(): THREE.Group {
  const m = new Model();
  for (let i = 0; i < 4; i++) m.tube(BARK, [V(-0.18, 0.03 + (i % 2) * 0.03, -0.05 + i * 0.03), V(0.18, 0.03 + (i % 2) * 0.03, -0.06 + i * 0.035)], [0.018, 0.015], 4);
  m.line(0xc8b890, ring(V(0, 0.045, 0), 0.075, 7, 'x'), true); // the cord round the bundle
  return m.done();
}
function crate(): THREE.Group {
  const m = new Model(), s = 0.36;
  m.solid(WOOD, new THREE.BoxGeometry(s, s * 0.8, s * 0.8), V(0, s * 0.4, 0));
  for (const x of [-s / 2 - 0.002, s / 2 + 0.002]) m.seg(WOOD, V(x, 0, -s * 0.4), V(x, s * 0.8, s * 0.4)).seg(WOOD, V(x, s * 0.8, -s * 0.4), V(x, 0, s * 0.4));
  for (let i = 1; i < 3; i++) m.seg(WOOD, V(-s / 2, s * 0.8 + 0.002, -s * 0.4 + i * s * 0.8 / 3), V(s / 2, s * 0.8 + 0.002, -s * 0.4 + i * s * 0.8 / 3));
  return m.done();
}
function hatchet(): THREE.Group {
  const m = new Model();
  m.tube(WOOD, [V(-0.22, 0.02, 0), V(0.18, 0.02, 0)], [0.018, 0.018], 4);
  m.line(STEEL, [V(0.12, 0.02, 0), V(0.14, 0.02, 0.1), V(0.22, 0.02, 0.12), V(0.2, 0.02, -0.02), V(0.2, 0.02, -0.03)], true);
  return m.done();
}
function pickaxe(): THREE.Group {
  const m = new Model();
  m.tube(WOOD, [V(-0.26, 0.02, 0), V(0.16, 0.02, 0)], [0.018, 0.018], 4);
  m.tube(STEEL, [V(0.16, 0.02, -0.2), V(0.18, 0.02, 0), V(0.16, 0.02, 0.2)], [0.004, 0.025, 0.004], 4);
  return m.done();
}

/** Things that have a lying model, and how to make it. */
const MODELS: Partial<Record<ItemKey, () => THREE.Group>> = {
  log, planks, stone: () => stone(), ironO: () => stone(IRON), copperO: () => stone(COPPER), scrap, circuit, pcore,
  hide, fang, incisor, plate, membrane, meatR: () => meat(false), meatC: () => meat(true), cap: caps, pod, ncrys: () => crystals(),
  bread, stew: bowl, flask, waterF: flask, waterM: flask, firekit: sticks, hatchet, pickaxe, wire: () => coil(), nails: () => nails(), rope: () => coil(0xc8b890),
};
function nails(): THREE.Group {
  const m = new Model();
  for (let i = 0; i < 7; i++) { const a = i * 2.4, x = Math.cos(a) * 0.06 * (i % 3), z = Math.sin(a) * 0.06 * (i % 3), d = V(Math.cos(a * 1.7), 0, Math.sin(a * 1.7)).multiplyScalar(0.06);
    m.seg(STEEL, V(x - d.x, 0.01 + (i % 2) * 0.012, z - d.z), V(x + d.x, 0.01, z + d.z)); m.line(STEEL, ring(V(x - d.x, 0.01 + (i % 2) * 0.012, z - d.z), 0.012, 5, 'y'), true); }
  return m.done();
}
function coil(c = STEEL): THREE.Group {
  const m = new Model(), pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 40; i++) { const a = i / 40 * Math.PI * 2 * 4, r = 0.1 + (i % 10) * 0.002; pts.push(V(Math.cos(a) * r, 0.015 + i * 0.0012, Math.sin(a) * r)); }
  return m.line(c, pts).done();
}
/** The lying model of item k, or null (it keeps the floating token). Trade goods lie as crates. */
export function lyingModel(k: ItemKey, type: string): THREE.Group | null {
  const f = MODELS[k];
  if (f) return f();
  return type === 'good' ? crate() : null;
}
