// Building on your claim at runtime: the parts drawn (walls, doors, roofs in wood or metal), their collision, and the
// build mode: pick a part in the build list (B), a hologram snaps to the grid round your flag where you look (green
// when it can go there, red with the reason), a click builds it from what your backpack holds (the tools stay),
// F takes down the part you look at (hammer for wood, torch for metal; half the materials come back), E opens and
// shuts doors. The rules are pure, in gen/base.ts; the parts are saved with the claim.
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { saveChar } from '../character';
import { count, takeAll } from '../data/crafting';
import { putItems } from '../inventory';
import { PACK, ITEMS } from '../data/items';
import { PIECES, BUILD, type PieceKind } from '../data/building';
import { partEnds, snap, partProblem, baseHitLocal, refund, type Part } from '../gen/base';
import { claimDist, CLAIM } from '../gen/claims';
import { nearX, wrapDx } from '../gen/regions';
import { EYE } from './player';
import { logLine } from '../ui/hud';
import type { Char } from '../save';

type Claim = Char['claims'][number];
const WOOD = 0xb8b060, METAL = 0xa8c8b8, C = BUILD.cell, H = BUILD.wallH, T = BUILD.thick;

// ---------- drawing ----------
const drawn = new Map<Claim, THREE.Group>();
function model(c: Claim, x0: number): THREE.Group {
  const pb = new PropBatch(), y = c.y, z0 = c.z;
  /** A box in claim-local metres (u east, v south), from height h0 to h1 above the pad. */
  const B = (u0: number, v0: number, u1: number, v1: number, h0: number, h1: number, col: number) =>
    pb.box(x0 + Math.min(u0, u1), y + h0, z0 + Math.min(v0, v1), x0 + Math.max(u0, u1), y + h1, z0 + Math.max(v0, v1), col);
  const L = (col: number, ...pts: [number, number, number][]) => pb.line(col, ...pts.map(([u, h, v]) => [x0 + u, y + h, z0 + v]));
  for (const p of c.parts ?? []) {
    const s = PIECES[p.k], col = s.mat === 'wood' ? WOOD : METAL;
    if (s.shape === 'roof') {
      const [[u, v]] = partEnds(p, 'roof');
      B(u, v, u + C, v + C, H, H + BUILD.roofT, col);
      for (let k = 0.4; k < C; k += 0.4) L(col, [u + k, H + BUILD.roofT + 0.01, v], [u + k, H + BUILD.roofT + 0.01, v + C]);
      continue;
    }
    const [[u0, v0]] = partEnds(p, s.shape), du = p.d === 0 ? 1 : 0, dv = 1 - du, t = T / 2;
    /** A slab along the edge from s0 to s1 (metres along it), h0..h1 high, `th` thick. */
    const slab = (s0: number, s1: number, h0: number, h1: number, th = t) =>
      B(u0 + du * s0 - dv * th, v0 + dv * s0 - du * th, u0 + du * s1 + dv * th, v0 + dv * s1 + du * th, h0, h1, col);
    const at = (a: number, h: number, side: number): [number, number, number] => [u0 + du * a + dv * side, h, v0 + dv * a + du * side];
    /** Surface lines on both faces between s0 and s1: planks (horizontal) for wood, seams (vertical) for metal. */
    const face = (s0: number, s1: number, h1: number) => {
      for (const side of [-t - 0.01, t + 0.01]) {
        if (s.mat === 'wood') for (let h = 0.4; h < h1; h += 0.4) L(col, at(s0, h, side), at(s1, h, side));
        else { for (let a = s0 + 0.5; a < s1 - 0.1; a += 0.5) L(col, at(a, 0, side), at(a, h1, side)); L(col, at(s0, h1 * 0.5, side), at(s1, h1 * 0.5, side)); }
      }
    };
    if (s.shape === 'wall') { slab(0, C, 0, H); face(0, C, H); continue; }
    // a door: jambs, the lintel over the opening, and the leaf, shut in the opening or swung open on its hinge
    const j = (C - BUILD.doorW) / 2;
    slab(0, j, 0, H); slab(C - j, C, 0, H); slab(j, C - j, BUILD.doorH, H);
    face(0, j, H); face(C - j, C, H);
    if (!p.open) {
      slab(j + 0.02, C - j - 0.02, 0.02, BUILD.doorH - 0.02, 0.04);
      for (const side of [-0.05, 0.05]) { L(col, at(j + 0.1, 0.2, side), at(C - j - 0.1, BUILD.doorH - 0.2, side)); L(col, at(C - j - 0.25, 1.05, side), at(C - j - 0.15, 1.05, side)); }
    } else {
      const hu = u0 + du * j, hv = v0 + dv * j; // the hinge; the leaf stands across the edge
      B(hu - du * 0.04 + dv * 0.02, hv - dv * 0.04 + du * 0.02, hu + du * 0.04 + dv * BUILD.doorW, hv + dv * 0.04 + du * BUILD.doorW, 0.02, BUILD.doorH - 0.02, col);
    }
  }
  return pb.build();
}
function redraw(c: Claim) {
  const g = drawn.get(c);
  if (g) { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); drawn.delete(c); }
  if (!c.parts?.length || G.char.loc !== 'overworld') return;
  const x = nearX(c.x, G.pos.x), m = model(c, x); m.userData.x = x; scene.add(m); drawn.set(c, m);
}
/** Draw the bases within sight, drop far ones (now and then, and after a change). */
export function syncBases() {
  const p = G.pos, want = new Set<Claim>();
  if (G.char.loc === 'overworld') for (const c of G.char.claims) if (c.parts?.length && Math.hypot(nearX(c.x, p.x) - p.x, c.z - p.z) < 300) want.add(c);
  for (const [c, g] of drawn) if (!want.has(c) || Math.abs(g.userData.x - nearX(c.x, p.x)) > 1) { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); drawn.delete(c); }
  for (const c of want) if (!drawn.has(c)) redraw(c);
}
export function clearBases() { for (const g of drawn.values()) scene.remove(g); drawn.clear(); stopBuilding(true); }

