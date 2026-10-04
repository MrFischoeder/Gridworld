// Title / pause menu: play, roll a new world, wipe the character.
import { G } from '../game';
import { $, el, renderSheet } from './hud';
import { lockPointer } from './input';
import { newChar } from '../save';
import { calcStats, saveChar, handsChanged } from '../character';
import { openChangelog } from './changelog';
import { playIntro } from './intro';
import { renderer } from '../world/render';
import { mpLocked, refreshMp } from './mp';

const menu = $('menu'), startBtn = $('start'), wipeBtn = $('wipe'), nameIn = $<HTMLInputElement>('heroName'), nameHint = $('nameHint');
/** A name as the villagers will say it: trimmed, single spaces, letters, digits and a few marks, at most 20 characters. */
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} '\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
function showName() { nameIn.value = G.char.name; nameHint.textContent = G.char.name ? '' : 'Name your hero: everyone will call you by it.'; }

export interface MenuHooks {
  /** Start a fresh world with the given seed (character is kept). */
  newWorld(seed: number): void;
  /** The character was wiped; load the starting place. */
  freshStart(): void;
}

export function showMenu(resume = true) {
  G.playing = false; G.firing = false; menu.style.display = 'flex'; if (resume) startBtn.textContent = 'Resume'; showName(); renderSheet(); refreshMp();
}

export function initMenu(h: MenuHooks) {
  showName();
  nameIn.onchange = () => { const n = cleanName(nameIn.value); if (n) { G.char.name = n; saveChar(); } showName(); renderSheet(); };
  nameIn.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') startBtn.click(); };
  startBtn.onclick = () => {
    const n = cleanName(nameIn.value);
    if (!n) { nameHint.textContent = 'Your hero needs a name first.'; nameIn.focus(); return; }
    if (n !== G.char.name) { G.char.name = n; saveChar(); }
    const s = parseInt(el.seed.value, 10);
    if (Number.isFinite(s) && s !== G.char.world && !mpLocked()) h.newWorld(s); // (online, the host's world is everyone's)
    if (!G.isTouch) lockPointer();
    menu.style.display = 'none';
    if (G.char.intro) { G.playing = true; return; }
    // a new character: the opening first, then they wake in the wreck of their ship
    playIntro(() => {
      G.char.intro = true; saveChar();
      if (!G.isTouch && document.pointerLockElement !== renderer.domElement) { showMenu(); return; } // skipped with Esc: the pointer is free
      G.playing = true;
    });
  };
  $('replayCinematic').onclick = async () => { const film = await import('./cinematic'); film.playCinematic(() => showMenu(false)); };
  $('changelog').onclick = openChangelog;
  $('reroll').onclick = () => { if (mpLocked()) { nameHint.textContent = 'Leave the multiplayer game first: online, the host\'s world is everyone\'s.'; return; } h.newWorld((Math.random() * 1e6) | 0); startBtn.textContent = 'Play'; };
  let wipeArmed = false;
  wipeBtn.onclick = () => {
    if (!wipeArmed) { wipeArmed = true; wipeBtn.textContent = 'Click again to delete your character'; return; }
    wipeArmed = false; wipeBtn.textContent = 'New character';
    G.char = newChar(); calcStats(); handsChanged(); G.hp = G.S.maxHp; saveChar(); h.freshStart(); showName(); renderSheet(); nameIn.focus();
  };
}
