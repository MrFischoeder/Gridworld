// The changelog window, opened from the main menu: every version of the game and what it brought (data/changelog.ts).
import { CHANGELOG } from '../data/changelog';
import { VERSION } from '../version';
import { $ } from './hud';

const box = $('changes'), list = $('changesList');
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);

export function openChangelog() {
  list.innerHTML = CHANGELOG.map((c) => `<section class="${c.v === VERSION ? 'now' : ''}">
    <h3><span class="v">v${c.v}</span> ${esc(c.title)} <span class="d">${c.date}</span></h3>
    <ul>${c.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></section>`).join('');
  box.style.display = 'flex';
  list.scrollTop = 0;
}
export function closeChangelog() { box.style.display = 'none'; }
export const changelogOpen = () => box.style.display === 'flex';

$('changesClose').onclick = closeChangelog;
// Esc closes the log before anything else sees the key
window.addEventListener('keydown', (e) => { if (changelogOpen() && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeChangelog(); } }, true);
