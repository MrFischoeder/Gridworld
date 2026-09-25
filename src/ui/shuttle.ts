// The Chariot of the Ancients (the shuttle in the old hangar by Gridholm: gen/shuttle.ts, world/hangar.ts). Nothing
// is sold here: bring the processed goods it needs to the hangar (in your backpack, or in a vehicle parked by it) and
// the crew unload them straight onto the Chariot (`updateChariot`, twice a second near the hangar). The desk inside
// shows the stages of the repair, what each needs and what has come in.
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { calcStats, saveChar, gainXp } from '../character';
import { STAGES, SHUTTLE, CHARIOT, stageRows, stagesDone, giveToStage } from '../gen/shuttle';
import { findPoi, HANGAR_ID } from '../gen/regions';
import { rectDist } from '../gen/terrain';
import { OW, reloadStruct } from '../world/overworld';
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
    const lines = rows.map((r) => `${ITEMS[r.g].name} <b>${r.given}/${r.n}</b>${r.given < r.n && carried(r.g, at) ? ` <span style="opacity:.75">(you have ${carried(r.g, at)})</span>` : ''}`).join('<br>');
    return `<div class="shoprow"><div><b>${st.name}</b>${ok ? ' <span class="tag" style="color:#9dffe0">done</span>' : ''}<br><span style="opacity:.8">${st.blurb}</span><br><span>${lines}</span></div></div>`;
  }).join('');
  panel().classList.add('wide');
  panel().innerHTML = `<h2>The ${CHARIOT}</h2><div class="role">Old Hangar, Gridholm · ${done} of ${STAGES.length} stages done</div>` +
    `<div class="say">${msg ? msg + '<br><br>' : ''}` +
    (done >= STAGES.length ? `<b>The ${CHARIOT} is whole again: hull, engines, avionics, shield and full tanks. It is ready to fly.</b> (The flight itself is still to come.)`
      : `A sky-ship from before the machines woke, and the village means to fly it again. Nothing out in the fields or the ruins will mend it: it wants processed goods from the works, and the works want power. Nothing is bought or sold here: whatever it needs that you bring to the hangar, in your backpack or a vehicle parked by it, the crew unload straight onto the Chariot.`) +
    `</div>${stages}<button class="opt" data-shclose="1">Close</button>`;
}
export function openShuttle() {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = true; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = false; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the Chariot window; true when handled. */
export function shuttleClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-shclose]')) { close(); return true; }
  return false;
}

let tick = 0;
/** Twice a second, at the hangar: the crew unload whatever the Chariot still needs from your backpack and vehicles there. */
export function updateChariot(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const c = G.char, at = hangar();
  if (!at || c.loc !== 'overworld' || !OW.structs.has(HANGAR_ID) || rectDist(at.rect, G.pos.x, G.pos.z) > SHUTTLE.reach) return;
  const got: string[] = [], finished: string[] = [];
  let n = 0;
  for (const st of STAGES) {
    const before = stageRows(c.shuttle, st).done;
    for (const [g] of st.needs) {
      const m = giveToStage(c.shuttle, st.key, g, carried(g, at));
      if (!m) continue;
      takeFrom(g, m, at); n += m; got.push(`${ITEMS[g].name} ×${m} for the ${st.name.toLowerCase()}`);
    }
    if (!before && stageRows(c.shuttle, st).done) finished.push(st.name);
  }
  if (!n) return;
  gainXp(n * SHUTTLE.xp); calcStats(); saveChar();
  logLine(`The hangar crew unload ${got.join(', ')} onto the Chariot.`);
  for (const f of finished) { showToast(`The Chariot: ${f} done`); logLine(stagesDone(c.shuttle) >= STAGES.length ? `The last crate goes in. The ${CHARIOT} stands whole in the hangar, ready to fly.` : `The crew finish the ${f.toLowerCase()}. ${stagesDone(c.shuttle)} of ${STAGES.length} stages done.`); }
  if (finished.length) reloadStruct(HANGAR_ID);
  if (open) render();
}
