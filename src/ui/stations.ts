// The window of a power station (E at it; gen/energy.ts, world/stations.ts): what it makes now, the village's power
// balance, and for a coal or diesel station its bunker (load crates from your backpack and the vehicles parked by
// the village) and the switch (off, it burns nothing and makes nothing).
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { calcStats, saveChar } from '../character';
import { STATIONS, BUNKER, VILLAGE_KW, stationKw, fuelAt, loadBunker, switchStation, balance, type StationState } from '../gen/energy';
import { PLANTS, running } from '../gen/plants';
import { findPoi } from '../gen/regions';
import { carried, takeFrom } from './market';
import type { Station } from '../world/stations';
import { $ } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open: Station | null = null;
const state = (): StationState | null => (open ? G.char.towns[open.vid]?.stations?.[open.slot] ?? null : null);

function render(msg = '') {
  const s = state(), poi = open && findPoi(G.char.world, open.vid);
  if (!s || !open || !poi) return;
  const now = G.char.time, spec = STATIONS[s.k], kw = Math.round(stationKw(poi, open.seed, s, now)), b = balance(G.char.world, poi, open.seed, G.char.towns[open.vid], now);
  const how = s.k === 'solarfarm' ? 'It follows the sun: full at noon, nothing at night.' : s.k === 'windfarm' ? 'It turns with the wind, which changes from hour to hour.'
    : `It burns a ${spec.fuel === 'coal' ? 'crate of coal' : 'canister of fuel'} every ${spec.burn! / 60} hours while it is on, whether the works need the power or not.`;
  const plants = G.char.towns[open.vid]?.plants ?? [];
  const works = plants.map((p, i) => `${PLANTS[p.k].name}: ${!running(p) ? 'idle' : b.powered[i] ? 'powered' : '<span style="color:var(--red,#ff5a3c)">no power</span>'}`).join(' · ');
  let fuel = '';
  if (spec.fuel) {
    const left = fuelAt(s, now), have = carried(spec.fuel, poi), room = Math.floor(BUNKER - left);
    fuel = `<div class="shoprow"><div><b>${ITEMS[spec.fuel].name}</b><br><span>in the bunker ${Math.floor(left)}/${BUNKER}${left > 0 && s.on ? ` · lasts about ${Math.round(left * spec.burn! / 60)} h` : ''} · you have ${have}</span></div>
      <button class="opt" style="width:auto" data-stl="1" ${have && room ? '' : 'disabled'}>load 1</button>
      <button class="opt" style="width:auto" data-stl="999" ${have > 1 && room > 1 ? '' : 'disabled'}>load all</button></div>`;
  }
  panel().classList.add('wide');
  panel().innerHTML = `<h2>${spec.name}</h2><div class="role">${open.town} · ${spec.blurb}</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}Now: <b>${s.on ? kw + ' kW' : 'switched off'}</b> (rated ${spec.kw} kW). ${how}<br><br>` +
    `The village makes ${Math.round(b.made)} kW in all and takes ${VILLAGE_KW} kW itself; ${Math.round(Math.max(0, b.made - VILLAGE_KW))} kW are left for the works.${works ? '<br>' + works : ''}</div>` +
    fuel + (spec.fuel ? `<button class="opt" data-sts="1">${s.on ? 'Switch it off (save the fuel)' : 'Switch it on'}</button>` : '') + `<button class="opt" data-stclose="1">Close</button>`;
}
/** Open the window of station w; false when there is none (an empty plot, a building site). */
export function openStation(w: Station): boolean {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return true;
  open = w;
  if (!state()) { open = null; return false; }
  G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
  return true;
}
function close() { open = null; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the station window; true when handled. */
export function stationClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-stclose]')) { close(); return true; }
  const s = state(), poi = findPoi(G.char.world, open.vid) ?? null, now = G.char.time;
  if (!s) { close(); return true; }
  if (t.closest('[data-sts]')) { switchStation(s, !s.on, now); saveChar(); render(s.on ? 'Switched on.' : 'Switched off: it burns nothing now, and makes nothing.'); return true; }
  const l = t.closest<HTMLElement>('[data-stl]');
  if (l && STATIONS[s.k].fuel) {
    const g = STATIONS[s.k].fuel!, n = loadBunker(s, Math.min(+l.dataset.stl!, carried(g, poi)), now);
    if (n) takeFrom(g, n, poi);
    calcStats(); saveChar();
    render(n ? `Loaded ${n} × ${ITEMS[g].name} into the bunker.` : 'The bunker is full.');
    return true;
  }
  return false;
}
