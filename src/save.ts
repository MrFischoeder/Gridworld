// Character persistence. Only player-made changes are stored, never generated geometry.
// Versions: v1 (relic counts) -> v2 (backpack, per-dungeon progress) -> v3 (open world).
import { INV_SIZE, MOD_SIZE, ITEMS, type ItemKey, type WearSlot } from './data/items';
import type { VehicleModel, VehicleParts } from './data/vehicles';
import type { Quest } from './gen/quests';
import { START_TIME, boardPeriod } from './core/time';
import { wrapC } from './gen/regions';
import { KCAL } from './data/survival';
import type { Part } from './gen/base';
import type { TownState } from './gen/town';
import type { MarketState } from './gen/market';

/** An item stack. `c` is the condition in percent of a used part (worn tires); such items do not stack. */
export interface Slot { k: ItemKey; n: number; c?: number }
/** Per-dungeon progress, keyed by dungeonKey() = "ruinId:depth:gx:gz". */
export type Progress = Record<string, number[]>;
/** Where in which dungeon the player is. In a cave system (`cave`), ruinId is the system's id; its mouths are kept so the way out is known. */
export interface DungeonPos { ruinId: number; depth: number; gx: number; gz: number; cave?: { name: string; mouths: { x: number; z: number; face: number }[]; from: number } }
/** Anything that holds items: a searched chest, a vehicle trunk. */
export interface Container { items: (Slot | null)[]; gold: number }
export interface VehicleState { id: string; model: VehicleModel; x: number; z: number; heading: number; trunk: Container; parts: VehicleParts }
export interface Char {
  v: 3;
  level: number; xp: number; gold: number; world: number;
  inv: (Slot | null)[]; mods: (ItemKey | null)[];
  opened: Progress; unlocked: Progress; killed: Progress;
  loc: 'overworld' | 'dungeon';
  /** Last position on the surface; null = at the starting village. */
  ow: { x: number; y: number; z: number; yaw: number } | null;
  /** Where in which dungeon the player is (only while loc === 'dungeon'). */
  dungeon: DungeonPos | null;
  /** Explored map: region "rx,rz" -> 64-bit mask (16 hex digits) of its 8x8 chunks. */
  discovered: Record<string, string>;
  /** What is left in searched chests, keyed "chest:<dungeonKey>:<index>". */
  containers: Record<string, Container>;
  /** The player's vehicles on the surface. */
  vehicles: VehicleState[];
  /** Notice board: offers on display, the counter that numbers new notices, and the posting they are from (core/time boardPeriod). */
  board: { seq: number; offers: Quest[]; stamp?: number };
  /** Accepted quests (talk / active / ready). */
  quests: Quest[];
  /** Bandit camps cleared by the player: camp id -> when (ms). They are empty until CAMP_RESPAWN_MS has passed. */
  camps: Record<string, number>;
  /** Game clock in game minutes since the world began (core/time). */
  time: number;
  /** Survival (data/survival.ts): calories in store, food in the stomach (kg), and water 0..100. */
  kcal: number; stomach: number; water: number;
  /** Attachments fitted to the Blaster, one per slot of data/weapons BLASTER.slots (optic, barrel, magazine). */
  gunMods: (ItemKey | null)[];
  /** Picked plants (gen/flora keys, "crys:<dungeonKey>:<i>" for dungeon crystals) -> game time picked; gone once grown back. */
  harvest: Record<string, number>;
  /** Workbenches the player has set up in the wilds (world position, facing). */
  benches: { x: number; y: number; z: number; yaw: number }[];
  /** Land claimed with a Flagpole (gen/claims.ts): the flag's spot, the height its ground is levelled to, when, and what is built there (gen/base.ts). */
  claims: { x: number; z: number; y: number; t: number; parts?: Part[] }[];
  /** What you hold in your hands (a weapon, or something too big for the backpack), and the two slots on your back (weapons). */
  hands: (Slot | null)[]; back: (Slot | null)[];
  /** What you wear, per data/items WearSlot. */
  wear: Partial<Record<WearSlot, ItemKey | null>>;
  /** This character's id (code locks remember who has entered their code; multiplayer later). */
  pid: string;
  /** What you changed about the villages (gen/town.ts), keyed by village id: the wall's tier, materials handed over, the power plant. */
  towns: Record<string, TownState>;
  /** The markets (gen/market.ts): how trades have shifted each village's stocks. On the server this is shared by everyone. */
  market: MarketState;
  /** Prices you have seen, per village id: when, the village's name and place, and [buy, sell] per good. */
  ledger: Record<string, { t: number; name: string; x: number; z: number; q: Record<string, [number, number]> }>;
  /** Crates bought off passing caravans (gen/caravans.ts), by caravan id. */
  caravans: Record<string, number>;
}

export const SAVE_KEY = 'gridWorld.character.v3';
/** Keys from before the project was renamed from Grid Arena to GridWorld. */
export const ARENA_V3_KEY = 'gridArena.character.v3', V2_KEY = 'gridArena.character.v2', OLD_KEY = 'gridArena.character.v1';

