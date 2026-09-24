// Forest placement per chunk: jittered candidates kept by forest density; never on roads or places.
import { rng, hash } from '../core/rng';
import { CHUNK, wrapC } from './regions';
import { rectDist, type Terrain } from './terrain';
import { nearestOnRoad } from './roads';
import { lakeBed, shoreR } from './water';
import { plantsNear, PLANT_SPAN } from './flora';

/** Open ground kept around places: villages keep a wide ring (the vehicle yard sits there). */
const clearing = (p: { type: string }) => (p.type === 'village' ? 20 : 6);

export type TreeKind = 'pine' | 'broad' | 'twisted' | 'umbrella' | 'arch';
/** A tree: where it stands, its size, its kind, a seed for its shape and the circles its trunk(s) block. */
export interface Tree {
  x: number; z: number; y: number; h: number; r: number;
  kind: TreeKind; rot: number; seed: number;
  /** Trunk collision circles [x, z, radius]: one for most trees, one per leg for an arch. */
  cols: [number, number, number][];
}
/** Footprint of the big kinds: other trees are cleared within this radius, roads and places keep this far away. */
export const TREE_SPAN: Record<TreeKind, number> = { pine: 0, broad: 0, twisted: 5, umbrella: 5.5, arch: 7 };

/** Where each candidate tree stands (unchanged since the first open-world version: vehicles and quests rely on it). */
function treeSpots(t: Terrain, cx: number, cz: number) {
  const R = rng(hash(t.world, cx, cz, 0x7733)), out: { x: number; z: number; y: number; h: number; r: number }[] = [], f = t.chunkFeatures(cx, cz);
  const n = 6, G = CHUNK / n;
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = cx * CHUNK + (i + 0.2 + R() * 0.6) * G, z = cz * CHUNK + (j + 0.2 + R() * 0.6) * G, roll = R(), h = 4 + R() * 3.5, r = 1.2 + R() * 0.8;
    if (roll > t.forest(x, z) * 0.85) continue;
    if (f.pads.some((p) => rectDist(p.poi.rect, x, z) < p.poi.flat + clearing(p.poi))) continue;
    if (f.roads.some((rd) => nearestOnRoad(rd, x, z)[0] < rd.half + 3.5)) continue;
    // stand the trunk on the lowest ground under it so it never floats
    const y = Math.min(t.heightAt(x - 0.3, z - 0.3), t.heightAt(x + 0.3, z - 0.3), t.heightAt(x - 0.3, z + 0.3), t.heightAt(x + 0.3, z + 0.3));
    out.push({ x, z, y, h, r });
  }
  return out;
}
/** Trunk positions only (for placing vehicles and other things clear of trees). */
export function treeTrunks(t: Terrain, cx: number, cz: number) {
  const c = wrapC(cx), dx = (cx - c) * CHUNK;
  return treeSpots(t, c, cz).map((s) => ({ ...s, x: s.x + dx }));
}
/** Moves a canonical tree east or west by dx (a copy across the planet's seam). */
const shiftTree = (tr: Tree, dx: number): Tree => (dx ? { ...tr, x: tr.x + dx, cols: tr.cols.map(([x, z, r]): [number, number, number] => [x + dx, z, r]) } : tr);

/** Kind, shape seed and size of the tree at a spot. Each spot draws from its own hash, so positions never shift. */
function classify(t: Terrain, f: ReturnType<Terrain['chunkFeatures']>, s: { x: number; z: number; y: number; h: number; r: number }): Tree {
  const seed = hash(t.world, Math.round(s.x * 100), Math.round(s.z * 100), 0x7e3e), R = rng(seed), roll = R(), rot = R() * 6.283;
  let kind: TreeKind = s.y > 15 + R() * 5 ? 'pine' : 'broad';
  if (roll < 0.012) kind = 'arch'; else if (roll < 0.06) kind = 'twisted'; else if (roll < 0.105) kind = 'umbrella';
  // edible plants keep their ground: no big tree grows over them (small ones are cleared in chunkTrees)
  if (TREE_SPAN[kind] && plantsNear(t, s.x, s.z).some((p) => Math.hypot(p.x - s.x, p.z - s.z) < PLANT_SPAN[p.kind] + TREE_SPAN[kind] + 1)) kind = 'broad';
  const span = TREE_SPAN[kind];
  if (span && (f.pads.some((p) => rectDist(p.poi.rect, s.x, s.z) < p.poi.flat + clearing(p.poi) + span) || f.roads.some((rd) => nearestOnRoad(rd, s.x, s.z)[0] < rd.half + span + 1))) kind = 'broad';
  const tr: Tree = { ...s, kind, rot, seed, cols: [[s.x, s.z, 0.35]] };
  if (kind === 'twisted') { tr.h = 8 + R() * 4; tr.r = 5; tr.cols = [[s.x, s.z, 1.3]]; }
  else if (kind === 'umbrella') { tr.h = 8 + R() * 2.5; tr.r = 5.5; tr.cols = [[s.x, s.z, 1.1]]; }
  else if (kind === 'arch') {
    tr.h = 10 + R() * 5; tr.r = 5 + R() * 1.5;
    const dx = Math.cos(rot) * tr.r, dz = Math.sin(rot) * tr.r;
    tr.cols = [[s.x - dx, s.z - dz, 1.7], [s.x + dx, s.z + dz, 1.7]];
    tr.y = Math.min(t.heightAt(s.x - dx, s.z - dz), t.heightAt(s.x + dx, s.z + dz)) - 0.2; // stand on the lower foot
  } else if (kind === 'broad') { tr.h = s.h * 0.9; tr.r = s.r * 1.15; }
  return tr;
}
const bigCache = new Map<string, Tree[]>();
/** The big trees a chunk would like to grow (before they are checked against each other). Cached. */
function bigWanted(t: Terrain, cx: number, cz: number): Tree[] {
  const c = wrapC(cx);
  if (c !== cx) return bigWanted(t, c, cz).map((tr) => shiftTree(tr, (cx - c) * CHUNK));
  const key = t.world + ':' + cx + ':' + cz;
  let b = bigCache.get(key);
  if (!b) {
    const f = t.chunkFeatures(cx, cz);
    b = treeSpots(t, cx, cz).map((s) => classify(t, f, s)).filter((tr) => TREE_SPAN[tr.kind] > 0);
    if (bigCache.size > 4000) bigCache.clear();
    bigCache.set(key, b);
  }
  return b;
}
/** Which of two clashing big trees wins: the wider one, then the higher seed. */
const beats = (a: Tree, b: Tree) => TREE_SPAN[a.kind] > TREE_SPAN[b.kind] || (TREE_SPAN[a.kind] === TREE_SPAN[b.kind] && a.seed > b.seed);

