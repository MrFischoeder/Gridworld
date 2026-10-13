// (0.190) The game speaks two languages, English and Polish (the owner's standing rule: every player-visible text
// exists in both). Texts are written in English in the code and go through `'...'` (a plain string) or
// TL`... ${x} ...` (a template: its key is the text with {0}, {1}... where the values go); the Polish for each key is in
// i18n/pl.ts. A key with no Polish falls back to the English (tests/i18n.test.ts checks every key has one).
//
// The language is the player's own (localStorage 'gridWorld.lang', chosen in the main menu; changing it reloads the
// page), so it is read once here, before any other module builds its texts. Pure: no DOM; without storage (tests,
// workers, the server) it is English.
import { PL } from './i18n/pl';

export type Lang = 'en' | 'pl';
export const LANGS: Lang[] = ['en', 'pl'];
export const LANG_NAME: Record<Lang, string> = { en: 'English', pl: 'Polski' };
const KEY = 'gridWorld.lang';
function stored(): Lang {
  try { const v = (globalThis as { localStorage?: Storage }).localStorage?.getItem(KEY); return v === 'pl' ? 'pl' : 'en'; } catch { return 'en'; }
}
/** The language the game runs in (fixed until the page reloads). */
export const lang: Lang = stored();
/** Save another language for the next start (the menu reloads the page after it). */
export function saveLang(l: Lang) {
  try { (globalThis as { localStorage?: Storage }).localStorage?.setItem(KEY, l); } catch { /* storage blocked: stays English */ }
}
const dict: Record<string, string> | null = lang === 'pl' ? PL : null;
/** A plain text in the player's language. */
export function tl(s: string): string {
  return dict && Object.hasOwn(dict, s) ? dict[s] : s;
}
/** The key a template makes: its parts joined by {0}, {1}... */
export const keyOf = (parts: readonly string[]) => parts.reduce((a, p, i) => (i ? a + '{' + (i - 1) + '}' + p : p), '');
/** A template text in the player's language: TL`Took ${n} crates.` → the Polish of 'Took {0} crates.' with n put in. */
export function TL(parts: TemplateStringsArray, ...vals: unknown[]): string {
  const k = keyOf(parts.raw.map((r, i) => parts[i] ?? r));
  const s = dict && Object.hasOwn(dict, k) ? dict[k] : k;
  return s.replace(/\{(\d+)\}/g, (m, i) => (+i < vals.length ? String(vals[+i]) : m));
}
/** The eight compass directions, in the player's language ('north', 'north-east'... from the north clockwise). */
export const DIR8: string[] = [tl('north'), tl('north-east'), tl('east'), tl('south-east'), tl('south'), tl('south-west'), tl('west'), tl('north-west')];
