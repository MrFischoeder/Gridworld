import { describe, it, expect } from 'vitest';
import type { OutpostState } from '../src/gen/outposts';
import { choosePower, handOver, stockNow } from '../src/gen/outposts';
import { grids, gridState, powerShare, powerFactor, fuelLeft, loadFuel, supplyAt, POWER_SRC, GRID, DIG_KW } from '../src/gen/grid';
import { startLodes } from '../src/gen/lodes';

const W = -12345;
const op = (x: number, z: number, extra: Partial<OutpostState> = {}): OutpostState => ({ o: 'crew', by: 'Ada', t: 0, k: 'iron', x, z, name: 'n', ...extra });
const all = () => 999;
describe('stage O3: power with a reach', () => {
  it('a mine off the grid digs at half pace, on a fuelled generator at full pace', () => {
    const mine = op(0, 0, { done: { dig: true }, stock: { t: 0, n: {} } });
    expect(powerShare(W, { a: mine }, 'a', 3000)).toBe(0);
    expect(powerFactor(0)).toBe(GRID.unpowered);
    const gen = op(200, 0, { k: 'stone', pk: 'generator', done: { power: true }, fuel: { n: 20, t: 0 } });
    const ops = { a: mine, b: gen };
    expect(grids(ops).get('a')).toBe(grids(ops).get('b'));
    expect(powerShare(W, ops, 'a', 1500)).toBe(1);
    const l = startLodes(W).find((x) => x.k === 'iron')!;
    expect(stockNow(mine, l, 600, powerFactor(0)).ore).toBeCloseTo(stockNow(mine, l, 600, 1).ore! / 2, 5);
  });
  it('shares a short grid out evenly and leaves far outposts off it', () => {
    const gen = op(0, 0, { k: 'stone', pk: 'generator', done: { power: true }, fuel: { n: 20, t: 0 } });
    const mines = Object.fromEntries([0, 1, 2, 3, 4].map((i) => ['m' + i, op(50 + i * 10, 0, { done: { dig: true } })]));
    const ops = { g: gen, ...mines, far: op(5000, 0, { done: { dig: true } }) };
    const g = grids(ops), st = gridState(W, ops, g, 100), n = g.get('m0')!;
    expect(st.demand[n]).toBe(5 * DIG_KW.mine);
    expect(st.share[n]).toBeCloseTo(POWER_SRC.generator.kw / (5 * DIG_KW.mine), 5);
    expect(g.has('far')).toBe(false);
  });
  it('joins sources whose reach meets into one grid', () => {
    const a = op(0, 0, { pk: 'wind', done: { power: true } }), b = op(900, 0, { pk: 'wind', done: { power: true } }), c = op(5000, 0, { pk: 'wind', done: { power: true } });
    const g = grids({ a, b, c });
    expect(g.get('a')).toBe(g.get('b'));
    expect(g.get('c')).not.toBe(g.get('a'));
  });
  it('burns fuel from the bunker and stops when it is empty; the sun gives nothing at night', () => {
    const gen = op(0, 0, { pk: 'generator', done: { power: true } });
    expect(loadFuel(gen, 50, 0)).toBe(POWER_SRC.generator.bunker);
    expect(fuelLeft(gen, POWER_SRC.generator.burn! * 5)).toBeCloseTo(POWER_SRC.generator.bunker! - 5, 5);
    expect(supplyAt(W, 'g', gen, POWER_SRC.generator.burn! * 30)).toBe(0);
    const sun = op(0, 0, { pk: 'solar', done: { power: true } });
    expect(supplyAt(W, 's', sun, 0)).toBeLessThan(1); // midnight
    expect(supplyAt(W, 's', sun, 12 * 60)).toBeGreaterThan(30); // noon
  });
  it('lets the source be changed only before anything is handed over', () => {
    const o = op(0, 0);
    expect(choosePower(o, 'wind')).toBe(true);
    handOver(o, 'power', () => 1, 0);
    expect(choosePower(o, 'solar')).toBe(false);
    expect(handOver(o, 'power', all, 0).started).toBe(true);
  });
});