export const newChar = (): Char => ({
  v: 3, level: 1, xp: 0, gold: 0, world: (Math.random() * 1e6) | 0,
  inv: Array(INV_SIZE).fill(null), mods: Array(MOD_SIZE).fill(null), opened: {}, unlocked: {}, killed: {},
  loc: 'overworld', ow: null, dungeon: null, discovered: {}, containers: {}, vehicles: [], board: { seq: 0, offers: [], stamp: boardPeriod(START_TIME) }, quests: [], camps: {}, time: START_TIME, gunMods: [null, null, null], kcal: KCAL.start, stomach: 0, water: 100, harvest: {}, benches: [], claims: [],
  hands: [{ k: 'blaster', n: 1 }], back: [{ k: 'blade', n: 1 }, null], wear: {}, pid: Math.random().toString(36).slice(2, 10), towns: {}, market: {}, ledger: {}, caravans: {},
});

interface V2 { level?: number; xp?: number; gold?: number; world?: number; inv?: (Slot | null)[]; mods?: (ItemKey | null)[] }

/** v1 stored relic counts; they go into free modules first, then the backpack. */
function migrateV1(o: { level?: number; xp?: number; gold?: number; relics?: Record<string, number> }): Char {
  const c = newChar();
  Object.assign(c, { level: o.level || 1, xp: o.xp || 0, gold: o.gold || 0 });
  for (const [k, n] of Object.entries(o.relics || {})) {
    if (!(k in ITEMS)) continue;
    for (let i = 0; i < n; i++) {
      const free = c.mods.indexOf(null);
      if (free >= 0) { c.mods[free] = k as ItemKey; continue; }
      const f = c.inv.indexOf(null); if (f >= 0) c.inv[f] = { k: k as ItemKey, n: 1 };
    }
  }
  return c;
}
/** v2 -> v3: character, backpack and gold stay; dungeon progress (keys without a ruin) is dropped; start in the village. */
function migrateV2(o: V2): Char {
  const c = newChar();
  if (o.level) c.level = o.level; if (o.xp) c.xp = o.xp; if (o.gold) c.gold = o.gold;
  if (typeof o.world === 'number') c.world = o.world;
  if (Array.isArray(o.inv)) c.inv = Array.from({ length: INV_SIZE }, (_, i) => o.inv![i] ?? null);
  if (Array.isArray(o.mods)) c.mods = Array.from({ length: MOD_SIZE }, (_, i) => o.mods![i] ?? null);
  return c;
}

export function loadChar(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Char {
  try {
    const raw = storage?.getItem(SAVE_KEY) ?? storage?.getItem(ARENA_V3_KEY);
    if (raw) {
      const c = Object.assign(newChar(), JSON.parse(raw)) as Char & { food?: number };
      // food used to be a 0..100 bar: it becomes the same share of the calorie store
      if (typeof c.food === 'number') { if (!('kcal' in JSON.parse(raw))) c.kcal = Math.round(c.food / 100 * KCAL.max); delete c.food; }
      if (c.loc === 'dungeon' && !c.dungeon) c.loc = 'overworld';
      return c;
    }
    const v2 = storage?.getItem(V2_KEY);
    if (v2) return migrateV2(JSON.parse(v2));
    const old = storage?.getItem(OLD_KEY);
    if (old) return migrateV1(JSON.parse(old));
  } catch { /* corrupt or blocked storage: start fresh */ }
  return newChar();
}

export function saveChar(c: Char): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ }
}

function safeStorage(): Storage | null { try { return localStorage; } catch { return null; } }

// ---------- explored map bitmask ----------
/** Chunk (cx, cz) -> its region key and bit index (regions are 8x8 chunks, centred like the regions of gen/regions). */
export function chunkBit(cx: number, cz: number): [string, number] {
  cx = wrapC(cx); // the planet is round: a chunk across the seam is the same chunk
  const rx = Math.floor((cx + 4) / 8), rz = Math.floor((cz + 4) / 8);
  return [rx + ',' + rz, (cx + 4 - rx * 8) + 8 * (cz + 4 - rz * 8)];
}
export function isDiscovered(d: Record<string, string>, cx: number, cz: number): boolean {
  const [k, b] = chunkBit(cx, cz), hex = d[k];
  if (!hex) return false;
  const nib = parseInt(hex[15 - (b >> 2)], 16);
  return ((nib >> (b & 3)) & 1) === 1;
}
/** Marks a chunk explored; returns true when it was new. */
export function discover(d: Record<string, string>, cx: number, cz: number): boolean {
  if (isDiscovered(d, cx, cz)) return false;
  const [k, b] = chunkBit(cx, cz), hex = (d[k] || '0000000000000000').split('');
  const i = 15 - (b >> 2);
  hex[i] = (parseInt(hex[i], 16) | (1 << (b & 3))).toString(16);
  d[k] = hex.join('');
  return true;
}
