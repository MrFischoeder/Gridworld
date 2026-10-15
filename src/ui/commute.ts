// (0.220, PLAN_PRAD_I_LUDZIE.md stage Z6) The commuters' row in the outpost, port and crew camp windows: ask a settlement
// within walking reach for its free people to work the outpost's post, or stop asking. The ask is the village's, so it is
// written under the village's lock (`withTownStock`).
import { G } from '../game';
import { COMMUTE, commuteVillages, commutersAt, setCommute } from '../gen/commute';
import { workCap } from '../gen/outpostlife';
import { assign } from '../gen/workforce';
import { workersAt } from '../gen/people';
import { villageSeed, GRIDHOLM_ID, allVillages } from '../gen/regions';
import type { OutpostState } from '../gen/outposts';
import { saveChar } from '../character';
import { withTownStock } from './stock';
import { logLine } from './hud';
import { tl, TL } from '../i18n';

const freeOf = (vid: number) => {
  const c = G.char, v = allVillages(c.world).find((q) => q.id === vid), s = c.towns[vid];
  return v ? assign(s, workersAt(villageSeed(c.world, v), v.id === GRIDHOLM_ID, s, c.time)).free : 0;
};
export function commuteHTML(id: string, o: OutpostState): string {
  const c = G.char, cap = workCap(o);
  if (!cap) return '';
  const r = commutersAt(c.world, c.towns, id, c.time);
  if (r.v !== null) {
    const name = allVillages(c.world).find((q) => q.id === r.v)?.name ?? '?';
    return TL`<div class="say"><b>Commuters</b> from ${name}: ${r.got} of ${r.want} walk out to work here${r.got < r.want ? TL` <span style="color:#ff6a4a">(the village has no more free hands: ${freeOf(r.v)} free)</span>` : ''}. They work the post first and eat at home; the settlers here do the rest and the fields.</div>` +
      TL`<button class="opt" data-op="commute:off">Stop asking ${name} for people</button>`;
  }
  const vs = commuteVillages(c.world, c.towns, o);
  if (!vs.length) return TL`<div class="say" style="opacity:.7"><b>Commuters</b>: no settlement within ${COMMUTE.reach / 1000} km to walk from. The people who work here must live here.</div>`;
  return TL`<div class="say"><b>Commuters</b>: a settlement within ${COMMUTE.reach / 1000} km can send its free people to work here each day, without bunkhouses of their own.</div>` +
    vs.slice(0, 2).map(({ v, d }) => TL`<button class="opt" data-op="commute:${v.id}">Ask ${v.name} (${(d / 1000).toFixed(1)} km, ${freeOf(v.id)} free) for ${cap} people</button>`).join('');
}
/** A commuters' click ('commute:<vid>' or 'commute:off'); `done` redraws the window with the message. */
export function commuteClick(id: string, x: string, done: (msg: string) => void) {
  const c = G.char, o = c.outposts[id];
  if (!o) return;
  const r = commutersAt(c.world, c.towns, id, c.time), vid = x === 'off' ? r.v : +x;
  if (vid === null || !Number.isFinite(vid) || (x !== 'off' && r.v !== null)) return;
  if (x !== 'off' && !commuteVillages(c.world, c.towns, o).some((q) => q.v.id === vid)) { done(tl('Too far to walk.')); return; }
  const name = allVillages(c.world).find((q) => q.id === vid)?.name ?? '?';
  void withTownStock(vid, () => { setCommute((c.towns[vid] ??= {}), id, x === 'off' ? null : o); }).then((ok) => {
    if (!ok) return;
    saveChar();
    const msg = x === 'off' ? TL`${name} keeps its people at home now.` : TL`${name} will send its free people to ${o.name} each day.`;
    logLine(msg); done(msg);
  });
}
