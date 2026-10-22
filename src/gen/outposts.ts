// (0.183, PLAN_PLACOWEK.md stage O2) Outposts at the deposits in the wilds (gen/lodes.ts): a player drives a stake in
// by a deposit, then builds its extraction (a quarry crane, a logging camp, a mine head, a pumpjack or a deep shaft)
// and a storage shed from materials brought there. Once the extraction stands the deposit is worked by a fixed rate
// (its richness × the kind's rate, nothing simulated), the crates pile up on site (a few without a shed, many in one)
// and are hauled away by hand or by truck. Nobody pays for the deposit; power, people and defence come in O3–O5
// (people and food: gen/outpostlife.ts).
//
// Pure: the state is `Char.outposts[lode id]`, shared in multiplayer like the villages' (`towns`): whoever looks first
// settles it, the same way on every game. Every outpost has an owner from the start ('crew' in co-op; a player's pid
// in the rivals mode of stage O8).
import type { ItemKey } from '../data/items';
import { lodeGives, type Lode, type LodeKind } from './lodes';
import { isRare } from './deposits';
import { POWER_SRC, PLINE, plineNeeds, type PowerKind, type PowerLine } from './grid';
import { procOf } from './outpostproc';
import { tl, TL } from '../i18n';

export type OutpostPart = 'dig' | 'store' | 'power' | 'bunks' | 'field' | 'wall' | 'turret' | 'proc' | 'port' | 'pline';
/** (0.216, PLAN_PRAD_I_LUDZIE.md stage Z2) What an entry of the shared `outposts` stands at: a deposit's kind, or a port at
 *  a finished dock (gen/ports.ts; id 'port:<dock id>', no deposit, nothing dug). */
export type OutpostKind = LodeKind | 'port' | 'camp' | 'store';
/** (0.249, PLAN_MAGAZYNOW.md stage M1) A port's warehouse (at a dock) or a warehouse built in the wilds ('store',
 *  id 'wh:<hex>', gen/warehouses.ts): both are built as the part 'port', worked by their own power and people. */
export const isStoreKind = (k: OutpostKind | undefined) => k === 'port' || k === 'store';
/** (0.185, stage O4) Parts built more than once: bunkhouses and fields (counted in `OutpostState.n`); (0.186, stage O5)
 *  the wall (each build raises it a tier) and turrets. */
