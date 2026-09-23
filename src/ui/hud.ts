// HUD: bars, toast, log lines, interaction prompt, boss bar.
import { G } from '../game';
import { xpNeed } from '../character';
import { ITEMS, type ItemKey } from '../data/items';

export const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
export const el = {
  cross: $('cross'), hudR: $('hudR'), hudL: $('hudL'), wname: $('wname'), hpfill: $('hpfill'), dmg: $('dmg'),
  toast: $('toast'), seed: $<HTMLInputElement>('seed'), xpfill: $('xpfill'), lvl: $('lvl'), prompt: $('prompt'), bUse: $('bUse'),
  warp: $('warp'), route: $('route'), bossbar: $('bossbar'), bossName: $('bossname'), bossFill: $('bossfill'), log: $('log'),
  sheet: $('sheet'), perf: $('perf'), veh: $('veh'),
};

let toastT = 0;
export function showToast(s: string) { el.toast.textContent = s; el.toast.style.opacity = '1'; toastT = 1.6; }

const logLines: { t: string; life: number }[] = [];
export function logLine(t: string) { logLines.push({ t, life: 4 }); }

export function renderSheet() {
  const c = G.char, names = c.mods.filter((k): k is ItemKey => !!k).map((k) => ITEMS[k].name);
  const d = c.dungeon, where = d ? 'Depth ' + d.depth + ', sector ' + d.gx + ', ' + d.gz + '. ' : el.hudL.textContent + '. ';
  el.sheet.innerHTML = where + 'Level ' + c.level + ', XP ' + c.xp + '/' + xpNeed(c.level) + ', gold ' + c.gold +
    '<div style="color:var(--gold);font-size:20px;margin-top:4px">' + (names.length ? 'Modules: ' + names.join(', ') : 'No relics equipped') + '</div>';
}

export function updateHud(dt: number) {
  G.hitFlash -= dt; el.cross.classList.toggle('hit', G.hitFlash > 0);
  G.dmgFlash -= dt; el.dmg.style.opacity = String(Math.max(0, G.dmgFlash * 3));
  toastT -= dt; if (toastT <= 0) el.toast.style.opacity = '0';
  el.hpfill.style.width = Math.max(0, G.hp / G.S.maxHp * 100) + '%';
  el.hpfill.style.background = G.hp < G.S.maxHp * 0.35 ? 'var(--amber)' : 'var(--g)';
  el.xpfill.style.width = (G.char.xp / xpNeed(G.char.level) * 100) + '%'; el.lvl.textContent = 'Level ' + G.char.level;
  el.hudR.textContent = 'Gold: ' + G.char.gold;
  for (let i = logLines.length - 1; i >= 0; i--) { logLines[i].life -= dt; if (logLines[i].life <= 0) logLines.splice(i, 1); }
  el.log.innerHTML = logLines.slice(-5).map((l) => l.t).join('<br>');
}
