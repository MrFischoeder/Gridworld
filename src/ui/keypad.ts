// The code lock keypad: four digits, typed with the number keys or clicked, Backspace / C to clear, Enter / OK to
// send, Esc to close. The caller decides what a code does (set it, open the door) and which extra buttons there are.
import { G } from '../game';
import { $ } from './hud';
import { lockPointer } from './input';

export interface KeypadSpec {
  title: string; sub: string;
  /** A full 4-digit code was entered: return a message to stay open (wrong code...), or '' to close. */
  enter(code: string): string;
  /** Extra buttons under the keys: label and what it does (return a message to stay open, '' to close). */
  acts?: [string, () => string][];
}
const el = { root: $('keypad'), title: $('kpTitle'), sub: $('kpSub'), show: $('kpShow'), keys: $('kpKeys'), msg: $('kpMsg'), acts: $('kpActs') };
let spec: KeypadSpec | null = null, code = '';

el.keys.innerHTML = [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button data-k="${n}">${n}</button>`).join('') +
  '<button data-k="C">C</button><button data-k="0">0</button><button class="ok" data-k="OK">OK</button>';
const show = () => { el.show.textContent = (code + '____').slice(0, 4); };
function press(k: string) {
  if (!spec) return;
  if (k === 'C') code = '';
  else if (k === 'OK') { if (code.length < 4) { el.msg.textContent = 'Four digits.'; return; } const m = spec.enter(code); code = ''; if (m) el.msg.textContent = m; else closeKeypad(); }
  else if (code.length < 4) code += k;
  show();
}
el.keys.addEventListener('click', (e) => { const b = (e.target as HTMLElement).closest<HTMLElement>('[data-k]'); if (b) press(b.dataset.k!); });
el.acts.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLElement>('[data-i]');
  if (!b || !spec?.acts) return;
  const m = spec.acts[+b.dataset.i!][1](); if (m) el.msg.textContent = m; else closeKeypad();
});
window.addEventListener('keydown', (e) => {
  if (!spec) return;
  e.stopImmediatePropagation(); e.preventDefault();
  if (/^Digit\d$|^Numpad\d$/.test(e.code)) press(e.code.slice(-1));
  else if (e.code === 'Backspace') { code = code.slice(0, -1); show(); }
  else if (e.code === 'Enter' || e.code === 'NumpadEnter') press('OK');
  else if (e.code === 'Escape') closeKeypad();
}, true);

export function openKeypad(s: KeypadSpec) {
  if (spec) return;
  spec = s; code = ''; G.dlgOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  el.title.textContent = s.title; el.sub.textContent = s.sub; el.msg.textContent = '';
  el.acts.innerHTML = (s.acts ?? []).map(([t], i) => `<button data-i="${i}">${t}</button>`).join('');
  show(); el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeKeypad() {
  if (!spec) return;
  spec = null; G.dlgOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
