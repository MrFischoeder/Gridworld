import { describe, it, expect } from 'vitest';
import { HARNESS, MOD_MAX, EXO_EXT, modSockets, extLoad, extProblem, strandedMods } from '../src/gen/exoframe';
import { gearOf, MOD_SIZE, INV_SIZE, PACK, HANDS_ONLY, TWO_HANDED } from '../src/data/items';
import { bagBox, bagFree, bagId, isBagId } from '../src/gen/bags';
import { FEATURES } from '../server/mp.mjs';

describe('(0.285) exoskeleton modules and the frame built up', () => {
  it('the harness has 3 sockets, a frame opens more, extensions only with a frame on', () => {
    expect(modSockets({})).toBe(HARNESS);
    expect(modSockets({}, 3)).toBe(HARNESS); // no frame: the extensions do nothing
    expect(modSockets({ frame: 'exoL' })).toBe(HARNESS + 1);
    expect(modSockets({ frame: 'exoH' }, 3)).toBe(MOD_MAX);
    expect(MOD_SIZE).toBe(MOD_MAX);
  });
  it('extensions carry more and want their materials', () => {
    expect(extLoad({}, 2)).toEqual({ comfy: 0, max: 0 });
    const e = extLoad({ frame: 'exoL' }, 2);
    expect(e.max).toBe(EXO_EXT[0].max + EXO_EXT[1].max);
    expect(gearOf({ frame: 'exoL' }, 2).max).toBe(gearOf({ frame: 'exoL' }).max + e.max);
    expect(gearOf({}).max).toBe(PACK.max);
    expect(extProblem({}, 0, () => 99)).toBe('frame');
    expect(extProblem({ frame: 'exoL' }, 0, () => 0)).toBe('needs');
    expect(extProblem({ frame: 'exoL' }, 0, () => 99)).toBe('');
    expect(extProblem({ frame: 'exoL' }, EXO_EXT.length, () => 99)).toBe('full');
  });
  it('a frame may not come off while its sockets hold modules', () => {
    const mods = ['shield', 'lens', 'edge', 'servo', null, null, null, null] as const;
    expect(strandedMods([...mods], modSockets({ frame: 'exoL' }))).toBe(0);
    expect(strandedMods([...mods], modSockets({}))).toBe(1);
  });
});
describe('(0.285) the backpack taken off', () => {
  it('its container keeps every slot and the pack worn with it', () => {
    const box = bagBox([{ k: 'log', n: 3 }, null, { k: 'stone', n: 2 }], 'rucksack', 'p1');
    expect(box.items.length).toBe(INV_SIZE);
    expect(box.items[2]).toEqual({ k: 'stone', n: 2 });
    expect(box.pack).toBe('rucksack');
    expect(bagFree(box)).toBe(false); // carried
    delete box.held; expect(bagFree(box)).toBe(true);
    expect(isBagId(bagId('p1', 100.4, 1))).toBe(true);
  });
  it('is carried in both hands, and the server announces it keeps them lying', () => {
    expect(HANDS_ONLY.has('backpack')).toBe(true);
    expect(TWO_HANDED.has('backpack')).toBe(true);
    expect(FEATURES).toContain('bags');
  });
});
