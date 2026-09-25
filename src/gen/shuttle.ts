// The shuttle in the old hangar near Gridholm, which the locals call the Chariot of the Ancients: a spacecraft from
// before the machines woke, which the village elders mean to fly again. Its repair is the long goal: stage after
// stage, each needing crates of processed goods that no field, mine or scavenged robot gives you (the robots are few
// once the ruins and wrecks are cleared): they come out of the works (gen/plants.ts), and the works need power
// (gen/energy.ts). Nothing is sold at the hangar: what you bring goes straight onto the Chariot (ui/shuttle.ts
// unloads it as you arrive), for experience and the goal itself. Stages can be worked in any order; the state is what
// was handed over (`char.shuttle`).
import type { Good } from './market';

export type StageKey = 'hull' | 'engines' | 'avionics' | 'shield' | 'fuel';
export interface Stage { key: StageKey; name: string; blurb: string; needs: [Good, number][] }
export const STAGES: Stage[] = [
  { key: 'hull', name: 'Hull Plating', blurb: 'new plates over the torn skin of the fuselage and wings', needs: [['alloy', 12], ['steel', 20]] },
  { key: 'engines', name: 'Main Engines', blurb: 'the three engines rebuilt: turbopumps, valves, nozzles', needs: [['parts', 16], ['alloy', 8], ['cable', 10]] },
  { key: 'avionics', name: 'Avionics', blurb: 'flight computers, sensors and the cockpit panels', needs: [['boards', 14], ['cable', 12], ['glass', 6]] },
  { key: 'shield', name: 'Heat Shield', blurb: 'glass tiles under the belly and the wing edges', needs: [['glass', 24], ['alloy', 4], ['plastic', 6]] },
  { key: 'fuel', name: 'Propellant', blurb: 'the tanks filled for the flight', needs: [['propellant', 30]] },
];
/** Experience per crate that goes onto the Chariot; how near the hangar (m from its rect) the crew unload for you. */
export const SHUTTLE = { xp: 8, reach: 25 };
/** What the locals call it. */
export const CHARIOT = 'Chariot of the Ancients';
export interface ShuttleState { given: Partial<Record<StageKey, Partial<Record<Good, number>>>> }
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
