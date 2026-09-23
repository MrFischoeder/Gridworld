import { describe, it, expect } from 'vitest';
import { loadChar, SAVE_KEY, OLD_KEY } from '../src/save';

const store = (m: Record<string, string>) => ({ getItem: (k: string) => m[k] ?? null });

describe('loadChar', () => {
  it('loads a v2 save as is', () => {
    const v2 = { level: 4, xp: 12, gold: 99, depth: 2, gx: 1, gz: -1, world: 777, inv: [{ k: 'medkit', n: 2 }, ...Array(11).fill(null)],
      mods: ['lens', null, null], opened: { '2:1:-1': [0] }, unlocked: {}, killed: {}, loc: 'dungeon' };
    const c = loadChar(store({ [SAVE_KEY]: JSON.stringify(v2) }));
    expect(c).toMatchObject(v2);
  });
  it('migrates v1 relic counts into modules, then the backpack', () => {
    const c = loadChar(store({ [OLD_KEY]: JSON.stringify({ level: 2, xp: 3, gold: 10, depth: 3, relics: { lens: 2, shield: 2 } }) }));
    expect(c).toMatchObject({ level: 2, xp: 3, gold: 10, depth: 3 });
    expect(c.mods).toEqual(['lens', 'lens', 'shield']);
    expect(c.inv[0]).toEqual({ k: 'shield', n: 1 });
  });
  it('survives garbage', () => {
    expect(loadChar(store({ [SAVE_KEY]: '{oops' })).level).toBe(1);
  });
});
