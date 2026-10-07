// Character persistence. Only player-made changes are stored, never generated geometry.
// Versions: v1 (relic counts) -> v2 (backpack, per-dungeon progress) -> v3 (open world).
import { fixInstall, type InstallKind, type InstallState } from './gen/installs';
import { fixPlant } from './gen/plants';
import { retireOldCrossings, type BridgeState, type Ford } from './gen/bridges';
import type { Pier } from './gen/piers';
import type { Boat } from './gen/boats';
import { INV_SIZE, MOD_SIZE, ITEMS, PACK, type ItemKey, type WearSlot } from './data/items';
import { putItems } from './inventory';
import type { VehicleModel, VehicleParts } from './data/vehicles';
import type { Quest } from './gen/quests';
import { START_TIME, boardPeriod } from './core/time';
import { wrapC, GRIDHOLM_ID } from './gen/regions';
import { KCAL } from './data/survival';
import type { Part } from './gen/base';
import type { TownState } from './gen/town';
import type { MarketState } from './gen/market';
import { fixShuttle, type ShuttleState } from './gen/shuttle';
import type { Contract } from './gen/contracts';

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
  /** The hero's name, entered in the menu before the first game (everyone calls you by it). */
  name: string;
  /** Seen the opening (ui/intro.ts: the ship, the meteor storm, the fall). False for a new character: it starts at the crash site. */
  intro: boolean;
  /** Technologies recovered from old data carriers (gen/tech.ts): tech id -> game time found. */
  tech: Record<string, number>;
  /** Leads to data carriers the villagers told you of (tech ids), shown on the maps and the compass until recovered. */
  leads: string[];
  /** The great installations you have been restoring (gen/installs.ts), by kind. */
  installs: Partial<Record<InstallKind, InstallState>>;
  /** Bridges at the fords, built or going up (gen/bridges.ts), by site id. */
  bridges: Record<string, BridgeState>;
  /** Bridge sites you staked out yourself with a Bridge Kit (their place and shape; their state is in `bridges`). */
  bridgeSites: Ford[];
  /** Casualties/health and reinforcement deadlines of the fixed city posts. */
  cityGarrisons: Record<string, import('./gen/garrisons').GarrisonState>;
  /** The castaways who died in this world (multiplayer, shared): their names (lower case) are not taken again; `pod` stays open. */
  fallen: Record<string, Fallen>;
  /** The cryo-pod this character woke from (world/crashpod.ts); unset = by their place on the server. */
  pod?: number;
  /** Online: what a dead character of this same player left behind (ui/rebirth.ts): their houses and what was in them,
   *  waiting until the elder hands them over (ui/dialog.ts 'estate'). Personal, never shared. */
  estate?: Estate;
  /** Piers on the sea coast you staked out, with their state (gen/piers.ts). */
  piers: Pier[];
  /** Your boats and where they lie (gen/boats.ts; each hold is `containers[id]`). */
  boats: Boat[];
  /** The Gridholm scout's welcome (world/guide.ts): 0 waiting at your ship, 1 leading you to Gridholm, 2 done. */
  guide: number;
  /** Seconds left in the filter screwed into your gas mask (gen/toxic.ts MASK; 0 = none or spent). */
  filter: number;
  /** The toxic fog zones you have found (id -> [x, z, radius, name]) for the maps. */
  fogs: Record<string, [number, number, number, string]>;
  /** Villages where you own a house (bought from the elder; Gridholm's for now). */
  houses: number[];
  /** Which house (gen/homes.ts index) you have in each of those villages; unset = the first (Gridholm's, from before). */
  homeOf?: Record<string, number>;
  /** The shuttle project in the hangar by Gridholm (gen/shuttle.ts): crates handed over per stage. */
  shuttle: ShuttleState;
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
  /** The notice boards of the other villages (by village id), the same shape, made when you first read one. */
  boards: Record<number, { seq: number; offers: Quest[]; stamp?: number }>;
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
  /** Rounds in each gun's magazine (data/weapons.ts GUNS; ammunition is limited: reloads come out of the backpack). */
  loaded: Partial<Record<ItemKey, number>>;
  /** The GPS Tablet's waypoint (world x, z), or null. */
  waypoint: [number, number] | null;
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
  /** New-world settlement rules; 0 preserves settlements in older saves. */
  settlementRules: 0 | 1;
  settlementRewards?: string[];
  /** Work ordered from village craftsmen (ui/orders.ts): world, village, order (index in data/orders.ts ORDERS), pieces still to collect, game time ready. Yours alone (not shared). */
  forge?: { w: number; v: number; i: number; n: number; done: number; told?: 1 }[];
  /** Work ordered from the mechanic (data/garage.ts GARAGE index): world, village, game time ready. Yours alone. */
  garage?: { w: number; v: number; i: number; done: number; n?: number; told?: 1 }[];
  /** The markets (gen/market.ts): how trades have shifted each village's stocks. On the server this is shared by everyone. */
  market: MarketState;
  /** Prices you have seen, per village id: when, the village's name and place, and [buy, sell] per good. */
  ledger: Record<string, { t: number; name: string; x: number; z: number; q: Record<string, [number, number]> }>;
  /** Crates bought off passing caravans (gen/caravans.ts), by caravan id. */
  caravans: Record<string, number>;
  /** The caravan you are guarding (world/caravans.ts): its road and departure, where it goes, the pay, how long you have been away from it, raids so far. */
  escort: { id: string; road: string; k: number; to: number; toName: string; pay: number; away: number; raids: number; second: boolean } | null;
  /** Delivery contracts you took (gen/contracts.ts), and the ids of offers taken (so they are not posted again). */
  contracts: Contract[]; taken: string[];
}

