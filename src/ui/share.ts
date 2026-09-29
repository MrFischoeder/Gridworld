// The elder's share (gen/standing.ts): what the village spares you for free, by the trust you have earned. The crates
// come out of its storehouse into your backpack or a vehicle parked by the village.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { findPoi, GRIDHOLM_ID } from '../gen/regions';
import { peopleAt, workersAt } from '../gen/people';
import { profileOf, type Good } from '../gen/market';
import { production } from '../gen/industry';
import { stockOf, OWN } from '../gen/hall';
import { trustOf, trustTier, shareLeft, useShare, rareLeft, useRare, TRUST_TIERS } from '../gen/standing';
import { depositOf, RARE_NAME, RARE_SHARE, rareItem } from '../gen/deposits';
import { loadedVillage } from '../world/overworld';
import { putAway } from './market';
import { saveChar, calcStats } from '../character';

function place(town: string) {
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return null;
  const st = c.towns[v.id], seed = v.vm.seed, prod = production(c.world, poi, seed, st, c.time);
  return { v, poi, st, seed, prod, makes: profileOf(c.world, poi, seed).makes as Good[] };
}
/** The share panel (after `head`). */
export function shareHTML(town: string, head: string, msg = ''): string {
  const p = place(town), c = G.char;
  if (!p) return head + '<div class="say">Hm?</div><button class="opt" data-o="back">Back</button>';
  const t = trustOf(p.st), k = trustTier(p.st), tier = TRUST_TIERS[k], next = TRUST_TIERS[k + 1], left = shareLeft(p.st, c.time), sk = stockOf(c.world, p.poi, p.seed, p.st, c.time), inStore = Math.floor(sk.makes.reduce((a, g) => a + sk.ownOf(g), 0));
  const bar = (x: number) => { const n = Math.max(0, Math.min(12, Math.round(x * 12))); return '█'.repeat(n) + '░'.repeat(12 - n); };
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}`;
  s += tier.crates ? `You have done right by ${p.v.vm.name}. What our land gives, we share with you: up to ${tier.crates} crates a day, free.`
    : `We do not know you well yet. Help ${p.v.vm.name} (raise the wall, mend the power plant, stand with us in a raid, bring what we need) and we will share what our land gives.`;
  s += `<br><span style="opacity:.8">${Math.round(peopleAt(p.seed, p.v.id === GRIDHOLM_ID, p.st, c.time))} people live here, ${workersAt(p.seed, p.v.id === GRIDHOLM_ID, p.st, c.time)} of them at work.</span>`;
  s += '</div>';
  s += `<div class="shoprow"><div><b>${tier.name}</b> · trust ${t}${next ? ` / ${next.min} for ${next.name} (${next.crates} crates a day)` : ''}<br><span style="font-family:monospace">${next ? bar((t - tier.min) / (next.min - tier.min)) : bar(1)}</span></div></div>`;
  if (tier.crates) {
    s += `<div class="say">Left today: <b>${left}</b> of ${tier.crates} · in the village hall: ${inStore}/${OWN.cap * Math.max(1, sk.makes.length)} crates of our own goods</div>`;
    s += p.makes.map((g) => `<div class="shoprow"><div><b>${ITEMS[g as ItemKey].name}</b><br><span>made here</span></div>
      <button class="buy" data-share="${g}" data-n="1" ${left && inStore ? '' : 'disabled'}>Take 1</button>${left > 1 ? `<button class="buy" data-share="${g}" data-n="${left}" ${inStore > 1 ? '' : 'disabled'}>Take ${left}</button>` : ''}</div>`).join('');
  }
  const dep = depositOf(c.world, p.poi);
  if (dep) {
    const rl = rareLeft(p.st, c.time, RARE_SHARE), per = RARE_SHARE[k];
    s += `<div class="say">Near ${p.v.vm.name} lies a deposit of <b>${RARE_NAME[dep]}</b>, rare in these parts. ${per ? `We dig some for you: ${rl} of ${per} crates left today.` : `We dig it for those we know (${TRUST_TIERS[1].name}).`}</div>`;
    if (per) s += `<div class="shoprow"><div><b>${ITEMS[rareItem(dep)].name}</b><br><span>rare deposit</span></div><button class="buy" data-rare="${dep}" data-n="1" ${rl ? '' : 'disabled'}>Take 1</button>${rl > 1 ? `<button class="buy" data-rare="${dep}" data-n="${rl}">Take ${rl}</button>` : ''}</div>`;
  }
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on "Take" for the rare deposit: the message, or null when it was not one. */
function rareClick(p: NonNullable<ReturnType<typeof place>>, b: HTMLElement): string {
  const c = G.char, dep = depositOf(c.world, p.poi);
  if (!dep || b.dataset.rare !== dep) return '';
  const want = Math.min(Number(b.dataset.n) || 1, rareLeft(p.st, c.time, RARE_SHARE));
  if (!want) return 'That is all we dig for you today.';
  const n = want - putAway(rareItem(dep) as Good, want, p.poi, true);
  if (!n) return 'You have no room for a crate: park a vehicle by the village or empty your backpack.';
  useRare((c.towns[p.v.id] ??= {}), n, c.time); calcStats(); saveChar();
  return `The diggers bring ${n} × ${ITEMS[rareItem(dep)].name}.`;
}
/** A click on "Take": the message, or null when it was not a share button. */
export function shareClick(town: string, el: HTMLElement): string | null {
  const r = el.closest<HTMLElement>('[data-rare]');
  if (r) { const p = place(town); return p ? rareClick(p, r) : ''; }
  const b = el.closest<HTMLElement>('[data-share]');
  if (!b) return null;
  const p = place(town), c = G.char;
  if (!p) return '';
  const g = b.dataset.share as Good, want = Math.min(Number(b.dataset.n) || 1, shareLeft(p.st, c.time));
  if (!want) return 'That is all for today. Come back tomorrow.';
  const st = (c.towns[p.v.id] ??= {}), got = stockOf(c.world, p.poi, p.seed, st, c.time).takeOwn(g, want);
  if (!got) return 'None of those are in the village hall. Give the workers time.';
  const back = putAway(g, got, p.poi, true);
  if (back) { const o = (st.own ??= {})[g]; st.own[g] = { n: (o?.n ?? 0) + back, t: o?.t ?? c.time }; } // what does not fit goes back in
  const n = got - back;
  if (!n) return 'You have no room for a crate: park a vehicle by the village or empty your backpack.';
  useShare(st, n, c.time); calcStats(); saveChar();
  return `The villagers load ${n} × ${ITEMS[g as ItemKey].name} for you${back ? ' (no room for the rest)' : ''}.`;
}
