// Village houses (gen/village.ts `Building`): timber-framed like a player's base. Thin plank walls on a sill with
// corner and middle posts, windows with shutters, a doorway (its door is world/housedoors.ts), a gabled roof with an
// overhang, shingle rows and a ridge beam, gable boards; shops get an awning on posts over the door, some houses a
// chimney, the Elder's Hall a little bell turret. The walls collide here (houseHit / houseRay / houseSolid), not as
// voxels: voxels are a metre thick, these walls a quarter of one.
import { HOUSE, furnSolid, type Building, type VillageMap, type Furn } from '../gen/village';
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
  sets.set(id, vm.buildings.flatMap((b) => [...b.walls.map((w) => ({ b: w as Box['b'], slab: false })),
    ...b.furniture.filter((f) => furnSolid(f.k)).map((f) => ({ b: [f.x0, vm.y, f.z0, f.x1, vm.y + f.h, f.z1] as Box['b'], slab: false }))])); rebuild();
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
    // the leaf itself swings on its hinge: world/housedoors.ts
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

// ---------- furniture ----------
const WOOD = 0xb8b060, METAL = 0xa8c8b8, FIRE = 0xffb347, GOLD = 0xffd060, CLOTH = 0x9dffb4, STONE = 0x8fb89a, TERM = 0xa8c8b8, SCREEN = 0x5cff9a;
/** An octagonal prism (barrels, jars) round (cx, cz), radius r, from y0 to y1; hoops at the given heights (bulging `bulge`). */
function octo(pb: PropBatch, cx: number, cz: number, r: number, y0: number, y1: number, col: number, hoops: number[] = [], bulge = 0) {
  const ring = (y: number, rr: number) => Array.from({ length: 8 }, (_, i) => [cx + Math.cos(i * Math.PI / 4 + 0.39) * rr, y, cz + Math.sin(i * Math.PI / 4 + 0.39) * rr]);
  const lo = ring(y0, r), hi = ring(y1, r);
  for (let i = 0; i < 8; i++) { const k = (i + 1) % 8; pb.face(lo[i], lo[k], hi[k], hi[i]); pb.seg(col, hi[i], hi[k]); pb.seg(col, lo[i], lo[k]); pb.seg(col, lo[i], hi[i]); }
  pb.face(...hi); pb.face(...lo);
  for (const t of hoops) { const h = ring(y0 + (y1 - y0) * t, r + bulge); pb.line(col, ...h, h[0]); }
}
/** The furniture of one house (on a floor at y0). */
export function drawFurniture(pb: PropBatch, b: Building, y0: number) {
  for (const f of b.furniture) drawPiece(pb, f, b, y0);
}
function drawPiece(pb: PropBatch, f: Furn, b: Building, y: number) {
  const { x0, z0, x1, z1, h } = f, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, longX = x1 - x0 >= z1 - z0;
  const rnd = (i: number) => (hash(Math.round(x0 * 10), Math.round(z0 * 10), i) % 1000) / 1000;
  const legs = (t: number, top: number, inset = 0.07) => { for (const [lx, lz] of [[x0 + inset, z0 + inset], [x1 - inset - t, z0 + inset], [x1 - inset - t, z1 - inset - t], [x0 + inset, z1 - inset - t]]) pb.box(lx, y, lz, lx + t, top, lz + t, WOOD); };
  // the side facing the room: a point on it, a along its length (0..len), o out from it
  const alongX = f.n[1] !== 0, len = alongX ? x1 - x0 : z1 - z0;
  const front = (a: number, yy: number, o = 0) => (alongX ? [x0 + a, yy, (f.n[1] > 0 ? z1 : z0) + f.n[1] * o] : [(f.n[0] > 0 ? x1 : x0) + f.n[0] * o, yy, z0 + a]);
  switch (f.k) {
    case 'counter': {
      // a panelled bar with an overhanging top, and the wares of the house on it
      pb.box(x0, y, z0, x1, y + h - 0.06, z1, WOOD);
      const oh = 0.08, ox = f.n[0] * oh, oz = f.n[1] * oh;
      pb.box(Math.min(x0, x0 + ox) - (alongX ? oh : 0), y + h - 0.06, Math.min(z0, z0 + oz) - (alongX ? 0 : oh), Math.max(x1, x1 + ox) + (alongX ? oh : 0), y + h, Math.max(z1, z1 + oz) + (alongX ? 0 : oh), WOOD);
      for (let a = 0.3; a < len - 0.1; a += 0.3) pb.seg(WOOD, front(a, y + 0.08, 0.01), front(a, y + h - 0.1, 0.01));
      pb.seg(WOOD, front(0, y + 0.12, 0.01), front(len, y + 0.12, 0.01));
      const top = y + h, spot = (t: number) => { const p = front(len * t, top, -0.3); return [p[0], p[2]]; };
      if (b.role === 'innkeeper') {
        for (const t of [0.2, 0.28, 0.7]) { const [mx, mz] = spot(t); octo(pb, mx, mz, 0.06, top, top + 0.16, GOLD, [0.5]); }
        const [tx, tz] = spot(0.5); octo(pb, tx, tz, 0.16, top, top + 0.35, WOOD, [0.2, 0.8], 0.02); pb.seg(METAL, [tx, top + 0.2, tz], front(len * 0.5, top + 0.2, -0.05)); // a small keg with its tap
      } else if (b.role === 'blacksmith') {
        const [a, c] = spot(0.3), [d, e] = spot(0.65);
        pb.line(METAL, [a - 0.2, top + 0.02, c], [a + 0.15, top + 0.02, c + 0.05], [a + 0.25, top + 0.02, c - 0.05]); // tongs
        pb.box(d - 0.12, top, e - 0.05, d + 0.12, top + 0.05, e + 0.05, METAL); pb.box(d + 0.1, top, e - 0.02, d + 0.35, top + 0.03, e + 0.02, WOOD); // a hammer
      } else if (b.role === 'merchant') {
        const [a, c] = spot(0.35); // a balance: a post, a beam and two pans
        pb.box(a - 0.03, top, c - 0.03, a + 0.03, top + 0.4, c + 0.03, GOLD);
        const u = alongX ? [1, 0] : [0, 1], L = 0.25;
        pb.seg(GOLD, [a - u[0] * L, top + 0.4, c - u[1] * L], [a + u[0] * L, top + 0.4, c + u[1] * L]);
        for (const s of [-1, 1]) { const px = a + u[0] * L * s, pz = c + u[1] * L * s; pb.seg(GOLD, [px, top + 0.4, pz], [px, top + 0.18, pz]); octo(pb, px, pz, 0.09, top + 0.15, top + 0.18, GOLD); }
        const [d, e] = spot(0.7); pb.box(d - 0.18, top, e - 0.12, d + 0.18, top + 0.2, e + 0.12, WOOD); // a box of goods
      } else if (b.role === 'grocer') {
        for (const t of [0.25, 0.6]) { const [a, c] = spot(t); octo(pb, a, c, 0.2, top, top + 0.16, WOOD, [0.5]); for (let i = 0; i < 3; i++) pb.box(a - 0.12 + i * 0.09, top + 0.16, c - 0.05, a - 0.05 + i * 0.09, top + 0.24, c + 0.05, 0xb6ff3a); }
        const [a, c] = spot(0.85); pb.box(a - 0.2, top, c - 0.08, a + 0.2, top + 0.12, c + 0.08, GOLD); // a loaf
      }
      break;
    }
    case 'terminal': { // a desk with a boxy screen, a keyboard and the case beside it; the screen glows with lines of text
      pb.box(x0, y + h - 0.05, z0, x1, y + h, z1, WOOD); legs(0.06, y + h - 0.05);
      const scr = (a: number, yy: number, o: number) => front(a, yy, o);
      const m = len / 2 - 0.12, t = y + h, d = alongX ? z1 - z0 : x1 - x0, back = -d + 0.12;
      // the monitor: a deep box, its screen a little inset on the side facing the room
      const b0 = [scr(m - 0.28, t, back), scr(m + 0.28, t, back), scr(m + 0.28, t, back + 0.45), scr(m - 0.28, t, back + 0.45)];
      pb.solid8(b0, b0.map((p) => [p[0], t + 0.46, p[2]]), TERM);
      const sf = back + 0.46, sy0 = t + 0.07, sy1 = t + 0.4;
      pb.line(SCREEN, scr(m - 0.22, sy0, sf), scr(m + 0.22, sy0, sf), scr(m + 0.22, sy1, sf), scr(m - 0.22, sy1, sf), scr(m - 0.22, sy0, sf));
      for (let k = 0; k < 5; k++) { const yy = sy1 - 0.06 - k * 0.055; pb.seg(SCREEN, scr(m - 0.18, yy, sf + 0.003), scr(m - 0.18 + 0.1 + ((k * 37) % 5) * 0.05, yy, sf + 0.003)); }
      // keyboard, the case, a cable
      const k0 = [scr(m - 0.24, t, back + 0.52), scr(m + 0.24, t, back + 0.52), scr(m + 0.24, t, back + 0.7), scr(m - 0.24, t, back + 0.7)];
      pb.solid8(k0, k0.map((p) => [p[0], t + 0.035, p[2]]), TERM);
      for (let a = -0.2; a <= 0.2; a += 0.08) pb.seg(TERM, scr(m + a, t + 0.036, back + 0.55), scr(m + a, t + 0.036, back + 0.67));
      const c0 = [scr(len - 0.3, t, back), scr(len - 0.08, t, back), scr(len - 0.08, t, back + 0.4), scr(len - 0.3, t, back + 0.4)];
      pb.solid8(c0, c0.map((p) => [p[0], t + 0.42, p[2]]), TERM);
      pb.seg(SCREEN, scr(len - 0.26, t + 0.3, back + 0.401), scr(len - 0.18, t + 0.3, back + 0.401)); // the power light
      break;
    }
    case 'table': case 'desk': {
      pb.box(x0, y + h - 0.05, z0, x1, y + h, z1, WOOD); legs(0.07, y + h - 0.05);
      pb.line(WOOD, [x0 + 0.07, y + h - 0.14, z0 + 0.07], [x1 - 0.07, y + h - 0.14, z0 + 0.07], [x1 - 0.07, y + h - 0.14, z1 - 0.07], [x0 + 0.07, y + h - 0.14, z1 - 0.07], [x0 + 0.07, y + h - 0.14, z0 + 0.07]);
      if (f.k === 'desk') { // drawers down one side, a book and a candle on top
        pb.box(x0 + 0.05, y + 0.1, z0 + 0.05, longX ? x0 + 0.5 : x1 - 0.05, y + h - 0.05, longX ? z1 - 0.05 : z0 + 0.5, WOOD);
        pb.box(cx - 0.15, y + h, cz - 0.12, cx + 0.15, y + h + 0.05, cz + 0.12, GOLD);
        octo(pb, cx + 0.3, cz + 0.2, 0.03, y + h, y + h + 0.15, CLOTH); pb.seg(FIRE, [cx + 0.3, y + h + 0.15, cz + 0.2], [cx + 0.3, y + h + 0.21, cz + 0.2]);
      } else if (rnd(1) < 0.7) { const mx = cx + (rnd(2) - 0.5) * (x1 - x0 - 0.3), mz = cz + (rnd(3) - 0.5) * (z1 - z0 - 0.3); octo(pb, mx, mz, 0.05, y + h, y + h + 0.13, GOLD); }
      break;
    }
    case 'bench': {
      pb.box(x0, y + h - 0.05, z0, x1, y + h, z1, WOOD);
      const t = 0.05, ends = longX ? [[x0 + 0.1, z0 + 0.03, x0 + 0.1 + t, z1 - 0.03], [x1 - 0.1 - t, z0 + 0.03, x1 - 0.1, z1 - 0.03]] : [[x0 + 0.03, z0 + 0.1, x1 - 0.03, z0 + 0.1 + t], [x0 + 0.03, z1 - 0.1 - t, x1 - 0.03, z1 - 0.1]];
      for (const [a, c, d, e] of ends) pb.box(a, y, c, d, y + h - 0.05, e, WOOD);
      break;
    }
    case 'stool': {
      octo(pb, cx, cz, (x1 - x0) / 2, y + h - 0.05, y + h, WOOD);
      for (const [dx, dz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(WOOD, [cx + dx * 0.08, y + h - 0.05, cz + dz * 0.08], [cx + dx * 0.16, y, cz + dz * 0.16]);
      break;
    }
    case 'shelf': {
      // two uprights, boards every 45 cm, jars, boxes and bottles on them
      const t = 0.05, ends = longX ? [[x0, z0, x0 + t, z1], [x1 - t, z0, x1, z1]] : [[x0, z0, x1, z0 + t], [x0, z1 - t, x1, z1]];
      for (const [a, c, d, e] of ends) pb.box(a, y, c, d, y + h, e, WOOD);
      let i = 0;
      for (let yy = y + 0.3; yy < y + h; yy += 0.45) {
        pb.box(x0, yy - 0.03, z0, x1, yy, z1, WOOD);
        if (yy + 0.35 > y + h) break;
        for (let a = 0.2; a < len - 0.2; a += 0.28 + rnd(i++) * 0.2) {
          const p = front(a, yy, -((alongX ? z1 - z0 : x1 - x0) / 2)), r = rnd(i++);
          if (b.role === 'blacksmith') { if (r < 0.6) pb.box(p[0] - 0.12, yy, p[2] - 0.04, p[0] + 0.12, yy + 0.06 + r * 0.2, p[2] + 0.04, METAL); } // iron: blanks, horseshoes, tools
          else if (r < 0.35) octo(pb, p[0], p[2], 0.06, yy, yy + 0.18 + rnd(i++) * 0.1, r < 0.15 ? GOLD : CLOTH);
          else if (r < 0.7) pb.box(p[0] - 0.09, yy, p[2] - 0.09, p[0] + 0.09, yy + 0.16, p[2] + 0.09, r < 0.5 ? WOOD : GOLD);
        }
      }
      break;
    }
    case 'barrel': octo(pb, cx, cz, Math.min(x1 - x0, z1 - z0) / 2 - 0.02, y, y + h, WOOD, [0.15, 0.5, 0.85], 0.02); break;
    case 'crate': {
      pb.box(x0, y, z0, x1, y + h, z1, WOOD);
      for (const [a, c, d, e] of [[x0, z0 - 0.01, x1, z0 - 0.01], [x0, z1 + 0.01, x1, z1 + 0.01], [x0 - 0.01, z0, x0 - 0.01, z1], [x1 + 0.01, z0, x1 + 0.01, z1]]) {
        pb.seg(WOOD, [a, y, c], [d, y + h, e]); pb.seg(WOOD, [a, y + h, c], [d, y, e]);
      }
      if (h < 0.85) pb.box(x0 + 0.1, y + h, z0 + 0.1, x0 + 0.5, y + h + 0.35, z0 + 0.5, WOOD); // a smaller one on top
      break;
    }
    case 'sack': {
      pb.box(x0 + 0.03, y, z0 + 0.03, x1 - 0.03, y + h * 0.65, z1 - 0.03, CLOTH);
      pb.pyramid(x0 + 0.08, z0 + 0.08, x1 - 0.08, z1 - 0.08, y + h * 0.65, h * 0.35, CLOTH);
      pb.line(WOOD, [x0 + 0.03, y + h * 0.5, z0 + 0.02], [x1 - 0.03, y + h * 0.5, z0 + 0.02]);
      break;
    }
    case 'anvil': {
      const w = longX ? z1 - z0 : x1 - x0;
      pb.box(x0 + 0.05, y, z0 + 0.05, x1 - 0.05, y + 0.18, z1 - 0.05, METAL);
      pb.box(cx - (longX ? 0.18 : w * 0.25), y + 0.18, cz - (longX ? w * 0.25 : 0.18), cx + (longX ? 0.18 : w * 0.25), y + h - 0.2, cz + (longX ? w * 0.25 : 0.18), METAL);
      pb.box(x0 + (longX ? 0.1 : 0), y + h - 0.2, z0 + (longX ? 0 : 0.1), x1 - (longX ? 0.1 : 0), y + h, z1 - (longX ? 0 : 0.1), METAL);
      // the horn, tapering off one end
      const ex = longX ? x1 - 0.1 : cx, ez = longX ? cz : z1 - 0.1, hx = longX ? 0.3 : 0, hz = longX ? 0 : 0.3;
      pb.line(METAL, [ex, y + h, ez - (longX ? w / 2 : 0) - (longX ? 0 : 0)], [ex + hx, y + h - 0.05, ez + hz], [ex, y + h - 0.2, ez]);
      pb.line(METAL, [ex, y + h, ez + (longX ? w / 2 : 0)], [ex + hx, y + h - 0.05, ez + hz]);
      break;
    }
    case 'hearth': {
      // a stone forge: coursed block, a glowing mouth on the room side, a hood and a flue up through the roof
      pb.box(x0, y, z0, x1, y + h, z1, STONE);
      for (let yy = y + 0.25; yy < y + h; yy += 0.25) pb.line(STONE, [x0 - 0.01, yy, z0 - 0.01], [x1 + 0.01, yy, z0 - 0.01], [x1 + 0.01, yy, z1 + 0.01], [x0 - 0.01, yy, z1 + 0.01], [x0 - 0.01, yy, z0 - 0.01]);
      const m = len / 2, fm = (a: number, yy: number) => front(m + a, yy, 0.02);
      pb.line(FIRE, fm(-0.35, y + 0.35), fm(-0.35, y + 0.7), fm(0, y + 0.85), fm(0.35, y + 0.7), fm(0.35, y + 0.35), fm(-0.35, y + 0.35));
      for (let a = -0.25; a <= 0.25; a += 0.12) pb.seg(FIRE, fm(a, y + 0.4), fm(a * 0.6, y + 0.55 + Math.abs(a)));
      const hy = y + h + 0.9, c = [cx, cz];
      pb.solid8([[x0, y + h, z0], [x1, y + h, z0], [x1, y + h, z1], [x0, y + h, z1]], [[c[0] - 0.25, hy, c[1] - 0.25], [c[0] + 0.25, hy, c[1] - 0.25], [c[0] + 0.25, hy, c[1] + 0.25], [c[0] - 0.25, hy, c[1] + 0.25]], STONE);
      pb.box(c[0] - 0.25, hy, c[1] - 0.25, c[0] + 0.25, y + b.h + 1.2, c[1] + 0.25, STONE);
      break;
    }
    case 'bed': {
      const hl = 0.1;
      pb.box(x0, y, z0, x1, y + 0.3, z1, WOOD);
      pb.box(x0 + 0.04, y + 0.3, z0 + 0.04, x1 - 0.04, y + h - 0.05, z1 - 0.04, CLOTH);
      if (longX) { pb.box(x0 - hl, y, z0, x0, y + 0.95, z1, WOOD); pb.box(x0 + 0.1, y + h - 0.05, z0 + 0.15, x0 + 0.5, y + h + 0.08, z1 - 0.15, CLOTH); for (let a = x0 + 0.8; a < x1 - 0.1; a += 0.3) pb.seg(WOOD, [a, y + h - 0.04, z0 + 0.04], [a, y + h - 0.04, z1 - 0.04]); }
      else { pb.box(x0, y, z0 - hl, x1, y + 0.95, z0, WOOD); pb.box(x0 + 0.15, y + h - 0.05, z0 + 0.1, x1 - 0.15, y + h + 0.08, z0 + 0.5, CLOTH); for (let a = z0 + 0.8; a < z1 - 0.1; a += 0.3) pb.seg(WOOD, [x0 + 0.04, y + h - 0.04, a], [x1 - 0.04, y + h - 0.04, a]); }
      break;
    }
  }
}