/**
 * The trees of a chunk: pines on high ground, broadleaves elsewhere, and now and then an Ancient Twisted Tree,
 * an Umbrella Tree or (rarely) a Hollow Arch Tree. Big trees clear the small ones around them (also across
 * chunk borders), give way to a bigger neighbour, and keep away from roads and places.
 */
export function chunkTrees(t: Terrain, cx: number, cz: number): Tree[] {
  const c = wrapC(cx);
  if (c !== cx) return chunkTrees(t, c, cz).map((tr) => shiftTree(tr, (cx - c) * CHUNK));
  const f = t.chunkFeatures(cx, cz), near: Tree[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) near.push(...bigWanted(t, cx + i, cz + j));
  const out: Tree[] = [], plants = plantsNear(t, cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2);
  const wet = (x: number, z: number, m: number) => f.lakes.some((l) => lakeBed(l, x, z, Infinity) !== null && Math.hypot(l.x - x, l.z - z) < shoreR(l, Math.atan2(z - l.z, x - l.x)) * 1.08 + m);
  for (const s of treeSpots(t, cx, cz)) {
    const tr = classify(t, f, s), span = TREE_SPAN[tr.kind];
    if (wet(s.x, s.z, span * 0.6 + 1) || t.water(s.x, s.z)) continue; // no trees in the water
    if (plants.some((p) => Math.hypot(p.x - s.x, p.z - s.z) < PLANT_SPAN[p.kind] + span + 0.8)) continue;
    const blocked = near.some((b) => b.seed !== tr.seed && Math.hypot(b.x - tr.x, b.z - tr.z) < Math.max(TREE_SPAN[b.kind], span) && (span === 0 || beats(b, tr)));
    if (!blocked) out.push(tr);
  }
  return out;
}

export interface Rock { x: number; z: number; y: number; r: number; h: number; sides: number; rot: number }

/** Scattered rocks: low faceted pyramids, a few per chunk, never on roads or places. */
export function chunkRocks(t: Terrain, cx: number, cz: number): Rock[] {
  const c = wrapC(cx);
  if (c !== cx) return chunkRocks(t, c, cz).map((k) => ({ ...k, x: k.x + (cx - c) * CHUNK }));
  const R = rng(hash(t.world, cx, cz, 0x50c4)), out: Rock[] = [], f = t.chunkFeatures(cx, cz);
  const n = 3 + Math.floor(R() * 6);
  for (let i = 0; i < n; i++) {
    const x = cx * CHUNK + R() * CHUNK, z = cz * CHUNK + R() * CHUNK, big = R() < 0.25;
    const r = big ? 1.4 + R() * 1.2 : 0.4 + R() * 0.7, h = r * (0.5 + R() * 0.6), sides = 3 + Math.floor(R() * 3), rot = R() * 6.283;
    if (f.pads.some((p) => rectDist(p.poi.rect, x, z) < p.poi.flat + clearing(p.poi))) continue;
    if (f.roads.some((rd) => nearestOnRoad(rd, x, z)[0] < rd.half + r + 0.5)) continue;
    if (t.water(x, z)) continue;
    out.push({ x, z, y: t.heightAt(x, z) - 0.15, r, h, sides, rot });
  }
  return out;
}
