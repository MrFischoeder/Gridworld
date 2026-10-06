// The mechanic's workshop window (data/garage.ts): "Build me something in your workshop." Kuba takes the salvage from
// the village hall's stock (ui/stock.ts) when you order and works for game hours; a vehicle is parked in his yard when
// you collect it, a repair kit goes into your backpack. The jobs are yours alone (`char.garage`).
import { G } from '../game';
import { ITEMS } from '../data/items';
import { GARAGE, GARAGE_MAX, type GarageJob } from '../data/garage';
import { vehicleTitle } from '../data/vehicles';
import { saveChar, calcStats, addItem } from '../character';
import { parkNew, yardBay } from '../world/vehicles';
import { showToast, logLine } from './hud';
import { stockHas, stockTake } from './stock';

const nameOf = (j: GarageJob) => (j.car ? vehicleTitle(j.car) : ITEMS[j.out!].name + (j.n > 1 ? ' ×' + j.n : ''));
const span = (min: number) => { const h = Math.floor(min / 60), m = Math.ceil(min % 60); return h ? `${h} h${m ? ' ' + m + ' min' : ''}` : `${m} min`; };
function jobsAt(vid: number) { const c = G.char; return (c.garage ?? []).map((j, at) => ({ j, at })).filter(({ j }) => j.w === c.world && j.v === vid); }

/** The workshop, as dialogue panel HTML (after `head`). */
export function garageHTML(head: string, vid: number | null, msg = ''): string {
  const c = G.char, has = vid !== null ? stockHas(vid) : () => 0, full = (c.garage?.length ?? 0) >= GARAGE_MAX;
  const queue = vid === null ? '' : jobsAt(vid).map(({ j, at }) => {
    const left = j.done - c.time;
    return `<div class="shoprow"><div><b>${nameOf(GARAGE[j.i])}</b><br><span>${left > 0 ? 'in the workshop · ready in ' + span(left) : '<span style="color:var(--xp)">ready</span>'}</span></div>
      <button class="buy" data-gar="${at}" ${left > 0 ? 'disabled' : ''}>Collect</button></div>`;
  }).join('');
  const rows = GARAGE.map((g, i) => {
    const ok = g.needs.every(([k, n]) => has(k) >= n) && !full;
    const needs = g.needs.map(([k, n]) => { const h = has(k); return `<span style="color:${h >= n ? 'var(--xp)' : '#ff9a7a'}">${ITEMS[k].name} ${Math.min(h, n)}/${n}</span>`; }).join(' · ');
    return `<div class="shoprow"><div><b>${nameOf(g)}</b><br><span style="opacity:.8">${g.blurb}</span><br><span>${needs}</span></div>
      <button class="buy" data-garn="${i}" ${ok ? '' : 'disabled'}>Order · ${g.hours} h</button></div>`;
  }).join('');
  return head + `<div class="say">${msg ? msg + '<br><br>' : ''}Nobody makes engines or gearboxes any more, so I build from what you drag out of the wrecks, the ruins and the robots: scrap, machine parts, gears, engine parts and old electronics. Store them in the village hall and order: I take them from there. Good work takes hours: come back later.</div>` +
    (queue ? '<h3>In the workshop</h3>' + queue : '') + (full ? `<div class="say" style="opacity:.8">You have ${GARAGE_MAX} jobs in the workshop already: collect one before you order more.</div>` : '') + rows +
    `<button class="opt" data-o="back">Back</button>`;
}
/** Collect a finished job: a vehicle into the yard, items into the backpack. */
function collect(at: number): string {
  const c = G.char, j = c.garage?.[at];
  if (!j || j.done > c.time) return 'It is not ready yet.';
  const g = GARAGE[j.i];
  if (g.car) {
    if (!yardBay() || !parkNew(g.car)) return 'The yard is full: drive one of your vehicles away first.';
    c.garage!.splice(at, 1); saveChar();
    return `Kuba wipes his hands. "There she is." Your ${vehicleTitle(g.car)} waits in the yard outside the north gate.`;
  }
  const want = j.n ?? g.n;
  let made = 0;
  while (made < want && addItem(g.out!)) made++;
  if (!made) return 'You have no room for it in your backpack.';
  if (made < want) j.n = want - made; else c.garage!.splice(at, 1); // (what finds no room waits in the workshop)
  calcStats(); saveChar();
  return `You take ${ITEMS[g.out!].name}${made > 1 ? ' ×' + made : ''} from the workshop.` + (made < want ? ` ${want - made} more wait for room in your pack.` : '');
}
/** Order job i at village vid: takes the salvage from the stock. */
function order(i: number, vid: number): string {
  const c = G.char, g = GARAGE[i];
  if (!g) return '';
  if ((c.garage?.length ?? 0) >= GARAGE_MAX) return `You have ${GARAGE_MAX} jobs waiting already: collect one first.`;
  const has = stockHas(vid);
  if (!g.needs.every(([k, n]) => has(k) >= n)) return 'The village hall does not hold all of it yet.';
  stockTake(vid, g.needs);
  (c.garage ??= []).push({ w: c.world, v: vid, i, done: c.time + g.hours * 60 });
  saveChar();
  return `Kuba rolls up his sleeves. "${g.hours} hours and your ${nameOf(g)} is done. Go and do something useful meanwhile."`;
}
/** Clicks in the workshop: the message, or null when it was not one of its buttons. */
export function garageClick(t: HTMLElement, vid: number | null): string | null {
  const cb = t.closest<HTMLElement>('[data-gar]');
  if (cb) return collect(Number(cb.dataset.gar));
  const ob = t.closest<HTMLElement>('[data-garn]');
  if (ob) return vid === null ? 'Hm?' : order(Number(ob.dataset.garn), vid);
  return null;
}
let told = 0;
/** Main loop: tells you once when a job is ready. */
export function updateGarage(dt: number) {
  if ((told -= dt) > 0) return;
  told = 3;
  for (const j of G.char.garage ?? []) if (j.done <= G.char.time && !j.told) {
    j.told = 1;
    const g = GARAGE[j.i]; showToast(`Your ${nameOf(g)} is ready at the workshop`); logLine(`Kuba has finished your ${nameOf(g)}: collect it at his workshop in the yard.`);
  }
}
