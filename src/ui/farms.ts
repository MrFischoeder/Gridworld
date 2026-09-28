// The elder's farms panel (gen/farms.ts): how many people the village feeds, its farms, and the materials for the
// next one, handed over from your backpack bit by bit.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { GRIDHOLM_ID } from '../gen/regions';
import { FARM, farmsOf, farmPlan, handOverFarm, soil, farmPeople } from '../gen/farms';
import { peopleAt, peopleTarget } from '../gen/people';
import { carried, takeFrom } from './market';
import { findPoi } from '../gen/regions';
import type { Good } from '../gen/market';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { earnTrust } from '../world/standing';
import { saveChar, calcStats, gainXp } from '../character';
import { showToast, logLine } from './hud';

export function farmsHTML(town: string, head: string, msg = ''): string {
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const have = (k: string) => carried(k as Good, poi);
  const st = c.towns[v.id], home = v.id === GRIDHOLM_ID, seed = v.vm.seed, n = farmsOf(st), plan = farmPlan(st);
  const now = Math.round(peopleAt(seed, home, st, c.time)), tg = peopleTarget(seed, home, st), sl = soil(seed);
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}More food, more people; more people, more hands at work. ${v.vm.name} has ${n ? n + (n > 1 ? ' farms' : ' farm') : 'no farms yet'} outside the walls.`;
  s += `<br><span style="opacity:.8">${now} people live here${Math.abs(tg - now) >= 1 ? `, growing to ${tg}` : ''}. The soil is ${sl > 1.1 ? 'rich' : sl < 0.9 ? 'poor' : 'fair'}: each farm feeds ${farmPeople(seed)} more.</span></div>`;
  if (!plan) return s + `<div class="say">We have cleared all the land we can guard (${FARM.max} farms).</div><button class="opt" data-o="back">Back</button>`;
  s += `<div class="shoprow"><div><b>Farm ${plan.n} of ${FARM.max}</b><br><span>${plan.rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ')}</span></div></div>`;
  const can = plan.rows.some((r) => r.given < r.n && have(r.k) > 0);
  return s + `<button class="opt" data-farm="give" ${can ? '' : 'disabled'}>Hand over what I carry (for the farm)</button><button class="opt" data-o="back">Back</button>`;
}
/** A click on the farm button: the message (and whether a farm was finished: the dialogue closes, the village is rebuilt), or null when it was not one. */
export function farmsClick(town: string, t: HTMLElement): { msg: string; built: boolean } | null {
  if (!t.closest('[data-farm]')) return null;
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return { msg: '', built: false };
  const st = (c.towns[v.id] ??= {});
  const { taken, built } = handOverFarm(st, v.vm.seed, v.id === GRIDHOLM_ID, c.time, (k) => carried(k as Good, poi));
  for (const [k, n] of taken) takeFrom(k as Good, n, poi); // backpack first, then the trunks of vehicles parked by the village
  const given = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'You carry nothing the farm still needs.';
  if (!built) { calcStats(); saveChar(); return { msg: given, built: false }; }
  c.gold += FARM.gold; gainXp(FARM.xp); earnTrust(v.id, 'farm'); calcStats(); saveChar();
  showToast(`${v.vm.name}: a new farm`);
  logLine(`The villagers clear the land and sow it. ${v.vm.name} will feed ${farmPeople(v.vm.seed)} more people in a few days. They pay you ${FARM.gold} gold.`);
  return { msg: given, built: true };
}
/** After the dialogue has closed: rebuild the village so the new field shows. */
export function showFarm(town: string) { const v = loadedVillage(town); if (v) reloadStruct(v.id); }
