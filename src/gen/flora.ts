// Edible plants of the open world (RF-01 alien flora sheet): Nutrient Mushroom Clusters in shaded forest and
// Alien Fruit Pod Trees on forest edges and in low ground. Placement is deterministic per chunk; whether a plant has
// been picked (and when it grows back) is a player change kept in the save (char.harvest, world/flora.ts).
import { rng, hash } from '../core/rng';
import { CHUNK, POLAR_Z, wrapC } from './regions';
import { rectDist, type Terrain } from './terrain';
import { nearestOnRoad } from './roads';

export type PlantKind = 'shroom' | 'pod';
export interface Plant {
  /** Save key, the same on both sides of the planet's seam: "<kind>:<cx>:<cz>" in canonical chunk coordinates. */
  key: string;
  kind: PlantKind; x: number; z: number; y: number; rot: number; seed: number;
  /** Collision circles [x, z, radius] (stems, the trunk). */
  cols: [number, number, number][];
  /** Mushroom cluster: the big mushrooms (offset from x/z, height, cap radius, stem radius). */
  stems: { dx: number; dz: number; h: number; cap: number; r: number }[];
}

/** The ground a plant keeps clear: trees within it are not grown (gen/trees.ts asks plantsNear). */
export const PLANT_SPAN: Record<PlantKind, number> = { shroom: 3, pod: 4.5 };

const cache = new Map<string, Plant[]>();
/** The plants of a chunk (cached: the forest asks for them too). */
export function chunkPlants(t: Terrain, cx: number, cz: number): Plant[] {
  const k = t.world + ':' + cx + ':' + cz;
  let p = cache.get(k);
  if (!p) { if (cache.size > 4000) cache.clear(); cache.set(k, (p = makePlants(t, cx, cz))); }
  return p;
}
/** Plants whose clearing could reach (x, z): those of the chunk and its neighbours. */
export function plantsNear(t: Terrain, x: number, z: number): Plant[] {
  const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), out: Plant[] = [];
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) out.push(...chunkPlants(t, cx + i, cz + j));
  return out;
}

/** At most one plant per chunk (32 m): a mushroom cluster where it is shady, a pod tree at the edge of the woods. */
function makePlants(t: Terrain, cx: number, cz: number): Plant[] {
  const c = wrapC(cx);
  if (c !== cx) {
    const dx = (cx - c) * CHUNK;
    return chunkPlants(t, c, cz).map((p) => ({ ...p, x: p.x + dx, cols: p.cols.map(([x, z, r]): [number, number, number] => [x + dx, z, r]) }));
  }
  const R = rng(hash(t.world, cx, cz, 0xf10a)), roll = R();
  const x = cx * CHUNK + 4 + R() * (CHUNK - 8), z = cz * CHUNK + 4 + R() * (CHUNK - 8);
  if (Math.abs(z) > POLAR_Z - 600) return [];
  const forest = t.forest(x, z), h = t.heightAt(x, z);
  let kind: PlantKind | null = null;
  if (roll < 0.2 * Math.max(0, forest - 0.3) / 0.7) kind = 'shroom'; // shade: the denser the forest, the likelier
  else if (roll > 0.955 && forest > 0.12 && forest < 0.7 && h < 14) kind = 'pod';
  if (!kind) return [];
  const span = PLANT_SPAN[kind], f = t.chunkFeatures(cx, cz);
  if (f.pads.some((p) => rectDist(p.poi.rect, x, z) < p.poi.flat + (p.poi.type === 'village' ? 20 : 6) + span)) return [];
  if (f.roads.some((rd) => nearestOnRoad(rd, x, z)[0] < rd.half + span + 1)) return [];
  for (let a = 0; a < 6.28; a += 1.05) if (t.water(x + Math.cos(a) * span, z + Math.sin(a) * span)) return [];
  if (t.water(x, z)) return [];
  const seed = hash(t.world, cx, cz, 0xf10b), rot = R() * 6.283;
  // stand on the lowest ground under it so nothing floats
  let y = h;
  for (let a = 0; a < 6.28; a += 1.57) y = Math.min(y, t.heightAt(x + Math.cos(a) * 1.2, z + Math.sin(a) * 1.2));
  const cols: [number, number, number][] = [], stems: Plant['stems'] = [];
  if (kind === 'pod') cols.push([x, z, 0.5]);
  else {
    const S = rng(seed), n = 3 + Math.floor(S() * 3);
    for (let i = 0; i < n; i++) {
      // the first is the tallest (2-3 m), the others lean out around it
      const a = rot + i / n * 6.283 + S() * 0.6, d = i ? 0.8 + S() * 0.7 : S() * 0.3;
      const hh = i ? 1.1 + S() * 1.2 : 2.2 + S() * 0.8, cap = hh * (0.5 + S() * 0.14), r = 0.1 + hh * 0.07;
      stems.push({ dx: Math.cos(a) * d, dz: Math.sin(a) * d, h: hh, cap, r });
      cols.push([x + Math.cos(a) * d, z + Math.sin(a) * d, r + 0.12]);
    }
  }
  return [{ key: `${kind}:${cx}:${cz}`, kind, x, z, y, rot, seed, cols, stems }];
}