// ---------- collision ----------
/** Walls and shut doors of your bases: solid up to their top. */
export function baseHit(x: number, y: number, z: number, r: number): boolean {
  for (const c of G.char.claims) {
    if (!c.parts?.length || y > c.y + H - 0.1) continue;
    const u = wrapDx(x - c.x), v = z - c.z;
    if (Math.hypot(u, v) < CLAIM.flat + 2 && baseHitLocal(c.parts, u, v, r)) return true;
  }
  return false;
}

// ---------- doors ----------
/** A door of yours within reach (for E). */
export function nearDoor(): { c: Claim; p: Part } | null {
  if (G.char.loc !== 'overworld') return null;
  for (const c of G.char.claims) for (const p of c.parts ?? []) {
    if (PIECES[p.k].shape !== 'door') continue;
    const [[u0, v0], [u1, v1]] = partEnds(p, 'door'), u = wrapDx(G.pos.x - c.x), v = G.pos.z - c.z;
    if (Math.hypot(u - (u0 + u1) / 2, v - (v0 + v1) / 2) < 1.7 && Math.abs(G.pos.y - c.y) < 1.5) return { c, p };
  }
  return null;
}
export function toggleDoor(d: { c: Claim; p: Part }) {
  d.p.open = !d.p.open;
  if (!d.p.open && baseHit(G.pos.x, G.pos.y, G.pos.z, 0.3)) { d.p.open = true; logLine('You are standing in the doorway.'); return; }
  saveChar(); redraw(d.c);
}

// ---------- build mode ----------
let kind: PieceKind | null = null, ghost: THREE.Group | null = null, lastKey = '';
let target: { c: Claim; p: Part; problem: string | null } | null = null, aimed: { c: Claim; p: Part } | null = null;
const okMat = new THREE.LineBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.9, depthTest: false, fog: false });
const badMat = new THREE.LineBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.9, depthTest: false, fog: false });

