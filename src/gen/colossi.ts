// (0.275, the owner's request) Colossi scattered over the planet, far from one another: the great stone heads, one
// at a time or two, and sphinxes like the riddle-gate of an old film (a lion's body seated on its haunches, front legs
// straight, a woman's calm face under long stone hair), alone or a pair facing each other across a gap like a gate.
// Never neatly set out: each sunk into the ground, some to the shoulders, leaning and rolled to a side, a few toppled.
//
// Pure and deterministic from the world seed, like the crystal forests (gen/crystals.ts): at most one site per 256 m
// region (`regionColossi`, cached per canonical region and shifted to the copy of the planet asked for), on natural
// ground (nothing is levelled for them), kept off the sea, villages, places, roads, rivers, lakes and the other
// landmarks; trees, rocks and plants keep off them (`inColossus`). Their solids are capsules (gen/tilt.ts).
import { hash, rng } from '../core/rng';
import { REGION, POLAR_Z, wrapR, regionOf, worldDist, wrapDx, poisNear, villageDist, type Rect } from './regions';
import { seaMask } from './seas';
import { naturalHeight } from './heights';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { regionRoads, nearestOnRoad } from './roads';
import { regionLakes } from './water';
import { inFogSite } from './toxic';
import { inLode } from './lodes';
import { megalithsNear } from './megaliths';
import { gatesNear } from './worldgates';
import { crystalFieldsNear } from './crystals';
import { mountainMask } from './mountains';
import { tiltFrame, capsulesHit, type Capsule } from './tilt';

export const COLOSSI = {
  /** The share of regions holding a head site, and a sphinx site; none within `from` m of Gridholm. */
  head: 0.009, sphinx: 0.004, from: 2500,
  /** A second head beside the first; a sphinx's twin facing it across the gate. */
  pair: { head: 0.22, sphinx: 0.5 },
  /** Heights (m): a head from the buried shoulders, a seated sphinx from the ground to the crown. */
  hHead: [16, 34] as [number, number], hSphinx: [20, 32] as [number, number],
  /** Villages keep this far (m), places, roads and rivers this far from the site's edge. */
  village: 380, place: 40, road: 18, river: 24,
  /** Trees, rocks and plants keep this far out of the site's radius. */
  clear: 4,
};
export type ColossusKind = 'head' | 'sphinx';
/**
 * One colossus in the world: base (`y`, under the ground when sunk), height, facing (`yaw`: its face looks along
 * (sin, cos)), how far it leans forward and rolls to a side (radians).
 */
export interface Colossus { k: ColossusKind; x: number; z: number; y: number; h: number; yaw: number; lean: number; roll: number; seed: number }
export interface ColossusSite { id: string; k: ColossusKind; x: number; z: number; r: number; name: string; list: Colossus[] }

const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
function misfit(world: number, x: number, z: number, r: number): string {
  if (Math.abs(z) > POLAR_Z - 600) return 'ice';
  if (seaMask(world, x, z) > 0 || [0, 1.57, 3.14, 4.71].some((a) => seaMask(world, x + Math.cos(a) * (r + 15), z + Math.sin(a) * (r + 15)) > 0)) return 'sea';
  if (mountainMask(world, x, z) > 0.5) return 'peak';
  if (nearRiver(world, x, z, r + COLOSSI.river)) return 'river';
  if (villageDist(world, x, z, COLOSSI.village + 60) < COLOSSI.village) return 'village';
  if (inCity(world, x, z, r + 80)) return 'city';
  if (poisNear(world, x, z, r + COLOSSI.place + 40).some((p) => rectDist(p.rect, x, z) < r + COLOSSI.place)) return 'place';
  if (inFogSite(world, x, z, r + 20) || inLode(world, x, z, r + 20)) return 'site';
  if (megalithsNear(world, x, z, r + 60).length || gatesNear(world, x, z, r + 60).length || crystalFieldsNear(world, x, z, r + 20).length) return 'landmark';
  const [rx, rz] = regionOf(x, z), t = { world, base: (a: number, b: number) => naturalHeight(world, a, b) };
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    for (const l of regionLakes(t, rx + i, rz + j)) if (worldDist(l.x, l.z, x, z) < l.r * 1.6 + r + 10) return 'lake';
    for (const rd of regionRoads(world, rx + i, rz + j)) if (nearestOnRoad(rd, x, z)[0] < r + COLOSSI.road) return 'road';
  }
  return '';
}
const HEAD_A = ['Lone', 'Fallen', 'Sunken', 'Weeping', 'Silent', 'Forgotten', 'Broken', 'Drowsing', 'Blind', 'Old', 'Leaning', 'Buried'];
const HEAD_B = ['Watcher', 'Face', 'Elder', 'Sentinel', 'Dreamer', 'King', 'Witness', 'Sleeper', 'Mourner', 'Gazer'];
const SPHINX_A = ['Riddle', 'Southern', 'Oracle', 'Dawn', 'Dusk', 'Sleeping', 'Silver', 'Silent', 'Last', 'Hidden', 'Weeping', 'Ivory'];