export type ManyPart = 'bunks' | 'field' | 'wall' | 'turret';
export const isMany = (p: OutpostPart): p is ManyPart => p === 'bunks' || p === 'field' || p === 'wall' || p === 'turret';
export interface OutpostState {
  /** Owner: 'crew' (co-op: everyone) or (0.189, the rivals mode) the seat that staked it, 's<slot>' (gen/rivals.ts). */
  o: string;
  /** (0.189) The seats the owner let in (gen/rivals.ts addPartner). */
  pp?: string[];
  /** Who drove the stake in, when; the deposit's kind, place and name (for the maps, without the generator). */
  by: string; t: number; k: OutpostKind; x: number; z: number; name: string;
  done?: Partial<Record<OutpostPart, true>>;
  given?: Partial<Record<OutpostPart, Partial<Record<ItemKey, number>>>>;
  /** The one build going up: the part, its start and hours. */
  job?: { p: OutpostPart; t: number; h: number };
  /** The crates on site at game time `t` (settled forward by the rate). */
  stock?: { t: number; n: Partial<Record<ItemKey, number>> };
  /** (0.184, stage O3) The power source built (or going up) here, and its fuel bunker (crates at game time t). */
  pk?: PowerKind; fuel?: { n: number; t: number };
  /** (0.185, stage O4) Bunkhouses and fields built, and the people: settlers, the pantry (food units), on whole two-hour marks. */
  n?: Partial<Record<ManyPart, number>>;
  life?: OutpostLife;
  /** (0.186, stage O5) The last bandit raid settled, raids fought with a player there (k → outcome), the last outcome. */
  rk?: number; raids?: Record<number, 'won' | 'lost'>; rlast?: [number, 'won' | 'lost'];
  /** (0.187, stage O6) The convoy route to a village (gen/routes.ts). */
  route?: import('./routes').Route;
  /** (0.188, stage O7) Where the processing works stands in its batches (gen/outpostproc.ts). */
  pt?: number;
  /** (0.216, stage Z2) A port's warehouse hold (item → count; gen/ports.ts) and its dock's id. */
  hold?: Partial<Record<ItemKey, number>>; pier?: string;
  /** (0.216) Where a port's pieces stand (gen/ports.ts `portSpots`, worked out once when it was founded). */
  ps?: PortSpots;
  /** (0.218, stage Z4) A crew camp at an old plant (gen/plantcamps.ts): the plant's kind and the crew it needs. */
  ik?: string; cw?: number;
  /** (0.217, stage Z3) A port's cargo line to another port (gen/shiplines.ts), and what its crane took off the lines
   *  coming in (`rcvKey` → item → count, cumulative). */
  line?: import('./shiplines').ShipLine; rcv?: Record<string, Partial<Record<ItemKey, number>>>;
  /** (0.219, stage Z5) The power line to a village (gen/grid.ts), staked out, going up or standing (`done.pline`). */
  pl?: PowerLine;
  /** (0.249, stage M1) What the carriers took from this outpost's site to the warehouse of its hex (gen/warehouses.ts). */
  out?: import('./warehouses').HandOff;
  /** (0.249) A wild warehouse's frame: [x, z] of the point before its doors and [dx, dz] the way the doors face (the
   *  port drawing's frame, gen/ports.ts `portPoint`, without a dock). */
  fr?: [number, number, number, number];
}
export interface PortSpots { house: [number, number]; crane: [number, number]; power: [number, number]; bunks: [number, number][]; fields: [number, number][] }
export interface OutpostLife {
  /** The last two-hour mark settled; people (a fraction while they come and go); food in the pantry; the last step's share fed. */
  t: number; n: number; food: number; fed: number;
  /** When it first became a hamlet (it stays one). */
  v?: number;
}
export type DigKind = 'quarry' | 'logging' | 'mine' | 'pump' | 'shaft';
export const digOf = (k: OutpostKind): DigKind => (k === 'stone' ? 'quarry' : k === 'grove' ? 'logging' : k === 'oil' ? 'pump' : isRare(k) ? 'shaft' : 'mine');
export const DIG: Record<DigKind, { name: string; needs: [ItemKey, number][]; text: string }> = {
  quarry: { name: tl('Quarry crane'), needs: [['planks', 16], ['nails', 10], ['rope', 6], ['scrap', 6]], text: tl('A timber derrick and a cutting floor: the crew splits the face into blocks.') },
  logging: { name: tl('Logging camp'), needs: [['planks', 12], ['nails', 8], ['rope', 4], ['scrap', 8]], text: tl('A saw pit and a skid road: the giants are felled limb by limb and the trunks cut to length.') },
  mine: { name: tl('Mine head'), needs: [['planks', 24], ['nails', 12], ['rope', 6], ['scrap', 10]], text: tl('A headframe over a shaft, a winch and an ore cart.') },
  pump: { name: tl('Pumpjack'), needs: [['scrap', 20], ['pipes', 4], ['parts', 2], ['planks', 8]], text: tl('An old nodding pump over the seep, a tank and a drum filler.') },
  shaft: { name: tl('Deep shaft'), needs: [['steel', 4], ['cable', 4], ['parts', 2], ['planks', 20], ['nails', 10]], text: tl('A steel headframe and a cage down to the rare ore.') },
};
/** (0.185) A bunkhouse sleeps `beds`; a field is worked by `crew` (stage O4: gen/outpostlife.ts). */
export const BUNKS = { name: tl('Bunkhouse'), needs: [['planks', 30], ['nails', 16], ['stone', 10], ['scrap', 4]] as [ItemKey, number][], text: tl('A long plank bunkhouse with a stove: beds for settlers who come to work here.'), max: 3 };
export const FIELD = { name: tl('Field'), needs: [['planks', 10], ['nails', 8], ['rope', 4], ['scrap', 4]] as [ItemKey, number][], text: tl('A fenced plot ploughed and sown: it feeds the people here, as well as the land allows.'), max: 3 };
/** (0.186) The wall round an outpost, a tier a build (stake fence, timber palisade, stone wall), and auto turrets. */
export const WALL = [
  { name: tl('Stake fence'), needs: [['planks', 16], ['nails', 8], ['rope', 6]] as [ItemKey, number][], text: tl('A ring of sharpened stakes and rails: it keeps the animals off the fields and slows a raid.') },
  { name: tl('Timber palisade'), needs: [['planks', 40], ['nails', 20], ['rope', 6], ['scrap', 6]] as [ItemKey, number][], text: tl('A wall of tall timbers with a walk behind: bandits break on it far more often.') },
  { name: tl('Stone wall'), needs: [['stone', 60], ['cement', 6], ['planks', 16], ['scrap', 10]] as [ItemKey, number][], text: tl('Mortared stone with a gate: most raids give up at it.') },
];
export const TURRET = { name: tl('Auto turret'), needs: [['turretkit', 1], ['wire', 4], ['scrap', 6], ['circuit', 2]] as [ItemKey, number][], text: tl('An auto turret on a timber tower: it shoots raiders and beasts that come near, and helps the outpost hold.'), max: 2 };
export const STORE = { name: tl('Storage shed'), needs: [['planks', 20], ['nails', 12], ['stone', 8]] as [ItemKey, number][], text: tl('A plank shed with racks: the crates keep there instead of piling in the open.') };
/** (0.216, stage Z2) The port warehouse at a dock: a yard, a shed and a crane. Its crane (loading boats and trucks) works
 *  with its whole `crew` and a power share of at least `power` over the day (like the settlement's services, 0.215);
 *  storing and taking by hand always works. `vol` litres in the hold; the middle stands `back` m inland of the dock's root. */
