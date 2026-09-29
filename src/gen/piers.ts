// Piers on the sea coast, built by the players with a Pier Kit. Pure and deterministic given where they were staked.
//
// Staking out (`planPier`): from where the player stands, along where they look, the first sea water within
// `PIER.look`; the pier's root is `PIER.back` metres short of it on the beach, and it runs straight out until the
// water under its head is `PIER.depth` deep (a boat's draught, for the boats to come), at least `PIER.min` long.
// The deck is `PIER.w` wide, `PIER.clear` above the sea, ramping down to the beach over its first `PIER.ramp`
// metres, and ends in a wider head with bollards, a lamp and a crate for goods (`char.containers[<id>]`).
// The materials go in bit by bit, as for the bridges (`handOverPier`). Saved: `char.piers` (place, shape and state).
import { worldDist, poisNear } from './regions';
import { SEA } from './seas';
import type { ItemKey } from '../data/items';
import type { BoatBuild } from './boats';

export const PIER = {
  /** How far along the view the sea is looked for; the root's distance back from the waterline (m). */
  look: 45, back: 3,
  /** The depth wanted under the head, the shortest and longest pier (m). */
  depth: 1.8, min: 10, max: 45,
  /** Deck width, height over the sea, the ramp at the root, and the head (length and width) (m). */
  w: 3.2, clear: 1.3, ramp: 5, head: 5, headW: 6,
  /** The steepest the beach may be at the root (m of ground above the deck). */
  steep: 3,
  /** Other piers keep this far apart; places this far from the pier (m). */
  apart: 45, place: 25,
  /** Materials per metre of deck (rounded up), and the fittings of the head; xp per metre. */
  per: { log: 1 / 1.4, stone: 1 / 5, nails: 1 / 2, rope: 1 / 4 } as Partial<Record<ItemKey, number>>,
  fittings: { scrap: 3, wire: 2 } as Partial<Record<ItemKey, number>>,
  xp: 14,
  /** Slots of the crate on the head. */
  crate: 16,
};

export interface Pier {
  /** 'pier:<pid>:<time>:<n>'. */
  id: string;
  /** The root on the beach and the direction out to sea (unit). */
  x: number; z: number; dx: number; dz: number;
  /** Length of the deck to the end of the head; the ground at the root. */
  len: number; g0: number;
  given: Partial<Record<ItemKey, number>>;
  done?: number;
  /** A boat going up on its slip (gen/boats.ts). */
  boat?: BoatBuild;
}
type Water = (x: number, z: number) => { kind: string; depth: number } | null;

/** The deck's height at distance s along the pier from its root. */
export function pierY(p: Pier, s: number): number {
  const top = SEA.level + PIER.clear;
  return s >= PIER.ramp ? top : p.g0 + (top - p.g0) * Math.max(0, s) / PIER.ramp;
}
/** Where (x, z) lies in the pier's frame: s out from the root, v across. */
export const pierLocal = (p: Pier, x: number, z: number): [number, number] => [(x - p.x) * p.dx + (z - p.z) * p.dz, (x - p.x) * -p.dz + (z - p.z) * p.dx];
/** The deck's height at (x, z), or null off it (the head is wider). */
export function pierAt(p: Pier, x: number, z: number): number | null {
  const [s, v] = pierLocal(p, x, z), hw = (s > p.len - PIER.head ? PIER.headW : PIER.w) / 2;
  return s >= 0 && s <= p.len && Math.abs(v) <= hw ? pierY(p, s) : null;
}

/**
 * A pier from the player at (px, pz) looking along (fx, fz): null without sea ahead. `problem` says why it cannot go
 * there (null: it can).
 */
export function planPier(world: number, px: number, pz: number, fx: number, fz: number, ground: (x: number, z: number) => number, water: Water, others: Pier[]): { p: Pier | null; problem: string | null } {
  const L = Math.hypot(fx, fz) || 1, dx = fx / L, dz = fz / L;
  let edge = -1, fresh = false;
  for (let t = 1; t <= PIER.look; t += 0.5) {
    const w = water(px + dx * t, pz + dz * t);
    if (w?.kind === 'sea') { edge = t; break; }
    if (w && w.depth > 0.3) fresh = true;
  }
  if (edge < 0) return { p: null, problem: fresh ? 'Piers are for the sea: this is a lake or a river' : 'Look out to sea to build a pier' };
  const t0 = Math.max(0, edge - PIER.back), x = px + dx * t0, z = pz + dz * t0;
  // out until the water is deep enough under the head
  let len = -1;
  for (let s = PIER.min; s <= PIER.max; s += 1) {
    const w = water(x + dx * (s - PIER.head / 2), z + dz * (s - PIER.head / 2));
    if (w && w.kind === 'sea' && w.depth >= PIER.depth) { len = s; break; }
    if (w && w.kind !== 'sea') break;
  }
  const g0 = ground(x, z), p: Pier = { id: '', x, z, dx, dz, len: len < 0 ? PIER.max : len, g0, given: {} };
  if (len < 0) return { p, problem: `The water stays too shallow: no ${PIER.depth} m depth within ${PIER.max} m` };
  if (g0 > SEA.level + PIER.clear + PIER.steep) return { p, problem: 'The shore is too steep here' };
  const mid = { x: x + dx * len / 2, z: z + dz * len / 2 };
  for (const q of poisNear(world, mid.x, mid.z, len / 2 + 120)) {
    const d = Math.hypot(Math.max(q.rect.x0 - mid.x, 0, mid.x - q.rect.x1), Math.max(q.rect.z0 - mid.z, 0, mid.z - q.rect.z1));
    if (d < len / 2 + q.flat + q.blend + PIER.place) return { p, problem: `Too close to ${q.type === 'village' ? q.name : 'the ' + q.name}` };
  }
  if (others.some((o) => worldDist(o.x + o.dx * o.len / 2, o.z + o.dz * o.len / 2, mid.x, mid.z) < PIER.apart + (o.len + len) / 2)) return { p, problem: 'Another pier is too close' };
  return { p, problem: null };
}

/** What the pier takes: its deck by the metre, and the head's fittings. */
export function pierNeeds(p: Pier): [ItemKey, number][] {
  const out = new Map<ItemKey, number>();
  for (const [k, r] of Object.entries(PIER.per) as [ItemKey, number][]) out.set(k, Math.ceil(p.len * r));
  for (const [k, n] of Object.entries(PIER.fittings) as [ItemKey, number][]) out.set(k, (out.get(k) ?? 0) + n);
  return [...out];
}
export interface PierRow { k: ItemKey; n: number; given: number }
export const pierRows = (p: Pier): PierRow[] => pierNeeds(p).map(([k, n]) => ({ k, n, given: p.given[k] ?? 0 }));
export function pierProgress(p: Pier): number {
  if (p.done) return 1;
  const rows = pierRows(p), all = rows.reduce((a, r) => a + r.n, 0);
  return all ? rows.reduce((a, r) => a + Math.min(r.n, r.given), 0) / all : 0;
}
/** Hand over what you have (`have`); the pier stands once everything is in. */
export function handOverPier(p: Pier, have: (k: ItemKey) => number, now: number): { taken: [ItemKey, number][]; built: boolean } {
  if (p.done) return { taken: [], built: false };
  const taken: [ItemKey, number][] = [];
  for (const r of pierRows(p)) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { p.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (pierRows(p).some((r) => r.given < r.n)) return { taken, built: false };
  p.done = now; p.given = {};
  return { taken, built: true };
}
export const pierXp = (p: Pier) => Math.round(p.len * PIER.xp);
