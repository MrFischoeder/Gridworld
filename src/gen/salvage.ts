// (0.272, the owner's request) Stripping machines for parts: a crashed freighter's engine room (its two reactor drums
// and the drive cabinets on the stern wall) and its laboratories, and the crumpled engine of your own ship, are taken
// apart with a wrench into the power parts every generator needs (Stator Coils, Turbine Bearings, Solar Cell Sheets,
// Power Inverters) and other salvage. Every machine has a few parts and never grows them back: the wrecks run out,
// and later the old plants (gen/installs.ts) must be restored to make new parts. Pure and deterministic.
// MP: the parts taken are the shared `Char.salvage` (one entry per machine), the yield of each part is hashed, so it
// is the same whoever takes it.
import { hash, rng } from '../core/rng';
import type { ItemKey } from '../data/items';
import type { DungeonMap, DecoBox } from './dungeon';
import { SHIP_CX } from './ship';
import { tl } from '../i18n';

export type SalvageKind = 'reactor' | 'drive' | 'lab' | 'kestrel';
/** One machine to strip: where to stand by it (ship cells, or world metres for the Kestrel), which way it faces. */
export interface SalvageSpot { k: SalvageKind; x: number; z: number; nx: number; nz: number }
/** What a machine has given: parts taken, and who is working on it now (a claim, refreshed while they work). */
export interface SalvageState { n: number; by?: string; nm?: string; t?: number }

export const SALVAGE = {
  /** E reach from the spot, metres */
  reach: 2.4,
  /** game minutes a claim holds without a beat from its worker */
  claim: 1.5,
  /** real seconds a part takes, stamina and kcal it costs */
  secs: { reactor: 16, drive: 12, lab: 10, kestrel: 12 } as Record<SalvageKind, number>,
  stamina: 18, kcal: 60,
  /** parts in each machine */
  parts: { reactor: 3, drive: 3, lab: 3, kestrel: 3 } as Record<SalvageKind, number>,
  /** the share of a ship's side compartments that are laboratories */
  labs: 0.55,
};
export const SALVAGE_NAME: Record<SalvageKind, string> = {
  reactor: tl('reactor drum'), drive: tl('drive cabinet'), lab: tl('laboratory bench'), kestrel: tl('crumpled engine of the Kestrel'),
};

/** What one part of each kind may give: [item, chance, min, max]. */
export const SALVAGE_YIELD: Record<Exclude<SalvageKind, 'kestrel'>, [ItemKey, number, number, number][]> = {
  reactor: [['coil', 0.7, 1, 1], ['pcore', 0.25, 1, 1], ['scrap', 1, 3, 5], ['wire', 0.6, 2, 4], ['circuit', 0.3, 1, 2]],
  drive: [['bearing', 0.7, 1, 2], ['coil', 0.25, 1, 1], ['gears', 0.2, 1, 1], ['parts', 0.35, 1, 1], ['scrap', 1, 2, 4]],
  lab: [['pvcell', 0.6, 1, 2], ['inverter', 0.45, 1, 1], ['circuit', 0.8, 1, 3], ['optics', 0.12, 1, 1], ['control', 0.1, 1, 1], ['glass', 0.15, 1, 1]],
};
/** Your own ship's engine: always the same three parts, enough for the village's first power plant and a turbine. */
export const KESTREL_PARTS: [ItemKey, number][][] = [
  [['coil', 1], ['scrap', 4]],
  [['inverter', 1], ['wire', 4]],
  [['bearing', 2], ['circuit', 2]],
];
export const kestrelKey = 'kestrel';
export const wreckKey = (ruinId: number, i: number) => `wreck:${ruinId}:${i}`;

/** What part `piece` of a machine gives (hashed by the world, the machine's key and the part). */
export function salvageYield(world: number, key: string, k: SalvageKind, piece: number): [ItemKey, number][] {
  if (k === 'kestrel') return KESTREL_PARTS[piece] ?? [];
  let h = 0; for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0;
  const out: [ItemKey, number][] = [];
  SALVAGE_YIELD[k].forEach(([it, p, a, b], j) => {
    const u = hash(world, h, piece, j, 0x5a17) / 1e6;
    if (u >= p) return;
    out.push([it, a + Math.floor((hash(world, h, piece, j, 0x5a18) / 1e6) * (b - a + 1))]);
  });
  return out;
}
/** Parts left in a machine. */
export const partsLeft = (k: SalvageKind, s: SalvageState | undefined) => Math.max(0, SALVAGE.parts[k] - (s?.n ?? 0));
/** Another hero works it now (a fresh claim not yours): their name, else ''. */
export function workingOn(s: SalvageState | undefined, me: string, now: number): string {
  return s?.by && s.by !== me && now - (s.t ?? -1e9) < SALVAGE.claim ? s.nm || tl('Someone') : '';
}

/** A ship's side compartment big enough for a laboratory (gen/ship.ts: 8–10 a side, 4–5 high). */
const sideRoom = (b: DecoBox) => !b.tunnel && b.w >= 8 && b.w <= 10 && b.d >= 8 && b.d <= 10 && (b.h === 4 || b.h === 5);
/**
 * The machines of a crashed freighter (gen/ship.ts): the two reactor drums and the two drive cabinets of the engine
 * room, then the laboratories (a share of the side compartments, own RNG stream: the layout stays as it was), each
 * a bench against the room's outer wall. `free(x, z)` says whether a floor cell is clear (debris and chests).
 */
export function shipSalvage(map: DungeonMap, free: (x: number, z: number) => boolean): SalvageSpot[] {
  const CX = SHIP_CX, out: SalvageSpot[] = [];
  // the drums stand at x CX-7..CX-5 and their mirror, z 5..7; you work them from the front (towards the bow)
  out.push({ k: 'reactor', x: CX - 5.5, z: 8.6, nx: 0, nz: 1 }, { k: 'reactor', x: CX + 6.5, z: 8.6, nx: 0, nz: 1 });
  // the drive cabinets on the stern wall, either side of the chest
  out.push({ k: 'drive', x: CX - 8.5, z: 2.9, nx: 0, nz: 1 }, { k: 'drive', x: CX + 9.5, z: 2.9, nx: 0, nz: 1 });
  const R = rng(map.seed ^ 0x1ab5);
  for (const b of map.boxes ?? []) {
    if (!sideRoom(b) || R() >= SALVAGE.labs) continue;
    const right = b.x > CX, wx = right ? b.x + b.w - 1 : b.x;
    // along the outer wall, the first clear stretch of 3 cells from the middle outwards
    const mid = b.z + (b.d >> 1);
    for (const dz of [0, -1, 1, -2, 2]) {
      const z = mid + dz;
      if (z - 1 < b.z + 1 || z + 1 > b.z + b.d - 2 || ![-1, 0, 1].every((o) => free(wx, z + o)) || !free(wx + (right ? -1 : 1), z)) continue;
      out.push({ k: 'lab', x: wx + 0.5 + (right ? -0.6 : 0.6), z: z + 0.5, nx: right ? -1 : 1, nz: 0 });
      break;
    }
  }
  return out;
}
