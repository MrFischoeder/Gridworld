import { describe, it, expect } from 'vitest';
import { GRIDHOLM_ID } from '../src/gen/regions';
import { loadChar, OLD_SAVE_CELLS, SAVE_KEY, V2_KEY, OLD_KEY, discover, isDiscovered } from '../src/save';

const store = (m: Record<string, string>) => ({ getItem: (k: string) => m[k] ?? null });

describe('loadChar', () => {
  it('loads a v3 save as is', () => {
    const v3 = { v: 3, level: 4, xp: 12, gold: 99, world: 777, inv: [{ k: 'medkit', n: 2 }, ...Array(11).fill(null)], mods: ['lens', null, null],
      opened: { '5:2:1:-1': [0] }, unlocked: {}, killed: {}, loc: 'dungeon', ow: null, dungeon: { ruinId: 5, depth: 2, gx: 1, gz: -1 }, discovered: { '0,0': '0000000000000001' }, containers: {}, vehicles: [], board: { seq: 0, offers: [] }, quests: [], camps: {} };
    // saves from before the game clock start at 08:00 of day 1
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify(v3) }))).toEqual({ ...v3, settlementRules: 0, inv: [{ k: 'medkit', n: 2 }, { k: 'ammoE', n: 60 }, { k: 'ammoE', n: 60 }, ...Array(9).fill(null)], loaded: { blaster: 20 }, waypoint: null, time: 480, gunMods: [null, null, null], kcal: 2400, stomach: 0, water: 100, harvest: {}, benches: [], claims: [], hands: [{ k: 'blaster', n: 1 }], back: [{ k: 'blade', n: 1 }, null], wear: {}, pid: expect.any(String), towns: {}, market: {}, ledger: {}, caravans: {}, escort: null, contracts: [], taken: [], boards: {}, name: '', houses: [], shuttle: { given: {}, v: 3 }, intro: true, tech: {}, leads: [], installs: {}, bridges: {}, bridgeSites: [], cityGarrisons: {}, fallen: {}, piers: [], boats: [], filter: 0, fogs: {}, guide: 2 });
    const timed = { ...v3, time: 5000, gunMods: ['scope', null, 'magX'], kcal: 1234, stomach: 0.6, water: 12, harvest: { 'pod:3:-2': 4000 }, benches: [], claims: [], hands: [null], back: [{ k: 'blaster', n: 1 }, { k: 'blade', n: 1 }], wear: { head: 'helmet' }, pid: 'abc123', towns: { '5': { wall: 1, fixed: 3000 } }, market: { '5:ore': { d: -3, t: 4000 } }, ledger: {}, caravans: { 'x:1': 2 }, escort: null, contracts: [], taken: [], boards: {}, name: 'Ada', houses: [], shuttle: { given: { hull: { steel: 3 } } }, intro: false, tech: { fields: 900 }, leads: ['solar'], installs: { uranium: { stage: 1, given: {}, inp: { uranium: 2 }, out: 0, t: 0 } }, bridges: { 'bridge:road:1:2:3:4': { given: { log: 3 } } }, bridgeSites: [], cityGarrisons: {}, fallen: {}, piers: [], boats: [], filter: 0, fogs: {}, guide: 2, loaded: { blaster: 7, rifle: 2 }, waypoint: [120, -40] };
    const timed2 = { ...timed, settlementRules: 0, shuttle: { given: { hull: { steel: 3 } }, v: 3 } }; // (the Chariot's stages checked once against the old needs)
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify(timed) }))).toEqual(timed2);
    // the old 0..100 food bar becomes the same share of the calorie store
    const { kcal: _k, stomach: _s, ...old } = { ...timed, food: 40 };
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify(old) }))).toEqual({ ...timed2, kcal: 1200, stomach: 0 });
  });
  it('preserves city casualties and cooldowns, and initialises older saves with no posts', () => {
    const old = { v: 3, world: 12345, level: 1, gold: 30, inv: [], mods: [], loc: 'overworld', containers: {}, opened: {}, unlocked: {}, killed: {} };
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify(old) })).cityGarrisons).toEqual({});
    const cityGarrisons = { '1:5': { until: 1500, hp: { '0': 0, '1': 7 } } };
    const loaded = loadChar(store({ [SAVE_KEY]: JSON.stringify({ ...old, cityGarrisons }) }));
    expect(loaded.cityGarrisons).toEqual(cityGarrisons); expect(loaded.gold).toBe(30);
  });
  it('gives characters from before limited ammunition a full Blaster and a stock of cells', () => {
    const base = { v: 3, level: 1, xp: 0, gold: 0, world: 5, inv: Array(12).fill(null), mods: [], opened: {}, unlocked: {}, killed: {}, loc: 'overworld', ow: null, dungeon: null };
    const c = loadChar(store({ [SAVE_KEY]: JSON.stringify(base) }));
    expect(c.loaded).toEqual({ blaster: 20 });
    expect(c.inv.reduce((a, s) => a + (s?.k === 'ammoE' ? s.n : 0), 0)).toBe(OLD_SAVE_CELLS);
  });
  it('gives the Gridholm house to players who already used its chest', () => {
    const base = { v: 3, level: 1, xp: 0, gold: 0, world: 5, inv: [], mods: [], opened: {}, unlocked: {}, killed: {}, loc: 'overworld', ow: null, dungeon: null };
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify({ ...base, containers: { 'home:chest': { items: [], gold: 0 } } }) })).houses).toEqual([GRIDHOLM_ID]);
    expect(loadChar(store({ [SAVE_KEY]: JSON.stringify({ ...base, containers: {} }) })).houses).toEqual([]);
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

describe('rename to GridWorld', () => {
  it('still loads a v3 save stored under the old Grid Arena key', () => {
    const c = loadChar(store({ 'gridArena.character.v3': JSON.stringify({ v: 3, level: 7, gold: 5, world: 1, loc: 'overworld' }) }));
    expect(c).toMatchObject({ level: 7, gold: 5, world: 1 });
  });
});

it('removes retired crossings when opening an existing character save', () => {
  const old = { id: 'old', kind: 'chasm', x: 1, z: 2 };
  const river = { id: 'river', x: 3, z: 4 };
  const c = loadChar(store({ [SAVE_KEY]: JSON.stringify({ bridgeSites: [old, river], bridges: { old: { given: {}, done: 100 }, river: { given: { log: 3 } } } }) }));
  expect(c.bridgeSites).toEqual([river]);
  expect(c.bridges).toEqual({ river: { given: { log: 3 } } });
});