/** The claim you stand on. */
const claimUnder = () => G.char.claims.find((c) => claimDist(c, G.pos.x, G.pos.z) < CLAIM.r);
export const isBuilding = () => kind !== null;
export const buildingKind = () => kind;
/** What stops you building a part of kind k right now (materials, tools), or null. */
export function lacks(k: PieceKind): string | null {
  const s = PIECES[k], inv = G.char.inv;
  const miss = [...s.needs.filter(([m, n]) => count(inv, m) < n).map(([m, n]) => `${ITEMS[m].name} ${count(inv, m)}/${n}`),
    ...s.tools.filter((t) => !count(inv, t)).map((t) => 'tool: ' + ITEMS[t].name)];
  return miss.length ? 'Needs ' + miss.join(', ') : null;
}
export function startBuilding(k: PieceKind): boolean {
  if (G.char.loc !== 'overworld' || !claimUnder()) { logLine('You can only build on your own claim: raise a Flagpole first.'); return false; }
  kind = k; lastKey = ''; target = null;
  return true;
}
export function stopBuilding(quiet = false) {
  if (kind === null) return;
  kind = null; target = null; aimed = null;
  if (ghost) { scene.remove(ghost); ghost.traverse((o) => (o as THREE.Line).geometry?.dispose()); ghost = null; }
  if (!quiet) logLine('You put your tools away.');
}

