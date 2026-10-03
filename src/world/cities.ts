// The dead cities in the world (gen/cities.ts lays them out): drawn in tiles of the city's frame round the player
// (a tile within `TILE_IN` m is built, a tile past `TILE_OUT` m dropped, a few tiles a frame), so a city a kilometre
// and more across costs only what is near. Every building has a dark fill and green lines: its floors and window bays
// as a grid on its faces, a ragged broken crown, the upper floors of a gutted one standing as a bare frame of columns
// and slabs with beams hanging, a fallen one a heap of rubble over the stubs of its walls; rubble at the feet of the
// walls. Streets: kerbs and sidewalks, centre dashes, crossings at the junctions, lamp posts (some bent or down) and
// wrecked cars. Buildings, heaps and cars collide (`cityHit`), and buildings stop shots and sight (`cityRay`).
import { cityEntrances, type CityEntrance } from '../gen/citydungeons';
import { textSprite } from './npc';
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { rng } from '../core/rng';
import { citySites, cityLayout, worldToCity, bldsNear, carsNear, inBld, bldTop, corners, CITY, type CityLayout, type CitySite, type Bld, type Street, type Car } from '../gen/cities';
import { nearX, worldDist } from '../gen/regions';
import type { Terrain } from '../gen/terrain';

const EDGE = 0x36e468, DIM = 0x1c8a42, FRAME = 0x52d27a, RUBBLE = 0x4c9a62, KERB = 0x2c8048, PAINT = 0x8fe0a0, CAR = 0x5fb07a, LAMP = 0x3fa060;
const FH = CITY.floor, TILE = 96, TILE_IN = 250, TILE_OUT = 330, CITY_IN = 360, CITY_OUT = 480;

interface Tile { g: THREE.Group }
interface Live {
  c: CitySite; L: CityLayout; root: THREE.Group; ox: number; co: number; si: number;
  tiles: Map<number, Tile>;
  /** Each building's base height (NaN until asked). */
  base: Float32Array;
}
const live = new Map<number, Live>();
/** What each tile holds (by tile index), worked out once per layout. */
const tileItems = new WeakMap<CityLayout, { nt: number; b: number[][]; s: number[][]; c: number[][]; e: number[][] }>();
function itemsOf(world: number, L: CityLayout) {
  let t = tileItems.get(L);
  if (t) return t;
  const nt = Math.ceil(2 * L.half / TILE), idx = (u: number, v: number) => Math.max(0, Math.min(nt - 1, Math.floor((u + L.half) / TILE))) + nt * Math.max(0, Math.min(nt - 1, Math.floor((v + L.half) / TILE)));
  t = { nt, b: Array.from({ length: nt * nt }, () => []), s: Array.from({ length: nt * nt }, () => []), c: Array.from({ length: nt * nt }, () => []), e: Array.from({ length: nt * nt }, () => []) };
  L.blds.forEach((b, k) => t!.b[idx(b.x, b.z)].push(k));
  L.streets.forEach((s, k) => t!.s[idx((s.ax + s.bx) / 2, (s.az + s.bz) / 2)].push(k));
  L.cars.forEach((c, k) => t!.c[idx(c.x, c.z)].push(k));
  cityEntrances(world, L.c).forEach((e, k) => t!.e[idx(e.u, e.v)].push(k));
  tileItems.set(L, t);
  return t;
}

/** The ground's height at (u, v) of a live city. */
const groundOf = (T: Terrain, l: Live) => (u: number, v: number) => T.heightAt(l.ox + u * l.co + v * l.si, l.c.z - u * l.si + v * l.co);
function baseOf(T: Terrain, l: Live, k: number): number {
  let y = l.base[k];
  if (y === y) return y;
  const b = l.L.blds[k], H = groundOf(T, l);
  y = Math.min(H(b.x, b.z), ...corners(b).map(([u, v]) => H(u, v))) - 0.6;
  l.base[k] = y;
  return y;
}

