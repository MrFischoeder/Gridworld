// What the panels say about a build under way (gen/construction.ts): how far along it is and when it stands.
import { G } from '../game';
import { jobOf, jobShare, jobLeft, hoursOf, type JobKind } from '../gen/construction';
import type { TownState } from '../gen/town';

/** The line for the moment the builders start: how long they take. */
export function buildersLine(s: TownState | undefined, k: JobKind, a?: string): string {
  const j = jobOf(s, k, a);
  return j ? `it stands in ${jobLeft(j, G.char.time)} of game time (watch the builders on the site).` : `it takes ${hoursOf(k, a)} game hours.`;
}
/** A row for a panel while k is being built ('' when it is not). */
export function jobHTML(s: TownState | undefined, k: JobKind, a?: string, what = 'it'): string {
  const j = jobOf(s, k, a);
  if (!j) return '';
  const p = Math.floor(jobShare(j, G.char.time) * 100);
  return `<div class="shoprow"><div><b style="color:var(--gold)">Under construction: ${what}</b><br><span>The builders are at work: ${p}% done, ready in ${jobLeft(j, G.char.time)}.</span></div></div>`;
}
export const building = (s: TownState | undefined, k: JobKind, a?: string) => !!jobOf(s, k, a);
