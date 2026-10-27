// Character persistence. Only player-made changes are stored, never generated geometry.
// Versions: v1 (relic counts) -> v2 (backpack, per-dungeon progress) -> v3 (open world).
import { newWorldSeed } from './gen/worldrules';
import type { OutpostState } from './gen/outposts';
import type { RivalSeat } from './gen/rivals';
import { planksForLogs } from './gen/wood';
import { dropEmpty } from './data/cargo';
import { fixInstall, type InstallKind, type InstallState } from './gen/installs';
import { fixPlant } from './gen/plants';
import { retireOldCrossings, type BridgeState, type Ford } from './gen/bridges';
import type { Pier } from './gen/piers';
import type { Lighthouse } from './gen/lighthouses';
import type { Body } from './gen/bodies';
import type { SkyFall } from './gen/skyfall';
import type { WorkClaim } from './gen/workshop';
import type { Boat } from './gen/boats';
import type { Airship } from './gen/airships';
import type { Copter } from './gen/copters';
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
/** `b` (0.247): what a crate or a barrel holds (data/cargo.ts), one kind of thing. */
export interface Slot { k: ItemKey; n: number; c?: number; b?: { k: ItemKey; n: number } }
/** Per-dungeon progress, keyed by dungeonKey() = "ruinId:depth:gx:gz". */
export type Progress = Record<string, number[]>;
/** Where in which dungeon the player is. In a cave system (`cave`), ruinId is the system's id; its mouths are kept so the way out is known. */
export interface DungeonPos { ruinId: number; depth: number; gx: number; gz: number; /** (0.207) a hand-made level from the map editor, by name (world/custommaps.ts) */ custom?: string; cave?: { name: string; mouths: { x: number; z: number; face: number }[]; from: number } }
/** Anything that holds items: a searched chest, a vehicle trunk. */
export interface Container { items: (Slot | null)[]; gold: number; /** (0.247) a vehicle's cargo bays: crates and barrels (data/cargo.ts), `VEHICLES[model].bays` long */ bays?: (Slot | null)[] }
/**
 * A vehicle on the surface. (0.248) Vehicles belong to nobody: the list is the world's (shared online), and the trunk
 * with its cargo bays is the shared container `containers['trunk:<id>']` (`trunkKey`, world/vehicles.ts `trunkOf`).
 * `trunk` / `bays` here only for a vehicle not in the list yet (a raider's, a found one) and old saves.
 */
