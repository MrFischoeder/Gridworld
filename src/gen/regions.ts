// World overview map: the world is split into 256 m regions. Each region decides its own
// features from hash(world, rx, rz): points of interest (villages, ruins), forest density, terrain roughness.
// New kinds of places are added as new PoiType values plus a placement rule here.
import { hash, rng, rangeInt, DIRV, type Dir } from '../core/rng';

export const REGION = 256, CHUNK = 32;

export type PoiType = 'village' | 'ruin';
export interface Rect { x0: number; z0: number; x1: number; z1: number }
export interface Poi {
  type: PoiType;
  /** Stable id: packed region coordinates + index. Used in dungeon seeds and save keys. */
  id: number;
  name: string;
  /** Centre of the place. */
  x: number; z: number;
  /** Voxel-owned footprint (even-aligned): the terrain is replaced by the structure's own floor here. */
  rect: Rect;
  /** Extra perfectly flat margin around the rect, then a blend distance back to natural terrain. */
  flat: number; blend: number;
}
export interface RegionInfo { rx: number; rz: number; pois: Poi[]; forest: number; rough: number }

/** Region (rx, rz) spans [rx*256-128, rx*256+128) on both axes, so region (0,0) is centred on the origin. */
export const regionOf = (x: number, z: number): [number, number] => [Math.floor((x + REGION / 2) / REGION), Math.floor((z + REGION / 2) / REGION)];

export const packId = (rx: number, rz: number, i: number) => ((rx & 0x7fff) << 17) | ((rz & 0x7fff) << 2) | (i & 3);

const SYL_A = ['Kar', 'Vel', 'Mor', 'Dun', 'Ith', 'Zar', 'Ost', 'Bel', 'Quor', 'Nym', 'Tor', 'Rha', 'Sel', 'Gorm', 'Ael', 'Vorn'];
const SYL_B = ['os', 'ane', 'ith', 'um', 'ar', 'eth', 'ix', 'ora', 'ag', 'und', 'el', 'is'];
export function ruinName(R: () => number): string {
  const ri = rangeInt(R);
  return SYL_A[ri(0, SYL_A.length - 1)] + SYL_B[ri(0, SYL_B.length - 1)];
}

const even = (v: number) => 2 * Math.round(v / 2);
export const RUIN_SIZE = 24;
export const VILLAGE_RECT: Rect = { x0: -38, z0: -38, x1: 38, z1: 38 };

function ruinAt(rx: number, rz: number, i: number, x: number, z: number, R: () => number): Poi {
  const x0 = even(x - RUIN_SIZE / 2), z0 = even(z - RUIN_SIZE / 2);
  return {
    type: 'ruin', id: packId(rx, rz, i), name: 'Ruins of ' + ruinName(R),
    x: x0 + RUIN_SIZE / 2, z: z0 + RUIN_SIZE / 2, rect: { x0, z0, x1: x0 + RUIN_SIZE, z1: z0 + RUIN_SIZE }, flat: 4, blend: 26,
  };
}

const cache = new Map<string, RegionInfo>();
export function regionInfo(world: number, rx: number, rz: number): RegionInfo {
  const key = world + ':' + rx + ':' + rz;
  let r = cache.get(key);
  if (r) return r;
  if (cache.size > 4096) cache.clear();
  const R = rng(hash(world, rx, rz, 0x7e61)), ri = rangeInt(R);
  const forest = R(), rough = R();
  const pois: Poi[] = [];
  const cx = rx * REGION, cz = rz * REGION;
  if (rx === 0 && rz === 0) {
    pois.push({ type: 'village', id: packId(0, 0, 0), name: 'Gridholm', x: 0, z: 0, rect: { ...VILLAGE_RECT }, flat: 8, blend: 34 });
  } else if (Math.abs(rx) + Math.abs(rz) === 1) {
    // The four regions next to the start: three of them always hold ruins within ~300 m of the village.
    const dirs: Dir[] = ['N', 'E', 'S', 'W'];
    const skip = dirs[hash(world, 0x5c1) % 4];
    const dir = dirs.find((d) => DIRV[d][0] === rx && DIRV[d][1] === rz)!;
    if (dir !== skip || R() < 0.35) {
      const dist = ri(150, 250), lat = ri(-60, 60), o = DIRV[dir];
      pois.push(ruinAt(rx, rz, 1, o[0] * dist + (o[0] ? 0 : lat), o[1] * dist + (o[1] ? 0 : lat), R));
    }
  } else if (R() < (Math.abs(rx) <= 1 && Math.abs(rz) <= 1 ? 0.4 : 0.5)) {
    pois.push(ruinAt(rx, rz, 1, cx + ri(-80, 80), cz + ri(-80, 80), R));
  }
  r = { rx, rz, pois, forest, rough };
  cache.set(key, r);
  return r;
}

/** All POIs in regions overlapping the square [x-r, x+r] x [z-r, z+r]. */
export function poisNear(world: number, x: number, z: number, r: number): Poi[] {
  const [ax, az] = regionOf(x - r, z - r), [bx, bz] = regionOf(x + r, z + r), out: Poi[] = [];
  for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) out.push(...regionInfo(world, rx, rz).pois);
  return out;
}
export const findPoi = (world: number, id: number): Poi | undefined => {
  const rx = (id << 0) >> 17, rz = ((id << 15) >> 17);
  return regionInfo(world, rx, rz).pois.find((p) => p.id === id);
};
