// The shuttle in the old hangar near Gridholm: a spacecraft from before the machines woke, which the village elders
// mean to fly again. Its repair is the long goal: stage after stage, each needing crates of processed goods that no
// field, mine or scavenged robot gives you (the robots are few once the ruins and wrecks are cleared): they come out
// of the works (gen/plants.ts). The hangar pays for every crate you bring (above its base price), so feeding the
// project is also a living. Stages can be worked in any order; the state is what was handed over (`char.shuttle`).
import type { Good } from './market';
import { GOOD_INFO } from './market';

export type StageKey = 'hull' | 'engines' | 'avionics' | 'shield' | 'fuel';
export interface Stage { key: StageKey; name: string; blurb: string; needs: [Good, number][] }
export const STAGES: Stage[] = [
  { key: 'hull', name: 'Hull Plating', blurb: 'new plates over the torn skin of the fuselage and wings', needs: [['alloy', 12], ['steel', 20]] },
  { key: 'engines', name: 'Main Engines', blurb: 'the three engines rebuilt: turbopumps, valves, nozzles', needs: [['parts', 16], ['alloy', 8], ['cable', 10]] },
  { key: 'avionics', name: 'Avionics', blurb: 'flight computers, sensors and the cockpit panels', needs: [['boards', 14], ['cable', 12], ['glass', 6]] },
  { key: 'shield', name: 'Heat Shield', blurb: 'glass tiles under the belly and the wing edges', needs: [['glass', 24], ['alloy', 4], ['plastic', 6]] },
  { key: 'fuel', name: 'Propellant', blurb: 'the tanks filled for the flight', needs: [['propellant', 30]] },
];
/** What the hangar pays per crate you bring (times its base price), and the xp per crate. */
export const SHUTTLE = { pay: 1.25, xp: 6 };
export interface ShuttleState { given: Partial<Record<StageKey, Partial<Record<Good, number>>>> }
export const payPerCrate = (g: Good) => Math.round(GOOD_INFO[g].base * SHUTTLE.pay);
/** Each stage's rows (needed, given) and whether it is complete. */
export function stageRows(s: ShuttleState | undefined, st: Stage) {
  const rows = st.needs.map(([g, n]) => ({ g, n, given: Math.min(n, s?.given[st.key]?.[g] ?? 0) }));
  return { rows, done: rows.every((r) => r.given >= r.n) };
}
export const stageDone = (s: ShuttleState | undefined, k: StageKey) => stageRows(s, STAGES.find((x) => x.key === k)!).done;
export const stagesDone = (s: ShuttleState | undefined) => STAGES.filter((st) => stageRows(s, st).done).length;
/** Hand over up to n crates of g to stage k; returns how many it took. */
export function giveToStage(s: ShuttleState, k: StageKey, g: Good, n: number): number {
  const st = STAGES.find((x) => x.key === k)!, need = st.needs.find(([x]) => x === g);
  if (!need) return 0;
  const cur = s.given[k]?.[g] ?? 0, take = Math.max(0, Math.min(n, need[1] - cur));
  if (take) (s.given[k] ??= {})[g] = cur + take;
  return take;
}