// ---------- drawing ----------
/** A wall face from p to q (city frame) on the ground at y0, its top at heights tops[j] at bay j (nb bays). */
function face(pb: PropBatch, p: [number, number], q: [number, number], y0: number, tops: number[], floors: number, lineTop: boolean) {
  const nb = tops.length - 1, at = (j: number): [number, number] => [p[0] + (q[0] - p[0]) * j / nb, p[1] + (q[1] - p[1]) * j / nb];
  for (let j = 0; j < nb; j++) {
    const [ax, az] = at(j), [bx, bz] = at(j + 1);
    pb.face([ax, y0, az], [bx, y0, bz], [bx, y0 + tops[j + 1], bz], [ax, y0 + tops[j], az]);
    if (lineTop) pb.seg(EDGE, [ax, y0 + tops[j], az], [bx, y0 + tops[j + 1], bz]);
  }
  // the window bays: a line up each bay edge, to the top there
  for (let j = 1; j < nb; j++) { const [x, z] = at(j); pb.seg(DIM, [x, y0 + 0.4, z], [x, y0 + tops[j], z]); }
  // the floors: a line along the face at every floor, in runs where the wall still stands that high
  for (let f = 1; f < floors; f++) {
    const y = f * FH;
    let run = -1;
    for (let j = 0; j <= nb; j++) {
      const ok = j < nb && Math.min(tops[j], tops[j + 1]) > y + 0.2;
      if (ok && run < 0) run = j;
      if (!ok && run >= 0) { const [ax, az] = at(run), [bx, bz] = at(j); pb.seg(DIM, [ax, y0 + y, az], [bx, y0 + y, bz]); run = -1; }
    }
  }
}
function rubble(pb: PropBatch, R: () => number, H: (u: number, v: number) => number, u: number, v: number, r: number, h: number) {
  pb.rock(u, H(u, v) - 0.3, v, r, h, 5 + Math.floor(R() * 3), R() * 6.283, RUBBLE);
}
function drawBld(pb: PropBatch, b: Bld, y0: number, H: (u: number, v: number) => number) {
  const R = rng(b.s), cs = corners(b), top = b.f * FH, co = Math.cos(b.a), si = Math.sin(b.a);
  const bays = (p: [number, number], q: [number, number]) => Math.max(1, Math.round(Math.hypot(q[0] - p[0], q[1] - p[1]) / 3.3));
  // rubble at the feet of the walls
  for (let k = 0, n = 1 + Math.floor(R() * 4) + (b.st ? 2 : 0); k < n; k++) {
    const side = Math.floor(R() * 4), t = R() - 0.5, out = 1.2 + R() * 1.6;
    const [nu, nv] = side === 0 ? [t * b.w, -b.d / 2 - out] : side === 1 ? [b.w / 2 + out, t * b.d] : side === 2 ? [t * b.w, b.d / 2 + out] : [-b.w / 2 - out, t * b.d];
    rubble(pb, R, H, b.x + nu * co - nv * si, b.z + nu * si + nv * co, 0.8 + R() * 1.6, 0.5 + R() * (b.st === 2 ? 2.5 : 1.5));
  }
  if (b.st === 2) {
    // fallen: the stubs of its walls, a heap over the footprint
    const stub = Math.min(top, FH * (0.4 + R() * 1.4));
    for (let i = 0; i < 4; i++) {
      const p = cs[i], q = cs[(i + 1) % 4], nb = bays(p, q), tops: number[] = [];
      for (let j = 0; j <= nb; j++) tops.push(Math.max(0.6, stub * (0.3 + R() * 0.9)));
      face(pb, p, q, y0, tops, 2, true);
    }
    const n = Math.max(6, Math.min(22, Math.round(b.w * b.d / 30))), heap = bldTop(b);
    for (let k = 0; k < n; k++) { // a low spread of broken slabs and blocks, highest in the middle
      const u = (R() - 0.5) * b.w * 0.95, v = (R() - 0.5) * b.d * 0.95, mid = 1 - Math.max(Math.abs(u) / b.w, Math.abs(v) / b.d);
      rubble(pb, R, H, b.x + u * co - v * si, b.z + u * si + v * co, 1.6 + R() * Math.min(b.w, b.d) * 0.16, heap * (0.25 + 0.6 * mid) * (0.6 + R() * 0.4));
    }
    for (let k = 0; k < 3; k++) { // a slab or two lying tilted on the heap
      const u = (R() - 0.5) * b.w * 0.5, v = (R() - 0.5) * b.d * 0.5, a = R() * 3.14, L2 = 2 + R() * 3, W2 = 1.5 + R() * 2, y = H(b.x, b.z) + heap * 0.4;
      const cx = b.x + u * co - v * si, cz = b.z + u * si + v * co, ca = Math.cos(a), sa = Math.sin(a), tilt = 0.8 + R();
      const pts = [[-L2, -W2, 0], [L2, -W2, tilt], [L2, W2, tilt], [-L2, W2, 0]].map(([p, q, t]) => [cx + p * ca - q * sa, y + t, cz + p * sa + q * ca]);
      pb.face(pts[0], pts[1], pts[2], pts[3]); pb.line(RUBBLE, pts[0], pts[1], pts[2], pts[3], pts[0]);
    }
    return;
  }
  // how much of the building still stands to its full height: the corners first
  const broken = b.f >= 3 ? 1 + Math.floor(R() * Math.min(5, b.f * 0.3)) : 0;
  const wallTop = b.st === 1 ? top * (0.35 + R() * 0.3) : top - broken * FH;
  const ch = cs.map(() => (b.st === 1 ? wallTop + R() * FH * 2 : broken ? wallTop + R() * broken * FH : top));
  for (let i = 0; i < 4; i++) {
    const p = cs[i], q = cs[(i + 1) % 4], nb = bays(p, q), tops: number[] = [];
    for (let j = 0; j <= nb; j++) {
      if (j === 0) tops.push(ch[i]); else if (j === nb) tops.push(ch[(i + 1) % 4]);
      else tops.push(broken || b.st === 1 ? wallTop + (R() < 0.55 ? R() * (b.st === 1 ? FH * 2.5 : broken * FH) : 0) : top);
    }
    face(pb, p, q, y0, tops, b.f, true);
    pb.seg(EDGE, [p[0], y0, p[1]], [p[0], y0 + ch[i], p[1]]); // the corner
  }
  if (!broken && b.st === 0) {
    // a whole roof: the slab, a parapet line, a stair head on the taller ones
    pb.face(...cs.map(([u, v]) => [u, y0 + top, v]));
    if (b.f >= 4) { const s = Math.min(b.w, b.d) * 0.18; pb.box(b.x - s, y0 + top, b.z - s, b.x + s, y0 + top + 2.6, b.z + s, EDGE); }
  }
  if (b.st === 1) {
    // gutted: the frame stands over the walls, columns and slabs, some slabs gone, beams hanging
    const colTop = cs.map((_, i) => wallTop + (top - wallTop) * (i % 2 ? 0.55 + R() * 0.45 : 0.85 + R() * 0.15));
    const cols: [number, number, number][] = cs.map((p, i) => [p[0], p[1], colTop[i]]);
    for (let i = 0; i < 4; i++) { // a column in the middle of each long face
      const p = cs[i], q = cs[(i + 1) % 4];
      if (Math.hypot(q[0] - p[0], q[1] - p[1]) > 14) cols.push([(p[0] + q[0]) / 2, (p[1] + q[1]) / 2, wallTop + (top - wallTop) * (0.4 + R() * 0.6)]);
    }
    for (const [u, v, t] of cols) pb.box(u - 0.25, y0 + wallTop - 0.5, v - 0.25, u + 0.25, y0 + t, v + 0.25, FRAME);
    for (let f = Math.ceil(wallTop / FH); f < b.f; f++) {
      const y = y0 + f * FH;
      if (R() < 0.28) continue;
      const k = 0.55 + R() * 0.45; // a slab reaching part of the way across
      const sl = [[-b.w / 2, -b.d / 2], [-b.w / 2 + b.w * k, -b.d / 2], [-b.w / 2 + b.w * k, b.d / 2], [-b.w / 2, b.d / 2]].map(([u, v]) => [b.x + u * co - v * si, y, b.z + u * si + v * co]);
      pb.face(sl[0], sl[1], sl[2], sl[3]); pb.line(FRAME, sl[0], sl[1], sl[2], sl[3], sl[0]);
      if (R() < 0.35) { const e = R() < 0.5 ? sl[1] : sl[2]; pb.seg(FRAME, e, [e[0] + (R() - 0.5) * 3, y - FH * (0.6 + R() * 0.8), e[2] + (R() - 0.5) * 3]); } // a beam hanging
    }
  }
}
function drawStreet(pb: PropBatch, s: Street, R: () => number, H: (u: number, v: number) => number) {
  const dx = s.bx - s.ax, dz = s.bz - s.az, len = Math.hypot(dx, dz);
  if (len < 1) return;
  const ux = dx / len, uz = dz / len, nx = -uz, nz = ux, n = Math.max(1, Math.ceil(len / 8));
  const P = (t: number, o: number, up = 0.12): number[] => { const u = s.ax + ux * t + nx * o, v = s.az + uz * t + nz * o; return [u, H(u, v) + up, v]; };
  // kerbs and the sidewalks' outer edges, broken here and there
  for (const o of [-s.w / 2, s.w / 2, -s.w / 2 - 3.2, s.w / 2 + 3.2]) for (let i = 0; i < n; i++) {
    if (R() < 0.08) continue;
    const t0 = len * i / n, t1 = len * (i + 1) / n; pb.seg(KERB, P(t0, o, 0.18), P(t1, o, 0.18));
  }
  // centre dashes (a double line on the avenues)
  for (let t = 1.5; t + 3 < len; t += 7) {
    if (s.w >= 15) { pb.seg(PAINT, P(t, -0.3), P(t + 3, -0.3)); pb.seg(PAINT, P(t, 0.3), P(t + 3, 0.3)); } else pb.seg(PAINT, P(t, 0), P(t + 3, 0));
  }
  // a crossing where the street meets another
  for (const [t, dir] of [[0, 1], [len, -1]] as [number, number][]) {
    if (R() < 0.45) continue;
    for (let o = -s.w / 2 + 1; o < s.w / 2 - 0.5; o += 1.4) pb.seg(PAINT, P(t + dir * 2, o), P(t + dir * 5, o));
  }
  // lamp posts along the sidewalks: some bent, some down
  for (let t = 6 + R() * 10; t < len - 3; t += 26 + R() * 12) {
    const side = R() < 0.5 ? -1 : 1, base = P(t, side * (s.w / 2 + 1.2), 0), roll = R();
    if (roll < 0.15) { const tip = P(t + 5, side * (s.w / 2 + 1.2 - 2), 0.3); pb.seg(LAMP, base, tip); continue; } // down across the walk
    const lean = roll < 0.35 ? 1.6 : 0, top = [base[0] + nx * side * -lean, base[1] + 7, base[2] + nz * side * -lean];
    pb.seg(LAMP, base, top);
    pb.seg(LAMP, top, [top[0] - nx * side * 2, top[1] + 0.4, top[2] - nz * side * 2]);
  }
}
function drawCar(pb: PropBatch, c: Car, H: (u: number, v: number) => number) {
  const R = rng(c.s), co = Math.cos(c.a), si = Math.sin(c.a), y = H(c.x, c.z) - 0.05 - (R() < 0.3 ? 0.25 : 0); // some sunk on flat tyres
  const P = (u: number, v: number, h: number) => [c.x + u * co - v * si, y + h, c.z + u * si + v * co];
  const l = 2.2, w = 0.95, tilt = R() < 0.2 ? 0.35 : 0;
  pb.solid8([P(-l, -w, 0.25), P(l, -w, 0.25), P(l, w, 0.25 + tilt), P(-l, w, 0.25 + tilt)], [P(-l, -w, 0.95), P(l, -w, 0.95), P(l, w, 0.95 + tilt), P(-l, w, 0.95 + tilt)], CAR);
  if (R() < 0.7) pb.solid8([P(-1.1, -0.8, 0.95), P(0.9, -0.8, 0.95), P(0.9, 0.8, 0.95 + tilt), P(-1.1, 0.8, 0.95 + tilt)], [P(-0.8, -0.7, 1.55), P(0.5, -0.7, 1.55), P(0.5, 0.7, 1.55 + tilt), P(-0.8, 0.7, 1.55 + tilt)], CAR);
}
function buildTile(T: Terrain, l: Live, k: number): Tile {
  const it = itemsOf(T.world, l.L), pb = new PropBatch(), H = groundOf(T, l), R = rng(l.c.i * 7919 + k * 31 + 1);
  for (const i of it.s[k]) drawStreet(pb, l.L.streets[i], R, H);
  for (const i of it.b[k]) drawBld(pb, l.L.blds[i], baseOf(T, l, i), H);
  for (const i of it.c[k]) drawCar(pb, l.L.cars[i], H);
  const entrances = cityEntrances(T.world, l.c);
  for (const i of it.e[k]) {
    const e = entrances[i], y = H(e.u, e.v), color = 0x5cc8ff;
    pb.box(e.u - 1.6, y + 0.04, e.v - 2, e.u + 1.6, y + 0.14, e.v + 2, color);
    for (let step = 0; step < 6; step++) pb.seg(color, [e.u - 1.3, y + 0.16, e.v - 1.5 + step * 0.5], [e.u + 1.3, y + 0.16, e.v - 1.5 + step * 0.5]);
    for (const side of [-1, 1]) pb.seg(color, [e.u + side * 1.6, y, e.v - 2], [e.u + side * 1.6, y + 1.2, e.v - 2]);
    pb.line(color, [e.u - 0.5, y + 1.6, e.v], [e.u, y + 1.1, e.v], [e.u + 0.5, y + 1.6, e.v]);
  }
  const g = pb.build();
  for (const i of it.e[k]) {
    const e = entrances[i], sign = textSprite('▼ VAULT ' + (e.n + 1), '#5cc8ff', 3.4);
    sign.position.set(e.u, H(e.u, e.v) + 2.2, e.v); g.add(sign);
  }
  l.root.add(g);
  return { g };
}
function dropTile(t: Tile) {
  t.g.removeFromParent(); t.g.traverse((o) => {
    if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); }
    else (o as THREE.Mesh).geometry?.dispose();
  });
}
function dropCity(key: number) {
  const l = live.get(key);
  if (!l) return;
  for (const t of l.tiles.values()) dropTile(t);
  scene.remove(l.root); live.delete(key);
}

