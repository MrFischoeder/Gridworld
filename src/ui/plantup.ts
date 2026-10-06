// The elder's power plant panel (gen/plantup.ts): what the village's own plant makes now, its level, and the next
// upgrade (its plans, if it needs any, and the materials, built from the village hall's stock: ui/stock.ts).
import { G } from '../game';
import { ITEMS } from '../data/items';
import { findPoi } from '../gen/regions';
import { powerKind, POWER } from '../gen/town';
import { baseKw, BASE_KW } from '../gen/energy';
import { PLANT_LEVELS, plantLevel, plantUpPlan, handOverPlantUp } from '../gen/plantup';
import { TECH_BY_ID } from '../gen/tech';
import { loadedVillage, reloadStruct } from '../world/overworld';
import { earnTrust } from '../world/standing';
import { stockHas, stockTake } from './stock';
import { saveChar, calcStats, gainXp } from '../character';
import { showToast, logLine } from './hud';
import { buildersLine, jobHTML, building } from './jobs';

export function plantUpHTML(town: string, head: string, msg = ''): string {
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const st = c.towns[v.id], seed = v.vm.seed, kind = powerKind(seed), lv = plantLevel(st), plan = plantUpPlan(seed, st, c.tech);
  const have = stockHas(v.id);
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}Our ${POWER[kind].name.toLowerCase()} makes <b>${Math.round(baseKw(c.world, poi, seed, st, c.time))} kW</b> now (at best ${Math.round(BASE_KW[kind] * PLANT_LEVELS[lv].mult)} kW: ${PLANT_LEVELS[lv].name.toLowerCase()}). The village, the farms and the works all live on it.</div>`;
  if (!plan) return s + `<div class="say">It is as good as the old world ever made them.</div><button class="opt" data-o="back">Back</button>`;
  if (building(st, 'plantup', String(plan.to))) return s + jobHTML(st, 'plantup', String(plan.to), `the plant, ${plan.lv.name.toLowerCase()}`) + `<button class="opt" data-o="back">Back</button>`;
  s += `<div class="shoprow"><div><b>${plan.lv.name}</b> <span style="opacity:.7">(×${plan.lv.mult} power, ${Math.round(BASE_KW[kind] * plan.lv.mult)} kW at best)</span><br><span>`;
  if (!plan.plans) s += `Nobody here knows how. The old plans for ${TECH_BY_ID[plan.tech!].name} must lie somewhere out there.`;
  else s += plan.rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (in the village hall: ${h})` : ''}</span>`; }).join(' · ');
  s += `</span></div></div>`;
  if (plan.plans) s += `<button class="opt" data-plantup="1" ${plan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Build from the village hall's stock (the power plant)</button>`;
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on the hand-over button: the message and whether the plant was upgraded (then the dialogue closes), or null. */
export function plantUpClick(town: string, t: HTMLElement): { msg: string; built: boolean } | null {
  if (!t.closest('[data-plantup]')) return null;
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return { msg: '', built: false };
  const st = (c.towns[v.id] ??= {}), seed = v.vm.seed;
  const to = plantLevel(st) + 1, { taken, built, started } = handOverPlantUp(seed, st, c.tech, stockHas(v.id), c.time);
  stockTake(v.id, taken);
  const given = taken.length ? 'Handed over: ' + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}.`).join(' ') : 'The village hall has nothing more of what the plant still needs: bring the materials to the village stores.';
  if (started) {
    const lv = PLANT_LEVELS[to];
    c.gold += lv.gold; gainXp(lv.xp); earnTrust(v.id, 'plantup'); calcStats(); saveChar();
    return { msg: `${given} <b>All in: the fitters start on the power plant</b>, ${buildersLine(st, 'plantup', String(to))} The village pays you ${lv.gold} gold.`, built: false };
  }
  if (!built) { calcStats(); saveChar(); return { msg: given, built: false }; }
  const lv = PLANT_LEVELS[plantLevel(st)], kind = powerKind(seed);
  c.gold += lv.gold; gainXp(lv.xp); earnTrust(v.id, 'plantup'); calcStats(); saveChar();
  showToast(`${v.vm.name}: ${POWER[kind].name} ${lv.name.toLowerCase()}`);
  logLine(`The ${POWER[kind].name.toLowerCase()} runs ${lv.mult}× as strong now: up to ${Math.round(BASE_KW[kind] * lv.mult)} kW. The village pays you ${lv.gold} gold.`);
  return { msg: given, built: true };
}
export function showPlantUp(town: string) { const v = loadedVillage(town); if (v) reloadStruct(v.id); }
