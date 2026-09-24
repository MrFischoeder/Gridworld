// The build list (B on your claim): every part you can build, what it takes (what you carry / what it needs, and the
// tools), and a Build button that starts the build mode (world/building.ts). It lives in the dialogue panel.
import { G, W } from '../game';
import { ITEMS } from '../data/items';
import { PIECES, PIECE_KINDS, BASES_OPEN, BASES_CLOSED_MSG, type PieceKind } from '../data/building';
import { count } from '../data/crafting';
import { startBuilding, lacks, stopBuilding, isBuilding } from '../world/building';
import { claimHere } from '../world/claims';
import { loadText } from './slots';
import { $, logLine } from './hud';
import { lockPointer } from './input';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;

function render() {
  const inv = G.char.inv;
  const rows = PIECE_KINDS.map((k) => {
    const s = PIECES[k];
    const needs = s.needs.map(([m, n]) => `<span class="${count(inv, m) >= n ? '' : 'bad'}">${ITEMS[m].name} ${count(inv, m)}/${n}</span>`).join(' · ') +
      s.tools.map((t) => ` · <span class="${count(inv, t) ? '' : 'bad'}">tool: ${ITEMS[t].name}</span>`).join('');
    return `<div class="shoprow"><div><b>${s.name}</b><br><span>${needs}</span></div><button class="buy" data-build="${k}" ${lacks(k) ? 'disabled' : ''}>Build</button></div>`;
  }).join('');
  panel().innerHTML = `<h2>Build</h2><div class="role">on your claim, round the flag</div>` +
    `<div class="say">Backpack: ${loadText()}<br>Pick a part, look where it should stand and click. F takes down the part you look at (a Hammer for wood, an Acetylene Torch for metal; half the materials come back). E opens and shuts doors. Right mouse or Esc stops building.</div>` +
    `<div class="recipes">${rows}</div><button class="opt" data-bclose="1">Close</button>`;
}
/** B: open the build list (on your claim), or close it. */
export function toggleBuildMenu() {
  if (G.dlgOpen) { if (panel().querySelector('[data-bclose]')) close(); return; }
  if (!G.playing || G.packOpen || G.xferOpen) return;
  if (!BASES_OPEN) { logLine(BASES_CLOSED_MSG); return; }
  if (G.char.loc !== 'overworld' || !claimHere(G.pos.x, G.pos.z)) { logLine('You can only build on your own claim: raise a Flagpole first.'); return; }
  G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks inside the panel that belong to the build list. Returns true when handled. */
export function buildClick(t: HTMLElement): boolean {
  const b = t.closest<HTMLElement>('[data-build]');
  if (b) { if (isBuilding()) stopBuilding(true); close(); startBuilding(b.dataset.build as PieceKind); return true; }
  if (t.closest('[data-bclose]')) { close(); return true; }
  return false;
}