/** Where you look, claim-local: on the roof plane when you look up under it, else on the pad. */
function aim(c: Claim): { u: number; v: number; high: boolean } {
  const cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp;
  const x0 = wrapDx(G.pos.x - c.x), y0 = G.pos.y + EYE, z0 = G.pos.z - c.z, top = c.y + H;
  if (dy > 0.05 && y0 < top) { const t = (top - y0) / dy; if (t < 10) return { u: x0 + dx * t, v: z0 + dz * t, high: true }; }
  if (dy < -0.02) { const t = (y0 - c.y) / -dy; if (t < 12) return { u: x0 + dx * t, v: z0 + dz * t, high: false }; }
  const h = Math.hypot(dx, dz) || 1;
  return { u: x0 + dx / h * 4, v: z0 + dz / h * 4, high: false };
}
/** Build mode, every frame: follow the view, check the spot, redraw the hologram when it changed. */
export function updateBuilding() {
  if (kind === null) return;
  const c = claimUnder();
  if (G.char.loc !== 'overworld' || !c) { stopBuilding(true); logLine('You left your claim.'); return; }
  const a = aim(c), shape = PIECES[kind].shape;
  const p: Part = { k: kind, ...snap(shape, a.u, a.v) };
  // the part you look at, for F: a roof overhead, else the wall or door nearest the spot
  aimed = null;
  let best = 0.9;
  for (const q of c.parts ?? []) {
    const qs = PIECES[q.k].shape, e = partEnds(q, qs);
    if ((qs === 'roof') !== a.high) continue;
    const d = qs === 'roof' ? (a.u >= e[0][0] && a.u <= e[2][0] && a.v >= e[0][1] && a.v <= e[2][1] ? 0 : 9)
      : Math.hypot(a.u - Math.max(Math.min(e[0][0], e[1][0]), Math.min(Math.max(e[0][0], e[1][0]), a.u)), a.v - Math.max(Math.min(e[0][1], e[1][1]), Math.min(Math.max(e[0][1], e[1][1]), a.v)));
    if (d < best) { best = d; aimed = { c, p: q }; }
  }
  let problem = partProblem(c.parts ?? [], p) ?? lacks(kind);
  if (!problem && shape !== 'roof' && baseHitLocal([p], wrapDx(G.pos.x - c.x), G.pos.z - c.z, 0.35)) problem = 'You are standing there.';
  target = { c, p, problem };
  const key = `${p.gx}:${p.gz}:${p.d}:${problem ?? ''}:${aimed ? aimed.p.gx + ',' + aimed.p.gz + ',' + aimed.p.d : ''}`;
  if (key === lastKey) return;
  lastKey = key;
  // the hologram: the part's outline where it would stand
  const x0 = nearX(c.x, G.pos.x), y = c.y, pts: number[] = [];
  const seg = (a0: number[], b0: number[]) => pts.push(x0 + a0[0], y + a0[1], c.z + a0[2], x0 + b0[0], y + b0[1], c.z + b0[2]);
  const boxLines = (u0: number, v0: number, u1: number, v1: number, h0: number, h1: number) => {
    const cs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) { const [a1, b1] = cs[i], [a2, b2] = cs[(i + 1) % 4]; seg([a1, h0, b1], [a2, h0, b2]); seg([a1, h1, b1], [a2, h1, b2]); seg([a1, h0, b1], [a1, h1, b1]); }
  };
  const e = partEnds(p, shape);
  if (shape === 'roof') { boxLines(e[0][0], e[0][1], e[2][0], e[2][1], H, H + BUILD.roofT); seg([e[0][0], H, e[0][1]], [e[2][0], H, e[2][1]]); seg([e[1][0], H, e[1][1]], [e[3][0], H, e[3][1]]); }
  else {
    const t = T / 2, [[u0, v0], [u1, v1]] = e, du = p.d === 0 ? 1 : 0, dv = 1 - du;
    boxLines(u0 - dv * t, v0 - du * t, u1 + dv * t, v1 + du * t, 0, H);
    if (shape === 'door') { const j = (C - BUILD.doorW) / 2; boxLines(u0 + du * j - dv * t, v0 + dv * j - du * t, u0 + du * (C - j) + dv * t, v0 + dv * (C - j) + du * t, 0, BUILD.doorH); }
  }
  if (!ghost) { ghost = new THREE.Group(); scene.add(ghost); }
  ghost.traverse((o) => (o as THREE.Line).geometry?.dispose()); ghost.clear();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(geo, problem ? badMat : okMat); l.renderOrder = 10; l.frustumCulled = false; ghost.add(l);
}
/** Click: build the part where the hologram stands. */
export function placePart() {
  if (!kind || !target) return;
  if (target.problem) { logLine(target.problem); return; }
  takeAll(G.char.inv, PIECES[kind].needs);
  (target.c.parts ??= []).push(target.p);
  saveChar(); redraw(target.c); lastKey = '';
  logLine(`${PIECES[kind].name} built.` + (lacks(kind) ? ' ' + lacks(kind) + ' for another.' : ''));
}
/** F: take down the part you look at. */
export function dismantle() {
  if (!kind) return;
  if (!aimed) { logLine('Look at the part you want to take down.'); return; }
  const s = PIECES[aimed.p.k];
  if (!count(G.char.inv, s.cut)) { logLine(`You need a ${ITEMS[s.cut].name} to take ${s.mat === 'wood' ? 'wooden' : 'metal'} parts down.`); return; }
  const parts = aimed.c.parts!;
  parts.splice(parts.indexOf(aimed.p), 1);
  let lost = 0;
  for (const [m, n] of refund(aimed.p.k)) lost += putItems(G.char.inv, m, n, PACK.vol);
  saveChar(); redraw(aimed.c); lastKey = '';
  logLine(`${s.name} taken down.` + (lost ? ' Your backpack is full: some of the materials were left behind.' : ' Half the materials go back into your backpack.'));
  aimed = null;
}
/** The hint shown while building (null when not building). */
export function buildHint(): string | null {
  if (!kind) return null;
  if (!target) return '';
  const t = target.problem ?? `Click — build ${PIECES[kind].name}`;
  return t + (aimed ? ` · F — take down ${PIECES[aimed.p.k].name}` : '') + ' · B — parts · right mouse — stop';
}
export const buildOk = () => !!target && !target.problem;
