// Character rules: stats from level and equipped relics, inventory, XP.
import { G } from './game';
import { ITEMS, item, BULK, WEAR, WEAPON_KIND, HANDS_ONLY, OFF_HAND, SHIELD, TWO_HANDED, gearOf, type ItemKey } from './data/items';
import { roomFor, weightOf, putSlot, putItems } from './inventory';
import type { Slot } from './save';
import { saveChar as persist } from './save';
import { showToast, logLine } from './ui/hud';
import { BLASTER, gunStats, gunOf, meleeOf } from './data/weapons';
import { proxied } from './world/remote';
import { tl, TL } from './i18n';

export const saveChar = () => persist(G.char);

export function calcStats() {
  const c = G.char, L = c.level - 1, r = (k: ItemKey) => c.mods.filter((m) => m === k).length;
  c.gunMods ??= [null, null, null]; c.loaded ??= { blaster: BLASTER.base.mag };
  // the gun in your hands (the Blaster's stats when you hold none, for the backpack's numbers); attachments fit the Blaster only
  const hk = c.hands[0]?.k, gun = gunOf(hk) ?? BLASTER, mel = meleeOf(hk) ?? meleeOf('blade')!;
  G.gun = gunStats(gun, gun === BLASTER ? c.gunMods : []);
  G.ammo = Math.min(G.ammo, G.gun.mag);
  G.S = {
    maxHp: 100 + L * 15 + r('shield') * 20, bm: (1 + L * 0.12) * (1 + r('lens') * 0.25), mm: (1 + L * 0.12) * (1 + r('edge') * 0.25),
    range: mel.reach + r('edge') * 0.3, rate: G.gun.interval * Math.pow(0.9, r('cell')), speed: (1 + r('servo') * 0.08) * gearOf(c.wear).speed, stamina: gearOf(c.wear).stamina,
    // worn armour, and a shield in the other hand beside a one-handed weapon
    def: 1 - Object.values(c.wear).reduce((a, k) => a * (1 - (k ? WEAR[k]?.def ?? 0 : 0)), 1) * (1 - shieldNow()),
  };
  G.hp = Math.min(G.hp, G.S.maxHp);
}

/** What you wear makes of the backpack and your legs (a bigger pack, an exoskeleton): data/items.ts gearOf. */
export const gear = () => gearOf(G.char.wear);
/** The backpack's litres now. */
export const packVol = () => gearOf(G.char.wear).vol;

/** A hit on the player after worn armour took its share off. */
export const armoured = (dmg: number) => (proxied() ? dmg : dmg * (1 - G.S.def));
/** Everything you carry (kg): the backpack, your hands, your back and what you wear. */
export function carriedKg(): number {
  const c = G.char;
  return weightOf(c.inv) + weightOf(c.hands) + weightOf(c.back) + weightOf(c.off ?? []) + Object.values(c.wear).reduce((a, k) => a + (k ? BULK[k][0] : 0), 0);
}

// ---------- hands and back ----------
/** The slot lists by slot-id prefix: p = backpack, h = hands (one slot), k = back (two slots, weapons only). */
export const listOf = (w: string): (Slot | null)[] => (w === 'h' ? G.char.hands : w === 'k' ? G.char.back : w === 'o' ? (G.char.off ??= [null]) : G.char.inv);
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
  if (putSlot(c.inv, s, packVol()) === 0) { c.hands[0] = null; handsChanged(); return ''; }
  return TL`Your hands are full (${item(s.k).name}) and there is nowhere to put it.`;
}

// ---------- (0.201) the other hand ----------
/** What is in your other hand (a light or a shield). */
export const offHeld = () => (G.char.off ??= [null])[0];
/** Whether the main hand's weapon or tool needs both hands. */
export const bothHands = () => { const h = G.char.hands[0]; return !!h && TWO_HANDED.has(h.k); };
/** Whether the other hand is free to use what it holds (nothing two-handed in the main hand). */
export const offFree = () => !!offHeld() && !bothHands();
/** The share of a hit the shield in your other hand takes (0 without one, or with both hands on a long gun). */
export const shieldNow = () => { const o = offHeld(); return o && !bothHands() ? SHIELD[o.k] ?? 0 : 0; };
/** Puts what the other hand holds into the backpack. '' when done. */
export function stowOff(): string {
  const c = G.char, s = offHeld();
  if (!s) return '';
  if (putSlot(c.inv, s, packVol()) > 0) return TL`No room in the backpack for the ${item(s.k).name}.`;
  c.off[0] = null; calcStats(); handsChanged(); return '';
}
/**
 * Takes k from the backpack (or your back, hands) into your other hand: a whole stack of torches, one of anything else;
 * what it held goes into the backpack. With a two-handed weapon in the main hand, that goes onto your back. '' when done.
 */