let tick = 0;
/** Every frame: load the cities near you and build their tiles round you (a few a frame). */
export function updateCities(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { dropCities(); return; }
  if ((tick -= dt) <= 0) {
    tick = 0.5;
    unstick(T);
    for (const c of citySites(T.world)) {
      const d = worldDist(c.x, c.z, G.pos.x, G.pos.z) - c.r, have = live.get(c.i);
      if (have && (d > CITY_OUT || Math.abs(have.ox - nearX(c.x, G.pos.x)) > 1)) dropCity(c.i); // gone out of reach, or across the seam
      if (d < CITY_IN && !live.has(c.i)) {
        const L = cityLayout(T.world, c), ox = nearX(c.x, G.pos.x), root = new THREE.Group();
        root.position.set(ox, 0, c.z); root.rotation.y = c.yaw; scene.add(root);
        live.set(c.i, { c, L, root, ox, co: Math.cos(c.yaw), si: Math.sin(c.yaw), tiles: new Map(), base: new Float32Array(L.blds.length).fill(NaN) });
      }
    }
  }
  // tiles: the nearest missing ones first, a time budget a frame
  const t0 = performance.now();
  for (const l of live.values()) {
    const it = itemsOf(T.world, l.L), [pu, pv] = worldToCity(l.c, G.pos.x, G.pos.z), center = (k: number): [number, number] => [(k % it.nt + 0.5) * TILE - l.L.half, (Math.floor(k / it.nt) + 0.5) * TILE - l.L.half];
    for (const [k, t] of l.tiles) { const [u, v] = center(k); if (Math.hypot(u - pu, v - pv) > TILE_OUT) { dropTile(t); l.tiles.delete(k); } }
    const want: [number, number][] = [];
    const i0 = Math.max(0, Math.floor((pu - TILE_IN + l.L.half) / TILE)), i1 = Math.min(it.nt - 1, Math.floor((pu + TILE_IN + l.L.half) / TILE));
    const j0 = Math.max(0, Math.floor((pv - TILE_IN + l.L.half) / TILE)), j1 = Math.min(it.nt - 1, Math.floor((pv + TILE_IN + l.L.half) / TILE));
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = i + it.nt * j; if (l.tiles.has(k)) continue;
      const [u, v] = center(k), d = Math.hypot(u - pu, v - pv);
      if (d < TILE_IN && (it.b[k].length || it.s[k].length || it.e[k].length)) want.push([d, k]);
    }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, k] of want) { if (performance.now() - t0 > 6 && l.tiles.size) break; l.tiles.set(k, buildTile(T, l, k)); }
  }
}
/** Arrived inside a building (a teleport, a death's arrival): step out through the nearest wall. */
function unstick(T: Terrain) {
  for (const l of live.values()) {
    const [u, v] = worldToCity(l.c, G.pos.x, G.pos.z);
    if (Math.hypot(u, v) > l.c.r) continue;
    for (const k of bldsNear(l.L, u, v, 1)) {
      const b = l.L.blds[k];
      if (!inBld(b, u, v, 0.3) || G.pos.y > baseOf(T, l, k) + bldTop(b)) continue;
      const co = Math.cos(b.a), si = Math.sin(b.a), x = (u - b.x) * co + (v - b.z) * si, z = -(u - b.x) * si + (v - b.z) * co;
      const ex = b.w / 2 - Math.abs(x), ez = b.d / 2 - Math.abs(z);
      const [nx, nz] = ex < ez ? [Math.sign(x || 1) * (b.w / 2 + 1), z] : [x, Math.sign(z || 1) * (b.d / 2 + 1)];
      const nu = b.x + nx * co - nz * si, nv = b.z + nx * si + nz * co;
      G.pos.x = l.ox + nu * l.co + nv * l.si; G.pos.z = l.c.z - nu * l.si + nv * l.co; G.pos.y = T.heightAt(G.pos.x, G.pos.z) + 0.05; G.vel.set(0, 0, 0);
      return;
    }
  }
}
export function dropCities() { for (const k of [...live.keys()]) dropCity(k); }

