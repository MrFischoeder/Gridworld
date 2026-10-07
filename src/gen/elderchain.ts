// What the elder asks of you, one step at a time (0.166, the owner's wish: no wall of tasks at once). His building
// commissions open in a chain like a tutorial: the farms first; the wall and defences once a farm stands; the works
// once the wall has risen or a defence stands; the power plant's overhaul once a works or a power station runs;
// the village improvements once the plant has been overhauled. A commission already begun always stays on the list.
// Pure: read from the village's shared state, so every player sees the same chain.
import type { TownState } from './town';
import { farmsOf } from './farms';
import { jobOf } from './construction';

export type ElderTask = 'farms' | 'fortify' | 'works' | 'plantup' | 'improve';
export const ELDER_CHAIN: ElderTask[] = ['farms', 'fortify', 'works', 'plantup', 'improve'];
const some = (m: object | undefined): boolean => !!m && Object.values(m).some((v) => (typeof v === 'number' ? v > 0 : !!v && typeof v === 'object' && some(v as object)));
/** Something of it has been handed over, started or built. */
export function begun(s: TownState | undefined, k: ElderTask): boolean {
  if (!s) return false;
  switch (k) {
    case 'farms': return farmsOf(s) > 0 || some(s.fgiven) || !!s.fwait || !!jobOf(s, 'farm');
    case 'fortify': return (s.wall ?? 0) > 0 || some(s.given) || some(s.wgiven) || some(s.works) || !!jobOf(s, 'wall');
    case 'works': return !!s.plants?.length || !!s.stations?.length || !!s.pbuild;
    case 'plantup': return (s.pup ?? 0) > 0 || some(s.pupgiven);
    case 'improve': return some(s.imp) || some(s.igiven);
  }
}
/** Done enough to open the next step. */
export function achieved(s: TownState | undefined, k: ElderTask): boolean {
  if (!s) return false;
  switch (k) {
    case 'farms': return farmsOf(s) > 0;
    case 'fortify': return (s.wall ?? 0) > 0 || some(s.works);
    case 'works': return !!s.plants?.length || !!s.stations?.length;
    case 'plantup': return (s.pup ?? 0) > 0;
    case 'improve': return some(s.imp);
  }
}
/** The commissions the elder offers now: every one begun, and the next one in the chain. */
export function elderTasks(s: TownState | undefined): Set<ElderTask> {
  const out = new Set<ElderTask>(); let open = true;
  for (const k of ELDER_CHAIN) { if (begun(s, k) || open) out.add(k); if (!achieved(s, k)) open = false; }
  return out;
}
