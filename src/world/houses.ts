// Village houses (gen/village.ts `Building`): timber-framed like a player's base. Thin plank walls on a sill with
// corner and middle posts, windows with shutters, a doorway with its door standing open, a gabled roof with an
// overhang, shingle rows and a ridge beam, gable boards; shops get an awning on posts over the door, some houses a
// chimney, the Elder's Hall a little bell turret. The walls collide here (houseHit / houseRay / houseSolid), not as
// voxels: voxels are a metre thick, these walls a quarter of one.
import { HOUSE, type Building, type VillageMap } from '../gen/village';
import { rayLocal, solidAt, type Box } from '../gen/base';
import { hash } from '../core/rng';
import type { PropBatch } from './props';

const WALL = 0x2fe060, BOARD = 0x1f9a44, POST = 0x4dff7e, TRIM = 0x9dffb4, ROOF = 0x4dff7e;

// ---------- collision ----------
const sets = new Map<number, Box[]>();
let all: Box[] = [];
const rebuild = () => { all = [...sets.values()].flat(); };
/** A village was loaded / dropped: its house walls come and go with it. */
export function setHouses(id: number, vm: VillageMap) {
  sets.set(id, vm.buildings.flatMap((b) => b.walls.map((w) => ({ b: w as Box['b'], slab: false })))); rebuild();
}
export function dropHouses(id: number) { sets.delete(id); rebuild(); }
/** Does a figure (radius r, feet at y) run into a house wall? */
export function houseHit(x: number, y: number, z: number, r: number): boolean {
  for (const { b } of all) {
    const cx = Math.max(b[0], Math.min(b[3], x)), cz = Math.max(b[2], Math.min(b[5], z));
    if ((x - cx) ** 2 + (z - cz) ** 2 < r * r && y < b[4] - 0.01 && y + 1.7 > b[1] + 0.01) return true;
  }
  return false;
}
/** Distance along a ray to the first house wall (shots and eyes stop there), or maxT. */
export const houseRay = (o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number) =>
  (all.length ? rayLocal([o.x, o.y, o.z], [d.x, d.y, d.z], maxT, all) : maxT);
export const houseSolid = (p: { x: number; y: number; z: number }) => all.length > 0 && solidAt(p.x, p.y, p.z, all);

