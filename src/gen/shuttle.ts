// The shuttle in the old hangar near Gridholm, which the locals call the Chariot of the Ancients: a spacecraft from
// before the machines woke, which the village elders mean to fly again. Its repair is the long goal: stage after
// stage, each needing crates of processed goods that no field, mine or scavenged robot gives you (the robots are few
// once the ruins and wrecks are cleared): they come out of the works (gen/plants.ts), and the works need power
// (gen/energy.ts); the avionics also want microchips from the Old Chip Foundry. Nothing is sold at the hangar: what you bring goes straight onto the Chariot (ui/shuttle.ts
// unloads it as you arrive), for experience and the goal itself. Stages can be worked in any order; the state is what
// was handed over (`char.shuttle`).
// The economy plan's stage 7 (0.98): the Chariot is the last buyer of the whole chain: every stage now wants what the
// old plants make (gen/installs.ts), and a sixth stage, the power system, was added before the propellant. A stage
// finished under the old needs stays finished (`fixShuttle`, `ShuttleState.done`); what was handed over stays.
import type { Good } from './market';
/** What the old plants make for the Chariot (gen/installs.ts). */
export const ANCIENT_GOODS = ['microchip', 'sensor', 'ancalloy', 'ceramics', 'precision', 'powercell', 'composite', 'aerocomp', 'rocketeng'] as const;
export type AncientGood = typeof ANCIENT_GOODS[number];
/** What the Chariot takes: processed goods from the works, and the old plants' goods. */
export type ChariotGood = Good | AncientGood;

export type StageKey = 'hull' | 'engines' | 'avionics' | 'shield' | 'power' | 'life' | 'fuel';
export interface Stage { key: StageKey; name: string; blurb: string; needs: [ChariotGood, number][] }
export const STAGES: Stage[] = [
  { key: 'hull', name: 'Hull Plating', blurb: 'new plates over the torn skin of the fuselage and wings: steel for the frames, aluminium and ancient alloy for the skin, airframe sections and composite from the Old Aerospace Works', needs: [['steel', 16], ['aluminium', 10], ['ancalloy', 6], ['aerocomp', 6], ['composite', 4]] },
  { key: 'engines', name: 'Main Engines', blurb: 'the three engines rebuilt: rocket engines from the Old Aerospace Works\' test stand, turbopumps and nozzles of ancient alloy, bearings and valves only the precision works can make', needs: [['ancalloy', 6], ['precision', 8], ['cable', 10], ['rocketeng', 3]] },
  { key: 'avionics', name: 'Avionics', blurb: 'flight computers, sensors and the cockpit panels: avionics racks, chips no works can etch, sensor heads no one can grow', needs: [['boards', 8], ['microchip', 6], ['sensor', 4], ['cable', 12], ['avionics', 3]] },
  { key: 'shield', name: 'Heat Shield', blurb: 'ceramic tiles under the belly and the wing edges, on a frame of ancient alloy', needs: [['ceramics', 16], ['ancalloy', 4]] },
  { key: 'power', name: 'Power System', blurb: 'racks of power cells in the belly, the chips that run them and the modules that steer their current: the Chariot\'s heart before the engines light', needs: [['powercell', 8], ['microchip', 4], ['cable', 8], ['pcm', 2]] },
  { key: 'life', name: 'Life Support', blurb: 'air scrubbers and water recyclers for the crew cabin, sealed in composite, run by a flight computer: without them nobody survives the climb', needs: [['lifesup', 4], ['composite', 2], ['computer', 1]] },
  { key: 'fuel', name: 'Propellant', blurb: 'the tanks filled for the flight', needs: [['propellant', 30]] },
];
/** What each stage needed before 0.98 (a stage finished under these stays finished). */
export const LEGACY_NEEDS: Partial<Record<StageKey, [ChariotGood, number][]>> = {
  hull: [['alloy', 12], ['steel', 20]], engines: [['parts', 16], ['alloy', 8], ['cable', 10]], avionics: [['boards', 8], ['microchip', 6], ['cable', 12], ['glass', 6]],
  shield: [['glass', 24], ['alloy', 4], ['plastic', 6]], fuel: [['propellant', 30]],
};
/** Experience per crate that goes onto the Chariot; how near the hangar (m from its rect) the crew unload for you. */
export const SHUTTLE = { xp: 8, reach: 25 };
/** What the locals call it. */
export const CHARIOT = 'Chariot of the Ancients';
/** `done`: stages finished for good (under the old needs, or the new); `v`: 2 once a save has been through `fixShuttle`. */
export interface ShuttleState { given: Partial<Record<StageKey, Partial<Record<ChariotGood, number>>>>; done?: StageKey[]; v?: number }
/**
 * Saves from before 0.98: the stages complete under the old needs are marked done, so the new needs never touch them;
 * of the unfinished ones, crates the new needs no longer take (or more than they take) come back (returned, for the
 * caller to put in Gridholm's village hall).
 */
export function fixShuttle(s: ShuttleState): Partial<Record<ChariotGood, number>> {
  s.given ??= {};
  const back: Partial<Record<ChariotGood, number>> = {};
  if ((s.v ?? 1) < 2) {
    for (const [k, needs] of Object.entries(LEGACY_NEEDS) as [StageKey, [ChariotGood, number][]][])
      if (needs.every(([g, n]) => (s.given[k]?.[g] ?? 0) >= n) && !(s.done ??= []).includes(k)) s.done.push(k);
    for (const st of STAGES) {
      const g0 = s.given[st.key];
      if (!g0 || s.done?.includes(st.key)) continue;
      for (const [g, n] of Object.entries(g0) as [ChariotGood, number][]) {
        const keep = Math.min(n, st.needs.find(([x]) => x === g)?.[1] ?? 0);
        if (n > keep) back[g] = (back[g] ?? 0) + n - keep;
        if (keep) g0[g] = keep; else delete g0[g];
      }
    }
    s.v = 2;
  }
  // (0.147) the life support stage came last: a Chariot finished under the six stages before it stays finished
  if ((s.v ?? 1) < 3) {
    const six: StageKey[] = ['hull', 'engines', 'avionics', 'shield', 'power', 'fuel'];
    if (six.every((k) => s.done?.includes(k)) && !s.done!.includes('life')) s.done!.push('life');
    s.v = 3;
  }
  return back;
}
/** Each stage's rows (needed, given) and whether it is complete. */
export function stageRows(s: ShuttleState | undefined, st: Stage) {
  const sealed = !!s?.done?.includes(st.key);
  const rows = st.needs.map(([g, n]) => ({ g, n, given: sealed ? n : Math.min(n, s?.given[st.key]?.[g] ?? 0) }));
  return { rows, done: rows.every((r) => r.given >= r.n) };
}
export const stageDone = (s: ShuttleState | undefined, k: StageKey) => stageRows(s, STAGES.find((x) => x.key === k)!).done;
export const stagesDone = (s: ShuttleState | undefined) => STAGES.filter((st) => stageRows(s, st).done).length;
/** Hand over up to n crates of g to stage k; returns how many it took. */
export function giveToStage(s: ShuttleState, k: StageKey, g: ChariotGood, n: number): number {
  const st = STAGES.find((x) => x.key === k)!, need = st.needs.find(([x]) => x === g);
  if (!need || s.done?.includes(k)) return 0;
  const cur = s.given[k]?.[g] ?? 0, take = Math.max(0, Math.min(n, need[1] - cur));
  if (take) (s.given[k] ??= {})[g] = cur + take;
  if (take && stageRows(s, st).done) (s.done ??= []).includes(k) || s.done.push(k);
  return take;
}
