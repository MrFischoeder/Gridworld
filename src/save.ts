// Character persistence. Only player-made changes are stored, never generated geometry.
import { INV_SIZE, MOD_SIZE, ITEMS, type ItemKey } from './data/items';

export interface Slot { k: ItemKey; n: number }
/** Per-dungeon progress, keyed by dungeonKey(). */
export type Progress = Record<string, number[]>;
export interface Char {
  level: number; xp: number; gold: number;
  depth: number; gx: number; gz: number; world: number;
  inv: (Slot | null)[]; mods: (ItemKey | null)[];
  opened: Progress; unlocked: Progress; killed: Progress;
  loc: 'village' | 'dungeon';
}

export const SAVE_KEY = 'gridArena.character.v2', OLD_KEY = 'gridArena.character.v1';

export const newChar = (): Char => ({
  level: 1, xp: 0, gold: 0, depth: 1, gx: 0, gz: 0, world: (Math.random() * 1e6) | 0,
  inv: Array(INV_SIZE).fill(null), mods: Array(MOD_SIZE).fill(null), opened: {}, unlocked: {}, killed: {}, loc: 'village',
});

/** v1 stored relic counts; they go into free modules first, then the backpack. */
function migrateV1(o: { level?: number; xp?: number; gold?: number; depth?: number; relics?: Record<string, number> }): Char {
  const c = newChar();
  Object.assign(c, { level: o.level || 1, xp: o.xp || 0, gold: o.gold || 0, depth: o.depth || 1 });
  for (const [k, n] of Object.entries(o.relics || {})) {
    if (!(k in ITEMS)) continue;
    for (let i = 0; i < n; i++) {
      const free = c.mods.indexOf(null);
      if (free >= 0) { c.mods[free] = k as ItemKey; continue; }
      const f = c.inv.indexOf(null); if (f >= 0) c.inv[f] = { k: k as ItemKey, n: 1 };
    }
  }
  return c;
}

export function loadChar(storage: Pick<Storage, 'getItem'> | null = safeStorage()): Char {
  try {
    const raw = storage?.getItem(SAVE_KEY);
    if (raw) return Object.assign(newChar(), JSON.parse(raw));
    const old = storage?.getItem(OLD_KEY);
    if (old) return migrateV1(JSON.parse(old));
  } catch { /* corrupt or blocked storage: start fresh */ }
  return newChar();
}

export function saveChar(c: Char): void {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(c)); } catch { /* storage unavailable */ }
}

function safeStorage(): Storage | null { try { return localStorage; } catch { return null; } }
