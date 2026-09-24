// Building on your claim at runtime: the parts drawn storey by storey (walls, doors, floors and roofs, stairs; wood
// or metal), what they do to the world (walls and shut doors stop you, creatures, shots and eyes; slabs and stairs
// carry you), code locks on doors, and the build mode: pick a part in the build list (B), a hologram snaps to the
// grid round your flag on the storey you stand on (white when it fits, red with the reason), a click builds it from
// what your backpack holds (the tools stay), F takes down the part you look at (hammer for wood, torch for metal;
// half the materials come back), E opens and shuts doors, L sets a door's code lock. The rules are pure, in
// gen/base.ts; the parts are saved with the claim.
import * as THREE from 'three';
import { scene } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { saveChar, takeOne, addItem } from '../character';
import { count, takeAll } from '../data/crafting';
import { putItems } from '../inventory';
import { PACK, ITEMS } from '../data/items';
import { PIECES, BUILD, type PieceKind } from '../data/building';
import { partEnds, snap, partProblem, baseHitLocal, refund, solids, floorLocal, rayLocal, solidAt, shapeOf, lvOf, floorH, cellsOf, stairDir, validCode, type Part, type Box } from '../gen/base';
import { claimDist, CLAIM } from '../gen/claims';
import { nearX, wrapDx } from '../gen/regions';
import { EYE, STEP_UP } from './player';
import { logLine } from '../ui/hud';
import { openKeypad } from '../ui/keypad';
import { syncTurrets } from './turrets';
import type { Char } from '../save';

type Claim = Char['claims'][number];
const WOOD = 0xb8b060, METAL = 0xa8c8b8, LOCK = 0xff5a3c, C = BUILD.cell, H = BUILD.wallH, T = BUILD.thick;
/** Solid boxes per claim, rebuilt after any change (every change redraws the claim, which bumps `rev`). */
const boxCache = new WeakMap<Claim, { rev: number; boxes: Box[] }>();
let rev = 0;
function boxesOf(c: Claim): Box[] {
  let e = boxCache.get(c);
  if (!e || e.rev !== rev) { e = { rev, boxes: solids(c.parts ?? []) }; boxCache.set(c, e); }
  return e.boxes;
}
/** Claims with something built within reach of (x, z). */
const basesNear = (x: number, z: number, pad = 2) => G.char.claims.filter((c) => c.parts?.length && claimDist(c, x, z) < CLAIM.flat + pad);

