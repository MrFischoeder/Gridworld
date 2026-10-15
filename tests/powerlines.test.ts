import { describe, it, expect, afterEach } from 'vitest';
import { PLINE, newLine, plineNeeds, plineProblem, linePoles, lineFlows, lineInto, grids, gridState, powerShare, setLineBalance, clearLineMemo, lined } from '../src/gen/grid';
import { handOver, finishDue, jobEnd, partPlan, partProblem, hoursOf, bare, type OutpostState } from '../src/gen/outposts';
import { balance, setLineHook, type Balance } from '../src/gen/energy';
import { allVillages, villageSeed } from '../src/gen/regions';

const W = -515151;
const V = { id: 7, name: 'Testby', x: 3000, z: 0 };
const dig = (x: number): OutpostState => ({ o: 'crew', by: 'Ala', t: 0, k: 'stone', x, z: 0, name: 'Quarry', done: { dig: true } });
const gen = (x: number): OutpostState => ({ o: 'crew', by: 'Ala', t: 0, k: 'iron', x, z: 0, name: 'Mine', done: { power: true }, pk: 'generator', fuel: { n: 1000, t: 0 } });
const bal = (free: number, short: number): Balance => ({ bank: 0, made: 0, village: 0, free, draw: 0, powered: [], farms: 0, farmsPowered: 1, site: 0, sitePowered: 1, line: 0, short });
const withLine = (o: OutpostState) => { o.pl = newLine(o, V); (o.done ??= {}).pline = true; return o; };
afterEach(() => { setLineBalance(null); setLineHook(null); clearLineMemo(); });

describe('power lines (stage Z5)', () => {
  it('costs by its length and keeps to one line a village', () => {
    const o = dig(0), l = newLine(o, V);
    expect(l.km).toBeCloseTo((3000 - PLINE.end - PLINE.start) / 1000, 1);
    const n = Object.fromEntries(plineNeeds(l.km));
    expect(n.planks).toBe(Math.ceil(12 * l.km));
    expect(n.cable).toBe(2);
    expect(plineNeeds(0.1).find(([k]) => k === 'planks')![1]).toBe(6); // half a km at least
    const all: Record<string, OutpostState> = { a: o, b: dig(500) };
    expect(plineProblem(all, 'a', V)).toBe('');
    all.b.pl = newLine(all.b, V); all.b.done!.pline = true;
    expect(plineProblem(all, 'a', V)).not.toBe(''); // the village has its line
    expect(plineProblem(all, 'a', { ...V, id: 8, x: 9000 })).not.toBe(''); // too far
    expect(plineProblem({ c: { ...dig(0), k: 'camp' } }, 'c', V)).not.toBe('');
    const poles = linePoles(o, l);
    expect(poles.length).toBeGreaterThan(60);
    for (let i = 1; i < poles.length; i++) expect(Math.hypot(poles[i][0] - poles[i - 1][0], poles[i][1] - poles[i - 1][1])).toBeLessThan(PLINE.gap * 1.2);
  });
  it('is built from materials like any outpost part', () => {
    const o = dig(0);
    expect(partProblem(o, 'pline')).not.toBe(''); // the village first
    o.pl = newLine(o, V);
    expect(partProblem(o, 'pline')).toBe('');
    const r = handOver(o, 'pline', () => 999, 0);
    expect(r.started).toBe(true);
    expect(o.job!.h).toBe(hoursOf(o, 'pline'));
    expect(finishDue(o, null, jobEnd(o))).toBe('pline');
    expect(lined(o)).toBe(true);
    expect(partPlan(o, 'pline').length).toBeGreaterThan(0);
    expect(bare(o)).toBe(false);
  });
  it('a lined outpost is on a grid even with no source, and the village feeds its shortfall', () => {
    const o = withLine(dig(0)), all = { a: o };
    expect(grids(all).has('a')).toBe(true);
    expect(lineFlows(W, all, 100).size).toBe(0); // the game has not hooked the villages up
    setLineBalance(() => bal(50, 0));
    const f = lineFlows(W, all, 100).get('a')!;
    expect(f).toBeLessThan(0); // out of the village
    expect(-f).toBe(8); // all the quarry draws
    const g = grids(all), st = gridState(W, all, g, 100);
    expect(st.share[g.get('a')!]).toBe(1);
    expect(powerShare(W, all, 'a', 600)).toBe(1);
  });
  it('a grid with power to spare feeds the village, up to the cap', () => {
    const o = withLine(gen(0)), all = { a: o };
    setLineBalance(() => bal(0, 200));
    expect(lineFlows(W, all, 100).get('a')).toBe(40); // the generator's 40 kW, nothing drawn here
    expect(lineInto(W, all, V.id, 100)).toBe(40);
    const b = withLine(gen(0)); b.pl!.v = 9;
    const both = { a: o, b };
    setLineBalance((vid) => (vid === V.id ? bal(0, 200) : bal(0, 200)));
    const fl = lineFlows(W, both, 200);
    expect((fl.get('a') ?? 0) + (fl.get('b') ?? 0)).toBe(80); // two generators on one grid, two villages
    expect(Math.max(...fl.values())).toBeLessThanOrEqual(PLINE.cap);
  });
  it('the village balance takes what the line brings', () => {
    const v = allVillages(W)[0], seed = villageSeed(W, v);
    const raw = balance(W, v, seed, undefined, 600);
    setLineHook(() => 30);
    const b = balance(W, v, seed, undefined, 600);
    expect(b.line).toBe(30);
    expect(b.made).toBeCloseTo(raw.made + 30, 5);
    expect(balance(W, v, seed, undefined, 600, true).line).toBe(0);
  });
});
