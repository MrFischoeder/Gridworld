import { G, W } from '../game';
import { GATE_GLYPHS, addressText, type GateAddress } from '../data/gates';
import { worldGates, gateName, GATE_SECONDS, type WorldGate } from '../gen/worldgates';
import { dialWorldGate, shutWorldGate, nearGatePanel } from '../world/worldgates';
import { $ } from './hud';
import { lockPointer } from './input';

const dlg = $('dlg'), panel = () => dlg.querySelector('.panel') as HTMLElement;
let source: WorldGate | null = null, selected: number[] = [], message = '';
function glyphSVG(id: number, size = 36): string {
  const glyph = GATE_GLYPHS[id];
  return `<svg width="${size}" height="${size}" viewBox="-1.25 -1.25 2.5 2.5" role="img" aria-label="${glyph.name}"><g transform="scale(1,-1)" fill="none" stroke="currentColor" stroke-width=".10" stroke-linejoin="round" stroke-linecap="round">${glyph.paths.map(p => `<polyline points="${p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('')}</g></svg>`;
}
const address = (a: GateAddress) => `<span class="gate-address" title="${addressText(a)}">${a.map(i => glyphSVG(i, 26)).join('')}</span>`;
function render() {
  if (!source) return;
  panel().classList.add('wide');
  panel().innerHTML = `<div class="gate-ui" data-gate-ui><h2>${gateName(source).toUpperCase()}</h2>` +
    `<div class="gate-local">THIS GATE'S ADDRESS ${address(source.address)}<small>${addressText(source.address)}</small></div>` +
    `<p>Press three symbols in the address order. Repeated symbols are allowed. Then walk through the ring. A connection lasts ${GATE_SECONDS} seconds while playing. Travel on foot.</p>` +
    `<div class="gate-entry" aria-label="Entered address">${[0, 1, 2].map(i => `<span>${selected[i] === undefined ? '—' : glyphSVG(selected[i], 46)}</span>`).join('')}</div>` +
    `<div class="gate-keys">${GATE_GLYPHS.map((g, i) => `<button type="button" data-gate-symbol="${i}" aria-label="${g.name}">${glyphSVG(i, 48)}<small>${g.name}</small></button>`).join('')}</div>` +
    `<p class="gate-message" role="status">${message || 'Choose a destination from the engraved archive below.'}</p>` +
    `<button class="opt" data-gate-reset>Clear address / close connection</button>` +
    `<details><summary>Engraved address archive · ${worldGates(G.char.world).length - 1} destinations</summary><div class="gate-directory">${worldGates(G.char.world).filter(g => g.id !== source!.id).map(g => `<div><b>${gateName(g)}</b>${address(g.address)}<small>${addressText(g.address)}</small></div>`).join('')}</div></details>` +
    `<button class="opt" data-gate-close>Leave console / enter the ring</button></div>`;
}
export function openGateConsole(g: WorldGate) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen || nearGatePanel()?.id !== g.id) return;
  source = g; selected = []; message = ''; G.dlgOpen = true; W.talkNpc = null; G.firing = false;
  for (const k in G.keys) G.keys[k] = false;
  render(); dlg.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export function gateConsoleClick(t: HTMLElement): boolean {
  if (!source || !G.dlgOpen || !panel().querySelector('[data-gate-ui]')) return false;
  if (t.closest('[data-gate-close]')) {
    source = null; G.dlgOpen = false; dlg.style.display = 'none'; if (!G.isTouch) lockPointer(); return true;
  }
  if (t.closest('[data-gate-reset]')) { shutWorldGate(source); selected = []; message = 'Connection closed. Enter a new address.'; render(); return true; }
  const key = t.closest<HTMLElement>('[data-gate-symbol]');
  if (key) {
    if (selected.length === 3) { selected = []; shutWorldGate(source); }
    selected.push(Number(key.dataset.gateSymbol)); message = selected.length === 3 ? dialWorldGate(source, selected) : `${selected.length} / 3 symbols entered.`;
    render(); return true;
  }
  return false;
}