export const PORT = {
  name: tl('Port warehouse'), text: tl('A fenced yard on the shore, a big plank shed with racks and a steel crane at the dock: crates go from boats to the shed and back.'),
  needs: [['planks', 40], ['nails', 20], ['stone', 16], ['steel', 4], ['rope', 8], ['gears', 2], ['scrap', 10]] as [ItemKey, number][],
  crew: 4, kw: 10, power: 0.25, vol: 6000, back: 18,
};
/** (0.249, stage M1) A warehouse in the wilds: the same shed and hold as a port's, without the crane; its storekeepers
 *  (the crew) carry in what the deposits of its hex dig. */
export const WILD_STORE = {
  name: tl('Warehouse'), text: tl('A big plank shed with racks and a fenced yard: the storekeepers take in what the deposits of its area dig.'),
  needs: [['planks', 50], ['nails', 24], ['stone', 20], ['rope', 6], ['scrap', 6]] as [ItemKey, number][],
};
export const OUTPOST = {
  /** Crates an hour of the main good at richness 1 (common deposits, rare ones); the second good's share. */
  rate: 0.5, rare: 0.12, second: 0.4,
  /** Crates of each good on site: piled in the open, or in the shed. */
  pile: 6, cap: 60,
  /** Game hours to build; xp. */
  hours: { dig: 10, store: 8, power: 8, bunks: 10, field: 8, wall: 12, turret: 6, proc: 10, port: 14, pline: 6 } as Record<OutpostPart, number>, xp: { dig: 80, store: 40, power: 60, bunks: 50, field: 40, wall: 60, turret: 50, proc: 70, port: 120, pline: 60 } as Record<OutpostPart, number>,
};
/** A part's name; for the wall, the tier the next build gives (`tier` = the tier standing now). */
export const partName = (k: OutpostKind, p: OutpostPart, pk?: PowerKind, tier = 0) => (p === 'pline' ? tl('Power line') : p === 'port' ? (k === 'store' ? WILD_STORE.name : PORT.name) : p === 'dig' ? DIG[digOf(k)].name : p === 'power' ? (pk ? POWER_SRC[pk].name : tl('Power source')) : p === 'bunks' ? BUNKS.name : p === 'field' ? FIELD.name : p === 'wall' ? WALL[Math.min(WALL.length - 1, tier)].name : p === 'turret' ? TURRET.name : p === 'proc' ? (procOf(k)?.name) || tl('Works') : STORE.name);
export const partNeeds = (k: OutpostKind, p: OutpostPart, pk?: PowerKind, tier = 0): [ItemKey, number][] => (p === 'pline' ? [] : p === 'port' ? (k === 'store' ? WILD_STORE.needs : PORT.needs) : p === 'dig' ? DIG[digOf(k)].needs : p === 'power' ? (pk ? POWER_SRC[pk].needs : []) : p === 'bunks' ? BUNKS.needs : p === 'field' ? FIELD.needs : p === 'wall' ? WALL[Math.min(WALL.length - 1, tier)].needs : p === 'turret' ? TURRET.needs : p === 'proc' ? (procOf(k)?.needs) || [] : STORE.needs);
/** The wall's tier (0 none, 1 stakes, 2 palisade, 3 stone) and the turrets. */
export const wallOf = (o: OutpostState) => o.n?.wall ?? 0;
export const turretsOf = (o: OutpostState) => o.n?.turret ?? 0;
/** How many of a part stand (0 / 1 for the single ones). */
export const countOf = (o: OutpostState, p: OutpostPart) => (isMany(p) ? o.n?.[p] ?? 0 : o.done?.[p] ? 1 : 0);
export const maxOf = (p: OutpostPart) => (p === 'bunks' ? BUNKS.max : p === 'field' ? FIELD.max : p === 'wall' ? WALL.length : p === 'turret' ? TURRET.max : 1);
/** Choose the power source to build here (only before anything is handed over for it). */
export function choosePower(o: OutpostState, pk: PowerKind): boolean {
  if (o.done?.power || o.job?.p === 'power' || Object.values(o.given?.power ?? {}).some((n) => (n ?? 0) > 0)) return false;
  o.pk = pk; return true;
}
/** A new outpost at deposit l. */
export const newOutpost = (l: Lode, by: string, now: number, owner = 'crew'): OutpostState => ({ o: owner, by, t: now, k: l.k, x: Math.round(l.x), z: Math.round(l.z), name: l.name });
/** May player `pid` work the outpost (co-op: everyone; the rivals mode: its owner). */
/** May `me` (an owner id: gen/rivals.ts `seatOwner`, or a player id) build at, take from or run outpost `o`? The
 *  crew's are everyone's; (0.189) a rival's are its owner's and the partners' they let in (`pp`). */
