// The elder's farms panel (gen/farms.ts): how many people the village feeds, its farms, and the materials for the
// next one, built from the village hall's stock (ui/stock.ts).
import { G } from '../game';
import { ITEMS } from '../data/items';
import { GRIDHOLM_ID } from '../gen/regions';
import { FARM, UPGRADE, UNPOWERED, CROPS, CROP_KINDS, cropOf, farmYield, type Crop, farmsOf, upgradedOf, farmPlan, farmProblem, upgradePlan, handOverFarm, handOverUpgrade, farmsKw, soil, farmPeople } from '../gen/farms';
import { farmPower } from '../gen/energy';
import { syncFarmVillage } from '../world/farms';
import { peopleAt, targetNow, workersAt } from '../gen/people';
import { progressive } from '../gen/settlement';
import { stockHas, stockTake, stockAt } from './stock';
import { settleOwn, anchorNew } from '../gen/hall';
import { findPoi } from '../gen/regions';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { earnTrust } from '../world/standing';
import { saveChar, calcStats, gainXp, hasItem, addItem } from '../character';
import { FIELD } from '../gen/fields';
import { showToast, logLine } from './hud';
import { buildersLine, jobHTML, building } from './jobs';

const rowsHTML = (rows: { k: import('../data/items').ItemKey; n: number; given: number }[], have: (k: import('../data/items').ItemKey) => number) =>
  rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (in the village hall: ${h})` : ''}</span>`; }).join(' · ');

