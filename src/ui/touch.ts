// Touch controls: left-side joystick, drag to look, on-screen buttons.
import { G, uiOpen } from '../game';
import { renderer } from '../world/render';
import { $ } from './hud';
import { togglePack } from './backpack';
import { interact } from '../world/interact';
import { setWeapon } from '../world/weapons';

export function initTouch() {
  if (G.isTouch) document.body.classList.add('is-touch');
  const { stick, look } = G, knob = $('knob'), stickEl = $('stick');
  const bindBtn = (id: string, down: () => void, up: () => void) => {
    const b = $(id);
    b.addEventListener('touchstart', (e) => { e.preventDefault(); e.stopPropagation(); down(); }, { passive: false });
    b.addEventListener('touchend', (e) => { e.preventDefault(); e.stopPropagation(); up(); }, { passive: false });
  };
  bindBtn('bFire', () => (G.firing = true), () => (G.firing = false));
  bindBtn('bJump', () => (G.touchJump = true), () => (G.touchJump = false));
  bindBtn('bSwap', () => setWeapon(1 - G.weapon), () => {});
  bindBtn('bUse', interact, () => {});
  bindBtn('bPack', togglePack, () => {});
  const moveStick = (t: Touch) => {
    let dx = t.clientX - stick.x, dy = t.clientY - stick.y; const m = Math.hypot(dx, dy), max = 50;
    if (m > max) { dx *= max / m; dy *= max / m; }
    stick.dx = dx / max; stick.dy = dy / max; knob.style.transform = `translate(${dx}px,${dy}px)`;
  };
  const cv = renderer.domElement;
  cv.addEventListener('touchstart', (e) => {
    if (!G.playing || uiOpen()) return; e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.clientX < innerWidth * 0.45 && stick.id === null) {
        stick.id = t.identifier; const r = stickEl.getBoundingClientRect();
        stick.x = r.left + r.width / 2; stick.y = r.top + r.height / 2; moveStick(t);
      } else if (look.id === null) { look.id = t.identifier; look.x = t.clientX; look.y = t.clientY; }
    }
  }, { passive: false });
  cv.addEventListener('touchmove', (e) => {
    e.preventDefault();
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) moveStick(t);
      else if (t.identifier === look.id) {
        G.yaw -= (t.clientX - look.x) * 0.006; G.pitch -= (t.clientY - look.y) * 0.006;
        G.pitch = Math.max(-1.5, Math.min(1.5, G.pitch)); look.x = t.clientX; look.y = t.clientY;
      }
    }
  }, { passive: false });
  const endTouch = (e: TouchEvent) => {
    for (const t of e.changedTouches) {
      if (t.identifier === stick.id) { stick.id = null; stick.dx = stick.dy = 0; knob.style.transform = ''; }
      if (t.identifier === look.id) look.id = null;
    }
  };
  cv.addEventListener('touchend', endTouch);
  cv.addEventListener('touchcancel', endTouch);
}
