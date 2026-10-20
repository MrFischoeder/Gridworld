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
import { customWorlds, worldAsked } from '../world/custommaps';
import { customSeed } from '../gen/customworld';
import { tl, TL, lang, LANGS, LANG_NAME, saveLang, type Lang } from '../i18n';

const menu = $('menu'), startBtn = $('start'), mpBtn = $('mpOpen'), wipeBtn = $('wipe'), nameIn = $<HTMLInputElement>('heroName'), nameHint = $('nameHint');
/** A name as the villagers will say it: trimmed, single spaces, letters, digits and a few marks, at most 20 characters. */
export const cleanName = (s: string) => s.replace(/[^\p{L}\p{N} '\-.]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 20);
function showName() { nameIn.value = G.char.name; nameHint.textContent = G.char.name ? '' : tl('Name your hero: everyone will call you by it.'); }

export interface MenuHooks {
  /** A new game in the world with this seed: a new castaway (only the name is kept), the opening and Wiktor again. */
  newWorld(seed: number, cw?: string): void;
  /** The character was wiped; load the starting place. */
  freshStart(): void;
}

/** Paused mid-game (the first button resumes) rather than at the title. */
let paused = false;
/** A typed seed asks once before it starts a new game. */
let seedArmed = false;
/** The first button: Single player at the title, Play online once connected, Resume when paused. */
function labels() {
  startBtn.textContent = paused ? tl('Resume') : online() ? tl('Play online') : tl('Single player');
  mpBtn.classList.toggle('on', mpShown());
  menu.classList.toggle('mp', mpShown()); // the blurb, keys and seed step aside for the server list
}
export function showMenu(resume = true) {
  G.playing = false; G.firing = false; menu.style.display = 'flex'; if (resume) paused = true; showName(); renderSheet(); refreshMp(); labels(); listWorlds();
}
/** (0.208) The worlds drawn in the map editor of this browser: pick one and play a new game on it. */
const cwRow = $('cwRow'), cwPick = $<HTMLSelectElement>('cwPick'), cwPlay = $('cwPlay');
let cwAsked = worldAsked;
function listWorlds() {
  const names = Object.keys(customWorlds()).sort(), was = cwAsked || cwPick.value || G.char.cw;
  cwRow.style.display = names.length ? '' : 'none';
  cwPick.replaceChildren(...names.map((n) => { const o = document.createElement('option'); o.value = n; o.textContent = n + (n === G.char.cw ? tl(' (playing)') : ''); return o; }));
  if (was && names.includes(was)) cwPick.value = was;
  if (cwAsked && names.includes(cwAsked)) nameHint.textContent = TL`The editor sent you ${cwAsked}: press Play on an editor world to start a new game on it.`;
  cwAsked = null;
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
    if (!n) { nameHint.textContent = tl('Your hero needs a name first.'); nameIn.focus(); return; }
    if (n !== G.char.name) { if (online() && nameProblem(n)) { nameHint.textContent = nameProblem(n); return; } G.char.name = n; saveChar(); if (online()) sendHero(n); }
    if (!paused && !online() && soloWaiting()) { backToOwnWorld(); return; } // single player is your own world: the save that waited while you were online
    const s = parseInt(el.seed.value, 10);
    if (Number.isFinite(s) && s !== G.char.world && !mpLocked()) { // another seed is a new game (online, the host's world is everyone's)
      if (!seedArmed) { seedArmed = true; nameHint.textContent = TL`World ${s} is a new game: your kit, quests and the town start over. Press again to begin.`; return; }
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
  $('mapEditor').onclick = () => window.open('editor.html', '_blank'); // (0.207) the map editor, in its own tab
  $('faunaGallery').onclick = () => window.open('fauna.html', '_blank', 'noopener');
  let cwArmed = '';
  cwPlay.onclick = () => {
    const n = cwPick.value;
    if (!n) return;
    if (mpLocked()) { nameHint.textContent = tl('Leave the multiplayer game first: online, the host\'s world is everyone\'s.'); return; }
    if (cwArmed !== n) { cwArmed = n; nameHint.textContent = TL`${n} is a new game: your kit, quests and the town start over. Press again to begin.`; return; }
    cwArmed = ''; nameHint.textContent = '';
    h.newWorld(customSeed(n), n); paused = false; labels(); showName(); renderSheet(); listWorlds();
  };
  const reroll = $('reroll'), rerollText = reroll.textContent;
  let rerollArmed = false;
  reroll.onclick = () => {
    if (mpLocked()) { nameHint.textContent = tl('Leave the multiplayer game first: online, the host\'s world is everyone\'s.'); return; }
    if (!rerollArmed) { rerollArmed = true; reroll.textContent = tl('Click again: a new game from the start'); return; } // a new map is a new game
    rerollArmed = false; reroll.textContent = rerollText;
    h.newWorld(newWorldSeed()); paused = false; labels(); showName(); renderSheet();
  };
  let wipeArmed = false;
  wipeBtn.onclick = () => {
    if (!wipeArmed) { wipeArmed = true; wipeBtn.textContent = tl('Click again to delete your character'); return; }
    wipeArmed = false; wipeBtn.textContent = tl('New character');
    G.char = newChar(); calcStats(); handsChanged(); G.hp = G.S.maxHp; saveChar(); h.freshStart(); showName(); renderSheet(); nameIn.focus();
  };
}

// (0.190) The language: English or Polish, the player's own (not shared online). Changing it saves the game, keeps
// the choice in this browser and reloads the page straight to the menu.
const langRow = $('langRow');
langRow.innerHTML = LANGS.map((l) => `<button data-lang="${l}"${l === lang ? ' class="on"' : ''}>${LANG_NAME[l]}</button>`).join('');
langRow.addEventListener('click', (e) => {
  const l = (e.target as HTMLElement).closest<HTMLElement>('[data-lang]')?.dataset.lang as Lang | undefined;
  if (!l || l === lang) return;
  try { if (G.char) saveChar(); } catch { /* nothing to save yet */ }
  saveLang(l);
  try { sessionStorage.setItem('gridWorld.noFilm', '1'); } catch { /* storage blocked */ }
  location.reload();
});