// ---------- drawing ----------
/** One house of a village standing on a plaza at y0. */
export function drawHouse(pb: PropBatch, b: Building, y0: number) {
  const t = HOUSE.thick, top = y0 + b.h, x0 = b.x, z0 = b.z, x1 = b.x + b.w, z1 = b.z + b.d;
  const rnd = (i: number) => (hash(b.x * 7 + b.z, i, 0x40fe) % 1000) / 1000;
  // plank walls
  for (const [a, h0, c, e, h1, f] of b.walls) {
    pb.box(a, h0, c, e, h1, f, WALL);
    const alongX = e - a > f - c;
    for (let h = h0 + 0.36; h < h1 - 0.1; h += 0.36) for (const side of [-0.012, 0.012]) {
      if (alongX) { const zz = side < 0 ? c + side : f + side; pb.seg(BOARD, [a, h, zz], [e, h, zz]); }
      else { const xx = side < 0 ? a + side : e + side; pb.seg(BOARD, [xx, h, c], [xx, h, f]); }
    }
  }
  // the sill it stands on and the top plate, a little proud of the walls
  pb.box(x0 - 0.06, y0, z0 - 0.06, x1 + 0.06, y0 + 0.22, z0 + t + 0.02, POST); pb.box(x0 - 0.06, y0, z1 - t - 0.02, x1 + 0.06, y0 + 0.22, z1 + 0.06, POST);
  pb.box(x0 - 0.06, y0, z0, x0 + t + 0.02, y0 + 0.22, z1, POST); pb.box(x1 - t - 0.02, y0, z0, x1 + 0.06, y0 + 0.22, z1, POST);
  // posts at the corners and every 3 m or so between them (not across the doorway)
  const post = (x: number, z: number) => pb.box(x - 0.17, y0, z - 0.17, x + 0.17, top + 0.05, z + 0.17, POST);
  const door = b.door, dh = HOUSE.doorW / 2 + 0.35;
  const onDoor = (x: number, z: number) => Math.hypot(x - door.x, z - door.z) < dh;
  for (const [x, z] of [[x0 + 0.12, z0 + 0.12], [x1 - 0.12, z0 + 0.12], [x1 - 0.12, z1 - 0.12], [x0 + 0.12, z1 - 0.12]]) post(x, z);
  const mids = (a0: number, a1: number, f: (a: number) => [number, number]) => {
    const n = Math.max(1, Math.round((a1 - a0) / 3.2));
    for (let i = 1; i < n; i++) { const [x, z] = f(a0 + (a1 - a0) * i / n); if (!onDoor(x, z)) post(x, z); }
  };
  mids(x0, x1, (a) => [a, z0 + 0.12]); mids(x0, x1, (a) => [a, z1 - 0.12]); mids(z0, z1, (a) => [x0 + 0.12, a]); mids(z0, z1, (a) => [x1 - 0.12, a]);
  // windows with a cross and open shutters on every wall (outside and in), clear of the posts and the door
  const win = (x: number, z: number, nx: number, nz: number) => {
    const ux = -nz, uz = nx, w = 0.45, s0 = y0 + 1.05, s1 = y0 + 1.95;
    for (const side of [0.02, -t - 0.02]) {
      const P = (u: number, y: number, o = 0) => [x + ux * u + nx * (side + o), y, z + uz * u + nz * (side + o)];
      pb.line(TRIM, P(-w, s0), P(w, s0), P(w, s1), P(-w, s1), P(-w, s0));
      pb.seg(TRIM, P(0, s0), P(0, s1)); pb.seg(TRIM, P(-w, (s0 + s1) / 2), P(w, (s0 + s1) / 2));
      if (side > 0) {
        const sl = [P(-w - 0.05, s0 - 0.08), P(w + 0.05, s0 - 0.08), P(w + 0.05, s0 - 0.08, 0.12), P(-w - 0.05, s0 - 0.08, 0.12)];
        pb.solid8(sl, sl.map((p) => [p[0], s0 - 0.02, p[2]]), TRIM); // the sill
        for (const k of [-1, 1]) { // shutters folded back against the wall
          const a = k * (w + 0.05), c = k * (w + 0.5);
          pb.line(TRIM, P(a, s0, 0.03), P(c, s0, 0.03), P(c, s1, 0.03), P(a, s1, 0.03));
          for (let y = s0 + 0.18; y < s1 - 0.05; y += 0.18) pb.seg(BOARD, P(a, y, 0.035), P(c, y, 0.035));
        }
      }
    }
  };
  const row = (a0: number, a1: number, at: (a: number) => [number, number], nx: number, nz: number) => {
    const L = a1 - a0, n = Math.max(1, Math.floor(L / 3.2));
    for (let i = 0; i < n; i++) {
      const a = a0 + L * (i + 0.5) / n, [x, z] = at(a);
      if (Math.hypot(x - door.x, z - door.z) < HOUSE.doorW / 2 + 1.1) continue;
      win(x, z, nx, nz);
    }
  };
  row(x0 + 0.6, x1 - 0.6, (a) => [a, z0], 0, -1); row(x0 + 0.6, x1 - 0.6, (a) => [a, z1], 0, 1);
  row(z0 + 0.6, z1 - 0.6, (a) => [x0, a], -1, 0); row(z0 + 0.6, z1 - 0.6, (a) => [x1, a], 1, 0);
  // the doorway: a frame, a step, and the door standing open inwards
  {
    const [ox, oz] = b.out, ux = -oz, uz = ox, w = HOUSE.doorW / 2, dy = y0 + HOUSE.doorH;
    const P = (u: number, y: number, o: number) => [door.x + ux * u + ox * o, y, door.z + uz * u + oz * o];
    for (const o of [t / 2 + 0.03, -t / 2 - 0.03]) pb.line(TRIM, P(-w, y0, o), P(-w, dy, o), P(w, dy, o), P(w, y0, o));
    const s = [P(-w - 0.2, y0, t / 2), P(w + 0.2, y0, t / 2), P(w + 0.2, y0, t / 2 + 0.55), P(-w - 0.2, y0, t / 2 + 0.55)];
    pb.solid8(s, s.map((p) => [p[0], y0 + 0.12, p[2]]), POST);
    // the leaf, hinged at one jamb and swung into the room
    const W = HOUSE.doorW - 0.05, leaf = [P(w, y0 + 0.02, -t / 2), P(w, y0 + 0.02, -t / 2 - W), P(w - 0.06, y0 + 0.02, -t / 2 - W), P(w - 0.06, y0 + 0.02, -t / 2)];
    pb.solid8(leaf, leaf.map((p) => [p[0], dy - 0.04, p[2]]), BOARD);
  }
  // the roof: two slopes over the longer side with an overhang, shingle rows, a ridge beam, boarded gables
  const alongX = b.w >= b.d, span = (alongX ? b.d : b.w) / 2, e = HOUSE.eave, rise = HOUSE.rise * span, slope = rise / span;
  const R = (a: number, c: number, y: number) => (alongX ? [a, y, c] : [c, y, a]);
  const a0 = (alongX ? x0 : z0) - e, a1 = (alongX ? x1 : z1) + e, c0 = alongX ? z0 : x0, c1 = alongX ? z1 : x1, cm = (c0 + c1) / 2, ridge = top + rise;
  for (const [ce, sg] of [[c0 - e, 1], [c1 + e, -1]] as [number, number][]) {
    const ye = top - e * slope, th = 0.14;
    const lo = [R(a0, ce, ye), R(a1, ce, ye), R(a1, cm, ridge), R(a0, cm, ridge)];
    pb.solid8(lo, lo.map((p) => [p[0], p[1] + th, p[2]]), ROOF);
    for (let k = 0.45; k < span + e - 0.1; k += 0.45) { // shingle rows, up from the eave
      const c = ce + sg * k, y = ye + th + 0.01 + k * slope;
      pb.seg(BOARD, R(a0, c, y), R(a1, c, y));
    }
    for (let a = a0 + 0.6; a < a1 - 0.3; a += 1.2) pb.seg(ROOF, R(a, ce - sg * 0.02, ye - 0.05), R(a, ce - sg * 0.02, ye + th + 0.05)); // rafter ends
  }
  pb.box(...(alongX ? [a0 - 0.05, ridge + 0.1, cm - 0.1, a1 + 0.05, ridge + 0.3, cm + 0.1] : [cm - 0.1, ridge + 0.1, a0 - 0.05, cm + 0.1, ridge + 0.3, a1 + 0.05]) as [number, number, number, number, number, number], POST);
  for (const a of [alongX ? x0 : z0, alongX ? x1 : z1]) {
    const g = [R(a, c0, top), R(a, c1, top), R(a, cm, ridge)];
    pb.face(...g); pb.line(WALL, ...g, g[0]);
    for (let c = c0 + 0.4; c < c1 - 0.2; c += 0.4) { const y = top + rise * (1 - Math.abs(c - cm) / span); pb.seg(BOARD, R(a + (a === (alongX ? x0 : z0) ? -0.01 : 0.01), c, top), R(a + (a === (alongX ? x0 : z0) ? -0.01 : 0.01), c, y)); }
  }
  // a chimney through the roof (the tavern and the smithy always, a house now and then)
  if (b.role === 'innkeeper' || b.role === 'blacksmith' || (b.role === 'house' && rnd(1) < 0.6)) {
    const ca = (alongX ? x0 : z0) + 1.2 + rnd(2) * ((alongX ? b.w : b.d) - 2.4), cc = cm + (rnd(3) < 0.5 ? -1 : 1) * span * 0.45;
    const [cx, , cz] = R(ca, cc, 0), hy = ridge + 0.7;
    pb.box(cx - 0.3, top - 0.5, cz - 0.3, cx + 0.3, hy, cz + 0.3, POST);
    pb.box(cx - 0.38, hy, cz - 0.38, cx + 0.38, hy + 0.12, cz + 0.38, POST);
    for (let y = top; y < hy - 0.1; y += 0.3) pb.line(BOARD, [cx - 0.31, y, cz - 0.31], [cx + 0.31, y, cz - 0.31], [cx + 0.31, y, cz + 0.31], [cx - 0.31, y, cz + 0.31], [cx - 0.31, y, cz - 0.31]);
  }
  // shops: an awning on two posts over the door
  if (b.role !== 'house' && b.role !== 'elder') {
    const [ox, oz] = b.out, ux = -oz, uz = ox, w = 1.6, out = 1.8, yh = y0 + HOUSE.doorH + 0.6, yl = y0 + HOUSE.doorH + 0.2;
    const P = (u: number, y: number, o: number) => [door.x + ux * u + ox * o, y, door.z + uz * u + oz * o];
    for (const u of [-w, w]) { const [px, , pz] = P(u, 0, out - 0.1); pb.box(px - 0.08, y0, pz - 0.08, px + 0.08, yl, pz + 0.08, POST); }
    const lo = [P(-w - 0.2, yh, t / 2), P(w + 0.2, yh, t / 2), P(w + 0.2, yl, out + 0.1), P(-w - 0.2, yl, out + 0.1)];
    pb.solid8(lo, lo.map((p) => [p[0], p[1] + 0.08, p[2]]), ROOF);
    for (let o = t / 2 + 0.3; o < out; o += 0.3) { const y = yh + 0.09 + (yl - yh) * (o - t / 2) / (out + 0.1 - t / 2); pb.seg(BOARD, P(-w - 0.2, y, o), P(w + 0.2, y, o)); }
  }
  // the Elder's Hall: a bell turret on the ridge
  if (b.role === 'elder') {
    const [cx, , cz] = R(((alongX ? x0 : z0) + (alongX ? x1 : z1)) / 2, cm, 0), by = ridge - 0.2;
    for (const [dx, dz] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) pb.box(cx + dx - 0.08, by, cz + dz - 0.08, cx + dx + 0.08, by + 1.5, cz + dz + 0.08, POST);
    pb.box(cx - 0.7, by + 1.5, cz - 0.7, cx + 0.7, by + 1.65, cz + 0.7, POST);
    pb.pyramid(cx - 0.9, cz - 0.9, cx + 0.9, cz + 0.9, by + 1.65, 1.6, ROOF);
    pb.line(0xffd060, [cx - 0.25, by + 1.3, cz], [cx, by + 0.8, cz], [cx + 0.25, by + 1.3, cz]); // the bell
  }
}
