import { G, W } from '../game';
import { GATE_GLYPHS, addressText, type GateAddress } from '../data/gates';
import { tabletDestinations, gateName, GATE_SECONDS, type WorldGate } from '../gen/worldgates';
import { dialWorldGate, gateConnection, gateSecondsLeft, nearGatePanel, nearGateTablet } from '../world/worldgates';
import { $ } from './hud';
import { lockPointer } from './input';

const dlg = $('dlg'), panel = () => dlg.querySelector('.panel') as HTMLElement;
let source: WorldGate | null = null, selected: number[] = [], message = '', tablet = false, pending = false, renderedClock = '';
let session = 0;
function glyphSVG(id: number, size = 36): string {
  const glyph = GATE_GLYPHS[id];
  return `<svg width="${size}" height="${size}" viewBox="-1.25 -1.25 2.5 2.5" role="img" aria-label="${glyph.name}"><g transform="scale(1,-1)" fill="none" stroke="currentColor" stroke-width=".10" stroke-linejoin="round" stroke-linecap="round">${glyph.paths.map(p => `<polyline points="${p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('')}</g></svg>`;
}
const address = (a: GateAddress) => `<span class="gate-address" title="${addressText(a)}">${a.map(i => glyphSVG(i, 26)).join('')}</span>`;
function render() {
  if (!source) return;
  const link = gateConnection(source.id), left = gateSecondsLeft(source.id), locked = !!link || pending;
  renderedClock = `${left}:${pending}`;
  panel().classList.add('wide');
  if (tablet) {
    panel().innerHTML = `<div class="gate-ui" data-gate-ui><h2>ANCIENT ADDRESS TABLET</h2><p>Three addresses are permanently engraved in this stone. Use the console beside the ring to enter them.</p><div class="gate-tablet-addresses">${tabletDestinations(G.char.world, source).map(g => `<div><b>${gateName(g)}</b>${address(g.address)}<small>${addressText(g.address)}</small></div>`).join('')}</div><button class="opt" data-gate-close>Leave tablet</button></div>`;
    return;
  }
  const destination = link ? gateName({ id: link.a === source.id ? link.b : link.a }) : '';
  panel().innerHTML = `<div class="gate-ui" data-gate-ui><h2>${gateName(source).toUpperCase()}</h2>` +
    `<div class="gate-local">THIS GATE'S ADDRESS ${address(source.address)}<small>${addressText(source.address)}</small></div>` +
    `<p>Press three symbols in the address order. Repeated symbols are allowed. A nearby stone tablet holds three destinations. Connections last ${GATE_SECONDS} real seconds, even in menus. Walk or drive through the ring.</p>` +
    `<div class="gate-entry" aria-label="Entered address">${[0, 1, 2].map(i => `<span>${selected[i] === undefined ? '—' : glyphSVG(selected[i], 46)}</span>`).join('')}</div>` +
    `<div class="gate-keys">${GATE_GLYPHS.map((g, i) => `<button type="button" data-gate-symbol="${i}" aria-label="${g.name}"${locked ? ' disabled' : ''}>${glyphSVG(i, 48)}<small>${g.name}</small></button>`).join('')}</div>` +
    `<p class="gate-message" role="status">${link ? `Connected to ${destination}. BOTH TERMINALS LOCKED · ${left}s remaining.` : message || 'Enter an address found on a stone tablet.'}</p>` +
    `<button class="opt" data-gate-reset${locked ? ' disabled' : ''}>Clear entered address</button>` +
    `<button class="opt" data-gate-close>Leave console / enter the ring</button></div>`;
}
function openDevice(g: WorldGate, readTablet: boolean) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen || (readTablet ? nearGateTablet() : nearGatePanel())?.id !== g.id) return;
  session++; source = g; tablet = readTablet; pending = false; selected = []; message = ''; G.dlgOpen = true; W.talkNpc = null; G.firing = false;
  for (const k in G.keys) G.keys[k] = false;
  render(); dlg.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export const openGateConsole = (g: WorldGate) => openDevice(g, false);
export const openGateTablet = (g: WorldGate) => openDevice(g, true);
/** Refresh the wall-clock countdown while the dialog is open; opening a menu never extends a connection. */
export function refreshGateConsole() {
  if (source && !tablet && G.dlgOpen && panel().querySelector('[data-gate-ui]') && renderedClock !== `${gateSecondsLeft(source.id)}:${pending}`) render();
}
export function gateConsoleClick(t: HTMLElement): boolean {
  if (!source || !G.dlgOpen || !panel().querySelector('[data-gate-ui]')) return false;
  if (t.closest('[data-gate-close]')) {
    session++; source = null; G.dlgOpen = false; dlg.style.display = 'none'; if (!G.isTouch) lockPointer(); return true;
  }
  if (tablet) return false;
  if (t.closest('[data-gate-reset]')) { if (!gateConnection(source.id) && !pending) { selected = []; message = ''; render(); } return true; }
  const key = t.closest<HTMLElement>('[data-gate-symbol]');
  if (key) {
    if (gateConnection(source.id) || pending) return true;
    if (selected.length === 3) selected = [];
    selected.push(Number(key.dataset.gateSymbol)); message = `${selected.length} / 3 symbols entered.`;
    if (selected.length === 3) {
      const current = source, token = session; pending = true; message = 'Connecting…';
      void dialWorldGate(current, [...selected]).then(result => {
        if (session !== token || source !== current || !G.dlgOpen || !panel().querySelector('[data-gate-ui]')) return;
        pending = false; message = result; render();
      });
    }
    render(); return true;
  }
  return false;
}
