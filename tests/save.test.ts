import { describe, it, expect } from 'vitest';
import { loadChar, SAVE_KEY, V2_KEY, OLD_KEY, discover, isDiscovered } from '../src/save';

const store = (m: Record<string, string>) => ({ getItem: (k: string) => m[k] ?? null });

describe('loadChar', () => {
  it('loads a v3 save as is', () => {
    const v3 = { v: 3, level: 4, xp: 12, gold: 99, world: 777, inv: [{ k: 'medkit', n: 2 }, ...Array(11).fill(null)], mods: ['lens', null, null],
      opened: { '5:2:1:-1': [0] }, unlocked: {}, killed: {}, loc: 'dungeon', ow: null, dungeon: { ruinId: 5, depth: 2, gx: 1, gz: -1 }, discovered: { '0,0': '0000000000000001' } };
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify(v3) }))).toEqual(v3);
  });
  it('migrates v2: character, backpack and gold stay, the player starts in the village', () => {
    const v2 = { level: 4, xp: 12, gold: 99, depth: 2, gx: 1, gz: -1, world: 777, inv: [{ k: 'medkit', n: 2 }, ...Array(11).fill(null)],
      mods: ['lens', null, null], opened: { '2:1:-1': [0] }, unlocked: {}, killed: {}, loc: 'dungeon' };
    const c = loadChar(store({ [V2_KEY]: JSON.stringify(v2) }));
    expect(c).toMatchObject({ v: 3, level: 4, xp: 12, gold: 99, world: 777, inv: v2.inv, mods: v2.mods, loc: 'overworld', ow: null, dungeon: null, opened: {} });
  });
  it('migrates v1 relic counts into modules, then the backpack', () => {
    const c = loadChar(store({ [OLD_KEY]: JSON.stringify({ level: 2, xp: 3, gold: 10, depth: 3, relics: { lens: 2, shield: 2 } }) }));
    expect(c).toMatchObject({ level: 2, xp: 3, gold: 10, loc: 'overworld' });
    expect(c.mods).toEqual(['lens', 'lens', 'shield']);
    expect(c.inv[0]).toEqual({ k: 'shield', n: 1 });
  });
  it('survives garbage', () => {
    expect(loadChar(store({ [SAVE_KEY]: '{oops' })).level).toBe(1);
  });
});

describe('explored map bitmask', () => {
  it('round-trips chunks across region borders', () => {
    const d: Record<string, string> = {};
    const pts = [[0, 0], [-4, -4], [3, 3], [4, 3], [-5, 0], [11, -12], [-100, 57]];
    for (const [x, z] of pts) { expect(discover(d, x, z)).toBe(true); expect(discover(d, x, z)).toBe(false); }
    for (const [x, z] of pts) expect(isDiscovered(d, x, z)).toBe(true);
    expect(isDiscovered(d, 1, 0)).toBe(false);
    expect(Object.values(d).every((h) => /^[0-9a-f]{16}$/.test(h))).toBe(true);
  });
});
