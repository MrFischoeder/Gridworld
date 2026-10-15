import { describe, it, expect } from 'vitest';
import { postsOf, assign } from '../src/gen/workforce';
import { wallGunsAt, siteKw, GUN_KW } from '../src/gen/energy';
import { outGunsAt, demandOf, OUT_GUN_KW } from '../src/gen/grid';
import { crews } from '../src/gen/outpostlife';
import { holdChance } from '../src/gen/outpostraids';
import { lhPower } from '../src/gen/lhpower';
import { LH, type Lighthouse } from '../src/gen/lighthouses';
import { allVillages, villageSeed } from '../src/gen/regions';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';

const W = -717171;
const settled = (more: Partial<TownState> = {}): TownState => ({ settlement: { v: 1, supplies: true }, ...more });
const outpost = (more: Partial<OutpostState> = {}): OutpostState => ({ o: 'crew', by: 'Ala', t: 0, k: 'stone', x: 9000, z: 0, name: 'Quarry', done: { dig: true }, ...more });
const lh = (x: number, z: number): Lighthouse => ({ id: 'lh', x, z, y: 2, given: {}, done: 1, p: 8, on: true, by: 'Ala' });

describe('defence takes power and people (stage Z7)', () => {
  it('a settlement mans its wall turrets after the services, a guard each', () => {
    const s = settled({ farms: 1, works: { turret: 2 }, commute: { a: 3 } });
    const ids = postsOf(s).map((p) => p.id);
    expect(ids.slice(-3)).toEqual(['guard:0', 'guard:1', 'commute:a']);
    const a = assign(s, 5); // 4 on the farm, one guard
    expect(a.posts.filter((p) => p.kind === 'guard').map((p) => p.got)).toEqual([1, 0]);
    const v = allVillages(W)[0], seed = villageSeed(W, v);
    expect(siteKw(W, v, seed, s) - siteKw(W, v, seed, settled({ farms: 1 }))).toBe(2 * GUN_KW);
  });
  it('an established village fires every turret; a settlement without power fires none', () => {
    const v = allVillages(W)[0], seed = villageSeed(W, v);
    expect(wallGunsAt(W, v, seed, { works: { turret: 3 } }, 600).work).toBe(3);
    const g = wallGunsAt(W, v, seed, settled({ works: { turret: 2 } }), 600); // no power plant yet
    expect(g.n).toBe(2);
    expect(g.work).toBe(0);
    expect(g.why).not.toBe('');
  });
  it("an outpost's turrets draw from its grid and take a settler each", () => {
    const o = outpost({ n: { turret: 2, bunks: 1, field: 1 }, life: { t: 0, n: 5, food: 10, fed: 1 } });
    expect(demandOf(o) - demandOf(outpost())).toBe(2 * OUT_GUN_KW);
    const w = crews(o, 5, 0);
    expect(w.farm).toBe(3);
    expect(w.guard).toBe(2);
    expect(w.dig).toBe(0);
    expect(outGunsAt(W, { a: o }, 'a', 600)).toMatchObject({ n: 2, work: 0, why: 'power' }); // off the grid
    const src = outpost({ k: 'iron', x: 9100, name: 'Mine', done: { power: true }, pk: 'generator', fuel: { n: 1000, t: 0 } });
    expect(outGunsAt(W, { a: o, b: src }, 'a', 600)).toMatchObject({ work: 2, why: '' });
    o.life!.n = 4; // one settler short
    expect(outGunsAt(W, { a: o, b: src }, 'a', 600)).toMatchObject({ work: 1, why: 'hands' });
    expect(holdChance(o, 3, 0)).toBeLessThan(holdChance(o, 3, 2));
  });
  it('an electric lighthouse in a towns world wants power; an old world keeps it lit', () => {
    expect(lhPower(-W, lh(20000, 5000), {}, {}, 600).ok).toBe(true);
    const far = lh(20000, 5000);
    expect(lhPower(W, far, {}, {}, 600).ok).toBe(false);
    const src = outpost({ k: 'iron', x: 20100, z: 5000, name: 'Mine', done: { power: true }, pk: 'generator', fuel: { n: 1000, t: 0 } });
    expect(lhPower(W, far, {}, { b: src }, 600)).toMatchObject({ ok: true, by: 'grid' });
    expect(LH.kw).toBeGreaterThan(0);
  });
});
