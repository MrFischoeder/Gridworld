// (0.218, PLAN_PRAD_I_LUDZIE.md stage Z4) Crews at the old plants: in a new world (a towns world, gen/worldrules.ts)
// every restored installation that makes something needs a crew to run its batches: 6 to 10 people by plant. The old
// plants stand far from any village, so the crew lives at the plant in a crew camp built like an outpost's people
// (gen/outpostlife.ts): bunkhouses for beds, fields for food, and settlers who come on their own while there are beds
// and food to spare. The camp is an entry of the shared `outposts` under 'camp:<plant kind>' with `k` 'camp': its
// people work the fields first, then the plant (`crews`, `cw`). A batch starts only while the whole crew is there
// (gen/installs.ts `crewAt`, the rule set by `crewRuleFor`). The radar station and the Ancient Power Complex need none
// yet. Old worlds keep their plants without crews.
//
// Pure: the camp's spots from the plant's site and a dry test, worked out once when it is set up.
import { townsWorld } from './worldrules';
import { crews, lifeNow, commuters } from './outpostlife';
import type { OutpostState, PortSpots } from './outposts';
import type { InstallKind, InstallSite } from './installs';
import { tl } from '../i18n';

/** The crew each plant needs (absent: none). */
export const CREW: Partial<Record<InstallKind, number>> = { uranium: 8, chips: 8, propellant: 6, battery: 8, optical: 6, alloy: 10, precision: 8, robotics: 10, aerospace: 10 };
export const campId = (k: InstallKind) => 'camp:' + k;
/** Does this plant need a crew in this world? */
export const needsCrew = (world: number, k: InstallKind) => townsWorld(world) && !!CREW[k];

/** Where the camp's pieces stand round the plant (world x, z): its board by the plant's edge, three bunkhouses just
 *  outside it and three fields further out, each the first dry candidate clear of the others round the circle. */
export function campSpots(site: InstallSite, dry: (x: number, z: number) => boolean): PortSpots {
  const taken: [number, number, number][] = [];
  const at = (a: number, d: number): [number, number] => [site.x + Math.sin(site.yaw + a) * d, site.z + Math.cos(site.yaw + a) * d];
  const pick = (d: number, r: number): [number, number] => {
    for (let i = 0; i < 24; i++) {
      const a = Math.PI + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * (Math.PI / 12), [x, z] = at(a, d); // from behind the plant round both ways
      if (taken.some(([tx, tz, tr]) => Math.hypot(tx - x, tz - z) < tr + r + 2)) continue;
      if ([[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]].every(([u, v]) => dry(x + u, z + v))) { taken.push([x, z, r]); return [x, z]; }
    }
    const [x, z] = at(Math.PI, d); taken.push([x, z, r]); return [x, z];
  };
  const board = pick(site.r + 6, 1);
  const bunks = [0, 1, 2].map(() => pick(site.r + 16, 5)), fields = [0, 1, 2].map(() => pick(site.r + 36, 8));
  const r = (q: [number, number]): [number, number] => [Math.round(q[0] * 10) / 10, Math.round(q[1] * 10) / 10];
  return { house: r(board), crane: r(board), power: r(board), bunks: bunks.map(r), fields: fields.map(r) };
}
/** A new crew camp at plant `site` (its middle is the plant's). */
export function newCamp(site: InstallSite, by: string, now: number, owner: string, ps: PortSpots): OutpostState {
  return { o: owner, by, t: now, k: 'camp', x: Math.round(site.x), z: Math.round(site.z), name: site.name + tl(' crew camp'), ik: site.k, cw: CREW[site.k] ?? 0, ps };
}
/** The camp's crew at the plant at game time t: how many work there of how many it needs. */
export function crewOf(world: number, outposts: Record<string, OutpostState>, k: InstallKind, t: number): { at: number; need: number } {
  const need = CREW[k] ?? 0, o = outposts[campId(k)];
  if (!o) return { at: 0, need };
  if (!o.life) return { at: crews(o, 0).dig, need }; // (0.220) commuters alone
  return { at: crews(o, lifeNow(world, o, t).n).dig, need };
}
/** The rule gen/installs.ts asks before a batch: the whole crew is there (or none is needed). */
export function crewRuleFor(world: number, outposts: () => Record<string, OutpostState>) {
  const memo = new Map<string, boolean>();
  return (k: InstallKind, t: number) => {
    if (!needsCrew(world, k)) return true;
    const o = outposts()[campId(k)], key = `${k}|${Math.floor(t / 120)}|${o?.life?.t ?? -1}|${o?.n?.bunks ?? 0}|${o?.n?.field ?? 0}|${Math.round((o?.life?.food ?? 0) * 10)}|${Math.floor((o?.life?.n ?? 0) * 4)}|${o ? commuters(o) : 0}`;
    let v = memo.get(key);
    if (v === undefined) { if (memo.size > 2000) memo.clear(); v = (() => { const c = crewOf(world, outposts(), k, t); return c.at >= c.need; })(); memo.set(key, v); }
    return v;
  };
}
