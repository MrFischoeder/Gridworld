// Character rules: stats from level and equipped relics, inventory, XP.
import { G } from './game';
import { ITEMS, PACK, item, BULK, WEAR, WEAPON_KIND, HANDS_ONLY, type ItemKey } from './data/items';
import { roomFor, weightOf, putSlot } from './inventory';
import type { Slot } from './save';
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
    def: 1 - Object.values(c.wear).reduce((a, k) => a * (1 - (k ? WEAR[k]?.def ?? 0 : 0)), 1),
  };
  G.hp = Math.min(G.hp, G.S.maxHp);
}

/** A hit on the player after worn armour took its share off. */
export const armoured = (dmg: number) => dmg * (1 - G.S.def);
/** Everything you carry (kg): the backpack, your hands, your back and what you wear. */
export function carriedKg(): number {
  const c = G.char;
  return weightOf(c.inv) + weightOf(c.hands) + weightOf(c.back) + Object.values(c.wear).reduce((a, k) => a + (k ? BULK[k][0] : 0), 0);
}

// ---------- hands and back ----------
/** The slot lists by slot-id prefix: p = backpack, h = hands (one slot), k = back (two slots, weapons only). */
export const listOf = (w: string): (Slot | null)[] => (w === 'h' ? G.char.hands : w === 'k' ? G.char.back : G.char.inv);
export const held = () => G.char.hands[0];
/** Called whenever what you hold may have changed (world/weapons.ts shows the right weapon). */
let handsHook = () => {};
export const onHandsChanged = (f: () => void) => { handsHook = f; };
export const handsChanged = () => handsHook();
/** Free your hands: a weapon goes onto your back (or into the backpack), anything else into the backpack. */
export function stowHeld(): string {
  const c = G.char, s = c.hands[0];
  if (!s) return '';
  if (WEAPON_KIND[s.k] !== undefined) { const f = c.back.indexOf(null); if (f >= 0) { c.back[f] = s; c.hands[0] = null; handsChanged(); return ''; } }
  if (putSlot(c.inv, s, PACK.vol) === 0) { c.hands[0] = null; handsChanged(); return ''; }
  return `Your hands are full (${item(s.k).name}) and there is nowhere to put it.`;
}

/** How many more of k the backpack has room for (by bulk); for things carried in the hands, whether your hands can take it. */
export const packRoom = (k: ItemKey) => (HANDS_ONLY.has(k) ? (!G.char.hands[0] || WEAPON_KIND[G.char.hands[0].k] !== undefined && G.char.back.includes(null) ? 1 : 0) : roomFor(G.char.inv, k, PACK.vol));
/**
 * Adds an item; new relics go straight into a free module, things too big for the backpack into your hands (a weapon you
 * held goes onto your back), weapons onto a free back slot. Returns where it went, or null when it does not fit.
 */
export function addItem(k: ItemKey, n = 1, quiet = false): 'mod' | 'inv' | 'hands' | 'back' | null {
  const it = item(k), c = G.char;
  if (it.type === 'relic' && !quiet) { const free = c.mods.indexOf(null); if (free >= 0 && !c.mods.includes(k)) { c.mods[free] = k; calcStats(); return 'mod'; } }
  if (it.type === 'relic' && quiet) { const free = c.mods.indexOf(null); if (free >= 0) { c.mods[free] = k; return 'mod'; } }
  if (HANDS_ONLY.has(k)) {
    if (n !== 1 || (c.hands[0] && stowHeld())) return null;
    c.hands[0] = { k, n: 1 }; handsChanged(); return 'hands';
  }
  if (WEAPON_KIND[k] !== undefined && n === 1) { const f = c.back.indexOf(null); if (f >= 0) { c.back[f] = { k, n: 1 }; return 'back'; } }
  if (packRoom(k) < n) return null;
  if (it.stack) { const s = c.inv.find((x) => x && x.k === k && x.n < it.stack!); if (s) { s.n += n; return 'inv'; } }
  const f = c.inv.indexOf(null); if (f < 0) return null;
  c.inv[f] = { k, n }; return 'inv';
}

/** Uses up one k from the backpack or, failing that, from your hands. */
export function takeOne(k: ItemKey): boolean {
  const c = G.char;
  for (const L of [c.inv, c.hands]) {
    const i = L.findIndex((x) => x && x.k === k); if (i < 0) continue;
    if (--L[i]!.n <= 0) L[i] = null;
    if (L === c.hands) handsChanged();
    saveChar(); return true;
  }
  return false;
}
export const hasItem = (k: ItemKey) => G.char.inv.some((x) => x && x.k === k) || G.char.hands[0]?.k === k;

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
  logLine(ITEMS[k].name + (where === 'mod' ? ' (equipped)' : where === 'hands' ? ' (in your hands)' : where === 'back' ? ' (on your back)' : ' → backpack')); if (item(k).type === 'relic') showToast(ITEMS[k].name);
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
