// The elder's share (gen/standing.ts): what the village spares you for free, by the trust you have earned. The crates
// come out of its storehouse into your backpack or a vehicle parked by the village.
import { G } from '../game';
import { ITEMS, type ItemKey } from '../data/items';
import { findPoi } from '../gen/regions';
import { profileOf, type Good } from '../gen/market';
import { production } from '../gen/industry';
import { storeAt, takeStore, storeCap } from '../gen/store';
import { trustOf, trustTier, shareLeft, useShare, TRUST_TIERS } from '../gen/standing';
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
  const t = trustOf(p.st), k = trustTier(p.st), tier = TRUST_TIERS[k], next = TRUST_TIERS[k + 1], left = shareLeft(p.st, c.time), inStore = Math.floor(storeAt(p.seed, p.st, c.time, p.prod));
  const bar = (x: number) => { const n = Math.max(0, Math.min(12, Math.round(x * 12))); return '█'.repeat(n) + '░'.repeat(12 - n); };
  let s = head + `<div class="say">${msg ? msg + '<br><br>' : ''}`;
  s += tier.crates ? `You have done right by ${p.v.vm.name}. What our land gives, we share with you: up to ${tier.crates} crates a day, free.`
    : `We do not know you well yet. Help ${p.v.vm.name} (raise the wall, mend the power plant, stand with us in a raid, bring what we need) and we will share what our land gives.`;
  s += '</div>';
  s += `<div class="shoprow"><div><b>${tier.name}</b> · trust ${t}${next ? ` / ${next.min} for ${next.name} (${next.crates} crates a day)` : ''}<br><span style="font-family:monospace">${next ? bar((t - tier.min) / (next.min - tier.min)) : bar(1)}</span></div></div>`;
  if (tier.crates) {
    s += `<div class="say">Left today: <b>${left}</b> of ${tier.crates} · in the storehouse: ${inStore}/${storeCap(p.st)} crates</div>`;
    s += p.makes.map((g) => `<div class="shoprow"><div><b>${ITEMS[g as ItemKey].name}</b><br><span>made here</span></div>
      <button class="buy" data-share="${g}" data-n="1" ${left && inStore ? '' : 'disabled'}>Take 1</button>${left > 1 ? `<button class="buy" data-share="${g}" data-n="${left}" ${inStore > 1 ? '' : 'disabled'}>Take ${left}</button>` : ''}</div>`).join('');
  }
  return s + `<button class="opt" data-o="back">Back</button>`;
}
/** A click on "Take": the message, or null when it was not a share button. */
export function shareClick(town: string, el: HTMLElement): string | null {
  const b = el.closest<HTMLElement>('[data-share]');
  if (!b) return null;
  const p = place(town), c = G.char;
  if (!p) return '';
  const g = b.dataset.share as Good, want = Math.min(Number(b.dataset.n) || 1, shareLeft(p.st, c.time));
  if (!want) return 'That is all for today. Come back tomorrow.';
  const st = (c.towns[p.v.id] ??= {}), got = takeStore(st, p.seed, want, c.time, p.prod);
  if (!got) return 'The storehouse is empty. Give the workers time.';
  const back = putAway(g, got, p.poi, true);
  if (back) st.store = { n: (st.store?.n ?? 0) + back, t: c.time }; // what does not fit goes back in
  const n = got - back;
  if (!n) return 'You have no room for a crate: park a vehicle by the village or empty your backpack.';
  useShare(st, n, c.time); calcStats(); saveChar();
  return `The villagers load ${n} × ${ITEMS[g as ItemKey].name} for you${back ? ' (no room for the rest)' : ''}.`;
}
