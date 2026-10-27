// (0.277, the owner's request) The Crystal Wastes bite back: the plain crystal spikes sticking out of the ground there
// are solid (you cannot walk through them) and cut whoever walks or runs into them, the harder the faster; and every
// stretch of the wastes holds one Crystal Colossus, a giant of living crystal that charges whoever comes near.
// Pure and deterministic from the world seed: every player sees the same spikes and the same giant's lair.
import { hash, rng } from '../core/rng';
import { CHUNK, wrapC, X_MIN, WORLD_W } from './regions';
import { biomeOfCell, biomeAt } from './biomes';
import { BIOME, noise } from './biomeshape';

/**
 * The spikes: `n` tries a chunk in the wastes, each a cluster of 1–4 pointed columns `h` high, its foot `r` wide
 * (the solid circle); `hurt` HP at a walk, `perMs` more for every m/s you come in at, at most once every `cool` s,
 * thrown back `push` m/s; slower than `still` m/s it only blocks.
 */
export const SPIKE = { n: 9, h: [1.2, 3.4], r: [0.45, 1.05], hurt: 4, perMs: 1.6, cool: 0.7, push: 5, still: 0.6, reach: 0.25 };
export interface Spike { x: number; z: number; r: number; h: number; seed: number }

/** The spike clusters of chunk (cx, cz) (canonical x: the copy asked for is shifted); none outside the wastes. */
export function chunkSpikes(world: number, cx: number, cz: number): Spike[] {
  const R = rng(hash(world, wrapC(cx), cz, 0x5b1e)), out: Spike[] = [], x0 = cx * CHUNK, z0 = cz * CHUNK;
  if (biomeOfCell(world, x0 + CHUNK / 2, z0 + CHUNK / 2) !== 'crystal' && biomeOfCell(world, x0, z0) !== 'crystal' && biomeOfCell(world, x0 + CHUNK, z0 + CHUNK) !== 'crystal') return out;
  for (let i = 0; i < SPIKE.n; i++) {
    const x = x0 + R() * CHUNK, z = z0 + R() * CHUNK, r = SPIKE.r[0] + R() * (SPIKE.r[1] - SPIKE.r[0]), h = SPIKE.h[0] + R() * (SPIKE.h[1] - SPIKE.h[0]), seed = (R() * 2 ** 31) | 0;
    if (biomeOfCell(world, x, z) !== 'crystal') continue;
    if (out.some((s) => Math.hypot(s.x - x, s.z - z) < s.r + r + 2.2)) continue; // room to pass between them
    out.push({ x, z, r, h, seed });
  }
  return out;
}
/** What running into a spike at `speed` m/s costs (HP); 0 when you only lean on it. */
export const spikeHurt = (speed: number) => (speed < SPIKE.still ? 0 : SPIKE.hurt + SPIKE.perMs * speed);

/**
 * The colossi: the planet is cut into `cell` m squares; in each, the strongest spot of the wastes' noise on a grid of
 * `step` m that lies in the wastes is a lair (a stretch of the wastes split between squares keeps only the stronger
 * of two lairs closer than `apart`). The giant wakes when a player comes within `wake` m and goes back to sleep when
 * all are beyond `sleep`; it gives up a chase `leash` m from its lair; killed, it is back after `respawn` ms.
 */
