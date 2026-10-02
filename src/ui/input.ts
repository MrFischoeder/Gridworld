// Keyboard and mouse. Pointer lock drives mouse look; losing it pauses the game.
import { riding, rideSeat, toggleRideView } from '../world/ride';
import { isPlacing, cancelPlacing } from '../world/claims';
import { isBridgePlacing, cancelBridgePlacing } from '../world/bridges';
import { isPierPlacing, cancelPierPlacing } from '../world/piers';
import { inBoat, openBoatHold, toggleBoatView, toggleSail, refuel } from '../world/boats';
import { isBuilding, stopBuilding, dismantle } from '../world/building';
import { toggleBuildMenu } from './build';
import { G, uiOpen } from '../game';
import { closeTransfer } from './transfer';
import { closeService } from './service';
import { closeBoard } from './board';
import { toggleConsole } from './console';
import { openChat } from './mp';
import { online } from '../net/client';
import { driving, toggleCockpit, switchSeat } from '../world/vehicles';
import { renderer, camera } from '../world/render';
import { el } from './hud';
import { togglePack, closePack } from './backpack';
import { closeDialog } from './dialog';
import { interact, lockKey } from '../world/interact';
import { useItem } from '../world/loot';
import { drawBack, swapWeapon, holster, armed, reload } from '../world/weapons';
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
    if (e.code === 'KeyT' && G.playing && online()) { e.preventDefault(); openChat(); return; }
    if (G.mapOpen) { if (e.code === 'Escape') toggleMap(false); if (e.code === 'Equal' || e.code === 'NumpadAdd') zoomMap(1.25); if (e.code === 'Minus' || e.code === 'NumpadSubtract') zoomMap(0.8); }
    if (extraKeys.some((f) => f(e))) return;
    if (e.code === 'Escape' && isPlacing()) cancelPlacing();
    if (e.code === 'Escape' && isBridgePlacing()) cancelBridgePlacing();
    if (e.code === 'Escape' && isPierPlacing()) cancelPierPlacing();
    if (e.code === 'Escape' && isBuilding()) stopBuilding();
    if (e.code === 'KeyB' && G.playing) { toggleBuildMenu(); return; }
    G.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (!G.playing) return;
    if (e.code === 'KeyE' && !e.repeat) interact();
    if (e.code === 'KeyV' && driving.v) toggleCockpit();
    if (e.code === 'KeyV' && riding()) toggleRideView();
    if (e.code === 'KeyV' && inBoat()) toggleBoatView();
    if (e.code === 'Space' && !e.repeat && inBoat()) toggleSail();
    if (e.code === 'KeyF' && !isBuilding() && G.playing) openBoatHold();
    if (e.code === 'KeyH') useItem('medkit');
    if (e.code === 'KeyG') useItem('emp');
    const seatKey = e.code === 'Digit1' ? 0 : e.code === 'Digit2' ? 1 : e.code === 'Digit3' ? 2 : -1;
    if (seatKey >= 0 && (driving.v || riding())) { if (driving.v) switchSeat(seatKey); else rideSeat(seatKey); } // in a vehicle the numbers pick the seat
    else if (e.code === 'Digit1') drawBack(0);
    else if (e.code === 'Digit2') drawBack(1);
    if (e.code === 'KeyQ') swapWeapon();
    if (e.code === 'KeyX') holster();
    if (e.code === 'KeyF' && isBuilding()) dismantle();
    if (e.code === 'KeyL') lockKey();
    if (e.code === 'KeyR' && !refuel()) reload();
    if (e.code === 'F3') { e.preventDefault(); el.perf.style.display = el.perf.style.display === 'block' ? 'none' : 'block'; }
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('wheel', () => { if (G.playing && !uiOpen() && armed()) swapWeapon(); }, { passive: true });
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