export interface Fallen { n: string; t: number; pod: number }
/** A dead character's houses (village ids) and their containers ('home:*'), `from` = whose they were. */
export interface Estate { from: string; houses: number[]; chests: Record<string, Container>; idx?: Record<string, number>; pid?: string }
export const SAVE_KEY = 'gridWorld.character.v3';
/** Keys from before the project was renamed from Grid Arena to GridWorld. */
export const ARENA_V3_KEY = 'gridArena.character.v3', V2_KEY = 'gridArena.character.v2', OLD_KEY = 'gridArena.character.v1';

export const newChar = (): Char => ({
  v: 3, settlementRules: 1, name: '', intro: false, tech: {}, leads: [], installs: {}, bridges: {}, bridgeSites: [], cityGarrisons: {}, fallen: {}, piers: [], boats: [], filter: 0, fogs: {}, guide: 0, houses: [], shuttle: { given: {}, v: 2 }, level: 1, xp: 0, gold: 0, world: (Math.random() * 1e6) | 0,
  inv: Array(INV_SIZE).fill(null), mods: Array(MOD_SIZE).fill(null), opened: {}, unlocked: {}, killed: {},
  loc: 'overworld', ow: null, dungeon: null, discovered: {}, containers: {}, vehicles: [], board: { seq: 0, offers: [], stamp: boardPeriod(START_TIME) }, boards: {}, quests: [], camps: {}, time: START_TIME, gunMods: [null, null, null], loaded: { blaster: 20 }, waypoint: null, kcal: KCAL.start, stomach: 0, water: 100, harvest: {}, benches: [], claims: [],
  hands: [{ k: 'blaster', n: 1 }], back: [{ k: 'blade', n: 1 }, null], wear: {}, pid: Math.random().toString(36).slice(2, 10), towns: {}, market: {}, ledger: {}, caravans: {}, escort: null, contracts: [], taken: [],
});

interface V2 { level?: number; xp?: number; gold?: number; world?: number; inv?: (Slot | null)[]; mods?: (ItemKey | null)[] }

/** v1 stored relic counts; they go into free modules first, then the backpack. */
function migrateV1(o: { level?: number; xp?: number; gold?: number; relics?: Record<string, number> }): Char {
  const c = newChar(); c.settlementRules = 0; c.intro = true; c.guide = 2;
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
  const c = newChar(); c.settlementRules = 0; c.intro = true; c.guide = 2;
  if (o.level) c.level = o.level; if (o.xp) c.xp = o.xp; if (o.gold) c.gold = o.gold;
  if (typeof o.world === 'number') c.world = o.world;
  if (Array.isArray(o.inv)) c.inv = Array.from({ length: INV_SIZE }, (_, i) => o.inv![i] ?? null);
  if (Array.isArray(o.mods)) c.mods = Array.from({ length: MOD_SIZE }, (_, i) => o.mods![i] ?? null);
  return c;
}

