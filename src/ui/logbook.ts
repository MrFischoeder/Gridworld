// The Kestrel's flight recorder (the console in the nose of your crashed ship, world/crashpod.ts): what happened,
// what is left of the ship, and what the scanners saw on the way down. Read only.
import { G, W } from '../game';
import { $ } from './hud';
import { lockPointer } from './input';
import { SHIP_NAME, PILOT, PODS } from '../world/lander';
import { crashWorld } from '../world/crashpod';
import { tl, TL, DIR8 } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
const DIRS = DIR8;
let open = false;

function render() {
  const [x, z] = crashWorld(0, 0), d = Math.hypot(x, z), dir = DIRS[Math.round(((Math.atan2(-x, z) * 180 / Math.PI + 360) % 360) / 45) % 8];
  const who = G.char.name || tl('Specialist');
  const lines: [string, string][] = [
    ['DAY 214 · 13:40', TL`Survey run through the outer belt of an uncharted system. ${PILOT} at the controls. Survey team in cryo-sleep (${PODS.length} pods; ${who} in one of them). All systems nominal.`],
    ['14:02', tl('Proximity alert. A meteor stream, dense and not on any chart. Evasive burn.')],
    ['14:03', tl('Impact. Starboard wing and engine lost. Hull breach. Main drive offline.')],
    ['14:05', tl('Captured by the fourth planet. Emergency entry, no control of the descent.')],
    ['14:11', tl('Ground contact. Recorder on emergency power.')],
    ['14:12', TL`Pilot: no life signs. Cryo bay intact. Waking the sleepers one by one as power allows.`],
  ];
  panel().classList.add('wide');
  panel().innerHTML = TL`<h2>${SHIP_NAME} · flight recorder</h2><div class="role">Emergency power · 9%</div>` +
    lines.map(([t, s]) => `<div class="say"><b>${t}</b> ${s}</div>`).join('') +
    TL`<div class="say"><b>STATUS</b> Hull 9%. Main drive destroyed. Jump core cracked beyond repair. Distress beacon transmitting: no reply. The nearest human station is forty light-years away. Pilot lost. Cryo bay on emergency power: a pod opens for each sleeper as they wake, and takes them back to heal if they fall. Other ships: no signal yet.</div>` +
    TL`<div class="say"><b>SURFACE SCAN</b> A walled settlement ${Math.round(d / 10) * 10} m ${dir} of the crash site. Ruins of an old and advanced civilisation all over the continent. A strong power signature under a hangar by the settlement.</div>` +
    TL`<div class="say"><b>RECOMMENDATION</b> Survive. Find people. Find a way back to the stars.</div>` +
    TL`<button class="opt" data-lbclose="1">Close</button>`;
}
export function openLogbook() {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = true; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
/** Clicks in the recorder window; true when handled. */
export function logbookClick(t: HTMLElement): boolean {
  if (!open) return false;
  if (t.closest('[data-lbclose]')) { open = false; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); return true; }
  return false;
}
