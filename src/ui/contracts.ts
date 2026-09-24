// The delivery board at a village's general store (the merchant's option 'contracts'; the contracts themselves are
// gen/contracts.ts): the offers posted here, your contracts, and handing crates over where they are due. Hauls load
// their crates into your backpack and the trunks of vehicles parked by the gates, against a deposit. Contracts past
// their deadline fail (a haul's deposit is lost). Also: the tracker lines and map markers of your contracts.
import { G } from '../game';
import { ITEMS } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { offersAt, payFor, CONTRACT, type Contract } from '../gen/contracts';
import { trade } from '../gen/market';
import { findPoi, worldDist, nearX } from '../gen/regions';
import { fmtTime } from '../core/time';
import { loadedVillage } from '../world/overworld';
import { carried, takeFrom, putAway, stores } from './market';
import { bearingTo, point8, fmtDist } from './compass';
import { showToast, logLine } from './hud';
import { count } from '../data/crafting';
import { putItems } from '../inventory';

let town = '';
const left = (c: Contract) => c.n - c.done;
const dueText = (t: number) => { const h = Math.floor((t - G.char.time) / 60); return h < 0 ? 'overdue' : h < 24 ? `${h} h left (by ${fmtTime(t)})` : `${Math.floor(h / 24)} d ${h % 24} h left`; };
const where = (x: number, z: number) => `${fmtDist(worldDist(G.pos.x, G.pos.z, x, z))} ${point8(bearingTo(x, z))}`;
function describe(c: Contract): string {
  const g = ITEMS[c.good].name;
  return c.kind === 'supply'
    ? `<b>Order:</b> ${c.n} × ${g} for ${c.toName} · ${c.pay} g a crate`
    : `<b>Haul:</b> ${c.n} × ${g} from ${c.fromName} to ${c.toName} (${where(c.tx, c.tz)}) · ${c.pay} g a crate · deposit ${c.deposit} g, returned on delivery`;
}
export function renderContracts(panel: HTMLElement, head: string, msg = '') {
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return;
  const mine = c.contracts.map((k) => {
    const here = k.to === v.id, have = carried(k.good, poi), can = here ? Math.min(have, left(k)) : 0;
    return `<div class="shoprow"><div>${describe(k)}<br><span>${k.done}/${k.n} delivered · ${dueText(k.due)}${here ? ` · you have ${have} here` : ` · take them to ${k.toName}, ${where(k.tx, k.tz)}`}</span></div>
      ${here ? `<button class="opt" style="width:auto" data-ctd="${k.id}" ${can ? '' : 'disabled'}>Hand over ${can || ''}</button>` : ''}</div>`;
  }).join('');
  const offers = offersAt(c.world, poi, v.vm.seed, c.time).filter((o) => !c.taken.includes(o.id) && !c.contracts.some((k) => k.id === o.id));
  const full = c.contracts.length >= CONTRACT.maxActive;
  const rows = offers.map((o) => `<div class="shoprow"><div>${describe(o)}<br><span>deliver ${dueText(o.due)}</span></div>
    <button class="opt" style="width:auto;color:var(--gold)" data-cta="${o.id}" ${full || (o.kind === 'haul' && c.gold < o.deposit) ? 'disabled' : ''}>Take it</button></div>`).join('');
  panel.classList.add('wide');
  panel.innerHTML = head + `<div class="say">${msg ? msg + '<br><br>' : ''}Gold: <b>${c.gold}</b>. Deliveries between the villages, paid on delivery. New notices every 12 hours.${full ? ` You already hold ${CONTRACT.maxActive} contracts.` : ''}</div>` +
    (mine ? `<div class="say" style="margin-bottom:0">Your contracts</div>${mine}` : '') +
    `<div class="say" style="margin:10px 0 0">Posted here</div>` + (rows || '<div class="say" style="opacity:.7">Nothing posted just now. Come back later.</div>') +
    `<button class="opt" data-o="back">Back</button>`;
}
export function openContracts(t: string) { town = t; }
/** Clicks in the contracts window; returns a message, or null when not ours. */
export function contractsClick(t: HTMLElement): string | null {
  const a = t.closest<HTMLElement>('[data-cta]'), d = t.closest<HTMLElement>('[data-ctd]');
  if (!a && !d) return null;
  const v = loadedVillage(town), c = G.char, poi = v && findPoi(c.world, v.id);
  if (!v || !poi) return '';
  if (a) {
    const o = offersAt(c.world, poi, v.vm.seed, c.time).find((x) => x.id === a.dataset.cta);
    if (!o || c.contracts.length >= CONTRACT.maxActive) return 'That notice is gone.';
    if (o.kind === 'haul') {
      if (c.gold < o.deposit) return 'You cannot pay the deposit.';
      const room = stores(poi).reduce((s, st) => s + Math.max(0, roomOf(st.slots, o.good, st.cap)), 0);
      if (room < o.n) return `No room for ${o.n} crates: you can take ${room}. Park a vehicle by the gates and come back.`;
      putAway(o.good, o.n, poi, true); c.gold -= o.deposit; // into the trunks first: crates are heavy trade(c.market, poi.id, o.good, -o.n, c.time);
    }
    c.contracts.push({ ...o }); c.taken.push(o.id); if (c.taken.length > 60) c.taken.splice(0, c.taken.length - 60);
    calcStats(); saveChar();
    return o.kind === 'haul' ? `The crates are loaded. Take them to ${o.toName}, ${where(o.tx, o.tz)}.` : `Bring ${o.n} × ${ITEMS[o.good].name} here: ${dueText(o.due)}.`;
  }
  const k = c.contracts.find((x) => x.id === d!.dataset.ctd);
  if (!k || k.to !== v.id) return '';
  const n = Math.min(left(k), carried(k.good, poi));
  if (!n) return 'You have none of those crates with you.';
  takeFrom(k.good, n, poi);
  const pay = payFor(k, n);
  k.done += n; c.gold += pay; trade(c.market, v.id, k.good, n, c.time);
  let m = `Handed over ${n} × ${ITEMS[k.good].name}: +${pay} gold.`;
  if (k.done >= k.n) { c.contracts.splice(c.contracts.indexOf(k), 1); gainXp(20 + k.n * 3); showToast('Contract fulfilled'); m += ' The contract is done.'; }
  calcStats(); saveChar();
  return m;
}
/** How many crates of g fit into the slots (bulk-limited under `cap`). */
function roomOf(slots: Parameters<typeof count>[0], g: Contract['good'], cap?: number): number {
  const test = slots.map((s) => (s ? { ...s } : null));
  return 999 - putAwayTest(test, g, 999, cap);
}
const putAwayTest = (slots: Parameters<typeof count>[0], g: Contract['good'], n: number, cap?: number) => putItems(slots, g, n, cap);

let tick = 0;
/** Now and then: contracts past their deadline fail. */
export function updateContracts(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 2;
  const c = G.char;
  for (const k of [...c.contracts]) if (c.time > k.due) {
    c.contracts.splice(c.contracts.indexOf(k), 1); saveChar();
    showToast('Contract failed');
    logLine(k.kind === 'haul' ? `Too late: ${k.toName} no longer wants your ${ITEMS[k.good].name}, and ${k.fromName} keeps your deposit.` : `Too late: ${k.toName} found the ${ITEMS[k.good].name} elsewhere.`);
  }
}
/** Tracker lines. */
export const contractLines = () => G.char.contracts.map((k) => `▸ ${k.kind === 'supply' ? 'Supply' : 'Haul'} ${left(k)} × ${ITEMS[k.good].name} to ${k.toName} · ${dueText(k.due)}` + (G.char.loc === 'overworld' ? ` · ${where(k.tx, k.tz)}` : ''));
/** Map and compass markers. */
export const contractMarkers = () => G.char.contracts.map((k) => ({ x: nearX(k.tx, G.pos.x), z: k.tz, label: `${ITEMS[k.good].name} → ${k.toName}` }));
