// Inside a cave system (gen/cavegen.ts): the floor and the vault drawn as two warped nets over dark fill that meet in
// rounded walls, stalagmites and stalactites, chests in the pockets, nutrient crystals, stray drones, and daylight at
// each way out. You walk on the smooth floor (G.ground), a coarse voxel grid of the rock keeps you inside and stops
// shots and eyes (rayWorld), and E at a way out takes you back to that cave mouth; in a linked system the other way
// out comes out on the far side of the mountain.
import * as THREE from 'three';
import { scene, lineMat, fillMat, GRID } from './render';
import { G, W } from '../game';
import { hash } from '../core/rng';
import { VoxelGrid } from '../core/voxel';
import { setPlaceLight } from './light';
import { UNDER, caveLamps } from '../gen/darkness';
import { CRYSTAL_HUES } from '../gen/crystals';
import { rng } from '../core/rng';
import { generateCave, headroom, floorAtCave, ceilAtCave, type CaveMap } from '../gen/cavegen';
import { makeChest, setCrystalXp } from './loot';
import { placeCrystals } from './flora';
import { populate, guardAlive, beastDown } from './dungeonfoes';
import { caveBeasts, caveDrones } from '../gen/cavefauna';
import { setCreatureEnv, spawnLairBeast, onLairDown, clearCreatures, type Creature } from './creatures';
import { spawnAuthority } from './remote';
import { dangerAt } from '../gen/danger';
import { setStreakSources } from './fx';
import { PropBatch } from './props';
import { el } from '../ui/hud';
import { buildMini, setMiniMode, setMiniOpen } from '../ui/minimap';
import type { DungeonPos } from '../save';

const ROCK = 0x8fb89a, EXIT = 0x5cc8ff;
export let cave: CaveMap | null = null;