// ---------- collisions ----------
/** Buildings, heaps and cars of the live cities (for G.obstacle, the vehicles and the creatures). */
export function cityHit(px: number, py: number, pz: number, r: number): boolean {
  const T = OW.terrain;
  if (!T) return false;
  for (const l of live.values()) {
    const [u, v] = worldToCity(l.c, px, pz);
    if (Math.hypot(u, v) > l.c.r + 10) continue;
    for (const k of bldsNear(l.L, u, v, r + 1)) {
      const b = l.L.blds[k];
      if (inBld(b, u, v, r) && py < baseOf(T, l, k) + bldTop(b) + 0.6) return true;
    }
    for (const k of carsNear(l.L, u, v, r + 3)) { const c = l.L.cars[k]; if (Math.hypot(u - c.x, v - c.z) < r + 1.2) return true; }
  }
  return false;
}
/** How far a ray goes before a building stops it (for shots and sight lines): the slab test in each building's frame. */
export function cityRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  const T = OW.terrain;
  if (!T || !live.size) return maxT;
  let best = maxT;
  for (const l of live.values()) {
    const [u0, v0] = worldToCity(l.c, o.x, o.z);
    if (Math.hypot(u0, v0) > l.c.r + maxT) continue;
    const du = d.x * l.co - d.z * l.si, dv = d.x * l.si + d.z * l.co; // the direction in the city's frame
    const um = u0 + du * maxT / 2, vm = v0 + dv * maxT / 2;
    for (const k of bldsNear(l.L, um, vm, maxT / 2 + 2)) {
      const b = l.L.blds[k], co = Math.cos(b.a), si = Math.sin(b.a), y0 = baseOf(T, l, k), y1 = y0 + bldTop(b);
      // into the building's frame
      const ox = (u0 - b.x) * co + (v0 - b.z) * si, oz = -(u0 - b.x) * si + (v0 - b.z) * co, dx = du * co + dv * si, dz = -du * si + dv * co;
      let t0 = 0, t1 = best;
      for (const [p, dd, lo, hi] of [[ox, dx, -b.w / 2, b.w / 2], [oz, dz, -b.d / 2, b.d / 2], [o.y, d.y, y0, y1]]) {
        if (Math.abs(dd) < 1e-9) { if (p < lo || p > hi) { t0 = Infinity; break; } continue; }
        let a = (lo - p) / dd, c = (hi - p) / dd; if (a > c) [a, c] = [c, a];
        t0 = Math.max(t0, a); t1 = Math.min(t1, c);
        if (t0 > t1) break;
      }
      if (t0 <= t1 && t0 < best) best = Math.max(0, t0);
    }
  }
  return best;
}
/** The city at (x, z), for place names. */
export function cityName(x: number, z: number): string | null {
  const T = OW.terrain;
  if (!T) return null;
  for (const c of citySites(T.world)) if (worldDist(c.x, c.z, x, z) < c.r + 20) return 'Ruins of ' + c.name;
  return null;
}

/** An entrance within use distance, on the player's copy of the planet and at street level. */
export function nearCityEntrance(): CityEntrance | null {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') return null;
  let best: CityEntrance | null = null, distance = 2.6;
  for (const l of live.values()) for (const e of cityEntrances(T.world, l.c)) {
    const x = nearX(e.x, G.pos.x), d = Math.hypot(x - G.pos.x, e.z - G.pos.z);
    if (d < distance && Math.abs(G.pos.y - T.heightAt(x, e.z)) < 1.5) { best = e; distance = d; }
  }
  return best;
}
