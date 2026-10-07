// Boats and ships, built by the players at their docks (gen/piers.ts). Pure: the kinds, what they take, building one
// bit by bit, refitting a rowboat, where a new one is launched and where one floats. The runtime (world/boats.ts)
// rows, sails, steers and draws them.
//
// Two hulls. The small boat (`row`, the Rowboat) is rowed with oars and your stamina; refitted at a dock it takes a
// mast and a sail (`sail`, the Sailing Skiff, driven by the wind of gen/weather.ts: `sailSpeed`) or an outboard
// (`motor`, the Motor Skiff, burning fuel canisters). The ship is bigger, decked and only sails or steams: the
// Sailing Ship (`ship`, two masts) or the Motor Ship (`steamer`, an engine and a funnel). On a ship's deck you walk
// about while it sails (`BoatSpec.deck`); you take its wheel to steer it. They differ in their holds.
import type { ItemKey } from '../data/items';

export type BoatKind = 'row' | 'sail' | 'motor' | 'ship' | 'steamer';
export interface BoatSpec {
  name: string;
  /** Length, beam and draught (m): it needs `draft` + `keel` of water under it. */
  len: number; beam: number; draft: number;
  /** Top speed through the water (m/s), backing speed as a share of it, turning (rad/s). */
  speed: number; back: number; turn: number;
  /** Slots of its hold. */
  hold: number;
  /** Where you sit or stand to steer (m from the middle, + towards the bow) and how high the eye is over the water. */
  seat: number; eye: number;
  /** A small boat's second seat (u), for another player: rowing too where `rowers` is 2, else along for the ride. */
  seat2?: number;
  /** How many can row at once (the rowboat: two, each pair of oars adding way). */
  rowers?: number;
  /** A mast too tall to pass under a bridge. */
  tall?: boolean;
  /** It sails (the wind drives it with the sail up). */
  sails?: boolean;
  /** Rowing speed with the oars (a sailing skiff with the sail down); the rowboat rows at `speed`. */
  row?: number;
  /** The engine: tank (litres), litres a second at full throttle, litres in a canister. */
  motor?: { tank: number; burn: number; can: number };
  /** A ship: the height of its walkable deck over the water (m). */
  deck?: number;
  /** A refit of this kind of boat at a dock (the `needs` are the refit's), not built new. */
  from?: BoatKind;
  /** What building (or refitting) one takes, and the experience for it. */
  needs: [ItemKey, number][]; xp: number;
  blurb: string;
}
export const BOATS: Record<BoatKind, BoatSpec> = {
  row: {
    name: 'Rowboat', len: 4.2, beam: 1.5, draft: 0.35, speed: 3.6, back: 0.5, turn: 0.9, hold: 10, seat: -0.15, eye: 1.0, seat2: -1.5, rowers: 2,
    needs: [['planks', 20], ['nails', 14], ['rope', 4]], xp: 120,
    blurb: 'the small boat: clinker-built with two pairs of oars (two can row together, and faster), slow and tiring on a long pull, but it goes wherever there is water enough, sea, river or lake, and carries ten loads in its bottom. At a dock it can be refitted with a mast and a sail or with an outboard motor',
  },
  sail: {
    name: 'Sailing Skiff', len: 4.6, beam: 1.6, draft: 0.45, speed: 6, back: 0.4, turn: 0.75, hold: 14, seat: -1.5, eye: 1.05, seat2: -0.1, tall: true, sails: true, row: 1.6, from: 'row',
    needs: [['planks', 12], ['rope', 10], ['hide', 6], ['nails', 8]], xp: 180,
    blurb: 'the small boat refitted with a mast and a hide sail: quick and tireless with a fair wind, but it cannot sail into the wind (tack across it), the mast will not pass under a bridge, and in a calm there are the oars. Fourteen loads',
  },
  motor: {
    name: 'Motor Skiff', len: 4.6, beam: 1.6, draft: 0.4, speed: 8, back: 0.35, turn: 0.85, hold: 14, seat: -1.25, eye: 1.15, seat2: 0.3, from: 'row',
    motor: { tank: 30, burn: 0.03, can: 20 },
    needs: [['scrap', 8], ['engine', 2], ['nails', 6], ['rope', 2], ['planks', 4]], xp: 160,
    blurb: 'the small boat refitted with a windscreen and an outboard motor rebuilt from engine parts: fast against wind and current alike, as long as you feed it fuel canisters. Fourteen loads',
  },
  ship: {
    name: 'Sailing Ship', len: 16, beam: 4.6, draft: 1.3, speed: 8.5, back: 0, turn: 0.28, hold: 48, seat: -4.98, eye: 1.25 + 1.55, tall: true, sails: true, deck: 1.25,
    needs: [['planks', 160], ['nails', 90], ['rope', 40], ['hide', 20], ['scrap', 10]], xp: 900,
    blurb: 'a two-masted ship with a planked deck, a deckhouse aft and a hatch to a deep hold: forty-eight loads. It only sails (no oars), so it needs a wind, cannot sail into it and its masts will not pass under a bridge; while it sails you can leave the wheel and walk the deck',
  },
  steamer: {
    name: 'Motor Ship', len: 15, beam: 4.4, draft: 1.2, speed: 10, back: 0.35, turn: 0.32, hold: 40, seat: -3.98, eye: 1.25 + 1.55, deck: 1.25,
    motor: { tank: 200, burn: 0.1, can: 20 },
    needs: [['planks', 140], ['nails', 80], ['rope', 16], ['scrap', 40], ['engine', 6], ['wire', 12]], xp: 900,
    blurb: 'a decked ship with an engine below, a funnel and a wheelhouse: forty loads in its hold, steady against wind and current as long as its big tank has fuel (canisters, R). It goes under bridges; while it steams you can leave the wheel and walk the deck',
  },
};
/** Kinds built new at a dock's slip (the others are refits). */
export const NEW_BOATS = (Object.keys(BOATS) as BoatKind[]).filter((k) => !BOATS[k].from);
/** Refits a boat of kind k can take. */
export const refitsOf = (k: BoatKind) => (Object.keys(BOATS) as BoatKind[]).filter((r) => BOATS[r].from === k);
/** A ship (decked, you walk aboard). */
export const isShip = (k: BoatKind) => BOATS[k].deck !== undefined;

