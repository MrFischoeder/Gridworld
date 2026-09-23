// Character rules: stats from level and equipped relics, inventory, XP.
import { G } from './game';
import { ITEMS, item, type ItemKey } from './data/items';
import { saveChar as persist } from './save';
import { showToast, logLine } from './ui/hud';
import { BLASTER, gunStats } from './data/weapons';

export const saveChar = () => persist(G.char);

export function calcStats() {
  const c = G.char, L = c.level - 1, r = (k: ItemKey) => c.mods.filter((m) => m === k).length;
  c.gunMods ??= [null, null, null];
  G.gun = gunStats(BLASTER, c.gunMods);
  G.ammo = Math.min(G.ammo, G.gun.mag);
  G.S = {
    maxHp: 100 + L * 15 + r('shield') * 20, bm: (1 + L * 0.12) * (1 + r('lens') * 0.25), mm: (1 + L * 0.12) * (1 + r('edge') * 0.25),
    range: 2.6 + r('edge') * 0.3, rate: G.gun.interval * Math.pow(0.9, r('cell')), speed: 1 + r('servo') * 0.08,
  };
  G.hp = Math.min(G.hp, G.S.maxHp);
}

/** Adds an item; new relics go straight into a free module. Returns where it went, or null when full. */
export function addItem(k: ItemKey, n = 1, quiet = false): 'mod' | 'inv' | null {
  const it = item(k), c = G.char;
  if (it.type === 'relic' && !quiet) { const free = c.mods.indexOf(null); if (free >= 0 && !c.mods.includes(k)) { c.mods[free] = k; calcStats(); return 'mod'; } }
  if (it.type === 'relic' && quiet) { const free = c.mods.indexOf(null); if (free >= 0) { c.mods[free] = k; return 'mod'; } }
  if (it.stack) { const s = c.inv.find((x) => x && x.k === k && x.n < it.stack!); if (s) { s.n += n; return 'inv'; } }
  const f = c.inv.indexOf(null); if (f < 0) return null;
  c.inv[f] = { k, n }; return 'inv';
}

export function takeOne(k: ItemKey): boolean {
  const c = G.char, i = c.inv.findIndex((x) => x && x.k === k); if (i < 0) return false;
  if (--c.inv[i]!.n <= 0) c.inv[i] = null; saveChar(); return true;
}
export const hasItem = (k: ItemKey) => G.char.inv.some((x) => x && x.k === k);

export const xpNeed = (lvl: number) => 40 + 30 * (lvl - 1);
export function gainXp(n: number) {
  const c = G.char;
  c.xp += n;
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level); c.level++; calcStats(); G.hp = G.S.maxHp;
    showToast('Level ' + c.level); logLine('+15 max HP, +12% damage');
  }
  saveChar();
}

export function giveLoot(k: ItemKey, n = 1) {
  const where = addItem(k, n);
  if (!where) { logLine('Backpack full: ' + ITEMS[k].name + ' lost'); return; }
  logLine(ITEMS[k].name + (where === 'mod' ? ' (equipped)' : ' → backpack')); if (item(k).type === 'relic') showToast(ITEMS[k].name);
  saveChar();
}

/** Current dungeon depth (1 on the surface). */
export const depth = () => G.char.dungeon?.depth ?? 1;
export const droneHp = () => 2 + Math.floor((depth() - 1) / 2);
export const droneDps = () => 16 + 3 * (depth() - 1);
/** Save key of the current dungeon sector: every ruin has its own network of sectors. */
export const dungeonKey = () => { const d = G.char.dungeon!; return d.ruinId + ':' + d.depth + ':' + d.gx + ':' + d.gz; };
/** Per-dungeon progress list (opened chests, unlocked doors, killed bosses). */
export function progress(which: 'opened' | 'unlocked' | 'killed'): number[] {
  const k = dungeonKey(), m = G.char[which];
  return (m[k] = m[k] || []);
}
export const progressHas = (which: 'opened' | 'unlocked' | 'killed', i: number) => (G.char[which][dungeonKey()] || []).includes(i);
