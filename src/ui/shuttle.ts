// The shuttle project, at the desk in the old hangar by Gridholm (gen/shuttle.ts, world/hangar.ts): the stages of the
// repair, what each needs and what has come in, and handing over crates from your backpack and the vehicles parked
// by the hangar. The hangar pays for every crate (above its base price) and the work shows on the shuttle.
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { STAGES, SHUTTLE, stageRows, stagesDone, giveToStage, payPerCrate, type StageKey } from '../gen/shuttle';
import { findPoi, HANGAR_ID } from '../gen/regions';
import { reloadStruct } from '../world/overworld';
import { carried, takeFrom } from './market';
import { $, showToast, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open = false;
const hangar = () => findPoi(G.char.world, HANGAR_ID) ?? null;

function render(msg = '') {
  const s = G.char.shuttle, at = hangar(), done = stagesDone(s);
  const stages = STAGES.map((st) => {
    const { rows, done: ok } = stageRows(s, st);
    const lines = rows.map((r) => { const have = carried(r.g, at); return `${ITEMS[r.g].name} <b>${r.given}/${r.n}</b>${r.given < r.n ? ` <span style="opacity:.75">(you have ${have} · ${payPerCrate(r.g)} g a crate)</span>` : ''}`; }).join('<br>');
    const can = !ok && rows.some((r) => r.given < r.n && carried(r.g, at) > 0);
    return `<div class="shoprow"><div><b>${st.name}</b>${ok ? ' <span class="tag" style="color:#9dffe0">done</span>' : ''}<br><span style="opacity:.8">${st.blurb}</span><br><span>${lines}</span></div>
      ${ok ? '' : `<button class="opt" style="width:auto" data-shs="${st.key}" ${can ? '' : 'disabled'}>Hand over</button>`}</div>`;
  }).join('');
  panel().classList.add('wide');
  panel().innerHTML = `<h2>The Shuttle</h2><div class="role">Old Hangar, Gridholm · ${done} of ${STAGES.length} stages done</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}` +
    (done >= STAGES.length ? '<b>The shuttle is whole again: hull, engines, avionics, shield and full tanks. It is ready to fly.</b> (The flight itself is still to come.)'
      : 'A shuttle from before the machines woke, and the village means to fly it again. Nothing out in the fields or the ruins will mend it: it wants processed goods from the works. Bring the crates here (in your backpack or a vehicle parked by the hangar); the village pays for every one.') +
    `</div>${stages}<button class="opt" data-shclose="1">Close</button>`;
}
export function openShuttle() {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = true; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = false; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the shuttle window; true when handled. */
export function shuttleClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-shclose]')) { close(); return true; }
  const b = t.closest<HTMLElement>('[data-shs]');
  if (!b) return false;
  const c = G.char, k = b.dataset.shs as StageKey, st = STAGES.find((x) => x.key === k)!, at = hangar(), before = stageRows(c.shuttle, st).done;
  let pay = 0, n = 0;
  const got: string[] = [];
  for (const [g] of st.needs) {
    const m = giveToStage(c.shuttle, k, g, carried(g, at));
    if (!m) continue;
    takeFrom(g, m, at); pay += m * payPerCrate(g); n += m; got.push(`${ITEMS[g].name} ×${m}`);
  }
  if (!n) { render('You have none of what that stage needs.'); return true; }
  c.gold += pay; gainXp(n * SHUTTLE.xp); calcStats(); saveChar();
  const finished = !before && stageRows(c.shuttle, st).done;
  if (finished) {
    showToast(`Shuttle: ${st.name} done`);
    logLine(stagesDone(c.shuttle) >= STAGES.length ? 'The last crate goes in. The shuttle stands whole in the hangar, ready to fly.' : `The crew finish the ${st.name.toLowerCase()}. ${stagesDone(c.shuttle)} of ${STAGES.length} stages done.`);
    reloadStruct(HANGAR_ID);
  }
  render(`Handed over: ${got.join(', ')}. The village pays you ${pay} gold.${finished ? ` <b>The ${st.name.toLowerCase()} is done!</b>` : ''}`);
  return true;
}