/** The hull's half-width at u (m from the middle, + towards the bow): full aft of the middle, rounding to the stem. */
export function halfBeam(k: BoatKind, u: number): number {
  const s = BOATS[k], L = s.len / 2;
  if (Math.abs(u) > L) return 0;
  return u <= 0 ? s.beam / 2 - 0.2 * (s.beam / 1.5) * (u / -L) ** 2 * (isShip(k) ? 0.6 : 1) : (s.beam / 2) * Math.sqrt(Math.max(0, 1 - (u / L) ** 2));
}
/** Points under the hull that must float: bow, stern, the sides and the quarters (boat-local u along, v across). */
export function hullPoints(k: BoatKind): [number, number][] {
  const s = BOATS[k], L = s.len / 2, B = s.beam / 2;
  const pts: [number, number][] = [[L, 0], [-L, 0], [0, B], [0, -B], [L / 2, B * 0.66], [L / 2, -B * 0.66]];
  if (isShip(k)) pts.push([-L / 2, B * 0.9], [-L / 2, -B * 0.9], [L * 0.8, 0], [-L * 0.8, B * 0.8], [-L * 0.8, -B * 0.8]);
  return pts;
}
/** Water a boat needs under its keel besides its draught (m). */
export const KEEL = 0.15;

/** A boat of yours, where it lies (saved in `char.boats`; the hold is `char.containers[id]`). */
export interface Boat { id: string; k: BoatKind; x: number; z: number; yaw: number; t: number; fuel?: number; refit?: BoatBuild }
/** A boat going up at a dock (saved on the dock), or a refit under way (saved on the boat). */
export interface BoatBuild { k: BoatKind; given: Partial<Record<ItemKey, number>> }