// ---------- drawing ----------
const drawn = new Map<Claim, THREE.Group>();
function model(c: Claim, x0: number): THREE.Group {
  const pb = new PropBatch(), y = c.y, z0 = c.z;
  const B = (u0: number, v0: number, u1: number, v1: number, h0: number, h1: number, col: number) =>
    pb.box(x0 + Math.min(u0, u1), y + h0, z0 + Math.min(v0, v1), x0 + Math.max(u0, u1), y + h1, z0 + Math.max(v0, v1), col);
  const L = (col: number, ...pts: [number, number, number][]) => pb.line(col, ...pts.map(([u, h, v]) => [x0 + u, y + h, z0 + v]));
  for (const p of c.parts ?? []) {
    const s = PIECES[p.k], col = s.mat === 'wood' ? WOOD : METAL, base = floorH(lvOf(p)), shape = s.shape;
    if (shape === 'roof') {
      const u = p.gx * C, v = p.gz * C;
      B(u, v, u + C, v + C, base - BUILD.slab, base, col);
      for (let k = 0.4; k < C; k += 0.4) L(col, [u + k, base + 0.01, v], [u + k, base + 0.01, v + C]);
      continue;
    }
    if (shape === 'turret') { // the plinth; the turning head is world/turrets.ts
      const u = p.gx * C + C / 2, v = p.gz * C + C / 2;
      B(u - 0.4, v - 0.4, u + 0.4, v + 0.4, base, base + 0.25, col); B(u - 0.18, v - 0.18, u + 0.18, v + 0.18, base + 0.25, base + 1, col);
      continue;
    }
    if (shape === 'stairs') {
      // ten treads on two stringers, climbing one storey over two cells
      const e = partEnds(p), d = p.d & 3, along = d === 0 || d === 2, sgn = d < 2 ? 1 : -1, n = 10, run = 2 * C / n, rise = BUILD.storey / n;
      const s0 = along ? (sgn > 0 ? e[0][0] : e[2][0]) : (sgn > 0 ? e[0][1] : e[2][1]), w0 = along ? e[0][1] : e[0][0];
      for (let i = 0; i < n; i++) {
        const a0 = s0 + sgn * i * run, a1 = s0 + sgn * (i + 1) * run, h = base + rise * (i + 1);
        if (along) B(a0, w0 + 0.1, a1, w0 + C - 0.1, h - 0.08, h, col); else B(w0 + 0.1, a0, w0 + C - 0.1, a1, h - 0.08, h, col);
      }
      for (const w of [w0 + 0.1, w0 + C - 0.1]) {
        const a = along ? [s0, base, w] : [w, base, s0], b = along ? [s0 + sgn * 2 * C, base + BUILD.storey, w] : [w, base + BUILD.storey, s0 + sgn * 2 * C];
        L(col, a as [number, number, number], b as [number, number, number]);
      }
      continue;
    }
    const [[u0, v0]] = partEnds(p), du = p.d === 0 ? 1 : 0, dv = 1 - du, t = T / 2;
    const slab = (s0: number, s1: number, h0: number, h1: number, th = t) =>
      B(u0 + du * s0 - dv * th, v0 + dv * s0 - du * th, u0 + du * s1 + dv * th, v0 + dv * s1 + du * th, base + h0, base + h1, col);
    const at = (a: number, h: number, side: number): [number, number, number] => [u0 + du * a + dv * side, base + h, v0 + dv * a + du * side];
    const face = (s0: number, s1: number, h1: number) => {
      for (const side of [-t - 0.01, t + 0.01]) {
        if (s.mat === 'wood') for (let h = 0.4; h < h1; h += 0.4) L(col, at(s0, h, side), at(s1, h, side));
        else { for (let a = s0 + 0.5; a < s1 - 0.1; a += 0.5) L(col, at(a, 0, side), at(a, h1, side)); L(col, at(s0, h1 * 0.5, side), at(s1, h1 * 0.5, side)); }
      }
    };
    if (shape === 'wall') { slab(0, C, 0, H); face(0, C, H); continue; }
    const j = (C - BUILD.doorW) / 2;
    slab(0, j, 0, H); slab(C - j, C, 0, H); slab(j, C - j, BUILD.doorH, H);
    face(0, j, H); face(C - j, C, H);
    if (p.lock) for (const side of [-t - 0.02, t + 0.02]) { // the keypad by the latch
      const a = C - j + 0.12;
      L(p.lock.on ? LOCK : col, at(a, 1.0, side), at(a + 0.18, 1.0, side), at(a + 0.18, 1.3, side), at(a, 1.3, side), at(a, 1.0, side));
    }
    if (!p.open) {
      slab(j + 0.02, C - j - 0.02, 0.02, BUILD.doorH - 0.02, 0.04);
      for (const side of [-0.05, 0.05]) { L(col, at(j + 0.1, 0.2, side), at(C - j - 0.1, BUILD.doorH - 0.2, side)); L(col, at(C - j - 0.25, 1.05, side), at(C - j - 0.15, 1.05, side)); }
    } else {
      const hu = u0 + du * j, hv = v0 + dv * j;
      B(hu - du * 0.04 + dv * 0.02, hv - dv * 0.04 + du * 0.02, hu + du * 0.04 + dv * BUILD.doorW, hv + dv * 0.04 + du * BUILD.doorW, base + 0.02, base + BUILD.doorH - 0.02, col);
    }
  }
  return pb.build();
}
function redraw(c: Claim) {
  rev++;
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

// ---------- what the building does to the world ----------
/** Walls, shut doors and the undersides of floors: does a figure (radius r, feet at y) run into one? */
export function baseHit(x: number, y: number, z: number, r: number): boolean {
  for (const c of basesNear(x, z)) if (baseHitLocal(c.parts!, wrapDx(x - c.x), y - c.y, z - c.z, r, 1.7, boxesOf(c))) return true;
  return false;
}
/** The highest floor or stair under (x, z) you can step onto from height y (-Infinity when none). */
export function baseFloor(x: number, y: number, z: number): number {
  let best = -Infinity;
  for (const c of basesNear(x, z, 1)) best = Math.max(best, c.y + floorLocal(c.parts!, wrapDx(x - c.x), z - c.z, y - c.y + STEP_UP));
  return best;
}
/** Distance along a ray to the first wall, shut door or floor of a base: shots and eyes stop there. */
export function baseRay(o: { x: number; y: number; z: number }, d: { x: number; y: number; z: number }, maxT: number): number {
  let best = maxT;
  for (const c of G.char.claims) {
    if (!c.parts?.length) continue;
    const u = wrapDx(o.x - c.x), v = o.z - c.z;
    // skip bases the ray cannot reach
    const reach = CLAIM.flat + 2, cu = u + d.x * best / 2, cv = v + d.z * best / 2;
    if (Math.hypot(cu, cv) > reach + best / 2) continue;
    best = Math.min(best, rayLocal([u, o.y - c.y, v], [d.x, d.y, d.z], best, boxesOf(c)));
  }
  return best;
}
/** Is the point inside a wall, a shut door or a floor? (Bolts die there, loot rests on floors.) */
export function baseSolid(p: { x: number; y: number; z: number }): boolean {
  for (const c of basesNear(p.x, p.z)) if (solidAt(wrapDx(p.x - c.x), p.y - c.y, p.z - c.z, boxesOf(c))) return true;
  return false;
}

// ---------- doors and code locks ----------
/** A door of yours within reach (for E and L). */
export function nearDoor(): { c: Claim; p: Part } | null {
  if (G.char.loc !== 'overworld') return null;
  for (const c of basesNear(G.pos.x, G.pos.z)) for (const p of c.parts ?? []) {
    if (shapeOf(p) !== 'door') continue;
    const [[u0, v0], [u1, v1]] = partEnds(p), u = wrapDx(G.pos.x - c.x), v = G.pos.z - c.z;
    if (Math.hypot(u - (u0 + u1) / 2, v - (v0 + v1) / 2) < 1.7 && Math.abs(G.pos.y - c.y - floorH(lvOf(p))) < 1.5) return { c, p };
  }
  return null;
}
const authed = (p: Part) => !p.lock || !p.lock.on || p.lock.auth.includes(G.char.pid);
function swing(d: { c: Claim; p: Part }) {
  d.p.open = !d.p.open;
  if (!d.p.open && baseHit(G.pos.x, G.pos.y, G.pos.z, 0.3)) { d.p.open = true; logLine('You are standing in the doorway.'); return; }
  saveChar(); redraw(d.c);
}
/** E at a door: open or shut it; a locked one asks for its code first. */
export function toggleDoor(d: { c: Claim; p: Part }) {
  const lock = d.p.lock;
  if (d.p.open || authed(d.p)) { swing(d); return; }
  openKeypad({
    title: 'Code lock', sub: 'Locked. Enter the code.',
    enter(code) {
      if (!lock || code !== lock.code) return 'Wrong code.';
      lock.auth.push(G.char.pid); swing(d); logLine('The lock clicks open.'); return '';
    },
  });
}
/** The prompt for a door: what E and L do there. */
export function doorPrompt(d: { c: Claim; p: Part }): string {
  const lock = d.p.lock, e = d.p.open ? 'E — shut the door' : lock?.on && !authed(d.p) ? 'E — enter the code' : 'E — open the door';
  if (lock) return e + (authed(d.p) ? ' · L — code lock' : '');
  return e + (count(G.char.inv, 'codelock') ? ' · L — fit your Code Lock' : '');
}
/** L at a door: fit a code lock (set its code), or change the code, lock or unlock it, take it off. */
export function lockMenu(d: { c: Claim; p: Part }) {
  const lock = d.p.lock, done = (m: string) => { saveChar(); redraw(d.c); logLine(m); return ''; };
  if (!lock) {
    if (!count(G.char.inv, 'codelock')) { logLine('You need a Code Lock (Zofia sells them).'); return; }
    openKeypad({
      title: 'Fit the code lock', sub: 'Choose a 4-digit code.',
      enter(code) {
        if (!validCode(code)) return 'Four digits.';
        if (!takeOne('codelock')) return 'You have no Code Lock.';
        d.p.lock = { code, on: true, auth: [G.char.pid] }; d.p.open = false;
        if (baseHit(G.pos.x, G.pos.y, G.pos.z, 0.3)) d.p.open = true;
        return done(`Code lock fitted, code ${code}. The door is locked; you can open it, others need the code.`);
      },
    });
    return;
  }
  if (!authed(d.p)) { logLine('Enter the code first (E).'); return; }
  openKeypad({
    title: 'Code lock', sub: `Code ${lock.code} · ${lock.on ? 'locked' : 'unlocked'}. Type a new code to change it.`,
    enter(code) { lock.code = code; lock.auth = [G.char.pid]; return done(`New code: ${code}. Everyone else has to enter it again.`); },
    acts: [
      [lock.on ? 'Leave it unlocked' : 'Lock it', () => { lock.on = !lock.on; return done(lock.on ? 'Locked.' : 'Unlocked: anyone can open the door.'); }],
      ['Take the lock off', () => { if (!addItem('codelock')) return 'No room in your backpack.'; delete d.p.lock; return done('You take the code lock off.'); }],
    ],
  });
}

// ---------- build mode ----------
let kind: PieceKind | null = null, ghost: THREE.Group | null = null, lastKey = '';
let target: { c: Claim; p: Part; problem: string | null } | null = null, aimed: { c: Claim; p: Part } | null = null;
const okMat = new THREE.LineBasicMaterial({ color: 0xe8fff0, transparent: true, opacity: 0.9, depthTest: false, fog: false });
const badMat = new THREE.LineBasicMaterial({ color: 0xff5a3c, transparent: true, opacity: 0.9, depthTest: false, fog: false });

const claimUnder = () => G.char.claims.find((c) => claimDist(c, G.pos.x, G.pos.z) < CLAIM.r);
/** The storey you stand on. */
const storeyAt = (c: Claim) => Math.max(0, Math.min(BUILD.levels - 1, Math.round((G.pos.y - c.y) / BUILD.storey)));
export const isBuilding = () => kind !== null;
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

/** Where you look, claim-local, on the storey you stand on: under the ceiling when you look up, else on the floor. */
function aim(c: Claim, lv: number): { u: number; v: number; high: boolean } {
  const cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp;
  const x0 = wrapDx(G.pos.x - c.x), y0 = G.pos.y + EYE - c.y, z0 = G.pos.z - c.z, floor = floorH(lv), top = floor + H;
  if (dy > 0.05 && y0 < top) { const t = (top - y0) / dy; if (t < 10) return { u: x0 + dx * t, v: z0 + dz * t, high: true }; }
  if (dy < -0.02) { const t = (y0 - floor) / -dy; if (t < 12) return { u: x0 + dx * t, v: z0 + dz * t, high: false }; }
  const h = Math.hypot(dx, dz) || 1;
  return { u: x0 + dx / h * 4, v: z0 + dz / h * 4, high: false };
}
/** Build mode, every frame: follow the view, check the spot, redraw the hologram when it changed. */
export function updateBuilding() {
  if (kind === null) return;
  const c = claimUnder();
  if (G.char.loc !== 'overworld' || !c) { stopBuilding(true); logLine('You left your claim.'); return; }
  const lv = storeyAt(c), a = aim(c, lv), shape = PIECES[kind].shape;
  const p: Part = { k: kind, ...snap(shape, a.u, a.v), lv: shape === 'roof' ? (a.high ? lv + 1 : lv) : lv };
  if (shape === 'stairs') p.d = stairDir(G.yaw);
  // the part you look at, for F: the slab overhead when you look up, else what stands on your storey
  aimed = null;
  let best = 0.9;
  for (const q of c.parts ?? []) {
    const qs = shapeOf(q), ql = lvOf(q), e = partEnds(q);
    const want = qs === 'roof' ? (a.high ? ql === lv + 1 : false) : !a.high && ql === lv;
    if (!want) continue;
    const inRect = a.u >= e[0][0] && a.u <= e[2]?.[0] && a.v >= e[0][1] && a.v <= e[2]?.[1];
    const d = qs === 'roof' || qs === 'stairs' || qs === 'turret' ? (inRect ? (qs === 'turret' ? 0.2 : 0.5) : 9)
      : Math.hypot(a.u - Math.max(Math.min(e[0][0], e[1][0]), Math.min(Math.max(e[0][0], e[1][0]), a.u)), a.v - Math.max(Math.min(e[0][1], e[1][1]), Math.min(Math.max(e[0][1], e[1][1]), a.v)));
    if (d < best) { best = d; aimed = { c, p: q }; }
  }
  let problem = partProblem(c.parts ?? [], p) ?? lacks(kind);
  if (!problem && (shape === 'wall' || shape === 'door') && baseHitLocal([p], wrapDx(G.pos.x - c.x), G.pos.y - c.y, G.pos.z - c.z, 0.35)) problem = 'You are standing there.';
  target = { c, p, problem };
  const key = `${p.gx}:${p.gz}:${p.d}:${p.lv}:${problem ?? ''}:${aimed ? aimed.p.gx + ',' + aimed.p.gz + ',' + aimed.p.d : ''}`;
  if (key === lastKey) return;
  lastKey = key;
  // the hologram: the part's outline where it would stand
  const x0 = nearX(c.x, G.pos.x), y = c.y, pts: number[] = [], base = floorH(lvOf(p));
  const seg = (a0: number[], b0: number[]) => pts.push(x0 + a0[0], y + a0[1], c.z + a0[2], x0 + b0[0], y + b0[1], c.z + b0[2]);
  const boxLines = (u0: number, v0: number, u1: number, v1: number, h0: number, h1: number) => {
    const cs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    for (let i = 0; i < 4; i++) { const [a1, b1] = cs[i], [a2, b2] = cs[(i + 1) % 4]; seg([a1, h0, b1], [a2, h0, b2]); seg([a1, h1, b1], [a2, h1, b2]); seg([a1, h0, b1], [a1, h1, b1]); }
  };
  const e = partEnds(p);
  if (shape === 'roof') { boxLines(e[0][0], e[0][1], e[2][0], e[2][1], base - BUILD.slab, base); seg([e[0][0], base, e[0][1]], [e[2][0], base, e[2][1]]); seg([e[1][0], base, e[1][1]], [e[3][0], base, e[3][1]]); }
  else if (shape === 'turret') { const u = p.gx * C + C / 2, v = p.gz * C + C / 2; boxLines(u - 0.4, v - 0.4, u + 0.4, v + 0.4, base, base + 1); boxLines(u - 0.3, v - 0.3, u + 0.3, v + 0.3, base + 1, base + 1.6); }
  else if (shape === 'stairs') {
    boxLines(e[0][0], e[0][1], e[2][0], e[2][1], base, base + 0.05);
    const [[au, av], [bu, bv]] = cellsOf(p).map(([gx, gz]) => [gx * C + C / 2, gz * C + C / 2]);
    seg([au - (bu - au) / 2, base, av - (bv - av) / 2], [bu + (bu - au) / 2, base + BUILD.storey, bv + (bv - av) / 2]); // the climb
  } else {
    const t = T / 2, [[u0, v0], [u1, v1]] = e, du = p.d === 0 ? 1 : 0, dv = 1 - du;
    boxLines(u0 - dv * t, v0 - du * t, u1 + dv * t, v1 + du * t, base, base + H);
    if (shape === 'door') { const j = (C - BUILD.doorW) / 2; boxLines(u0 + du * j - dv * t, v0 + dv * j - du * t, u0 + du * (C - j) + dv * t, v0 + dv * (C - j) + du * t, base, base + BUILD.doorH); }
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
  saveChar(); redraw(target.c); lastKey = ''; syncTurrets();
  logLine(`${PIECES[kind].name} built.` + (lacks(kind) ? ' ' + lacks(kind) + ' for another.' : ''));
}
/** F: take down the part you look at. */
export function dismantle() {
  if (!kind) return;
  if (!aimed) { logLine('Look at the part you want to take down.'); return; }
  const s = PIECES[aimed.p.k], parts = aimed.c.parts!;
  if (!count(G.char.inv, s.cut)) { logLine(`You need a ${ITEMS[s.cut].name} to take ${s.mat === 'wood' ? 'wooden' : 'metal'} parts down.`); return; }
  if (aimed.p.lock && !authed(aimed.p)) { logLine('It is locked: you cannot take it down without the code.'); return; }
  const lv = lvOf(aimed.p);
  if (parts.some((q) => q !== aimed!.p && lvOf(q) > lv && partProblem(parts.filter((o) => o !== aimed!.p && o !== q), q))) { logLine('Something above rests on it: take that down first.'); return; }
  parts.splice(parts.indexOf(aimed.p), 1);
  let lost = 0;
  for (const [m, n] of refund(aimed.p.k)) lost += putItems(G.char.inv, m, n, PACK.vol);
  if (aimed.p.lock && !addItem('codelock')) lost++;
  saveChar(); redraw(aimed.c); lastKey = ''; syncTurrets();
  logLine(`${s.name} taken down.` + (lost ? ' Your backpack is full: some of the materials were left behind.' : ' Half the materials go back into your backpack.'));
  aimed = null;
}
/** The hint shown while building (null when not building). */
export function buildHint(): string | null {
  if (!kind) return null;
  if (!target) return '';
  const lv = target.p.lv ?? 0, t = target.problem ?? `Click — build ${PIECES[kind].name}${lv > 0 ? ` (storey ${lv})` : ''}`;
  return t + (aimed ? ` · F — take down ${PIECES[aimed.p.k].name}` : '') + ' · B — parts · right mouse — stop';
}
export const buildOk = () => !!target && !target.problem;