export const GIANT = {
  cell: 6000, step: 500, apart: 3500, wake: 260, sleep: 420, leash: 230, respawn: 3 * 3600_000,
  /** Its size: `height` m tall (a player is 1.8), its hips `hip` m up, the body's centre `lift` m over its feet. */
  height: 26, hip: 12, lift: 13,
  /** Charging: top speed (m/s), how fast it gets there and stops (m/s²), how fast it can turn at full speed and when
   *  slow (rad/s); it gives the charge up and skids when you are more than `skid` rad off its line within `near` m. */
  speed: 16, accel: 5, brake: 9, turnFast: 0.32, turnSlow: 1.1, skid: 0.8, near: 30,
  /** Its blow: it swings from `strike` m (flat, from its middle) at whoever is within `aim` rad of its line, the
   *  wind-up `windup` s (step aside now!), it hits within `reach` m in a cone of `cone` rad, then stands `recover` s;
   *  running you down within `trample` m hurts too (`trampleHurt`). */
  strike: 9, aim: 0.45, windup: 0.85, reach: 11, cone: 0.6, recover: 1.6, trample: 4.5, trampleHurt: 0.5,
  /** It notices you within `notice` m (it is a giant: sight is not the point), roars `roar` s, then comes. */
  notice: 95, roar: 1.6,
};
export interface Lair { id: string; x: number; z: number; v: number }
const lairs = new Map<string, Lair | null>();
let lairWorld = NaN;
const crys = (world: number, x: number, z: number) => noise(world, 0xb10e3, BIOME.crys, x, z);
/** The strongest spot of the wastes in square (i, j), before the neighbours are weighed. */
function rawLair(world: number, i: number, j: number): Lair | null {
  const key = 'r' + i + ',' + j;
  if (lairs.has(key)) return lairs.get(key)!;
  let best: Lair | null = null;
  const n = GIANT.cell / GIANT.step;
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const x = X_MIN + i * GIANT.cell + (a + 0.5) * GIANT.step, z = j * GIANT.cell + (b + 0.5) * GIANT.step;
    if (x >= X_MIN + WORLD_W) continue; // the last square round the planet is cut short at the seam
    const v = crys(world, x, z);
    if (v <= BIOME.crysAt + 0.02 || (best && v <= best.v)) continue;
    if (biomeAt(world, x, z) !== 'crystal') continue;
    best = { id: `giant:${i}:${j}`, x, z, v };
  }
  lairs.set(key, best);
  return best;
}
const COLS = Math.ceil(WORLD_W / GIANT.cell);
const wrapI = (i: number) => ((i % COLS) + COLS) % COLS;
/** The lair of square (i, j) (canonical: squares count from the planet's seam, `X_MIN`), or null: no wastes there,
 *  or a stronger lair of a neighbour (across the seam too) is close. */
export function giantLair(world: number, i: number, j: number): Lair | null {
  if (world !== lairWorld) { lairs.clear(); lairWorld = world; }
  const L = rawLair(world, wrapI(i), j);
  if (!L) return null;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    if (!a && !b) continue;
    const o = rawLair(world, wrapI(i + a), j + b);
    if (!o) continue;
    const ox = o.x + Math.round((L.x - o.x) / WORLD_W) * WORLD_W; // the copy beside it
    if (Math.hypot(ox - L.x, o.z - L.z) < GIANT.apart && (o.v > L.v || (o.v === L.v && o.id < L.id))) return null;
  }
  return L;
}
/** The lairs within r of (x, z), placed on the copy of the planet nearest x. */
export function giantLairsNear(world: number, x: number, z: number, r: number): Lair[] {
  const out: Lair[] = [];
  const i0 = Math.floor((x - r - X_MIN) / GIANT.cell) - 1, i1 = Math.floor((x + r - X_MIN) / GIANT.cell) + 1, j0 = Math.floor((z - r) / GIANT.cell), j1 = Math.floor((z + r) / GIANT.cell);
  const seen = new Set<string>();
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const L = giantLair(world, i, j);
    if (!L || seen.has(L.id)) continue;
    const lx = L.x + Math.round((x - L.x) / WORLD_W) * WORLD_W;
    if (Math.hypot(lx - x, L.z - z) <= r) { seen.add(L.id); out.push({ ...L, x: lx }); }
  }
  return out;
}
/** Whether a lair's giant is still dead (killed at `at` ms, now `now` ms). */
export const giantDead = (at: number | undefined, now: number) => at !== undefined && now - at < GIANT.respawn;

/**
 * The turn a charging giant can make this step: towards the wanted heading by at most its turning rate, which falls
 * from `turnSlow` standing to `turnFast` at full speed (the weakness: it cannot follow a zigzag).
 */
export function giantTurn(heading: number, want: number, speed: number, dt: number): number {
  const k = Math.min(1, Math.max(0, speed / GIANT.speed)), rate = GIANT.turnSlow + (GIANT.turnFast - GIANT.turnSlow) * k;
  let d = want - heading; d = Math.atan2(Math.sin(d), Math.cos(d));
  return heading + Math.max(-rate * dt, Math.min(rate * dt, d));
}