export interface VehicleState { id: string; model: VehicleModel; x: number; z: number; heading: number; trunk?: Container; parts: VehicleParts; /** (0.203) its headlights are on */ lights?: boolean; bays?: (Slot | null)[] }
/** (0.248) The shared container that is a vehicle's trunk. */
export const trunkKey = (id: string) => 'trunk:' + id;
/** (0.248) Moves the trunks (and cargo bays) kept inside the vehicles into the shared containers. */
export function trunksOut(c: Pick<Char, 'vehicles' | 'containers'>) {
  for (const v of c.vehicles) {
    if (!v.trunk && !v.bays) continue;
    const k = trunkKey(v.id);
    if (!c.containers[k]) c.containers[k] = { ...(v.trunk ?? { items: [], gold: 0 }), ...(v.bays ? { bays: v.bays } : {}) };
    delete v.trunk; delete v.bays;
  }
}
export interface Char {
  v: 3;
  /** The hero's name, entered in the menu before the first game (everyone calls you by it). */
  name: string;
  /** Seen the opening (ui/intro.ts: the ship, the meteor storm, the fall). False for a new character: it starts at the crash site. */
  intro: boolean;
  /** (0.208) Played on a world drawn in the map editor: its file's name (world/custommaps.ts registers it for `world`). */
  cw?: string;
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
  /** (0.245) The bodies of the fallen, lying a game day where they died with their kit (gen/bodies.ts); shared. */
  bodies: Record<string, Body>;
  /** The cryo-pod this character woke from (world/crashpod.ts); unset = by their place on the server. */
  pod?: number;
  /** Online: what a dead character of this same player left behind (ui/rebirth.ts): their houses and what was in them,
   *  waiting until the elder hands them over (ui/dialog.ts 'estate'). Personal, never shared. */
  estate?: Estate;
  /** Piers on the sea coast you staked out, with their state (gen/piers.ts). */
  piers: Pier[];
  /** (0.204) The lighthouses the heroes built or staked out (gen/lighthouses.ts); shared. */
  lighthouses: Lighthouse[];
  /** Your boats and where they lie (gen/boats.ts; each hold is `containers[id]`). */
  boats: Boat[];
  /** (0.256) The airships of this world (gen/airships.ts; each hold is `containers[id]`); shared. */
  airships: Airship[];
  /** (0.259) The rotorcrafts of this world (gen/copters.ts; each hold is `containers[id]`); shared. */
  copters: Copter[];
  /** The Gridholm scout's welcome (world/guide.ts): 0 waiting at your ship, 1 leading you to Gridholm, 2 done. */
  guide: number;
  /** Seconds left in the filter screwed into your gas mask (gen/toxic.ts MASK; 0 = none or spent). */
  filter: number;
  /** (0.199) The light you carry (world/light.ts): on = 0 off / 1 flashlight / 2 oil lamp / 3 torch (0.200); minutes left in the cell and the oil burning now. */
  light?: { on: number; flash: number; oil: number; torch?: number };
  /** The toxic fog zones you have found (id -> [x, z, radius, name]) for the maps. */
  fogs: Record<string, [number, number, number, string]>;
  /** (0.182) Deposits in the wilds on your map (gen/lodes.ts): id -> [x, z, kind, name, 1 seen / 0 only heard of]. Personal, like the map. */
  lodes: Record<string, [number, number, string, string, number]>;
  /** (0.183) Outposts at the deposits (gen/outposts.ts), by lode id. Shared in multiplayer. */
  outposts: Record<string, OutpostState>;
  /** (0.189) The rivals mode's roster: seat -> {n: the name its player goes by, v: the home village} (gen/rivals.ts). Shared. */
  rivals: Record<string, RivalSeat>;
  /** Villages where you own a house (bought from the elder; Gridholm's for now). */
  houses: number[];
  /** Which house (gen/homes.ts index) you have in each of those villages; unset = the first (Gridholm's, from before). */
  homeOf?: Record<string, number>;
  /** Quests finished (0.166): the notice boards post more notices as you prove yourself (world/quests.ts boardOffers). */
  questsDone?: number;
  /** (0.230) Markers switched off in the journal (J): 'q:<quest id>', 'c:<contract id>', 'l:<lead id>', 'elder', 'side', 'guide'. Personal. */
  hideMarks?: string[];
  /** (0.267) The sky falls lying or in flight: one record each, seen and opened by everyone (gen/skyfall.ts); shared. */
  skyfalls: Record<string, SkyFall>;
  /** (0.270) Lying things being worked up in somebody's workshop cells (gen/workshop.ts), by drop id; shared. */
  workclaims: Record<string, WorkClaim>;
  /** (0.234) The body's warmth, −100 freezing .. 100 overheating (world/bodyheat.ts). Personal. */
  body?: number;
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
  /** The vehicles on the surface: (0.248) the world's, anyone drives them (shared online). */
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
  /** (0.201) The other hand: a light (flashlight, oil lamp, torches) or a shield, beside a one-handed weapon. */
  off: (Slot | null)[];
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
  /** (0.167) Told that Kuba the mechanic has come to the start village (personal). */
  mechTold?: 1;
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
  v: 3, settlementRules: 1, name: '', intro: false, tech: {}, leads: [], installs: {}, bridges: {}, bridgeSites: [], cityGarrisons: {}, fallen: {}, bodies: {}, skyfalls: {}, workclaims: {}, piers: [], lighthouses: [], boats: [], airships: [], copters: [], filter: 0, fogs: {}, lodes: {}, outposts: {}, rivals: {}, guide: 0, houses: [], shuttle: { given: {}, v: 2 }, level: 1, xp: 0, gold: 0, world: newWorldSeed(),
  inv: [{ k: 'blade', n: 1 }, ...Array(INV_SIZE - 1).fill(null)], mods: Array(MOD_SIZE).fill(null), opened: {}, unlocked: {}, killed: {},
  loc: 'overworld', ow: null, dungeon: null, discovered: {}, containers: {}, vehicles: [], board: { seq: 0, offers: [], stamp: boardPeriod(START_TIME) }, boards: {}, quests: [], camps: {}, time: START_TIME, gunMods: [null, null, null], loaded: { blaster: 20 }, waypoint: null, kcal: KCAL.start, stomach: 0, water: 100, harvest: {}, benches: [], claims: [],
  hands: [{ k: 'blaster', n: 1 }], back: [], off: [null], wear: {}, pid: Math.random().toString(36).slice(2, 10), towns: {}, market: {}, ledger: {}, caravans: {}, escort: null, contracts: [], taken: [],
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
      if (c.inv.length < INV_SIZE) c.inv = [...c.inv, ...Array(INV_SIZE - c.inv.length).fill(null)]; // (0.201) a bigger backpack
      if (!Array.isArray(c.off) || c.off.length !== 1) c.off = [null];
      // (0.264) nothing hangs on your back any more: what was slung there goes into the backpack's first free slots
      if (!Array.isArray(c.back)) c.back = [];
      c.back = c.back.filter((s) => { if (!s) return false; const f = c.inv.indexOf(null); if (f < 0) return true; c.inv[f] = s; return false; });
      retireOldCrossings(c);
      planksForLogs(c); // (0.165) logs handed over to builds count on as planks
      trunksOut(c); // (0.248) the trunks are shared containers now
      dropEmpty(c.hands); for (const b of Object.values(c.containers ?? {})) dropEmpty(b?.bays); // (0.251) one crate and one barrel; empty ones are gone
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
