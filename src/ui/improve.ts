// The elder's improvements panel (gen/improve.ts): what the parts of the old plants could do for the village, each
// built from the village hall's stock (ui/stock.ts) like the other village builds.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { findPoi } from '../gen/regions';
import { IMPROVE, IMPROVE_KINDS, improvePlan, handOverImprove, hasImprove, type ImproveKind } from '../gen/improve';
import { loadedVillage } from '../world/overworld';
import { earnTrust } from '../world/standing';
import { stockHas, stockTake } from './stock';
import { saveChar, calcStats, gainXp } from '../character';
import { showToast, logLine } from './hud';

export function improveHTML(town: string, head: string, msg = ''): string {
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const st = c.towns[v.id], have = stockHas(v.id);
  const built = IMPROVE_KINDS.filter((k) => hasImprove(st, k));
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}The traders say the old plants make wonders again: power cells, sensors, parts finer than any smith can file. Bring them to the village hall and we can put them to use.` +
    (built.length ? `<br><br>Done here: ${built.map((k) => `<b>${IMPROVE[k].name}</b>`).join(', ')}.` : '') + `</div>`;
  for (const k of IMPROVE_KINDS) {
    const plan = improvePlan(k, st);
    if (!plan) continue;
    s += `<div class="shoprow"><div><b>${plan.spec.name}</b> <span style="opacity:.7">(${plan.spec.gold} gold, ${plan.spec.xp} xp)</span><br><span style="opacity:.8">${plan.spec.blurb}.</span><br><span>`;
    s += plan.problem ? `<span style="color:#ff9a7a">${plan.problem}</span>` : plan.rows.map((r) => { const h = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : h ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && h ? ` (in the hall: ${h})` : ''}</span>`; }).join(' · ');
    s += `</span></div>`;
    if (!plan.problem) s += `<button class="opt" style="width:auto" data-imp="${k}" ${plan.rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>build</button>`;
    s += `</div>`;
  }
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on a build button: the message and whether it was finished (then the village is redrawn), or null. */
export function improveClick(town: string, t: HTMLElement): { msg: string; built: boolean } | null {
  const b = t.closest('[data-imp]') as HTMLElement | null;
  if (!b) return null;
  const v = loadedVillage(town), c = G.char;
  if (!v) return { msg: '', built: false };
  const k = b.dataset.imp as ImproveKind, st = (c.towns[v.id] ??= {}), spec = IMPROVE[k];
  const { taken, built } = handOverImprove(k, st, stockHas(v.id));
  stockTake(v.id, taken);
  const given = taken.length ? 'Handed over: ' + taken.map(([i, n]) => `${ITEMS[i].name} ×${n}.`).join(' ') : `The village hall has nothing more of what the ${spec.name.toLowerCase()} still needs: bring the materials to the village stores.`;
  if (!built) { calcStats(); saveChar(); return { msg: given, built: false }; }
  c.gold += spec.gold; gainXp(spec.xp); earnTrust(v.id, 'improve'); calcStats(); saveChar();
  showToast(`${v.vm.name}: ${spec.name}`);
  logLine(`${v.vm.name} has its ${spec.name.toLowerCase()} now: ${spec.blurb}. The village pays you ${spec.gold} gold.`);
  return { msg: given + ` <b>${spec.name}: done.</b>`, built: true };
}
