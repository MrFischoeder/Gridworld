// Keyboard and mouse. Pointer lock drives mouse look; losing it pauses the game.
import { G } from '../game';
import { renderer } from '../world/render';
import { el } from './hud';
import { togglePack, closePack } from './backpack';
import { closeDialog } from './dialog';
import { interact } from '../world/interact';
import { useItem } from '../world/loot';
import { setWeapon, armed } from '../world/weapons';

export function lockPointer() {
  try { const r = renderer.domElement.requestPointerLock() as unknown as Promise<void> | undefined; if (r && r.catch) r.catch(() => {}); } catch { /* not allowed right now */ }
}
/** Extra key handlers (e.g. the world map), checked before gameplay keys. Return true when handled. */
const extraKeys: ((e: KeyboardEvent) => boolean)[] = [];
export const onKey = (f: (e: KeyboardEvent) => boolean) => extraKeys.push(f);

export function initInput(onPause: () => void) {
  addEventListener('keydown', (e) => {
    if (e.target === el.seed) return;
    if (e.code === 'KeyI' || e.code === 'Tab') { e.preventDefault(); if (!G.dlgOpen) togglePack(); return; }
    if (G.packOpen) { if (e.code === 'Escape') closePack(); return; }
    if (G.dlgOpen) { if (e.code === 'Escape') closeDialog(); return; }
    if (extraKeys.some((f) => f(e))) return;
    G.keys[e.code] = true;
    if (e.code === 'Space') e.preventDefault();
    if (!G.playing) return;
    if (e.code === 'KeyE') interact();
    if (e.code === 'KeyH') useItem('medkit');
    if (e.code === 'KeyG') useItem('emp');
    if (e.code === 'Digit1') setWeapon(0);
    if (e.code === 'Digit2') setWeapon(1);
    if (e.code === 'KeyQ') setWeapon(1 - G.weapon);
    if (e.code === 'F3') { e.preventDefault(); el.perf.style.display = el.perf.style.display === 'block' ? 'none' : 'block'; }
  });
  addEventListener('keyup', (e) => { G.keys[e.code] = false; });
  addEventListener('wheel', () => { if (G.playing && !G.packOpen && !G.dlgOpen && armed()) setWeapon(1 - G.weapon); }, { passive: true });
  renderer.domElement.addEventListener('click', () => { if (G.playing && !G.packOpen && !G.dlgOpen && !G.isTouch && !document.pointerLockElement) lockPointer(); });
  document.addEventListener('pointerlockchange', () => {
    if (document.pointerLockElement !== renderer.domElement && !G.isTouch && !G.packOpen && !G.dlgOpen) onPause();
  });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement !== renderer.domElement) return;
    G.yaw -= e.movementX * 0.0022; G.pitch -= e.movementY * 0.0022; G.pitch = Math.max(-1.5, Math.min(1.5, G.pitch));
  });
  addEventListener('mousedown', (e) => { if (e.button === 0 && document.pointerLockElement) G.firing = true; });
  addEventListener('mouseup', (e) => { if (e.button === 0) G.firing = false; });
}
