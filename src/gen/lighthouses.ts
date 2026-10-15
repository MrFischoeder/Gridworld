// (0.204, the owner's direction) Lighthouses the heroes build: a tall tower whose lamp turns and flashes, seen from
// very far off by night, but that lights nothing round it. Its turning speed is set by whoever stands at its door, so
// the lighthouses along a coast can be told apart by their rhythm. Pure: the lighthouses live in the shared
// `Char.lighthouses` (a list by id); the beam's angle comes from the game clock and the period, so every player sees
// the same flash at the same moment.
import type { ItemKey } from '../data/items';

export interface Lighthouse {
  id: string; x: number; z: number; y: number;
  given: Partial<Record<ItemKey, number>>;
  /** Game time it was finished. */
  done?: number;
  /** Seconds a turn of the beam (`LH.periods`). */
  p: number;
  /** Its lamp is lit. */
  on: boolean;
  by: string;
}
/**
 * `h` the tower's height, `r` its foot's radius, `needs` what it takes, `xp` on completion, `periods` the turning
 * speeds to choose from (seconds a turn; two beams, so it flashes twice a turn), `see` how far its flash is seen (m),
 * `village` / `apart` how far it keeps from villages and from another lighthouse, `steep` the most height difference
 * across its foot.
 */
export const LH = {
  h: 22, r: 3.3,
  needs: [['stone', 40], ['planks', 24], ['scrap', 12], ['wire', 6], ['glass', 2], ['circuit', 2]] as [ItemKey, number][],
  xp: 400, periods: [3, 4, 5, 6, 8, 10, 12, 15, 20, 30], p0: 8, see: 9000, village: 150, apart: 80, steep: 3,
  /** (0.221, stage Z7) In a towns world its lamp is electric (gen/lhpower.ts): `kw` it draws, a village within `grid`
   *  m to feed it, or an outposts' grid meeting at least `share` of its demand. */
  kw: 2, grid: 500, share: 0.25,
};
export const lhRows = (l: Lighthouse) => LH.needs.map(([k, n]) => ({ k, n, given: l.given[k] ?? 0 }));
export const lhProgress = (l: Lighthouse) => (l.done ? 1 : LH.needs.reduce((a, [k, n]) => a + Math.min(n, l.given[k] ?? 0), 0) / LH.needs.reduce((a, [, n]) => a + n, 0));
/** Hand over what `have` says you carry, bit by bit; completes it (at game time `now`) when everything is in. */
export function handOverLh(l: Lighthouse, have: (k: ItemKey) => number, now: number): { taken: [ItemKey, number][]; built: boolean } {
  const taken: [ItemKey, number][] = [];
  if (l.done) return { taken, built: false };
  for (const [k, n] of LH.needs) { const m = Math.min(n - (l.given[k] ?? 0), have(k)); if (m > 0) { l.given[k] = (l.given[k] ?? 0) + m; taken.push([k, m]); } }
  const built = LH.needs.every(([k, n]) => (l.given[k] ?? 0) >= n);
  if (built) l.done = now;
  return { taken, built };
}
/** The beam's angle now (radians; game minutes run at a real second each). */
export const beamAngle = (l: Lighthouse, t: number) => (((t / Math.max(1, l.p)) % 1) * Math.PI * 2);
/**
 * How bright its flash looks from (vx, vz) now, 0..1: the two opposite beams sweep past you, a sharp flash each time;
 * dark when unlit or unfinished.
 */
export function flashAt(l: Lighthouse, t: number, vx: number, vz: number): number {
  if (!l.done || !l.on) return 0;
  const a = beamAngle(l, t), to = Math.atan2(vx - l.x, vz - l.z), c = Math.abs(Math.cos(a - to));
  return Math.pow(c, 60);
}
/** Why a lighthouse cannot stand at (x, z), or '' (villages and other lighthouses; the ground is checked at runtime). */
export function lhProblem(x: number, z: number, villages: { x: number; z: number }[], others: Lighthouse[]): string {
  if (villages.some((v) => Math.hypot(v.x - x, v.z - z) < LH.village)) return 'village';
  if (others.some((o) => Math.hypot(o.x - x, o.z - z) < LH.apart)) return 'close';
  return '';
}
