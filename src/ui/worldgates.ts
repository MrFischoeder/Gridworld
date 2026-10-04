import { G, W } from '../game';
import { GATE_GLYPHS } from '../data/gates';
import { tabletDestinations, gateName, GATE_SECONDS, type WorldGate } from '../gen/worldgates';
import { dialWorldGate, setGateDraft, gateDialSymbols, gateConnection, gateSecondsLeft, nearGatePanel, nearGateTablet } from '../world/worldgates';
import { $ } from './hud';
import { lockPointer } from './input';

const dlg = $('dlg'), panel = () => dlg.querySelector('.panel') as HTMLElement;
let source: WorldGate | null = null, selected: number[] = [], message = '', tablet = false, pending = false, renderedClock = '';
let session = 0;
function glyphSVG(id: number, size = 36): string {
  const glyph = GATE_GLYPHS[id];
  return `<svg width="${size}" height="${size}" viewBox="-1.25 -1.25 2.5 2.5" role="img" aria-label="Symbol ${id + 1}"><g transform="scale(1,-1)" fill="none" stroke="currentColor" stroke-width=".10" stroke-linejoin="round" stroke-linecap="round">${glyph.paths.map(p => `<polyline points="${p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('')}</g></svg>`;
}
const address = (a: readonly number[]) => `<span class="gate-address">${a.map(i => glyphSVG(i, 26)).join('')}</span>`;
function render() {
  if (!source) return;
  const link = gateConnection(source.id), locked = !!link || pending;
  renderedClock = clockKey();
  panel().classList.add('wide');
  if (tablet) {
    panel().innerHTML = `<div class="gate-ui" data-gate-ui><h2>ANCIENT ADDRESS TABLET</h2><p>Three addresses are permanently engraved in this stone. Use the console beside the ring to enter them.</p><div class="gate-tablet-addresses">${tabletDestinations(G.char.world, source).map(g => `<div><b>${gateName(g)}</b>${address(g.address)}</div>`).join('')}</div><button class="opt" data-gate-close>Leave tablet</button></div>`;
    return;
  }
  const entries = link ? gateDialSymbols(source.id) : selected;
  panel().innerHTML = `<div class="gate-ui" data-gate-ui><h2>${gateName(source).toUpperCase()}</h2>` +
    `<div class="gate-local">THIS GATE'S ADDRESS ${address(source.address)}</div>` +
    `<p>Select three symbols in order, then press Activate. Cancel clears the entered address. Repeated symbols are allowed. A nearby stone tablet holds three destinations. Connections last ${GATE_SECONDS} real seconds, even in menus. Walk or drive through the ring for a five-second journey.</p>` +
    (link && source.id === link.b ? `<div class="gate-local">INCOMING ADDRESS ${address(gateDialSymbols(source.id))}</div>` : '') +
    `<div class="gate-entry" aria-label="Entered address">${[0, 1, 2].map(i => `<span>${entries[i] === undefined ? '—' : glyphSVG(entries[i], 46)}</span>`).join('')}</div>` +
    `<div class="gate-keys">${GATE_GLYPHS.map((_, i) => `<button type="button" data-gate-symbol="${i}" aria-label="Symbol ${i + 1}"${locked ? ' disabled' : ''}>${glyphSVG(i, 48)}</button>`).join('')}</div>` +
    `<p class="gate-message" role="status">${link ? connectionMessage(source) : message || 'Enter an address found on a stone tablet.'}</p>` +
    `<div class="gate-actions"><button class="opt" data-gate-activate${locked || selected.length !== 3 ? ' disabled' : ''}>Activate</button>` +
    `<button class="opt" data-gate-reset${locked ? ' disabled' : ''}>Cancel</button></div>` +
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
function connectionMessage(g: WorldGate) {
  const link = gateConnection(g.id); if (!link) return '';
  const destination = gateName({ id: link.a === g.id ? link.b : link.a }), left = gateSecondsLeft(g.id);
  return `Connected to ${destination}. BOTH TERMINALS LOCKED · ${left ? `${left}s remaining.` : 'Transport finishing.'}`;
}
function clockKey() { const link = source && gateConnection(source.id); return `${source ? gateSecondsLeft(source.id) : 0}:${pending}:${link?.a}:${link?.inTransit ?? 0}`; }
/** Refresh the wall-clock countdown while the dialog is open; opening a menu never extends a connection. */
export function refreshGateConsole() {
  if (source && (!G.dlgOpen || !panel().querySelector('[data-gate-ui]'))) {
    if (!tablet) setGateDraft(source.id, []);
    session++; source = null; pending = false; return;
  }
  if (source && !tablet && renderedClock !== clockKey()) {
    // Update the countdown in place so a refresh cannot detach a button under the player's mouse.
    if (gateConnection(source.id) && !pending && panel().querySelector<HTMLButtonElement>('[data-gate-symbol]')?.disabled) {
      renderedClock = clockKey(); const status = panel().querySelector('.gate-message');
      if (status) status.textContent = connectionMessage(source);
    } else render();
  }
}
export function gateConsoleClick(t: HTMLElement): boolean {
  if (!source || !G.dlgOpen || !panel().querySelector('[data-gate-ui]')) return false;
  if (t.closest('[data-gate-close]')) {
    if (!tablet) setGateDraft(source.id, []);
    session++; source = null; G.dlgOpen = false; dlg.style.display = 'none'; if (!G.isTouch) lockPointer(); return true;
  }
  if (tablet) return false;
  if (t.closest('[data-gate-reset]')) { if (!gateConnection(source.id) && !pending) { selected = []; setGateDraft(source.id, []); message = ''; render(); } return true; }
  if (t.closest('[data-gate-activate]')) {
    if (gateConnection(source.id) || pending || selected.length !== 3) return true;
    const current = source, token = session; pending = true; message = 'Connecting…'; render();
    void dialWorldGate(current, [...selected]).then(result => {
      if (session !== token || source !== current || !G.dlgOpen || !panel().querySelector('[data-gate-ui]')) return;
      pending = false; message = result; render();
    });
    return true;
  }
  const key = t.closest<HTMLElement>('[data-gate-symbol]');
  if (key) {
    if (gateConnection(source.id) || pending || selected.length === 3) return true;
    selected.push(Number(key.dataset.gateSymbol)); setGateDraft(source.id, selected);
    message = `${selected.length} / 3 symbols entered.`; render(); return true;
  }
  return false;
}
