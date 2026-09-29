// Bridges over the rivers, built by the players. Pure and deterministic.
//
// Every place where a road crosses a river (a ford: gen/rivers.ts makes the channel shallow there) is a bridge
// site. Its bridge is fixed by the world: a straight timber deck along the road, `BRIDGE.w` wide, flat
// `BRIDGE.clear` above the water over the channel and its banks, then ramping down to the ground at both ends
// (`half + BRIDGE.reach` from the middle). The players build it: the materials are handed over bit by bit
// (`handOverBridge`), and when all are in the bridge stands (`BridgeState.done`). Saved: `char.bridges[id]`.
import { wrapR, REGION, type Rect } from './regions';
import { regionRoads, type Road } from './roads';
import { riverSegsIn, riverNear, riversOf } from './rivers';
import type { ItemKey } from '../data/items';

export const BRIDGE = {
  /** Deck width (m): the road's width and a little more. */
  w: 5.4,
  /** Height of the deck over the water (m). */
  clear: 1.4,
  /** The deck stays flat this far past the bank, then ramps to the ground at `reach` past it (m). */
  flat: 2, reach: 10,
  /** Two fords of one road on one river closer than this are one site (m). */
  merge: 30,
  /** Materials for every metre of the deck (rounded up for the whole bridge), and xp per metre. */
  per: { log: 1 / 1.6, stone: 1 / 4, nails: 1 / 2, rope: 1 / 6 } as Partial<Record<ItemKey, number>>,
  xp: 12,
};

/** A ford where a road crosses a river: the site of a bridge. */
export interface Ford {
  /** 'bridge:<road id>:<river>:<stretch>' (canonical: the same on every copy of the planet). */
  id: string;
  /** The middle of the crossing, the road's direction there (unit) and across it. */
  x: number; z: number; dx: number; dz: number;
  river: string; road: string;
  /** Water level and the channel's half-width at the crossing. */
  level: number; half: number;
  /** Distance from the middle to each end of the deck, and the ground there (-end, +end). */
  end: number; g0: number; g1: number;
}
export interface BridgeState { given: Partial<Record<ItemKey, number>>; done?: number }

/** Where two segments cross (the parameter along each), or null. */
function cross(ax: number, az: number, bx: number, bz: number, cx: number, cz: number, ex: number, ez: number): [number, number] | null {
  const rx = bx - ax, rz = bz - az, sx = ex - cx, sz = ez - cz, den = rx * sz - rz * sx;
  if (Math.abs(den) < 1e-9) return null;
  const t = ((cx - ax) * sz - (cz - az) * sx) / den, u = ((cx - ax) * rz - (cz - az) * rx) / den;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1 ? [t, u] : null;
}

const cache = new Map<string, Ford[]>();
/**
 * The fords whose middle lies in region (rx, rz). `ground(x, z)` is the terrain's height (the deck's ends sit on
 * it); pass `Terrain.heightAt` bound to its terrain.
 */