/** How a colossus stands (radians, signed): upright now and then, most clearly askew, some badly. */
function tilt(R: () => number, big: number): number {
  const q = R(), side = R() < 0.5 ? -1 : 1;
  return q < 0.2 ? (R() - 0.5) * 0.06 : q < 0.75 ? side * (0.07 + R() * 0.16) : side * (0.23 + R() * big);
}
const cache = new Map<string, ColossusSite | null>();
/** The colossi of region (rx, rz), or null. */
export function regionColossi(world: number, rx: number, rz: number): ColossusSite | null {
  const c = wrapR(rx);
  if (c !== rx) { const f = regionColossi(world, c, rz); const dx = (rx - c) * REGION; return f && { ...f, x: f.x + dx, list: f.list.map((o) => ({ ...o, x: o.x + dx })) }; }
  const key = world + ':' + rx + ':' + rz;
  let f = cache.get(key);
  if (f !== undefined) return f;
  if (cache.size > 20000) cache.clear();
  f = rollSite(world, rx, rz);
  cache.set(key, f);
  return f;
}
function rollSite(world: number, rx: number, rz: number): ColossusSite | null {
  const R = rng(hash(world, rx, rz, 0xc0105)), roll = R();
  const k: ColossusKind | null = roll < COLOSSI.head ? 'head' : roll < COLOSSI.head + COLOSSI.sphinx ? 'sphinx' : null;
  if (!k) return null;
  const x = rx * REGION + (R() - 0.5) * REGION * 0.5, z = rz * REGION + (R() - 0.5) * REGION * 0.5;
  if (Math.hypot(wrapDx(x), z) < COLOSSI.from) return null;
  const [lo, hi] = k === 'head' ? COLOSSI.hHead : COLOSSI.hSphinx, H = lo + (hi - lo) * R(), seed = hash(world, rx, rz, 0xc0106);
  const spots: [number, number, number][] = []; // x, z, yaw
  const a = R() * Math.PI * 2;
  if (k === 'sphinx' && R() < COLOSSI.pair.sphinx) { // a gate: two sphinxes face each other across the way between them
    const gap = H * (0.75 + R() * 0.35), ux = Math.sin(a), uz = Math.cos(a);
    spots.push([x - ux * gap, z - uz * gap, a], [x + ux * gap, z + uz * gap, a + Math.PI]);
  } else {
    spots.push([x, z, R() * Math.PI * 2]);
    if (k === 'head' && R() < COLOSSI.pair.head) { const d = H * (1.4 + R() * 1.6); spots.push([x + Math.sin(a) * d, z + Math.cos(a) * d, R() * Math.PI * 2]); }
  }
  const r = Math.max(...spots.map(([sx, sz]) => Math.hypot(sx - x, sz - z))) + H * 0.75;
  if (misfit(world, x, z, r)) return null;
  const list = spots.map(([sx, sz, yaw], i): Colossus => {
    const S = rng(hash(seed, i, 0xc0107)), h = H * (i ? 0.78 + S() * 0.3 : 1);
    // the ground under it: the lowest of the middle and four points round it (the colossus settles into the low side)
    const g = Math.min(...[[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].map(([u, v]) => naturalHeight(world, sx + u * h * 0.3, sz + v * h * 0.3)));
    if (k === 'head') {
      if (S() < 0.12) { const side = S() < 0.5 ? -1 : 1; return { k, x: sx, z: sz, y: g - h * (0.06 + S() * 0.1), h, yaw, lean: side * (1.1 + S() * 0.25), roll: (S() - 0.5) * 0.5, seed: hash(seed, i) }; } // toppled
      return { k, x: sx, z: sz, y: g - h * (0.12 + S() * 0.38), h, yaw, lean: tilt(S, 0.25), roll: tilt(S, 0.2) * 0.8, seed: hash(seed, i) };
    }
    return { k, x: sx, z: sz, y: g - h * (0.04 + S() * 0.34), h, yaw, lean: tilt(S, 0.18) * 0.8, roll: tilt(S, 0.14) * 0.7, seed: hash(seed, i) };
  });
  const n = hash(seed, 0xc0108);
  const name = k === 'head' ? `The ${HEAD_A[n % HEAD_A.length]} ${HEAD_B[(n >> 5) % HEAD_B.length]}` : SPHINX_A[n % SPHINX_A.length];
  return { id: `colossus:${rx}:${rz}`, k, x, z, r, name, list };
}
/** The sites whose ground reaches within `m` of (x, z). */
export function colossiNear(world: number, x: number, z: number, m = 0): ColossusSite[] {
  const out: ColossusSite[] = [], n = Math.ceil((60 + m) / REGION), [rx, rz] = regionOf(x, z);
  for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) {
    const f = regionColossi(world, rx + i, rz + j);
    if (f && worldDist(f.x, f.z, x, z) < f.r + m) out.push(f);
  }
  return out;
}
/** Is (x, z) at a colossus's foot (within its site's radius plus `COLOSSI.clear` and m)? Trees, rocks and plants keep off. */
export const inColossus = (world: number, x: number, z: number, m = 0) => colossiNear(world, x, z, m + COLOSSI.clear).length > 0;

