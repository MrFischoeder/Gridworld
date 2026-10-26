// (0.253, PLAN_MAGAZYNOW.md stage M5) Goods passing through a warehouse. A warehouse that takes in cargo from a line
// (a convoy line, gen/hublines.ts, a port's cargo line, gen/shiplines.ts, or an air line, gen/airlines.ts) may send that
// line's cargo on: by its own convoy line ('hl'), its sky line ('sk', 0.258, gen/skylines.ts), one of its air lines ('al:<line id>', 0.255; 'al' in 0.254 saves) or,
// at a port, its cargo line ('sl'). `fwd` says, per incoming line (its counter key at this warehouse), where its cargo
// goes on; what comes in is counted into `tr` (the goods waiting to go on, by the way out), and the outgoing line loads
// those first, whatever it is set to carry, then fills up as usual. The goods sit in the hold meanwhile: what someone
// takes out by hand is simply no longer there to go on (`takeTransit` trims to the hold).
//
// Written only under this warehouse's own lock (taking in and sending out both happen there), so the shared state
// never sees two writers. Pure.
import type { ItemKey } from '../data/items';

export type Way = 'hl' | 'sl' | 'sk' | 'al' | `al:${number}`;
export interface Transit {
  /** Incoming line (counter key here) → the way its cargo goes on. */
  fwd?: Record<string, Way>;
  /** Goods waiting to go on, by the way out. */
  tr?: Partial<Record<Way, Partial<Record<ItemKey, number>>>>;
}
/** Cargo of the incoming line `key` came in: count what goes on. */
export function noteArrival(st: Transit, key: string, g: ItemKey, n: number) {
  const w = st.fwd?.[key];
  if (!w || n <= 0) return;
  const t = ((st.tr ??= {})[w] ??= {});
  t[g] = (t[g] ?? 0) + n;
}
/** Set (or with no way, clear) where the cargo of incoming line `key` goes on. */
export function setForward(st: Transit, key: string, w: Way | undefined) {
  if (w) (st.fwd ??= {})[key] = w;
  else if (st.fwd) { delete st.fwd[key]; if (!Object.keys(st.fwd).length) delete st.fwd; }
}
/** How many crates wait to go on by way `w`. */
export const transitCount = (st: Transit | undefined, w: Way) => Object.values(st?.tr?.[w] ?? {}).reduce((a: number, n) => a + (n ?? 0), 0);
/** Load the goods waiting to go on by way `w` (up to `cap`; `takeOne` takes from the hold and says how many it got). */
export function takeTransit(st: Transit, w: Way, hold: Partial<Record<ItemKey, number>> | undefined, cap: number, takeOne: (k: ItemKey, n: number) => number): [ItemKey, number][] {
  const t = st.tr?.[w], out: [ItemKey, number][] = [];
  if (!t) return out;
  for (const g of Object.keys(t) as ItemKey[]) {
    const want = Math.min(t[g] ?? 0, hold?.[g] ?? 0);
    const m = cap > 0 && want > 0 ? takeOne(g, Math.min(cap, want)) : 0;
    if (m) { out.push([g, m]); cap -= m; }
    const left = Math.min((t[g] ?? 0) - m, hold?.[g] ?? 0);
    if (left > 0) t[g] = left; else delete t[g];
  }
  if (!Object.keys(t).length) { delete st.tr![w]; if (!Object.keys(st.tr!).length) delete st.tr; }
  return out;
}
/** (0.255) Rename a way (a 0.254 air line's 'al' becomes its own 'al:<id>'). */
export function renameWay(st: Transit, from: Way, to: Way) {
  if (st.tr?.[from]) { st.tr[to] = st.tr[from]; delete st.tr[from]; }
  if (st.fwd) for (const k of Object.keys(st.fwd)) if (st.fwd[k] === from) st.fwd[k] = to;
}
/** Forget the waiting goods of a way out that no longer exists (its line given up). */
export function dropWay(st: Transit, w: Way) {
  if (st.tr?.[w]) { delete st.tr[w]; if (!Object.keys(st.tr).length) delete st.tr; }
  if (st.fwd) { for (const k of Object.keys(st.fwd)) if (st.fwd[k] === w) delete st.fwd[k]; if (!Object.keys(st.fwd).length) delete st.fwd; }
}
