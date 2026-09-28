// The elder's farms panel (gen/farms.ts): how many people the village feeds, its farms, and the materials for the
// next one, handed over from your backpack bit by bit.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { GRIDHOLM_ID } from '../gen/regions';
import { FARM, UPGRADE, UNPOWERED, farmsOf, upgradedOf, farmPlan, upgradePlan, handOverFarm, handOverUpgrade, farmsKw, soil, farmPeople } from '../gen/farms';
import { farmPower } from '../gen/energy';
import { syncFarmVillage } from '../world/farms';
import { peopleAt, targetNow } from '../gen/people';
import { carried, takeFrom } from './market';
import { findPoi } from '../gen/regions';
import type { Good } from '../gen/market';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { earnTrust } from '../world/standing';
import { saveChar, calcStats, gainXp } from '../character';
import { showToast, logLine } from './hud';

const rowsHTML = (rows: { k: import('../data/items').ItemKey; n: number; given: number }[], have: (k: string) => number) =>
  rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (you have ${h} with you)` : ''}</span>`; }).join(' · ');

export function farmsHTML(town: string, head: string, msg = ''): string {
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const have = (k: string) => carried(k as Good, poi);
  const st = c.towns[v.id], home = v.id === GRIDHOLM_ID, seed = v.vm.seed, n = farmsOf(st), up = upgradedOf(st), plan = farmPlan(st), uplan = upgradePlan(st);
  const now = Math.round(peopleAt(seed, home, st, c.time)), tg = Math.round(targetNow(seed, home, st)), sl = soil(seed);
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}More food, more people; more people, more hands at work. ${v.vm.name} has ${n ? n + (n > 1 ? ' farms' : ' farm') : 'no farms yet'} outside the walls${up ? `, ${up} of them with steel ploughs and pumps` : ''}.`;
  s += `<br><span style="opacity:.8">${now} people live here${Math.abs(tg - now) >= 1 ? `, ${tg > now ? 'growing' : 'shrinking'} to ${tg}` : ''}. The soil is ${sl > 1.1 ? 'rich' : sl < 0.9 ? 'poor' : 'fair'}: each farm feeds ${farmPeople(seed)} more${up || c.tech[UPGRADE.tech] !== undefined ? `, ${Math.round(farmPeople(seed) * UPGRADE.mult)} with steel ploughs` : ''}.</span>`;
  if (n) {
    const p = farmPower(c.world, poi, seed, st, c.time), kw = farmsKw(st);
    s += `<br><span style="opacity:.8">The farms draw ${kw} kW (${FARM.kw} each, ${UPGRADE.kw} with pumps), before any works. Over the last day they got ${Math.round(p * 100)}% of it${p < 0.95 ? `: without power they feed only ${Math.round(UNPOWERED * 100)}% of what they could. A power station would help` : ''}.</span>`;
  }
  s += '</div>';
  if (plan) {
    s += `<div class="shoprow"><div><b>Farm ${plan.n} of ${FARM.max}</b> <span style="opacity:.7">(${FARM.kw} kW)</span><br><span>${rowsHTML(plan.rows, have)}</span></div></div>`;
    s += `<button class="opt" data-farm="give" ${plan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry (for the farm)</button>`;
  } else s += `<div class="say">We have cleared all the land we can guard (${FARM.max} farms).</div>`;
  if (uplan) {
    const known = c.tech[UPGRADE.tech] !== undefined;
    s += `<div class="shoprow"><div><b>Steel ploughs for farm ${uplan.n}</b> <span style="opacity:.7">(${UPGRADE.kw} kW, feeds ×${UPGRADE.mult})</span><br><span>${known ? rowsHTML(uplan.rows, have) : 'Nobody here knows how to make them. The old plans for Steel Ploughs must lie somewhere out there.'}</span></div></div>`;
    if (known) s += `<button class="opt" data-farm="up" ${uplan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry (for the steel ploughs)</button>`;
  }
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on a farm button: the message (and whether something was finished: the dialogue closes, the village is rebuilt), or null when it was not one. */
export function farmsClick(town: string, t: HTMLElement): { msg: string; built: boolean } | null {
  const b = t.closest<HTMLElement>('[data-farm]');
  if (!b) return null;
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return { msg: '', built: false };
  const st = (c.towns[v.id] ??= {}), have = (k: string) => carried(k as Good, poi), upgrade = b.dataset.farm === 'up';
  const { taken, built } = upgrade ? handOverUpgrade(st, c.tech, have) : handOverFarm(st, v.vm.seed, v.id === GRIDHOLM_ID, c.time, have);
  for (const [k, n] of taken) takeFrom(k as Good, n, poi); // backpack first, then the trunks of vehicles parked by the village
  const given = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : `You carry nothing the ${upgrade ? 'ploughs' : 'farm'} still ${upgrade ? 'need' : 'needs'}.`;
  if (!built) { calcStats(); saveChar(); return { msg: given, built: false }; }
  syncFarmVillage(v.id);
  if (upgrade) {
    c.gold += UPGRADE.gold; gainXp(UPGRADE.xp); earnTrust(v.id, 'farm'); calcStats(); saveChar();
    showToast(`${v.vm.name}: steel ploughs`);
    logLine(`The smith fits the ploughs and the pump starts to drum. With power, that farm now feeds ${Math.round(farmPeople(v.vm.seed) * UPGRADE.mult)} people. They pay you ${UPGRADE.gold} gold.`);
  } else {
    c.gold += FARM.gold; gainXp(FARM.xp); earnTrust(v.id, 'farm'); calcStats(); saveChar();
    showToast(`${v.vm.name}: a new farm`);
    logLine(`The villagers clear the land and sow it. ${v.vm.name} will feed ${farmPeople(v.vm.seed)} more people in a few days. They pay you ${FARM.gold} gold.`);
  }
  return { msg: given, built: true };
}
/** After the dialogue has closed: rebuild the village so the new field shows. */
export function showFarm(town: string) { const v = loadedVillage(town); if (v) reloadStruct(v.id); }
