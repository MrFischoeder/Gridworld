// What a crate is worth to the sims (economy plan stage 8): the market's base price, a rare deposit's value, or for
// the old plants' goods what goes into a batch plus the cheapest fuel for it, per crate. Shared by tools/*.sim.ts.
import { INSTALLS, INSTALL_DRAW, HALL_SETS, installWorks, type InstallKind, type InstallWork } from '../src/gen/installs';
import { GOOD_INFO } from '../src/gen/market';
import { RARE_VALUE } from '../src/gen/deposits';

const SALVAGE: Record<string, number> = { pcore: 150, circuit: 60, log: 4, stone: 3, scrap: 8 };
const memo: Record<string, number> = {};
export function worth(k: string): number {
  if (k in GOOD_INFO) return GOOD_INFO[k as keyof typeof GOOD_INFO].base;
  if (k in RARE_VALUE) return RARE_VALUE[k as keyof typeof RARE_VALUE];
  if (k in SALVAGE) return SALVAGE[k];
  if (memo[k] !== undefined) return memo[k];
  memo[k] = Infinity; // (while it is worked out: a plant cannot run on what it makes)
  const p = plantOf(k);
  return (memo[k] = p ? crate(p.k, p.w).total : 0);
}
/** The old plant (and its recipe) that makes k, if any. */
export function plantOf(k: string): { k: InstallKind; w: InstallWork } | null {
  for (const s of INSTALLS) for (const w of installWorks(s.k)) if (w.out === k) return { k: s.k, w };
  return null;
}
/** The cheapest way the hall powers a batch of `draw` kW for `batch` min: gold of fuel, and which sets. */
export function fuelCost(draw: number, batch: number): { gold: number; how: string } {
  const sets = HALL_SETS.filter((h) => h.fuel !== 'nfuel').map((h) => ({ h, g: batch / h.burn * worth(h.fuel) }));
  let best = { gold: Infinity, how: '' };
  for (const a of sets) if (a.h.kw >= draw && a.g < best.gold) best = { gold: a.g, how: a.h.name };
  for (const a of sets) for (const b of sets) if (a !== b && a.h.kw + b.h.kw >= draw && a.g + b.g < best.gold) best = { gold: a.g + b.g, how: a.h.name + ' + ' + b.h.name };
  return best;
}
/** A crate of w's output at plant k: inputs, fuel, game hours of work (a game hour is a real minute). */
export function crate(k: InstallKind, w: InstallWork) {
  const n = w.n ?? 1, inp = w.inp.reduce((a, [i, m]) => a + m * worth(i as string), 0) / n, f = fuelCost(INSTALL_DRAW[k] ?? 0, w.batch);
  return { inp, fuel: f.gold / n, how: f.how, hours: w.batch / 60 / n, total: inp + f.gold / n };
}
