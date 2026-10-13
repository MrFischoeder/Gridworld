// (0.188, PLAN_PLACOWEK.md stage O7) Processing on site: an outpost that digs can build a works beside its extraction
// that turns its raw good into a worth-more one before the convoys haul it away: a field refinery at an oil seep (crude
// into fuel), a smelter at an ore body (ore into bars), a sawmill at a great grove (logs into planks), a stone saw at an
// outcrop (stone into cut stone). It works in batches from the crates on site while it is powered (its draw joins the
// grid's demand; without power it runs at the grid's unpowered pace, like the digging), up to the outpost's cap.
//
// Pure. Settled with the stock (gen/grid.ts settleAll and the window's actions), so like the villages' sawmill and
// furnace whoever looks first settles it, the same on every game.
import type { ItemKey } from '../data/items';
import { capOf, settle, type OutpostState } from './outposts';
import type { Lode, LodeKind } from './lodes';
import { tl } from '../i18n';

export interface ProcSpec {
  name: string; text: string; needs: [ItemKey, number][];
  /** What goes in (crates a batch) and what comes out, the batch's minutes and the draw (kW). */
  inp: ItemKey; n: number; out: ItemKey; m: number; batch: number; kw: number;
}
export const PROC: Partial<Record<LodeKind, ProcSpec>> = {
  oil: { name: tl('Field refinery'), text: tl('A still and a cracking column by the pump: crude in, canisters of fuel out.'), needs: [['steel', 4], ['pipes', 4], ['scrap', 12], ['planks', 10]], inp: 'crude', n: 1, out: 'fuel', m: 1, batch: 90, kw: 12 },
  iron: { name: tl('Smelter'), text: tl('An electric shaft furnace beside the shaft: two crates of ore make a crate of iron bars.'), needs: [['stone', 24], ['scrap', 16], ['wire', 8], ['parts', 2]], inp: 'ore', n: 2, out: 'iron', m: 1, batch: 60, kw: 20 },
  copper: { name: tl('Smelter'), text: tl('An electric furnace for the copper: four crates of ore make a crate of ingots.'), needs: [['stone', 24], ['scrap', 16], ['wire', 8], ['parts', 2]], inp: 'copper', n: 4, out: 'copperbar', m: 1, batch: 60, kw: 20 },
  lead: { name: tl('Smelter'), text: tl('A low furnace for the lead: four crates of ore make a crate of ingots.'), needs: [['stone', 24], ['scrap', 16], ['wire', 8], ['parts', 2]], inp: 'lead', n: 4, out: 'leadbar', m: 1, batch: 60, kw: 20 },
  grove: { name: tl('Sawmill'), text: tl('A saw shed by the felling: every log comes out as five planks.'), needs: [['planks', 20], ['stone', 8], ['scrap', 6], ['wire', 4]], inp: 'log', n: 1, out: 'planks', m: 5, batch: 20, kw: 8 },
  stone: { name: tl('Stone saw'), text: tl('A wire saw and a crusher: three crates of stone make two pallets of cut stone.'), needs: [['planks', 12], ['scrap', 10], ['wire', 6], ['parts', 1]], inp: 'stone', n: 3, out: 'cutstone', m: 2, batch: 60, kw: 6 },
};
export const procOf = (k: LodeKind): ProcSpec | null => PROC[k] ?? null;
/** What the works draws while it stands (kW). */
export const procKw = (o: OutpostState) => (o.done?.proc ? procOf(o.k)?.kw ?? 0 : 0);
/** Run the works up to `now` (after the stock is settled there): whole batches while the input lasts and the output
 *  has room, at the power factor `pw`; time without input does not bank. Returns the batches run. */
export function runProc(o: OutpostState, l: Lode, now: number, pw = 1): number {
  const p = procOf(o.k);
  if (!p || !o.done?.proc || !o.stock) return 0;
  settle(o, l, now, pw);
  const t0 = o.pt ?? now, cap = capOf(o), st = o.stock.n;
  const can = Math.floor(Math.max(0, now - t0) * pw / p.batch), room = Math.floor((cap - (st[p.out] ?? 0)) / p.m), have = Math.floor((st[p.inp] ?? 0) / p.n);
  const b = Math.max(0, Math.min(can, room, have));
  if (b) { st[p.inp] = (st[p.inp] ?? 0) - b * p.n; st[p.out] = (st[p.out] ?? 0) + b * p.m; }
  o.pt = b === can ? t0 + Math.round(b * p.batch / Math.max(pw, 0.01)) : now; // stopped short: idle time does not bank
  if (o.pt > now) o.pt = now;
  return b;
}
/** The goods a convoy loads, best first (the works' output, then what the outpost digs). */
export const cargoGoods = (o: OutpostState, raw: ItemKey[]): ItemKey[] => {
  const p = o.done?.proc ? procOf(o.k) : null;
  return p ? [p.out, ...raw] : raw;
};
