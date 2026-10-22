// (0.253, PLAN_MAGAZYNOW.md stage M5) Goods passing through a warehouse, in its window (a village's warehouse
// terminal, ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts): for every line that brings cargo here, keep
// it here or send it on by this warehouse's own convoy line or, at a port, its cargo line (gen/transit.ts). The windows
// run the clicks under this warehouse's lock; `attr` makes their own button attribute.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { hubs } from '../gen/warehouses';
import { allHubLines, hubLineOf, hlKey } from '../gen/hublines';
import { rcvKey } from '../gen/shiplines';
import { setForward, transitCount, type Transit, type Way } from '../gen/transit';
import { tl, TL } from '../i18n';

const stOf = (id: string, make = false): Transit | undefined => (id.startsWith('v:') ? (make ? (G.char.towns[id.slice(2)] ??= {}) : G.char.towns[id.slice(2)]) : G.char.outposts[id]);
interface In { key: string; from: string; ship: boolean }
/** The lines that bring cargo to warehouse `id`. */
function incoming(id: string): In[] {
  const c = G.char, names = new Map(hubs(c.world, c.towns, c.outposts).map((h) => [h.id, h.name])), out: In[] = [];
  for (const [home, l] of allHubLines(c.towns, c.outposts)) if (l.to === id) out.push({ key: hlKey(home, l), from: names.get(home) ?? home, ship: false });
  for (const [from, o] of Object.entries(c.outposts)) if (o?.line?.to === id) out.push({ key: rcvKey(from, o.line), from: o.name, ship: true });
  return out;
}
/** The ways on from warehouse `id`: its convoy line and its cargo line, with where they go. */
function waysOut(id: string): [Way, string][] {
  const c = G.char, out: [Way, string][] = [], hl = hubLineOf(id, c.towns, c.outposts), sl = id.startsWith('v:') ? undefined : c.outposts[id]?.line;
  if (hl) out.push(['hl', hl.toName]);
  if (sl) out.push(['sl', sl.toName]);
  return out;
}
const pill = (attr: (v: string) => string, v: string, t: string, on: boolean) => `<button class="buy${on ? '' : ' off'}" style="display:inline-block;width:auto;margin:2px" ${attr(v)}>${t}</button>`;
/** The section of warehouse `id` (empty when no line brings it cargo). */
export function transitHTML(id: string, attr: (v: string) => string): string {
  const ins = incoming(id);
  if (!ins.length) return '';
  const st = stOf(id), outs = waysOut(id);
  let s = TL`<div class="say"><b>Passing through</b>: what the lines bring here can stay here or go on by this warehouse's own line. Goods sent on leave first, whatever the line is set to carry.`;
  if (!outs.length) s += tl(' This warehouse has no line of its own yet: open a convoy line (or at a port a cargo line) to send goods on.');
  s += '</div>';
  for (const q of ins) {
    const now = st?.fwd?.[q.key];
    s += `<div class="say">` + (q.ship ? TL`From ${q.from} by ship:` : TL`From ${q.from} by convoy:`) + ' ' + pill(attr, 'no~' + q.key, tl('Keep here'), !now);
    for (const [w, to] of outs) s += pill(attr, w + '~' + q.key, w === 'hl' ? TL`On by convoy to ${to}` : TL`On by ship to ${to}`, now === w);
    s += `</div>`;
  }
  for (const [w, to] of outs) {
    const n = transitCount(st, w);
    if (!n) continue;
    const list = Object.entries(st?.tr?.[w] ?? {}).filter(([, m]) => m).map(([g, m]) => `${m} × ${ITEMS[g as ItemKey].name}`).join(', ');
    s += `<div class="say" style="opacity:.85">` + (w === 'hl' ? TL`Waiting to go on by convoy to ${to}: ${list}.` : TL`Waiting to go on by ship to ${to}: ${list}.`) + `</div>`;
  }
  return s;
}
/** A click in the section (under warehouse `id`'s lock). */
export function transitClick(id: string, what: string): string {
  const i = what.indexOf('~'), w = what.slice(0, i), key = what.slice(i + 1), st = stOf(id, true);
  if (i < 0 || !st || !incoming(id).some((q) => q.key === key)) return '';
  if (w === 'no') { setForward(st, key, undefined); return tl('Its cargo stays here.'); }
  const way = waysOut(id).find(([x]) => x === w);
  if (!way) return '';
  setForward(st, key, way[0]);
  return way[0] === 'hl' ? TL`Its cargo goes on by convoy to ${way[1]}.` : TL`Its cargo goes on by ship to ${way[1]}.`;
}