export interface BoatRow { k: ItemKey; n: number; given: number }
export const boatRows = (b: BoatBuild): BoatRow[] => BOATS[b.k].needs.map(([k, n]) => ({ k, n, given: b.given[k] ?? 0 }));
/** Hand over what you have (`have`); true once the boat is complete. */
export function handOverBoat(b: BoatBuild, have: (k: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const taken: [ItemKey, number][] = [];
  for (const r of boatRows(b)) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { b.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  return { taken, built: boatRows(b).every((r) => r.given >= r.n) };
}
/** Can a boat of this kind float over water this deep? */
export const floats = (k: BoatKind, depth: number) => depth >= BOATS[k].draft + KEEL;

// ---------- sailing ----------
/** The wind's speed (m/s) from the weather's 0..1. */
export const windSpeed = (w: number) => 2 + 10 * w;
/** The angle between a boat's heading and where the wind blows to: 0 = running before the wind, π = head to wind. */
export function windAngle(yaw: number, windDir: number): number {
  const d = Math.sin(yaw) * Math.cos(windDir) + Math.cos(yaw) * Math.sin(windDir);
  return Math.acos(Math.max(-1, Math.min(1, d)));
}
/** How well the hull sails at that angle (0..1): best on a beam reach, nothing head to wind (the no-go zone). */
export const NO_GO = 0.83 * Math.PI, CLOSE = 0.75 * Math.PI;
export function polar(theta: number): number {
  if (theta >= NO_GO) return 0;
  const p = 0.5 + 0.5 * Math.sin(Math.min(theta, CLOSE));
  return theta <= CLOSE ? p : p * (NO_GO - theta) / (NO_GO - CLOSE);
}
/** The best sheet at that angle: 1 let right out (running), near 0 hauled in (close-hauled). */
export const bestSheet = (theta: number) => Math.max(0.05, Math.min(1, 1 - theta / CLOSE));
/** How much of the wind the sail catches with the sheet at `sheet` (0..1). */
export const trim = (theta: number, sheet: number) => Math.max(0, 1 - Math.abs(sheet - bestSheet(theta)) * 1.8);
/** The speed a sailboat heads for (m/s), with the sail up. */
export const sailSpeed = (k: BoatKind, wind: number, theta: number, sheet: number) => Math.min(BOATS[k].speed, windSpeed(wind) * 0.75 * polar(theta) * trim(theta, sheet));
/** How the wind comes, in words. */
export function pointOfSail(theta: number): string {
  const d = theta * 180 / Math.PI;
  return d < 30 ? 'from astern' : d < 70 ? 'on the quarter' : d < 110 ? 'on the beam' : d < CLOSE * 180 / Math.PI + 4 ? 'close-hauled' : 'head to wind: no way on';
}

/** Where a boat launched at a dock lies: beside the head (either side), further along the dock, or straight out beyond
 *  its head; the first spot where every point under the hull floats and none lies over the dock. Null: the water by
 *  this dock is too shallow for it. `depth` gives the water's depth at a point (null on land). */
export function launchSpot(k: BoatKind, dock: { x: number; z: number; dx: number; dz: number; len: number; head: number; headW: number; w: number },
  depth: (x: number, z: number) => number | null): { x: number; z: number; yaw: number } | null {
  const s = BOATS[k], yaw = Math.atan2(dock.dx, dock.dz), fx = Math.sin(yaw), fz = Math.cos(yaw);
  const onDock = (x: number, z: number) => {
    const u = (x - dock.x) * dock.dx + (z - dock.z) * dock.dz, v = (x - dock.x) * -dock.dz + (z - dock.z) * dock.dx;
    return u >= -0.5 && u <= dock.len + 0.5 && Math.abs(v) <= (u > dock.len - dock.head ? dock.headW : dock.w) / 2 + 0.1;
  };
  const ok = (cx: number, cz: number) => hullPoints(k).every(([u, v]) => {
    const x = cx + fx * u + fz * v, z = cz + fz * u - fx * v, d = depth(x, z);
    return d !== null && floats(k, d) && !onDock(x, z);
  });
  const tries: [number, number][] = [], off = isShip(k) ? 0.25 : 0.7; // a ship lies close alongside, so you step across onto her deck
  for (const side of [1, -1]) {
    tries.push([dock.len - dock.head / 2, side * (dock.headW / 2 + s.beam / 2 + off)]);
    // her middle (the gangway) by the outer end of the head, the rest of her out in the deeper water past it
    for (const a of [dock.len - 1.5, dock.len - 0.6]) tries.push([a, side * (dock.headW / 2 + s.beam / 2 + off)]);
    for (let a = dock.len - dock.head - 2; a > dock.len / 3; a -= 2) tries.push([a, side * (dock.w / 2 + s.beam / 2 + off)]);
  }
  for (const a of [dock.len + s.len / 2 + 1.5, dock.len + s.len / 2 + 6]) tries.push([a, 0]);
  for (const [a, v] of tries) {
    const x = dock.x + a * dock.dx - v * dock.dz, z = dock.z + a * dock.dz + v * dock.dx;
    if (ok(x, z)) return { x, z, yaw };
  }
  return null;
}

/** How much way the oars give (0..): one rower pulling at `a`, two together more than one but less than twice
 *  (`ROW_PAIR` for two pulling hard); a rower pulling against the other cancels out. */
export const ROW_PAIR = 1.5;
export function oarPower(a: number, b: number): number {
  const sum = a + b;
  if (!a || !b || Math.sign(a) !== Math.sign(b)) return Math.max(-1, Math.min(1, sum));
  return Math.sign(sum) * Math.min(ROW_PAIR, Math.abs(sum) * ROW_PAIR / 2);
}
