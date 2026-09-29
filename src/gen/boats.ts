// Boats, built by the players at their piers (gen/piers.ts). Pure: the kinds, what they take, building one bit by
// bit, and where one floats. The runtime (world/boats.ts) rows, sails and draws them.
//
// Three kinds: the rowboat (oars and your stamina), the sailboat (the wind of gen/weather.ts: `sailSpeed`) and the
// motor boat (an outboard burning fuel canisters).
import type { ItemKey } from '../data/items';

export type BoatKind = 'row' | 'sail' | 'motor';
export interface BoatSpec {
  name: string;
  /** Length, beam and draught (m): it needs `draft` + `keel` of water under it. */
  len: number; beam: number; draft: number;
  /** Top speed through the water (m/s), backing speed as a share of it, turning (rad/s). */
  speed: number; back: number; turn: number;
  /** Slots of its hold. */
  hold: number;
  /** Where you sit (m from the middle, + towards the bow) and how high the eye is over the water. */
  seat: number; eye: number;
  /** A sailboat's mast is too tall to pass under a bridge. */
  tall?: boolean;
  /** Rowing speed with the spare oars (a sailboat with the sail down). */
  row?: number;
  /** The outboard: tank (litres), litres a second at full throttle, litres in a canister. */
  motor?: { tank: number; burn: number; can: number };
  /** What building one takes, and the experience for it. */
  needs: [ItemKey, number][]; xp: number;
  blurb: string;
}
export const BOATS: Record<BoatKind, BoatSpec> = {
  row: {
    name: 'Rowboat', len: 4.2, beam: 1.5, draft: 0.35, speed: 3.6, back: 0.5, turn: 0.9, hold: 10, seat: -0.15, eye: 1.0,
    needs: [['log', 10], ['nails', 14], ['rope', 4]], xp: 120,
    blurb: 'a clinker-built rowboat with a pair of oars: slow and tiring on a long pull, but it goes wherever there is water enough, sea, river or lake, and carries ten loads in its bottom',
  },
  sail: {
    name: 'Sailboat', len: 6.6, beam: 2.3, draft: 0.6, speed: 7, back: 0.4, turn: 0.55, hold: 24, seat: -2.3, eye: 1.25, tall: true, row: 1.6,
    needs: [['log', 24], ['nails', 30], ['rope', 14], ['hide', 6]], xp: 300,
    blurb: 'a decked sailboat with a mast and a hide sail: quick and tireless with a fair wind, but it cannot sail into the wind (tack across it), its mast will not pass under a bridge, and in a calm there are only the spare oars. Twenty-four loads in its hold',
  },
  motor: {
    name: 'Motor Boat', len: 5.6, beam: 2.0, draft: 0.5, speed: 9, back: 0.35, turn: 0.8, hold: 18, seat: -0.7, eye: 1.4,
    motor: { tank: 40, burn: 0.04, can: 20 },
    needs: [['log', 14], ['nails', 18], ['rope', 4], ['scrap', 10], ['engine', 2]], xp: 260,
    blurb: 'a planked launch with a windscreen and an outboard motor rebuilt from engine parts: the fastest thing on the water, against wind and current alike, as long as you feed it fuel canisters (a full tank lasts a good while at full throttle). Eighteen loads in its hold',
  },
};
/** Water a boat needs under its keel besides its draught (m). */
export const KEEL = 0.15;

/** A boat of yours, where it lies (saved in `char.boats`; the hold is `char.containers[id]`). */
export interface Boat { id: string; k: BoatKind; x: number; z: number; yaw: number; t: number; fuel?: number }
/** A boat going up at a pier (saved on the pier). */
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
