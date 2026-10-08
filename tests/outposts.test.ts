import { describe, it, expect } from 'vitest';
import { startLodes, lodeById, regionLode } from '../src/gen/lodes';
import { newOutpost, handOver, finishDue, partPlan, outputs, stockNow, takeCrates, settle, capOf, bare, digOf, OUTPOST, mayUse } from '../src/gen/outposts';

const W = -12345;
const lode = () => startLodes(W).find((l) => l.k === 'iron')!;
const all = () => 999;
describe('stage O2: outposts at the deposits', () => {
  it('finds a deposit again by its id', () => {
    for (const l of startLodes(W)) expect(lodeById(W, l.id)).toEqual(l);
    expect(lodeById(W, 'lode:x')).toBeNull();
    for (let rx = -20; rx < 20; rx++) { const l = regionLode(W, rx, 3); if (l) expect(lodeById(W, l.id)?.id).toBe(l.id); }
  });
  it('belongs to the crew, takes materials bit by bit and builds in time', () => {
    const l = lode(), o = newOutpost(l, 'Ada', 100);
    expect(mayUse(o, 'anyone')).toBe(true);
    expect(digOf(l.k)).toBe('mine');
    const half = (k: string) => Math.floor((partPlan(o, 'dig').find((r) => r.k === k)?.n ?? 0) / 2);
    let r = handOver(o, 'dig', half as never, 100);
    expect(r.started).toBe(false);
    expect(bare(o)).toBe(false);
    r = handOver(o, 'dig', all, 110);
    expect(r.started).toBe(true);
    expect(handOver(o, 'store', all, 110).taken).toEqual([]); // one build at a time
    expect(finishDue(o, l, 110 + 60 * OUTPOST.hours.dig - 1)).toBeNull();
    expect(finishDue(o, l, 110 + 60 * OUTPOST.hours.dig)).toBe('dig');
    expect(o.done?.dig).toBe(true);
  });
  it('digs by the formula, piles a few in the open and many in the shed, and gives what is taken', () => {
    const l = lode(), o = newOutpost(l, 'Ada', 0);
    handOver(o, 'dig', all, 0); finishDue(o, l, 600);
    const [g, rate] = outputs(l)[0];
    expect(rate).toBeCloseTo(OUTPOST.rate * l.rich, 2);
    expect(stockNow(o, l, 600 + 60)[g]).toBeCloseTo(rate, 3);
    expect(stockNow(o, l, 600 + 60 * 1000)[g]).toBe(OUTPOST.pile); // no shed: a small pile
    settle(o, l, 600 + 60 * 1000);
    handOver(o, 'store', all, 600 + 60 * 1000); const done = 600 + 60 * 1000 + 60 * OUTPOST.hours.store;
    finishDue(o, l, done);
    expect(capOf(o)).toBe(OUTPOST.cap);
    expect(takeCrates(o, l, g, 4, done)).toBe(4);
    expect(Math.floor(stockNow(o, l, done)[g]!)).toBe(OUTPOST.pile - 4);
    expect(stockNow(o, l, done + 60 * 10000)[g]).toBe(OUTPOST.cap);
  });
});