/**
 * A colossus's solids: capsules in the world. A head: one up its axis. A sphinx: the haunches and back, the chest
 * and neck, the head, the two front legs with their paws and (0.276) the two folded wings.
 */
export function colossusCapsules(o: Colossus): Capsule[] {
  const P = tiltFrame(o.lean, o.roll, o.yaw, o.x, o.y, o.z), H = o.h;
  const cap = (a: [number, number, number], b: [number, number, number], r: number): Capsule => ({ a: P(...a), b: P(...b), r });
  if (o.k === 'head') return [cap([0, H * 0.12, 0], [0, H * 0.88, 0], H * 0.2)];
  return [
    cap([0, H * 0.2, -H * 0.36], [0, H * 0.3, H * 0.08], H * 0.2),
    cap([0, H * 0.34, H * 0.12], [0, H * 0.66, H * 0.2], H * 0.15),
    cap([0, H * 0.74, H * 0.22], [0, H * 0.93, H * 0.2], H * 0.12),
    cap([-H * 0.1, H * 0.05, H * 0.36], [-H * 0.1, H * 0.42, H * 0.26], H * 0.07),
    cap([H * 0.1, H * 0.05, H * 0.36], [H * 0.1, H * 0.42, H * 0.26], H * 0.07),
    // (0.276) the folded wings: from the wrist over the back down to the raised tips behind the rump
    cap([-H * 0.21, H * 1.03, -H * 0.16], [-H * 0.32, H * 0.55, -H * 0.88], H * 0.05),
    cap([H * 0.21, H * 1.03, -H * 0.16], [H * 0.32, H * 0.55, -H * 0.88], H * 0.05),
  ];
}
/** A body (feet at y, r wide) runs into one of these colossi. */
export const colossusHit = (list: readonly Colossus[], x: number, y: number, z: number, r: number) => list.some((o) => capsulesHit(colossusCapsules(o), x, y, z, r));
