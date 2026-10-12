import { describe, it, expect } from 'vitest';
import { startLodes, lodeById } from '../src/gen/lodes';
import { allVillages } from '../src/gen/regions';
import { newOutpost, handOver, finishDue, partProblem, OUTPOST, type OutpostState } from '../src/gen/outposts';
import { PROC, procOf, runProc, cargoGoods } from '../src/gen/outpostproc';
import { newRoute, assignTruck, settleRoute, convoyAt, truckEnergy, fuelTruck, tripKwh } from '../src/gen/routes';
import { demandOf, settleAll } from '../src/gen/grid';
import { freshParts, EV } from '../src/data/vehicles';

const W = -12345, all = () => 999, DAY = 1440;
const lodeOf = (k: string) => startLodes(W).find((l) => l.k === k)!;
function built(k: string, parts: ('dig' | 'store' | 'proc')[]): OutpostState {
  const l = lodeOf(k), o = newOutpost(l, 'Ada', 0);
  let t = 0;
  for (const p of parts) { handOver(o, p, all, t); t += OUTPOST.hours[p] * 60; expect(finishDue(o, l, t)).toBe(p); }
  return o;
}
describe('stage O7: processing on site and electric convoys', () => {
  it('has a works for the oil, the ores, the grove and the stone, none for coal', () => {
    expect(procOf('oil')?.out).toBe('fuel'); expect(procOf('iron')?.out).toBe('iron'); expect(procOf('grove')?.out).toBe('planks'); expect(procOf('stone')?.out).toBe('cutstone');
    expect(procOf('coal')).toBeNull();
    const o = newOutpost(lodeOf('iron'), 'Ada', 0);
    expect(partProblem(o, 'proc')).toMatch(/extraction/);
    expect(partProblem(newOutpost(lodeOf('coal'), 'Ada', 0), 'proc')).toMatch(/Nothing/);
  });
  it('turns the raw good into the processed one by the batch, no faster than the input allows', () => {
    const l = lodeOf('iron'), o = built('iron', ['dig', 'store', 'proc']), p = PROC.iron!;
    const t = o.pt!, b = runProc(o, l, t + 10 * 60);
    expect(b).toBeGreaterThan(0); expect(b).toBeLessThanOrEqual(10 * 60 / p.batch);
    expect(o.stock!.n.iron).toBe(b * p.m);
    expect(Math.floor(o.stock!.n.ore ?? 0)).toBeGreaterThanOrEqual(0);
    expect(cargoGoods(o, ['ore'])[0]).toBe('iron');
    expect(demandOf(o)).toBeGreaterThan(12);
  });
  it('is the same however often it is settled', () => {
    const l = lodeOf('grove'), a = built('grove', ['dig', 'store', 'proc']), b: OutpostState = JSON.parse(JSON.stringify(a)), end = a.pt! + 2 * DAY;
    for (let t = a.pt!; t < end; t += 120) settleAll(W, { [l.id]: a }, (id) => lodeById(W, id), t);
    settleAll(W, { [l.id]: a }, (id) => lodeById(W, id), end); settleAll(W, { [l.id]: b }, (id) => lodeById(W, id), end);
    expect(a.stock!.n.planks).toBeGreaterThan(0);
    expect(Math.abs((a.stock!.n.planks ?? 0) - (b.stock!.n.planks ?? 0))).toBeLessThanOrEqual(PROC.grove!.m * 2);
  });
  it('runs an electric truck while its outpost is on a grid, and parks it when not', () => {
    const l = lodeOf('iron'), o = built('iron', ['dig', 'store']), v = allVillages(W)[0];
    o.route = newRoute(o, v, v.name);
    assignTruck(o.route, { id: 'e1', model: 'mastodon', parts: { ...freshParts('mastodon'), ev: 0 }, by: 'Ada' }, 2000);
    expect(fuelTruck(o.route, 3)).toBe(0); // no canisters into a battery
    expect(truckEnergy(o.route)[2]).toBe('kWh');
    settleRoute(W, o, l, 2000 + 3 * DAY, 1, false);
    expect(o.route.last?.[1]).toBe('dry'); expect(convoyAt(o.route, 2000 + 3 * DAY + 10).at).toBe('parked');
    settleRoute(W, o, l, 2000 + 6 * DAY, 1, true);
    expect(o.route.last?.[1]).not.toBe('dry');
    expect(o.route.truck!.parts.ev).toBeCloseTo(EV.mastodon.cap - tripKwh(o.route, 'mastodon'), 1);
  });
});
