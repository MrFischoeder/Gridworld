// Title / pause menu: play, roll a new world, wipe the character.
import { newWorldSeed } from '../gen/worldrules';
import { G } from '../game';
import { $, el, renderSheet } from './hud';
import { lockPointer } from './input';
import { newChar } from '../save';
import { calcStats, saveChar, handsChanged } from '../character';
import { openChangelog } from './changelog';
import { playIntro } from './intro';
import { renderer } from '../world/render';
import { mpLocked, refreshMp, showMpBox, mpShown, onMpChange, soloWaiting, backToOwnWorld } from './mp';
import { online, sendHero } from '../net/client';
import { nameProblem } from './rebirth';

const menu = $('menu'), startBtn = $('start'), mpBtn = $('mpOpen'), wipeBtn = $('wipe'), nameIn = $<HTMLInputElement>('heroName'), nameHint = $('nameHint');
/** A name as the villagers will say it: trimmed, single spaces, letters, digits and a few marks, at most 20 characters. */
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} '\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
function showName() { nameIn.value = G.char.name; nameHint.textContent = G.char.name ? '' : 'Name your hero: everyone will call you by it.'; }

export interface MenuHooks {
  /** A new game in the world with this seed: a new castaway (only the name is kept), the opening and Wiktor again. */
  newWorld(seed: number): void;
  /** The character was wiped; load the starting place. */
  freshStart(): void;
}

/** Paused mid-game (the first button resumes) rather than at the title. */
let paused = false;
/** A typed seed asks once before it starts a new game. */
let seedArmed = false;
/** The first button: Single player at the title, Play online once connected, Resume when paused. */
function labels() {
  startBtn.textContent = paused ? 'Resume' : online() ? 'Play online' : 'Single player';
  mpBtn.classList.toggle('on', mpShown());
  menu.classList.toggle('mp', mpShown()); // the blurb, keys and seed step aside for the server list
}
export function showMenu(resume = true) {
  G.playing = false; G.firing = false; menu.style.display = 'flex'; if (resume) paused = true; showName(); renderSheet(); refreshMp(); labels();
}

export function initMenu(h: MenuHooks) {
  showName();
  nameIn.onchange = () => {
    const n = cleanName(nameIn.value);
    if (n && online() && n !== G.char.name) { // online the server checks it too: the dead keep their names, the living theirs
      const why = nameProblem(n);
      if (why) { showName(); nameHint.textContent = why; return; }
      G.char.name = n; saveChar(); sendHero(n);
    } else if (n) { G.char.name = n; saveChar(); }
    showName(); renderSheet();
  };
  nameIn.onkeydown = (e) => { e.stopPropagation(); if (e.key === 'Enter') startBtn.click(); };
  startBtn.onclick = () => {
    const n = cleanName(nameIn.value);
    if (!n) { nameHint.textContent = 'Your hero needs a name first.'; nameIn.focus(); return; }
    if (n !== G.char.name) { if (online() && nameProblem(n)) { nameHint.textContent = nameProblem(n); return; } G.char.name = n; saveChar(); if (online()) sendHero(n); }
    if (!paused && !online() && soloWaiting()) { backToOwnWorld(); return; } // single player is your own world: the save that waited while you were online
    const s = parseInt(el.seed.value, 10);
    if (Number.isFinite(s) && s !== G.char.world && !mpLocked()) { // another seed is a new game (online, the host's world is everyone's)
      if (!seedArmed) { seedArmed = true; nameHint.textContent = `World ${s} is a new game: your kit, quests and the town start over. Press again to begin.`; return; }
      seedArmed = false; h.newWorld(s);
    }
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
  mpBtn.onclick = () => showMpBox();
  onMpChange(labels);
  $('replayCinematic').onclick = async () => { const film = await import('./cinematic'); film.playCinematic(() => showMenu(false)); };
  $('changelog').onclick = openChangelog;
  const reroll = $('reroll'), rerollText = reroll.textContent;
  let rerollArmed = false;
  reroll.onclick = () => {
    if (mpLocked()) { nameHint.textContent = 'Leave the multiplayer game first: online, the host\'s world is everyone\'s.'; return; }
    if (!rerollArmed) { rerollArmed = true; reroll.textContent = 'Click again: a new game from the start'; return; } // a new map is a new game
    rerollArmed = false; reroll.textContent = rerollText;
    h.newWorld(newWorldSeed()); paused = false; labels(); showName(); renderSheet();
  };
  let wipeArmed = false;
  wipeBtn.onclick = () => {
    if (!wipeArmed) { wipeArmed = true; wipeBtn.textContent = 'Click again to delete your character'; return; }
    wipeArmed = false; wipeBtn.textContent = 'New character';
    G.char = newChar(); calcStats(); handsChanged(); G.hp = G.S.maxHp; saveChar(); h.freshStart(); showName(); renderSheet(); nameIn.focus();
  };
}
