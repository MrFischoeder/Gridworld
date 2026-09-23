// Keyboard and mouse. Pointer lock drives mouse look; losing it pauses the game.
import { G, uiOpen } from '../game';
import { closeTransfer } from './transfer';
import { closeService } from './service';
import { closeBoard } from './board';
import { toggleConsole } from './console';
import { driving, toggleCockpit } from '../world/vehicles';
import { renderer, camera } from '../world/render';
import { el } from './hud';
import { togglePack, closePack } from './backpack';
import { closeDialog } from './dialog';
import { interact } from '../world/interact';
import { useItem } from '../world/loot';
import { setWeapon, armed, reload } from '../world/weapons';
import { toggleMap, zoomMap } from './worldmap';

export function lockPointer() {
  try { const r = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined; if (r && r.catch) r.catch(() => {}); } catch { /* not allowed right now */ }
}
/** Extra key handlers (e.g. the world map), checked before gameplay keys. Return true when handled. */
const extraKeys: ((e: KeyboardEvent) => boolean)[] = [];
export const onKey = (f: (e: KeyboardEvent) => boolean) => extraKeys.push(f);

export function initInput(onPause: () => void) {
  addEventListener('keydown', (e) => {
    if (e.target === el.seed) return;
    if (e.code === 'Backquote') { e.preventDefault(); toggleConsole(); return; }
    if (G.consoleOpen) return;
    if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if (!G.dlgOpen && !G.xferOpen) togglePack(); return; }
    if (G.packOpen) { if (e.code === 'Escape') closePack(); return; }
    if (G.dlgOpen) { if (e.code === 'Escape') closeDialog(); return; }
    if (G.xferOpen) { if (e.code === 'Escape' || e.code === 'KeyE') { closeTransfer(); closeService(); closeBoard(); } return; }
    if (e.code === 'KeyM' && G.playing) { toggleMap(); return; }
    if (G.mapOpen) { if (e.code === 'Escape') toggleMap(false); if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomMap(1.25); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomMap(0.8); }
    if (extraKeys.some((f) => f(e))) return;
    G.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (!G.playing) return;
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyV' && driving.v) toggleCockpit();
    if (e.code === 'KeyH') useItem('medkit');
    if (e.code === 'KeyG') useItem('emp');
    if (e.code === 'Digit1') setWeapon(0);
    if (e.code === 'Digit2') setWeapon(1);
    if (e.code === 'KeyQ') setWeapon(1 - G.weapon);
    if (e.code === 'KeyR') reload();
    if (e.code === 'F3') { e.preventDefault(); el.perf.style.display = el.perf.style.display === 'block' ? 'none' : 'block'; }
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('wheel', () => { if (G.playing && !uiOpen() && armed()) setWeapon(1 - G.weapon); }, { passive: true });
  renderer.domElement.addEventListener('click', () => { if (G.playing && !uiOpen() && !G.isTouch && !document.pointerLockElement) lockPointer(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement && !G.isTouch && !uiOpen()) onPause();
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    const s = 0.0022 * camera.fov / 75; // slower look while zoomed in
    G.yaw -= e.movementX * s; G.pitch -= e.movementY * s; G.pitch = Math.max(-1.5, Math.min(1.5, G.pitch));
  });
  addEventListener('mousedown', (e) => {
    if (!document.pointerLockElement) return;
    if (e.button === 0) G.firing = true;
    if (e.button === 2) G.aiming = true;
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) G.firing = false; if (e.button === 2) G.aiming = false; });
  addEventListener('contextmenu', (e) => { if (document.pointerLockElement) e.preventDefault(); });
}