export function farmsHTML(town: string, head: string, msg = ''): string {
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const have = stockHas(v.id);
  const st = c.towns[v.id], home = v.id === GRIDHOLM_ID, seed = v.vm.seed, n = farmsOf(st), up = upgradedOf(st), plan = farmPlan(st), uplan = upgradePlan(st);
  const now = Math.round(peopleAt(seed, home, st, c.time)), tg = Math.round(targetNow(seed, home, st)), sl = soil(seed);
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}More food, more people; more people, more hands at work. ${v.vm.name} has ${n ? n + (n > 1 ? ' farms' : ' farm') : 'no farms yet'} outside the walls${up ? `, ${up} of them with steel ploughs and pumps` : ''}.`;
  s += `<br><span style="opacity:.8">${now} people live here${Math.abs(tg - now) >= 1 ? `, ${tg > now ? 'growing' : 'shrinking'} to ${tg}` : ''}. The soil is ${sl > 1.1 ? 'rich' : sl < 0.9 ? 'poor' : 'fair'}: each farm feeds ${farmPeople(seed)} more${up || c.tech[UPGRADE.tech] !== undefined ? `, ${Math.round(farmPeople(seed) * UPGRADE.mult)} with steel ploughs` : ''}.</span>`;
  if (n) {
    const p = farmPower(c.world, poi, seed, st, c.time), kw = farmsKw(st);
    s += `<br><span style="opacity:.8">The farms draw ${kw} kW (${FARM.kw} each, ${UPGRADE.kw} with pumps), before any works. Over the last day they got ${Math.round(p * 100)}% of it${p < 0.95 ? (progressive(st) ? ': the steel ploughs\' pumps need it, without power those farms yield no more than plain ones. A power station would help' : `: without power they feed only ${Math.round(UNPOWERED * 100)}% of what they could. A power station would help`) : ''}.</span>`;
  }
  s += '</div>';
  // what each farm grows, and the choice
  if (n) {
    const fy = progressive(st) ? farmYield(seed, st, workersAt(seed, v.id === GRIDHOLM_ID, st, c.time), farmPower(c.world, findPoi(c.world, v.id)!, seed, st, c.time)) : farmYield(seed, st), sk = stockAt(v.id);
    s += `<div class="say" style="margin:8px 0 0">What the farms grow (the harvest goes into the village hall)</div>`;
    for (let i = 0; i < n; i++) {
      const cr = cropOf(st, i), out = CROPS[cr].out;
      s += `<div class="shoprow"><div><b>Farm ${i + 1}: ${CROPS[cr].name}</b>${i < up ? ' <span style="opacity:.7">(steel ploughs)</span>' : ''}<br><span style="opacity:.8">${CROPS[cr].blurb} · the farms make ${((fy[out] ?? 0) * 24).toFixed(1)} ${ITEMS[out].name} a day · in the hall: ${sk ? Math.floor(sk.ownOf(out)) : 0}</span><br>` +
        CROP_KINDS.filter((k) => k !== cr).map((k) => `<button class="opt" style="width:auto;display:inline-block;margin:4px 4px 0 0" data-crop="${i}:${k}">${CROPS[k].name}</button>`).join('') + `</div></div>`;
    }
  }
  if (plan && building(st, 'farm')) s += jobHTML(st, 'farm', undefined, `farm ${plan.n}`);
  else if (plan && st?.fwait) { // the materials are in: the hero stakes out the field (world/fields.ts)
    const has = hasItem('fieldstake');
    s += `<div class="shoprow"><div><b>Farm ${plan.n}: the materials are in</b><br><span>Now choose its field. Take a Survey Stake out of the village (up to ${FIELD.reach} m), use it and click where the field should go: the ground there is levelled and the builders start. Not on the ground kept for the quarry, the mine, the oil wells, the lumber yard or the other works, nor on roads, water or slopes too steep to level.</span></div></div>`;
    s += has ? '<div class="say" style="opacity:.8">You have a Survey Stake.</div>' : '<button class="opt" data-farm="stake">Give me a Survey Stake</button>';
  } else if (plan) {
    s += `<div class="shoprow"><div><b>Farm ${plan.n} of ${FARM.max}</b> <span style="opacity:.7">(${FARM.kw} kW)</span><br><span>${rowsHTML(plan.rows, have)}</span></div></div>`;
    s += `<button class="opt" data-farm="give" ${plan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Build from the village hall's stock (the farm)</button>`;
  } else s += `<div class="say">${farmProblem(st) || `We have cleared all the land we can guard (${FARM.max} farms).`}</div>`;
  if (uplan && building(st, 'plough')) s += jobHTML(st, 'plough', undefined, `steel ploughs for farm ${uplan.n}`);
  else if (uplan) {
    const known = c.tech[UPGRADE.tech] !== undefined;
    s += `<div class="shoprow"><div><b>Steel ploughs for farm ${uplan.n}</b> <span style="opacity:.7">(${UPGRADE.kw} kW, feeds ×${UPGRADE.mult})</span><br><span>${known ? rowsHTML(uplan.rows, have) : 'Nobody here knows how to make them. The old plans for Steel Ploughs must lie somewhere out there.'}</span></div></div>`;
    if (known) s += `<button class="opt" data-farm="up" ${uplan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Build from the village hall's stock (the steel ploughs)</button>`;
  }
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on a farm button: the message (and whether something was finished: the dialogue closes, the village is rebuilt), or null when it was not one. */
export function farmsClick(town: string, t: HTMLElement): { msg: string; built: boolean } | null {
  const cb = t.closest<HTMLElement>('[data-crop]');
  if (cb) return cropClick(town, cb);
  const b = t.closest<HTMLElement>('[data-farm]');
  if (!b) return null;
  const v = loadedVillage(town), c = G.char;
  const poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return { msg: '', built: false };
  const st = (c.towns[v.id] ??= {}), have = stockHas(v.id), upgrade = b.dataset.farm === 'up';
  if (b.dataset.farm === 'stake') { // another stake for the farm that waits for its field
    if (!st.fwait) return { msg: 'No farm waits for its field.', built: false };
    return { msg: hasItem('fieldstake') ? 'You have one already.' : addItem('fieldstake') ? 'The elder hands you a Survey Stake. Walk out and mark the field with it.' : 'No room for the stake in your backpack.', built: false };
  }
  settleOwn(c.world, poi, v.vm.seed, st, c.time); // the harvest so far is kept at the old yield
  const r = upgrade ? handOverUpgrade(st, c.tech, have, c.time) : handOverFarm(st, v.vm.seed, v.id === GRIDHOLM_ID, c.time, have, true), { taken, built, started } = r;
  stockTake(v.id, taken);
  if ('wait' in r && r.wait) { // the farm's materials are in: the hero chooses its field
    const got = hasItem('fieldstake') || addItem('fieldstake'); saveChar();
    return { msg: `${taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') + ' ' : ''}<b>All in.</b> ${got ? 'The elder hands you a Survey Stake: walk out and mark where the new field should go (use the stake, then click).' : 'Make room in your backpack for the Survey Stake and ask again.'}`, built: false };
  }
  const given = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : `The village hall has nothing more of what the ${upgrade ? 'ploughs' : 'farm'} still ${upgrade ? 'need' : 'needs'}: bring the materials to the village stores.`;
  if (started) { // the builders take over: they are paid now, the farm stands when they are done (world/jobsites.ts)
    if (upgrade) { c.gold += UPGRADE.gold; gainXp(UPGRADE.xp); } else { c.gold += FARM.gold; gainXp(FARM.xp); }
    earnTrust(v.id, 'farm'); calcStats(); saveChar();
    return { msg: `${given} <b>All in: the villagers start on the ${upgrade ? 'steel ploughs' : 'new farm'}</b>, ${buildersLine(st, upgrade ? 'plough' : 'farm')} They pay you ${upgrade ? UPGRADE.gold : FARM.gold} gold.`, built: false };
  }
  if (!built) { calcStats(); saveChar(); return { msg: given, built: false }; }
  anchorNew(c.world, poi, v.vm.seed, st, c.time);
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
/** Sow farm i with another crop: the harvest so far stays in the hall, the new one starts now. */
function cropClick(town: string, b: HTMLElement): { msg: string; built: boolean } {
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return { msg: '', built: false };
  const [i, k] = b.dataset.crop!.split(':'), st = (c.towns[v.id] ??= {}), idx = Number(i), crop = k as Crop;
  if (!CROPS[crop] || idx >= farmsOf(st)) return { msg: '', built: false };
  settleOwn(c.world, poi, v.vm.seed, st, c.time);
  st.crops ??= []; for (let j = 0; j < farmsOf(st); j++) st.crops[j] = cropOf(st, j);
  st.crops[idx] = crop;
  anchorNew(c.world, poi, v.vm.seed, st, c.time);
  saveChar();
  logLine(`Farm ${idx + 1} at ${v.vm.name} now grows ${CROPS[crop].name.toLowerCase()}: ${CROPS[crop].blurb}.`);
  return { msg: '', built: true }; // the village is redrawn with the new field
}
/** After the dialogue has closed: rebuild the village so the new field shows. */
export function showFarm(town: string) { const v = loadedVillage(town); if (v) reloadStruct(v.id); }