export const mayUse = (o: OutpostState, me: string) => o.o === 'crew' || o.o === me || !!o.pp?.includes(me);
/** What the outpost digs an hour, per good. */
export function outputs(l: Lode): [ItemKey, number][] {
  const base = (isRare(l.k) ? OUTPOST.rare : OUTPOST.rate) * l.rich;
  return lodeGives(l).map((g, i) => [g, Math.round(base * (i ? OUTPOST.second : 1) * 1000) / 1000]);
}
export const capOf = (o: OutpostState) => (o.done?.store ? OUTPOST.cap : OUTPOST.pile);
/** The crates on site at `now`, without writing. */
export function stockNow(o: OutpostState, l: Lode, now: number, pw = 1): Partial<Record<ItemKey, number>> {
  if (!o.done?.dig || !o.stock) return { ...(o.stock?.n ?? {}) };
  const h = Math.max(0, now - o.stock.t) / 60 * pw, cap = capOf(o), out: Partial<Record<ItemKey, number>> = {};
  for (const [g, r] of outputs(l)) { const was = o.stock.n[g] ?? 0; out[g] = was >= cap ? was : Math.min(cap, was + r * h); }
  for (const g in o.stock.n) if (out[g as ItemKey] === undefined) out[g as ItemKey] = o.stock.n[g as ItemKey];
  return out;
}
/** Bring the stock forward to `now`. */
export function settle(o: OutpostState, l: Lode, now: number, pw = 1) {
  if (!o.done?.dig) return;
  o.stock = { t: Math.max(now, o.stock?.t ?? now), n: stockNow(o, l, now, pw) };
}
/** Take up to n whole crates of g; how many were taken. */
export function takeCrates(o: OutpostState, l: Lode, g: ItemKey, n: number, now: number, pw = 1): number {
  settle(o, l, now, pw);
  const have = Math.floor(o.stock?.n[g] ?? 0), m = Math.max(0, Math.min(n, have));
  if (m) o.stock!.n[g] = (o.stock!.n[g] ?? 0) - m;
  return m;
}
/** A part's materials with what was handed over. */
export function partPlan(o: OutpostState, p: OutpostPart) {
  return (p === 'pline' ? plineNeeds(o.pl?.km ?? 0) : partNeeds(o.k, p, o.pk, countOf(o, p))).map(([k, n]) => ({ k, n, given: Math.min(n, o.given?.[p]?.[k] ?? 0) }));
}
/** (0.219) Game hours and xp of a build (a power line's by its length). */
export const hoursOf = (o: OutpostState, p: OutpostPart) => (p === 'pline' ? PLINE.hours(o.pl?.km ?? 0) : OUTPOST.hours[p]);
export const xpOf = (o: OutpostState, p: OutpostPart) => (p === 'pline' ? PLINE.xp(o.pl?.km ?? 0) : OUTPOST.xp[p]);
/** Why part p cannot be worked on now ('' = it can). */
export function partProblem(o: OutpostState, p: OutpostPart): string {
  if (countOf(o, p) >= maxOf(p)) return p === 'wall' ? tl('The stone wall stands.') : isMany(p) ? TL`All ${maxOf(p)} stand.` : tl('It stands.');
  if (o.k === 'camp' && p !== 'bunks' && p !== 'field') return tl('Not here.'); // (0.218) a crew camp: bunkhouses and fields
  if (p === 'pline' && !o.pl) return tl('Choose the village first.'); // (0.219) a power line from an outpost or a port
  if (p !== 'pline' && isStoreKind(o.k) !== (p === 'port') && !(isStoreKind(o.k) && (p === 'power' || p === 'bunks' || p === 'field'))) return tl('Not here.'); // (0.216) a port (0.249: or a wild warehouse) builds its warehouse, power, bunks and fields
  if (p === 'power' && !o.pk) return tl('Choose a power source first.');
  if (p === 'proc' && !procOf(o.k)) return tl('Nothing here to process.');
  if (p === 'proc' && !o.done?.dig) return tl('The extraction must stand first.');
  if (o.job) return o.job.p === p ? tl('The builders are at it.') : tl('The builders are busy with the ') + partName(o.k, o.job.p, o.pk, countOf(o, o.job.p)).toLowerCase() + '.';
  return '';
}
/** Hand over what part p still needs (bit by bit); with everything in, the builders start. */
export function handOver(o: OutpostState, p: OutpostPart, have: (k: ItemKey) => number, now: number) {
  const taken: [ItemKey, number][] = [];
  if (partProblem(o, p)) return { taken, started: false };
  const g = ((o.given ??= {})[p] ??= {});
  for (const r of partPlan(o, p)) {
    const n = Math.max(0, Math.min(r.n - r.given, Math.floor(have(r.k))));
    if (n) { g[r.k] = r.given + n; taken.push([r.k, n]); }
  }
  if (!partPlan(o, p).every((r) => r.given >= r.n)) return { taken, started: false };
  o.job = { p, t: now, h: hoursOf(o, p) };
  return { taken, started: true };
}
export const jobEnd = (o: OutpostState) => (o.job ? o.job.t + o.job.h * 60 : Infinity);
/** Finish the build if its time has come; the part finished, or null. */
export function finishDue(o: OutpostState, l: Lode | null, now: number, pw = 1): OutpostPart | null {
  if (!o.job || now < jobEnd(o)) return null;
  const p = o.job.p, end = jobEnd(o);
  if (l) settle(o, l, end, pw); // the stock up to the moment it stands (the old cap)
  if (isMany(p)) (o.n ??= {})[p] = (o.n[p] ?? 0) + 1; else (o.done ??= {})[p] = true;
  delete o.given?.[p]; delete o.job;
  if (p === 'dig') o.stock = { t: end, n: o.stock?.n ?? {} };
  if (p === 'proc') o.pt = end; // (0.188) the works' batches count from here
  if (isMany(p) && !o.life) { const t = Math.floor(end / 120) * 120; o.life = { t, n: 0, food: 0, fed: 1 }; } // the people's clock starts on the mark it stood (gen/outpostlife.ts LIFE.step)
  return p;
}
/** Nothing built or handed over yet: the stake can be pulled up. */
export const bare = (o: OutpostState) => !o.done?.dig && !o.done?.store && !o.done?.power && !o.done?.proc && !o.done?.port && !Object.values(o.hold ?? {}).some((n) => (n ?? 0) > 0) && !o.n?.bunks && !o.n?.field && !o.n?.wall && !o.n?.turret && !o.route?.truck && !o.line?.ship && !o.done?.pline && !o.job && !Object.values(o.given ?? {}).some((g) => Object.values(g ?? {}).some((n) => (n ?? 0) > 0));