export function takeInOff(k: ItemKey): string {
  const c = G.char;
  if (!OFF_HAND.has(k)) return TL`The ${item(k).name} is not held in the other hand.`;
  if (bothHands()) { const m = stowHeld(); if (m) return m; }
  if (offHeld()?.k === k) return '';
  const i = c.inv.findIndex((s) => s?.k === k), fromHands = i < 0 && c.hands[0]?.k === k;
  if (i < 0 && !fromHands) return TL`You have no ${item(k).name}.`;
  const L = fromHands ? c.hands : c.inv, j = fromHands ? 0 : i, s = L[j]!;
  const one = k !== 'firebrand' && s.n > 1, took: Slot = one ? { k, n: 1 } : s;
  if (one) s.n--; else L[j] = null;
  const old = offHeld();
  c.off[0] = took;
  if (old && putSlot(c.inv, old, packVol()) > 0) { // no room for what it held: undo
    c.off[0] = old; if (one) s.n++; else L[j] = s;
    return TL`No room in the backpack for the ${item(old.k).name}.`;
  }
  calcStats(); handsChanged(); saveChar();
  return '';
}

/** Whether k is in your hands (tools work only from there, not from the backpack). */
export const inHands = (k: ItemKey) => G.char.hands[0]?.k === k;
/** Takes k from the backpack into your hands; what you held goes on your back or into the backpack. '' when done. */
export function takeInHands(k: ItemKey): string {
  const c = G.char;
  if (c.hands[0]?.k === k) return '';
  const i = c.inv.findIndex((s) => s?.k === k);
  if (i < 0) return TL`You have no ${item(k).name}.`;
  const m = stowHeld();
  if (m) return m;
  const s = c.inv[i]!;
  if (s.n > 1) { s.n--; c.hands[0] = { ...s, n: 1 }; } else { c.hands[0] = s; c.inv[i] = null; }
  handsChanged(); saveChar();
  return '';
}

/** How many more of k the backpack has room for (by bulk); for things carried in the hands, whether your hands can take it. */
export const packRoom = (k: ItemKey) => (HANDS_ONLY.has(k) ? (!G.char.hands[0] || WEAPON_KIND[G.char.hands[0].k] !== undefined && G.char.back.includes(null) ? 1 : 0) : roomFor(G.char.inv, k, packVol()));
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
  // all of it or nothing, spread over stacks as they allow (a box of 40 rounds may fill one stack and start the next)
  const copy = c.inv.map((s) => (s ? { ...s } : null));
  if (putItems(copy, k, n, packVol()) > 0) return null;
  copy.forEach((s, i) => { c.inv[i] = s; });
  void it; return 'inv';
}

/** Uses up one k from the backpack or, failing that, from your hands. */
export function takeOne(k: ItemKey): boolean {
  const c = G.char;
  for (const L of [c.inv, c.hands, c.off ?? []]) {
    const i = L.findIndex((x) => x && x.k === k); if (i < 0) continue;
    if (--L[i]!.n <= 0) L[i] = null;
    if (L !== c.inv) handsChanged();
    saveChar(); return true;
  }
  return false;
}
export const hasItem = (k: ItemKey) => G.char.inv.some((x) => x && x.k === k) || G.char.hands[0]?.k === k || G.char.off?.[0]?.k === k;

export const xpNeed = (lvl: number) => 40 + 30 * (lvl - 1);
export function gainXp(n: number) {
  const c = G.char;
  c.xp += n;
  while (c.xp >= xpNeed(c.level)) {
    c.xp -= xpNeed(c.level); c.level++; calcStats(); G.hp = G.S.maxHp;
    showToast(tl('Level ') + c.level); logLine(tl('+15 max HP, +12% damage'));
  }
  saveChar();
}

export function giveLoot(k: ItemKey, n = 1) {
  const where = addItem(k, n);
  if (!where) { logLine(tl('Backpack full: ') + ITEMS[k].name + ' lost'); return; }
  logLine(ITEMS[k].name + (where === 'mod' ? ' (equipped)' : where === 'hands' ? tl(' (in your hands)') : where === 'back' ? tl(' (on your back)') : ' → backpack')); if (item(k).type === 'relic') showToast(ITEMS[k].name);
  saveChar();
}

/** Current dungeon depth (1 on the surface). */
export const depth = () => G.char.dungeon?.depth ?? 1;
export const droneHp = () => 2 + Math.floor((depth() - 1) / 2);
export const droneDps = () => 16 + 3 * (depth() - 1);
/** Save key of the current dungeon sector: every ruin has its own network of sectors. */
export const dungeonKey = () => { const d = G.char.dungeon!; return d.ruinId + ':' + d.depth + ':' + d.gx + ':' + d.gz + (d.custom ? '@' + d.custom : ''); }; // (0.210) an editor's level keeps its own chests and kills, also under a place
/** Per-dungeon progress list (opened chests, unlocked doors, killed bosses). */
export function progress(which: 'opened' | 'unlocked' | 'killed'): number[] {
  const k = dungeonKey(), m = G.char[which];
  return (m[k] = m[k] || []);
}
export const progressHas = (which: 'opened' | 'unlocked' | 'killed', i: number) => (G.char[which][dungeonKey()] || []).includes(i);