/** The cave's meshes: floor and vault as nets (lines every 2 m) over a dark fill, closed where they meet. */
function caveMesh(m: CaveMap): THREE.Group {
  const { nx, nz } = m, tri: number[] = [], lines: number[] = [], vault: number[] = [];
  // at every sample: the floor and the vault, pinched together in the rock
  const F = new Float32Array(nx * nz), Cc = new Float32Array(nx * nz);
  for (let o = 0; o < nx * nz; o++) { const f = m.floor[o], c = m.ceil[o]; if (c > f) { F[o] = f; Cc[o] = c; } else { F[o] = Cc[o] = (f + c) / 2; } }
  const open = (o: number) => m.ceil[o] > m.floor[o];
  const P = (i: number, k: number, a: Float32Array) => [i + m.ox, a[i + nx * k], k + m.oz];
  for (let k = 0; k + 1 < nz; k++) for (let i = 0; i + 1 < nx; i++) {
    const o = i + nx * k, cs = [o, o + 1, o + nx + 1, o + nx];
    if (!cs.some(open)) continue;
    for (const [a, up] of [[F, false], [Cc, true]] as const) {
      const p00 = P(i, k, a), p10 = P(i + 1, k, a), p11 = P(i + 1, k + 1, a), p01 = P(i, k + 1, a);
      if (up) tri.push(...p00, ...p11, ...p10, ...p00, ...p01, ...p11); else tri.push(...p00, ...p10, ...p11, ...p00, ...p11, ...p01);
      const L = up ? vault : lines;
      if (k % 2 === 0) L.push(...p00, ...p10);
      if (i % 2 === 0) L.push(...p00, ...p01);
    }
  }
  const geo = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
  const fill = fillMat(); (fill as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  const grp = new THREE.Group();
  grp.add(new THREE.Mesh(geo(tri), fill), new THREE.LineSegments(geo(lines), lineMat(GRID)), new THREE.LineSegments(geo(vault), lineMat(0x1f9a48)));
  // stalagmites and stalactites, and the daylight at the ways out
  const pb = new PropBatch();
  for (const s of m.spikes) {
    if (headroom(m, s.x, s.z) < s.len + 1.9) continue;
    if (s.up) pb.cone(s.x, floorAtCave(m, s.x, s.z) - 0.1, s.z, s.r, s.len, ROCK, 7);
    else pb.cone(s.x, ceilAtCave(m, s.x, s.z) + 0.1, s.z, s.r, -s.len, ROCK, 7);
  }
  for (const e of m.exits) {
    const y = floorAtCave(m, e.ox, e.oz), pts: number[][] = [];
    for (let t = 0; t <= 12; t++) { const a = Math.PI * t / 12; pts.push([e.ox, y + Math.sin(a) * 4.4, e.oz - Math.cos(a) * 2.8]); }
    pb.line(EXIT, ...pts); pb.line(EXIT, [e.ox, y + 0.05, e.oz - 2.8], [e.ox, y + 0.05, e.oz + 2.8]);
  }
  grp.add(pb.build(), glowCrystals(m));
  return grp;
}
/**
 * (0.244) The glowing crystals: each cluster a fan of pointed six-sided columns growing up from the floor or hanging
 * from the vault, dark inside, their edges drawn without fog so they shine in the black (they are the cave's lamps,
 * gen/darkness.ts `caveLamps`).
 */
function glowCrystals(m: CaveMap): THREE.Group {
  const tri: number[] = [], seg: number[] = [], col: number[] = [], g = new THREE.Group();
  for (const [ci, c] of m.glow.entries()) {
    const R = rng(m.seed ^ (0x9c1 + ci * 7919)), [hc] = CRYSTAL_HUES[c.hue % CRYSTAL_HUES.length], cr = new THREE.Color(hc);
    const y0 = c.up ? floorAtCave(m, c.x, c.z) - 0.15 : ceilAtCave(m, c.x, c.z) + 0.15, sgn = c.up ? 1 : -1, room = headroom(m, c.x, c.z);
    const n = 3 + Math.floor(R() * 4);
    for (let j = 0; j < n; j++) {
      const main = j === 0, a = R() * 6.283, tilt = main ? R() * 0.2 : 0.35 + R() * 0.5;
      const len = Math.min(room * (c.up ? 0.6 : 0.4), (main ? 1.4 : 0.6 + R() * 0.8) * (1 + c.r * 1.6)), w = (main ? 0.22 : 0.1 + R() * 0.1) * (1 + c.r);
      const bx = c.x + (main ? 0 : Math.cos(a) * c.r * 0.5), bz = c.z + (main ? 0 : Math.sin(a) * c.r * 0.5);
      const ax = Math.cos(a) * Math.sin(tilt), ay = Math.cos(tilt) * sgn, az = Math.sin(a) * Math.sin(tilt);
      // two axes across the column
      const ux = -az, uz = ax, ul = Math.hypot(ux, uz) || 1, U = [ux / ul, 0, uz / ul], V = [ay * U[2] - az * 0, az * U[0] - ax * U[2], ax * 0 - ay * U[0]];
      const at = (k: number, h: number, rr: number) => { const t = k / 6 * 6.283, cu = Math.cos(t) * rr, sv = Math.sin(t) * rr; return [bx + U[0] * cu + V[0] * sv + ax * h, y0 + U[1] * cu + V[1] * sv + ay * h, bz + U[2] * cu + V[2] * sv + az * h]; };
      const tip = [bx + ax * len * 1.2, y0 + ay * len * 1.2, bz + az * len * 1.2];
      for (let k = 0; k < 6; k++) {
        const p0 = at(k, 0, w * 1.1), p1 = at(k + 1, 0, w * 1.1), q0 = at(k, len, w), q1 = at(k + 1, len, w);
        tri.push(...p0, ...p1, ...q1, ...p0, ...q1, ...q0, ...q0, ...q1, ...tip);
        for (const [s0, s1] of [[p0, q0], [q0, q1], [q0, tip]]) { seg.push(...s0, ...s1); col.push(cr.r, cr.g, cr.b, cr.r, cr.g, cr.b); }
      }
    }
  }
  const geo = (a: number[]) => { const q = new THREE.BufferGeometry(); q.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return q; };
  const fill = fillMat(); (fill as THREE.MeshBasicMaterial).side = THREE.DoubleSide;
  const lg = geo(seg); lg.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.add(new THREE.Mesh(geo(tri), fill), new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 0.9 })));
  return g;
}
/** The rock as a coarse voxel grid: columns open from the floor to the vault (collision, shots, minimap, drones). */
function caveGrid(m: CaveMap): VoxelGrid {
  let lo = Infinity, hi = -Infinity;
  for (let o = 0; o < m.floor.length; o++) if (m.ceil[o] > m.floor[o]) { lo = Math.min(lo, m.floor[o]); hi = Math.max(hi, m.ceil[o]); }
  const oy = Math.floor(lo) - 2, g = new VoxelGrid(m.ox, oy, m.oz, m.nx - 1, Math.ceil(hi) - oy + 2, m.nz - 1);
  for (let k = 0; k < g.nz; k++) for (let i = 0; i < g.nx; i++) {
    const s = [i + m.nx * k, i + 1 + m.nx * k, i + m.nx * (k + 1), i + 1 + m.nx * (k + 1)];
    const fmin = Math.min(...s.map((o) => m.floor[o])), cmax = Math.max(...s.map((o) => m.ceil[o])), room = Math.max(...s.map((o) => m.ceil[o] - m.floor[o]));
    if (room < 0.4) continue;
    for (let j = 0; j < g.ny; j++) { const y = j + oy; if (y + 1 > fmin && y < cmax - 0.3) g.setCell(i + m.ox, y, k + m.oz, 1); }
  }
  return g;
}

