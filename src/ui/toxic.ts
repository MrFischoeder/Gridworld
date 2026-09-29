// The toxic fog on the HUD (world/toxic.ts): a green haze at the screen's edges while you are in the fog, and a
// line under the bars: how thick it is, and the mask's filter (what is left of it and the spares), or a warning.
import { G } from '../game';

let box: HTMLDivElement | null = null, haze: HTMLDivElement | null = null;
function make() {
  box = document.createElement('div'); box.id = 'toxbar'; document.body.appendChild(box);
  haze = document.createElement('div'); haze.id = 'toxhaze'; document.body.appendChild(haze);
}
export interface ToxicShow { d: number; masked: boolean; filter: number; spares: number }
let last = '';
/** Show the fog's state (null: clean air, hidden). */
export function showToxic(s: ToxicShow | null) {
  if (!box) { if (!s) return; make(); }
  const show = !!s && G.playing && !document.body.classList.contains('intro');
  box!.style.display = show ? 'block' : 'none';
  haze!.style.opacity = show ? String(Math.min(0.85, s!.d * 0.9)) : '0';
  if (!show) return;
  const d = Math.round(s!.d * 100), ok = s!.masked && s!.filter > 0;
  const bar = (v: number) => '█'.repeat(Math.round(v * 10)) + '░'.repeat(10 - Math.round(v * 10));
  const t = `TOXIC FOG ${d}% · ` + (!s!.masked ? 'NO MASK: GET OUT' : s!.filter <= 0 ? 'FILTER SPENT' : `FILTER ${bar(s!.filter)} ${Math.round(s!.filter * 100)}%`) + (s!.masked ? ` · spares ${s!.spares}` : '');
  if (t !== last) { box!.textContent = t; last = t; }
  box!.className = s!.d <= 0.08 ? 'faint' : ok ? (s!.filter < 0.25 ? 'low' : '') : 'bad';
}