export function regionFords(world: number, rx: number, rz: number, ground: (x: number, z: number) => number): Ford[] {
  const c = wrapR(rx);
  if (c !== rx) return regionFords(world, c, rz, (x, z) => ground(x + (rx - c) * REGION, z)).map((f) => ({ ...f, x: f.x + (rx - c) * REGION }));
  const key = world + ':' + rx + ':' + rz;
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 4096) cache.clear();
  out = [];
  const r: Rect = { x0: rx * REGION - REGION / 2, z0: rz * REGION - REGION / 2, x1: rx * REGION + REGION / 2, z1: rz * REGION + REGION / 2 };
  const roads = regionRoads(world, rx, rz).filter((d: Road) => !d.h);
  if (roads.length) {
    const segs = riverSegsIn(world, r.x0 - 40, r.z0 - 40, r.x1 + 40, r.z1 + 40), names = riversOf(world).list;
    if (segs.length) for (const road of roads) {
      const found: Ford[] = [];
      for (let k = 0; k + 1 < road.pts.length; k++) {
        const [ax, az] = road.pts[k], [bx, bz] = road.pts[k + 1];
        for (const s of segs) {
          const hit = cross(ax, az, bx, bz, s.ax, s.az, s.bx, s.bz);
          if (!hit) continue;
          const x = ax + (bx - ax) * hit[0], z = az + (bz - az) * hit[0];
          if (found.some((f) => Math.hypot(f.x - x, f.z - z) < BRIDGE.merge)) continue;
          const L = Math.hypot(bx - ax, bz - az), dx = (bx - ax) / L, dz = (bz - az) / L, h = riverNear([s], x, z)!;
          const end = h.half + BRIDGE.reach;
          found.push({ id: `bridge:${road.id}:${s.r}:${s.i}`, x, z, dx, dz, river: names[s.r].name, road: road.id, level: h.level, half: h.half, end,
            g0: ground(x - dx * end, z - dz * end), g1: ground(x + dx * end, z + dz * end) });
        }
      }
      // only the fords whose middle is in this region (a road's stretch may reach into its neighbours)
      out.push(...found.filter((f) => f.x >= r.x0 && f.x < r.x1 && f.z >= r.z0 && f.z < r.z1));
    }
  }
  cache.set(key, out);
  return out;
}

/** Height of the deck at distance s from the middle along the road (-end .. end). */
export function deckY(f: Ford, s: number): number {
  const top = f.level + BRIDGE.clear, a = Math.abs(s), flat = f.half + BRIDGE.flat;
  if (a <= flat) return top;
  const g = s < 0 ? f.g0 : f.g1, t = Math.min(1, (a - flat) / (f.end - flat));
  return top + (g - top) * t;
}
/** Where (x, z) lies in the bridge's frame: s along the road from the middle, v across it. */
export const bridgeLocal = (f: Ford, x: number, z: number): [number, number] => [(x - f.x) * f.dx + (z - f.z) * f.dz, (x - f.x) * -f.dz + (z - f.z) * f.dx];
/** The deck's height at (x, z), or null off the deck. */
export function deckAt(f: Ford, x: number, z: number): number | null {
  const [s, v] = bridgeLocal(f, x, z);
  return Math.abs(s) <= f.end && Math.abs(v) <= BRIDGE.w / 2 ? deckY(f, s) : null;
}

/** What the whole bridge takes (the deck's length × `BRIDGE.per`, rounded up). */
export function bridgeNeeds(f: Ford): [ItemKey, number][] {
  const len = 2 * f.end;
  return (Object.entries(BRIDGE.per) as [ItemKey, number][]).map(([k, p]) => [k, Math.ceil(len * p)]);
}
export interface BridgeRow { k: ItemKey; n: number; given: number }
export const bridgeRows = (f: Ford, s: BridgeState | undefined): BridgeRow[] => bridgeNeeds(f).map(([k, n]) => ({ k, n, given: s?.given[k] ?? 0 }));
/** How far along it is (0..1, by the materials in). */
export function bridgeProgress(f: Ford, s: BridgeState | undefined): number {
  if (s?.done) return 1;
  const rows = bridgeRows(f, s), all = rows.reduce((a, r) => a + r.n, 0);
  return all ? rows.reduce((a, r) => a + Math.min(r.n, r.given), 0) / all : 0;
}
/** Hand over what you have (`have`) towards the bridge; it stands once everything is in. */
export function handOverBridge(f: Ford, s: BridgeState, have: (k: ItemKey) => number, now: number): { taken: [ItemKey, number][]; built: boolean } {
  if (s.done) return { taken: [], built: false };
  const taken: [ItemKey, number][] = [];
  for (const r of bridgeRows(f, s)) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (bridgeRows(f, s).some((r) => r.given < r.n)) return { taken, built: false };
  s.done = now; s.given = {};
  return { taken, built: true };
}
/** Experience for finishing a bridge. */
export const bridgeXp = (f: Ford) => Math.round(2 * f.end * BRIDGE.xp);