/** Energy Cells an old save gets when ammunition stops being endless. */
export const OLD_SAVE_CELLS = 120;
export function loadChar(storage: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>> | null = safeStorage()): Char {
  try {
    const raw = storage?.getItem(SAVE_KEY) ?? storage?.getItem(ARENA_V3_KEY);
    if (raw) {
      const c = Object.assign(newChar(), JSON.parse(raw)) as Char & { food?: number };
      if (!('settlementRules' in JSON.parse(raw))) {
        c.settlementRules = 0;
        // Keep the original serialized character for the frozen release; never replace an earlier backup.
        try { if (!storage?.getItem('gridWorld.frozen.0.130.0')) storage?.setItem?.('gridWorld.frozen.0.130.0', raw); } catch { /* a failed backup must not discard the loaded character */ }
      }
      // food used to be a 0..100 bar: it becomes the same share of the calorie store
      if (typeof c.food === 'number') { if (!('kcal' in JSON.parse(raw))) c.kcal = Math.round(c.food / 100 * KCAL.max); delete c.food; }
      if (c.loc === 'dungeon' && !c.dungeon) c.loc = 'overworld';
      if (!('guide' in JSON.parse(raw))) c.guide = 2; // characters from before the welcome found their own way
      if (!('intro' in JSON.parse(raw))) c.intro = true; // characters from before the opening existed have long since walked away from their ship
      // the house in Gridholm used to be yours from the start: whoever already kept things in its chest owns it
      if (!c.houses.length && c.containers['home:chest']) c.houses = [GRIDHOLM_ID];
      for (const k of Object.keys(c.installs) as InstallKind[]) fixInstall(k, c.installs[k]!);
      for (const t of Object.values(c.towns)) for (const p of t?.plants ?? []) fixPlant(p); // works whose recipes changed
      { // stages finished before the Chariot wanted the old plants' goods stay finished; crates it no longer takes go to Gridholm's hall
        const back = Object.entries(fixShuttle(c.shuttle));
        if (back.length) { const hold = ((c.towns[GRIDHOLM_ID] ??= {}).hold ??= {}); for (const [g, n] of back) hold[g as ItemKey] = (hold[g as ItemKey] ?? 0) + n!; }
      }
      if (!('loaded' in JSON.parse(raw))) { // ammunition used to be endless: a full Blaster and a stock of cells (what finds no room waits in Gridholm's hall)
        const left = putItems(c.inv, 'ammoE', OLD_SAVE_CELLS, PACK.vol);
        if (left > 0) { const hold = ((c.towns[GRIDHOLM_ID] ??= {}).hold ??= {}); hold.ammoE = (hold.ammoE ?? 0) + left; }
      }
      retireOldCrossings(c);
      return c;
    }
    const v2 = storage?.getItem(V2_KEY);
    if (v2) return migrateV2(JSON.parse(v2));
    const old = storage?.getItem(OLD_KEY);
    if (old) return migrateV1(JSON.parse(old));
  } catch { /* corrupt or blocked storage: start fresh */ }
  return newChar();
}

/** Online the character also lives under the server's own key (ui/mp.ts), so the same hero comes back to it. */
let mirror: () => string | null = () => null;
export function setSaveMirror(f: () => string | null) { mirror = f; }
export function saveChar(c: Char): void {
  try {
    const j = JSON.stringify(c), m = mirror();
    localStorage.setItem(SAVE_KEY, j);
    if (m) localStorage.setItem(m, j);
  } catch { /* storage unavailable */ }
}
/** A character stored under another key (a server's), with every migration of loadChar; null if there is none. */
export function loadCharAt(key: string): Char | null {
  let raw: string | null = null;
  try { raw = localStorage.getItem(key); } catch { return null; }
  if (!raw) return null;
  const r = raw;
  return loadChar({ getItem: (k) => (k === SAVE_KEY ? r : null) });
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