/** Build the cave of the current dungeon position and put the player at the entrance they came in by. */
export function buildCave(d: DungeonPos, clear: () => void, setGroup: (g: THREE.Group) => void) {
  const c = G.char, info = d.cave!;
  const m = generateCave(hash(c.world, d.ruinId, 0xca11), info.mouths.length >= 2 ? 2 : 1);
  clear(); cave = m;
  setCrystalXp(() => 6);
  G.grid = caveGrid(m); G.space = G.grid;
  G.ground = (x, z) => floorAtCave(m, x, z);
  // stalagmites are solid; so are places too low to stand in
  G.obstacle = (x, y, z, r) => {
    if (headroom(m, x, z) < 1.8) return true;
    for (const s of m.spikes) if (s.up && Math.hypot(s.x - x, s.z - z) < s.r * 0.8 + r && y < floorAtCave(m, s.x, s.z) + s.len) return true;
    return false;
  };
  const grp = caveMesh(m); setGroup(grp); scene.add(grp); setStreakSources([]);
  const e = m.exits[Math.min(info.from, m.exits.length - 1)];
  G.pos.set(e.x, e.y, e.z); G.vel.set(0, 0, 0); G.yaw = e.yaw; G.pitch = 0;
  W.chests = m.chests.map((p, i) => { const ch = makeChest(p, i); if (ch) ch.g.position.y = floorAtCave(m, ch.g.position.x, ch.g.position.z); return ch; }).filter((x) => !!x);
  placeCrystals(m.crystals.map((p) => ({ ...p, y: floorAtCave(m, Math.floor(p.x) + 0.5, Math.floor(p.z) + 0.5) })));
  for (let k = 0; k < m.nz - 1; k += 2) for (let i = 0; i < m.nx - 1; i += 2) if (headroom(m, i + 0.5, k + 0.5) > 3.2) W.spawnCells.push([i, Math.floor(floorAtCave(m, i + 0.5, k + 0.5)), k]);
  // (0.244) the beasts in their lairs, now and then a stray machine; a killed one stays dead
  const mouth = info.mouths[Math.min(info.from, info.mouths.length - 1)], lv = Math.max(1, dangerAt(c.world, mouth.x, mouth.z) + 0.5);
  const beasts = caveBeasts(m, lv);
  populate(caveDrones(m.seed), beasts.length, hash(c.world, d.ruinId, 0xca12));
  setCreatureEnv({ ground: (x, z) => floorAtCave(m, x, z), danger: () => lv, nearRuin: () => false, forbidden: (x, z) => headroom(m, x, z) < 2.2, water: () => null }, { indoor: true });
  onLairDown(beastDown);
  if (spawnAuthority()) { // the first one here runs them; the others see copies (world/foesync.ts)
    const groups = new Map<number, Creature[]>();
    beasts.forEach((b, i) => { if (!guardAlive(i)) return; if (!groups.has(b.group)) groups.set(b.group, []); spawnLairBeast(b.kind, b.x, b.z, lv, i, groups.get(b.group)!); });
  }
  setMiniOpen((x, z) => headroom(m, x + 0.5, z + 0.5) > 1.2);
  setMiniMode('voxel'); buildMini();
  el.hudL.textContent = info.name; el.route.style.display = 'none';
  setPlaceLight(true, UNDER.cave, caveLamps(m, (x, z) => floorAtCave(m, x, z))); // (0.199) black as pitch but for the mouths and the crystals' glow
}
export function leaveCave() { if (cave) { clearCreatures(); setCreatureEnv(null); onLairDown(null); } cave = null; setMiniOpen(null); }
/** The way out you stand at (its index), or -1. */
export function caveExitNear(): number {
  if (!cave) return -1;
  return cave.exits.findIndex((e) => Math.hypot(e.ox - G.pos.x, e.oz - G.pos.z) < 3);
}
