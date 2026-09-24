// Title / pause menu: play, roll a new world, wipe the character.
import { G } from '../game';
import { $, el, renderSheet } from './hud';
import { lockPointer } from './input';
import { newChar } from '../save';
import { calcStats, saveChar } from '../character';
import { openChangelog } from './changelog';

const menu = $('menu'), startBtn = $('start'), wipeBtn = $('wipe');

export interface MenuHooks {
  /** Start a fresh world with the given seed (character is kept). */
  newWorld(seed: number): void;
  /** The character was wiped; load the starting place. */
  freshStart(): void;
}

export function showMenu() {
  G.playing = false; G.firing = false; menu.style.display = 'flex'; startBtn.textContent = 'Resume'; renderSheet();
}

export function initMenu(h: MenuHooks) {
  startBtn.onclick = () => {
    const s = parseInt(el.seed.value, 10);
    if (Number.isFinite(s) && s !== G.char.world) h.newWorld(s);
    if (!G.isTouch) lockPointer();
    G.playing = true; menu.style.display = 'none';
  };
  $('changelog').onclick = openChangelog;
  $('reroll').onclick = () => { h.newWorld((Math.random() * 1e6) | 0); startBtn.textContent = 'Play'; };
  let wipeArmed = false;
  wipeBtn.onclick = () => {
    if (!wipeArmed) { wipeArmed = true; wipeBtn.textContent = 'Click again to delete your character'; return; }
    wipeArmed = false; wipeBtn.textContent = 'New character';
    G.char = newChar(); calcStats(); G.hp = G.S.maxHp; saveChar(); h.freshStart();
  };
}
