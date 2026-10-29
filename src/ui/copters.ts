// (0.259, PLAN_LOTNICTWA.md stage F5) The rotorcraft yard in a warehouse's window (a village's warehouse terminal,
// ui/hall.ts; a port's or a wild warehouse's board, ui/port.ts): with the plans 'rotorcraft' and the warehouse
// working, start a rotorcraft, hand its materials over from the warehouse's stock, and see the ones parked here.
// Built, it stands on the warehouse's apron (gen/copters.ts `copterSpot`) and goes into the shared list. The windows
// run the clicks under the warehouse's lock; `attr` makes their own button attribute.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { gainXp } from '../character';
import { SEA } from '../gen/seas';
import { hubs, hubWorks, type Hub } from '../gen/warehouses';
import { COPTER, copRows, handOverCop, copterSpot, newCopter, copBuildOf, copRangeKm } from '../gen/copters';
import { OW } from '../world/overworld';
import { redrawCopters } from '../world/copters';
import { store } from './airships';
import { hallNote } from './stock';
import { itemName } from './icons';
import { tl, TL } from '../i18n';
import { airRoadWhy } from '../world/roadnet';

const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
const btn = (attr: (v: string) => string, v: string, t: string) => `<button class="opt" ${attr(v)}>${t}</button>`;
const known = () => G.char.tech[COPTER.tech] !== undefined;
/** The rotorcraft section of warehouse `id` (nothing while it stands idle). */
export function copterYardHTML(id: string, attr: (v: string) => string): string {
  const c = G.char, me = hubOf(id);
  if (!me) return '';
  const here = (c.copters ?? []).filter((q) => q.hub === id && Math.hypot(q.x - me.x, q.z - me.z) < 200);
  let s = TL`<div class="say"><b>Rotorcraft</b>: a small, quick machine with two seats and a hold of ${COPTER.hold} slots that sets down on any level, dry ground. Built here from the warehouse's stock, flown by you (E beside it), diesel only.`;
  for (const q of here) s += TL`<br>Parked by the warehouse: a rotorcraft built by ${q.by}, ${Math.round(q.fuel)} of ${COPTER.fuel.tank} L (~${copRangeKm(q).toFixed(0)} km).`;
  const b = copBuildOf(id, c.towns, c.outposts);
  if (!known()) return s + tl('<br><span style="opacity:.7">The plans for it are lost (Rotorcraft, on an old data carrier).</span></div>');
  if (!hubWorks(c.world, me, c.towns, c.outposts, c.time)) return s + tl('<br><span style="opacity:.7">The warehouse stands idle (no storekeepers or no power): nothing is built here.</span></div>');
  if ((c.copters ?? []).length >= COPTER.max) return s + TL`<br><span style="opacity:.7">This world has ${COPTER.max} rotorcrafts already.</span></div>`;
  const road = copBuildOf(id, c.towns, c.outposts) ? '' : airRoadWhy(id); // (0.283) flying after the roads
  if (road) return s + `<br><span style="opacity:.7">${road}</span></div>`;
  const has = store(id).has, rows = copRows(b);
  s += TL`<br>${b ? tl('Going up on the apron') : tl('Needs')}:<br>` + rows.map((r) => `${itemName(r.k)} ${r.given}/${r.n}${hallNote(has(r.k), r.given, r.n)}`).join('<br>') + '</div>';
  return s + btn(attr, b ? 'give' : 'start', b ? tl('Hand over from the warehouse\'s stock') : tl('Start a rotorcraft')) + (b && !Object.values(b.given).some((n) => n) ? btn(attr, 'drop', tl('Take it down')) : '');
}
/** A click in the yard (under the warehouse's lock). Returns the message. */
export function copterYardClick(id: string, what: string): string {
  const c = G.char, me = hubOf(id), st = id.startsWith('v:') ? (c.towns[id.slice(2)] ??= {}) : c.outposts[id];
  if (!me || !st || !known() || !hubWorks(c.world, me, c.towns, c.outposts, c.time)) return '';
  if ((c.copters ?? []).length >= COPTER.max) return tl('No more rotorcrafts can be built on this world.');
  if (what === 'start' && !st.cbuild && airRoadWhy(id)) return airRoadWhy(id);
  if (what === 'start' && !st.cbuild) { st.cbuild = { given: {} }; return tl('You lay out the frame on the apron.'); }
  const b = st.cbuild;
  if (!b) return '';
  if (what === 'drop' && !Object.values(b.given).some((n) => n)) { delete st.cbuild; return tl('You take the frame down.'); }
  if (what !== 'give') return '';
  const sto = store(id), r = handOverCop(b, sto.has);
  sto.take(r.taken);
  if (!r.built) return r.taken.length ? TL`Handed over ${r.taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ')}.` : tl('The warehouse has nothing more for it.');
  const sp = copterSpot(me, (c.copters ?? []).filter((q) => q.hub === id).length), T = OW.terrain, g = T ? Math.max(T.heightAt(sp.x, sp.z), SEA.level) : SEA.level;
  (c.copters ??= []).push(newCopter(id, { x: sp.x, y: g, z: sp.z, yaw: sp.yaw }, c.name || tl('You'), c.pid, c.time));
  delete st.cbuild; gainXp(COPTER.xp); redrawCopters();
  return tl('The rotorcraft stands finished on the apron. Climb in to fly it.');
}
