// (0.179, the fuel plan's P3) A settlement's fuel pump: built as a project (gen/settlement.ts 'fuelpump'), never there
// by itself. E at a pump column opens its window: the village's fuel in stock and its price, your vehicles standing by
// the island with their tanks, Fill up (a canister at a time from the stock, paid at the village's buy price) and Buy
// a canister for the backpack. Multiplayer: the fuel comes out of the shared village stock under the village lock
// (`withTownStock`), so two players at the pump cannot take the same canister; the tank is the owner's vehicle.
import { G, W } from '../game';
import { allVillages, findPoi, villageSeed, worldDist, nearX, type Poi } from '../gen/regions';
import { progressive, projectDone, RESOURCE_PLOTS, FUEL_PUMP } from '../gen/settlement';
import { quote } from '../gen/market';
import { VEHICLES, vehicleTitle, rangeKm, cansToFill, FUEL } from '../data/vehicles';
import { vehicles, type Vehicle } from './vehicles';
import { stockAt, withTownStock } from '../ui/stock';
import { addItem, saveChar } from '../character';
import { itemName } from '../ui/icons';
import { lockPointer } from '../ui/input';
import { logLine, showToast } from '../ui/hud';

/** The pump island's middle (world) of village v. */
function pumpAt(v: Poi) { const p = RESOURCE_PLOTS.fuelpump; return { x: v.x - 36 + p.x, z: v.z - 36 + p.z }; }
const pumpVillage = (v: Poi) => progressive(G.char.towns[v.id]) && projectDone(G.char.towns[v.id], 'fuelpump');
/** The village whose pump column you stand at (E), or null. */
export function nearFuelPump(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const v of allVillages(G.char.world)) {
    if (worldDist(v.x, v.z, G.pos.x, G.pos.z) > 400 || !pumpVillage(v)) continue;
    const p = pumpAt(v), px = nearX(p.x, G.pos.x);
    if (FUEL_PUMP.pumps.some((dx) => Math.hypot(G.pos.x - (px + dx), G.pos.z - p.z) < FUEL_PUMP.use)) return v.id;
  }
  return null;
}
/** Your vehicles standing by village v's pump. */
function carsHere(v: Poi): Vehicle[] {
  const p = pumpAt(v);
  return vehicles.filter((c) => !c.ai && G.char.vehicles.includes(c.st) && Math.hypot(c.st.x - nearX(p.x, c.st.x), c.st.z - p.z) < FUEL_PUMP.reach);
}
const priceOf = (v: Poi) => quote(v, villageSeed(G.char.world, v), G.char.world, 'fuel', G.char.market, G.char.time, true, 1, G.char.towns[v.id]).buy;

let open: number | null = null;
const root = () => document.getElementById('dlg')!;
function render(msg = '') {
  const v = findPoi(G.char.world, open!)!, st = stockAt(v.id), have = st ? Math.floor(st.has('fuel')) : 0, price = priceOf(v);
  const cars = carsHere(v);
  let h = `<div data-fpump="1"><h2>Fuel pump</h2><div class="role">${v.name}</div>`;
  h += `<div class="say">${itemName('fuel')} in the village stores: <b>${have}</b> · <b>${price} g</b> a canister (${FUEL.can} L) · your gold: <b>${G.char.gold}</b>${msg ? '<br>' + msg : ''}</div>`;
  if (!cars.length) h += `<div class="say" style="opacity:.7">Drive your vehicle up to the pump island to fill its tank.</div>`;
  cars.forEach((c, i) => {
    const p = c.st.parts, s = VEHICLES[c.st.model], need = cansToFill(c.st.model, p.fuel);
    h += `<div class="shoprow"><div><b>${vehicleTitle(c.st.model)}</b><br><span>${Math.round(p.fuel)}/${s.tank} L · ~${Math.round(rangeKm(c.st.model, p.fuel))} km${need ? ` · ${need} canister${need > 1 ? 's' : ''} to fill` : ' · full'}</span></div>` +
      `<button class="buy" data-fpfill="${i}" ${need && have && G.char.gold >= price ? '' : 'disabled'}>Fill up</button></div>`;
  });
  h += `<div class="shoprow"><div>${itemName('fuel')}<br><span>a canister for your backpack</span></div><button class="buy" data-fpcan="1" ${have && G.char.gold >= price ? '' : 'disabled'}>${price} g</button></div>`;
  h += `<button class="opt" data-fpclose="1">Close</button></div>`;
  root().querySelector('.panel')!.innerHTML = h;
}
export function openFuelPump(vid: number) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = vid; G.dlgOpen = true; G.firing = false; W.talkNpc = null; for (const k in G.keys) G.keys[k] = false;
  render(); root().style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = null; G.dlgOpen = false; root().style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the pump's window (from the dialogue's click handler). */
export function fuelPumpClick(t: HTMLElement): boolean {
  if (open === null || !G.dlgOpen || !t.closest('[data-fpump]')) return false;
  if (t.closest('[data-fpclose]')) { close(); return true; }
  const v = findPoi(G.char.world, open)!, fill = t.closest('[data-fpfill]') as HTMLElement | null, can = t.closest('[data-fpcan]');
  if (!fill && !can) return true;
  const car = fill ? carsHere(v)[+fill.dataset.fpfill!] : null;
  let msg = '';
  void withTownStock(v.id, () => {
    const st = stockAt(v.id); if (!st) return;
    const price = priceOf(v);
    if (car) {
      const p = car.st.parts; let n = 0;
      while (cansToFill(car.st.model, p.fuel) > 0 && st.has('fuel') >= 1 && G.char.gold >= price) { st.take('fuel', 1); G.char.gold -= price; p.fuel = Math.min(car.spec.tank, p.fuel + FUEL.can); n++; }
      msg = n ? `${n} canister${n > 1 ? 's' : ''} into the ${vehicleTitle(car.st.model)}: ${Math.round(p.fuel)}/${car.spec.tank} L, ${n * price} gold.` : 'Nothing poured.';
    } else if (st.has('fuel') >= 1 && G.char.gold >= price) {
      if (!addItem('fuel', 1, true)) { msg = 'No room in your backpack.'; return; }
      st.take('fuel', 1); G.char.gold -= price; msg = `A canister of diesel, ${price} gold.`;
    }
  }).then((ok) => { if (!ok) return; saveChar(); if (msg) logLine(msg); if (open !== null) render(msg); else showToast(msg); });
  return true;
}
