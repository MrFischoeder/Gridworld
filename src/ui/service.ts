// Vehicle service window: wheels, engine and the roof cannon. Parts come from (and go back to) the backpack.
import { G } from '../game';
import { item, ITEMS, type ItemKey } from '../data/items';
import { vehicleTitle, immobile } from '../data/vehicles';
import { hasItem, takeOne, saveChar } from '../character';
import { putItems } from '../inventory';
import { refreshParts, type Vehicle } from '../world/vehicles';
import { $ } from './hud';
import { lockPointer } from './input';

const el = { root: $('svc'), title: $('svcTitle'), sub: $('svcSub'), rows: $('svcRows'), msg: $('svcMsg'), close: $('svcClose') };
let cur: Vehicle | null = null;
/** Parts worn below this are scrap when taken off; better ones go back into the backpack. */
const REUSABLE = 50;

function wheelName(v: Vehicle, i: number) {
  const axle = Math.floor(i / 2), n = v.spec.axles.length, side = i % 2 ? 'right' : 'left';
  return (axle === 0 ? 'Front' : axle === n - 1 ? 'Rear' : 'Middle') + ' ' + side + ' wheel';
}
const cond = (c: number) => c < 0 ? '<span class="bad">missing</span>'
  : `<span class="${c === 0 ? 'bad' : ''}">${Math.round(c)}%</span><span class="bar"><i style="width:${Math.max(0, c)}%;${c < 35 ? 'background:var(--amber)' : ''}"></i></span>`;
const btn = (act: string, i: number, label: string, ok: boolean) => `<button data-a="${act}" data-i="${i}" ${ok ? '' : 'disabled'}>${label}</button>`;

function render(msg?: string) {
  const v = cur!, p = v.st.parts, wk = v.spec.wheelItem, why = immobile(p);
  el.title.textContent = vehicleTitle(v.st.model);
  el.sub.textContent = v.spec.role + ' · ' + (why ? "won't move: " + why.toLowerCase() : 'ready to drive');
  let h = '';
  p.wheels.forEach((c, i) => {
    h += `<div class="svcrow"><div>${wheelName(v, i)} ${cond(c)}</div><div>` +
      (c < 0 ? btn('fitW', i, 'Fit ' + ITEMS[wk].name, hasItem(wk)) : btn('fitW', i, 'Replace', hasItem(wk) && c < 100) + ' ' + btn('offW', i, 'Take off', true)) + '</div></div>';
  });
  h += `<div class="svcrow"><div>Engine ${cond(p.engine)}</div><div>${btn('eng', 0, 'Repair (+50%)', hasItem('engine') && p.engine < 100)}</div></div>`;
  h += `<div class="svcrow"><div>Roof cannon ${p.gun ? 'fitted' : '<span style="opacity:.6">none</span>'}</div><div>` +
    (p.gun ? btn('offGun', 0, 'Take off', true) : btn('gun', 0, 'Fit ' + ITEMS.cannon.name, hasItem('cannon'))) + '</div></div>';
  el.rows.innerHTML = h;
  if (msg !== undefined) el.msg.textContent = msg;
}
/** Takes a part off into the backpack if it is still good, else scraps it. */
function salvage(k: ItemKey, condition: number): string {
  if (condition < REUSABLE) return `The old ${item(k).name.toLowerCase()} was scrap.`;
  if (putItems(G.char.inv, k, 1)) return `No room in your backpack: the old ${item(k).name.toLowerCase()} was left behind.`;
  return `${item(k).name} → backpack.`;
}
el.root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-a]');
  if (!b || !cur) return;
  const p = cur.st.parts, i = +b.dataset.i!, wk = cur.spec.wheelItem;
  let msg = '';
  switch (b.dataset.a) {
    case 'fitW': {
      const old = p.wheels[i];
      if (!takeOne(wk)) return;
      p.wheels[i] = 100; msg = 'Fitted a new wheel. ' + (old >= 0 ? salvage(wk, old) : '');
      break;
    }
    case 'offW': msg = salvage(wk, p.wheels[i]); p.wheels[i] = -1; break;
    case 'eng': if (!takeOne('engine')) return; p.engine = Math.min(100, p.engine + 50); msg = 'Engine repaired.'; break;
    case 'gun': if (!takeOne('cannon')) return; p.gun = true; msg = 'Cannon fitted on the roof. Fire it with the attack button while driving.'; break;
    case 'offGun':
      if (putItems(G.char.inv, 'cannon', 1)) { msg = 'No room in your backpack.'; break; }
      p.gun = false; msg = 'Cannon → backpack.'; break;
  }
  refreshParts(cur); saveChar(); render(msg);
});
el.close.onclick = () => closeService();

export function openService(v: Vehicle) {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  cur = v; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render(`Spare parts come from Mirek's yard: ${ITEMS[v.spec.wheelItem].name}, ${ITEMS.engine.name}, ${ITEMS.cannon.name}.`);
  el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeService() {
  if (!cur) return;
  cur = null; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
