import { describe, it, expect, afterEach } from 'vitest';
import { assign, postsOf } from '../src/gen/workforce';
import { crews, crewFactor, setCommuteHook, workCap, LIFE } from '../src/gen/outpostlife';
import { COMMUTE, commuteVillages, commutersAt, commuteFrom, setCommute } from '../src/gen/commute';
import { allVillages, GRIDHOLM_ID } from '../src/gen/regions';
import type { TownState } from '../src/gen/town';
import type { OutpostState } from '../src/gen/outposts';

const W = -616161;
const quarry = (x: number): OutpostState => ({ o: 'crew', by: 'Ala', t: 0, k: 'stone', x, z: 0, name: 'Quarry', done: { dig: true } });
const settled = (more: Partial<TownState> = {}): TownState => ({ settlement: { v: 1, supplies: true }, ...more });
afterEach(() => setCommuteHook(null));

describe('commuters (stage Z6)', () => {
  it('the village mans the walk-out post last, with whoever is free', () => {
    const s = settled({ farms: 1, commute: { 'lode:s0': 6 } });
    const posts = postsOf(s);
    expect(posts.at(-1)!.id).toBe('commute:lode:s0');
    const a = assign(s, 7); // 4 on the farm, 3 left
    expect(a.posts.at(-1)!.got).toBe(3);
    expect(assign(s, 20).posts.at(-1)!.got).toBe(6);
    expect(postsOf(settled({ commute: { x: 0 } })).length).toBe(0);
  });
  it('commuters work the post first, the settlers the fields', () => {
    const o = quarry(0); o.n = { field: 1 };
    expect(workCap(o)).toBe(LIFE.digCrew);
    const w = crews(o, 4, 2);
    expect(w.farm).toBe(3);
    expect(w.walk).toBe(2);
    expect(w.dig).toBe(3);
    expect(w.idle).toBe(0);
    expect(crews(o, 0, 99).dig).toBe(LIFE.digCrew); // never more than the post takes
    setCommuteHook(() => LIFE.digCrew);
    expect(crewFactor(o)).toBeCloseTo(1 + LIFE.boost, 5); // a full crew walked in, nobody living here
  });
  it('asks the nearest settlement within reach, and counts who comes', () => {
    const g = allVillages(W)[0];
    expect(g.id).toBe(GRIDHOLM_ID);
    const towns: Record<string, TownState> = { [g.id]: settled() };
    const near = quarry(g.x + 1200), far = quarry(g.x + COMMUTE.reach + 500);
    expect(commuteVillages(W, towns, near).map((q) => q.v.id)).toEqual([g.id]);
    expect(commuteVillages(W, towns, far)).toEqual([]);
    expect(commuteVillages(W, { [g.id]: {} }, near)).toEqual([]); // only settlements send people
    setCommute(towns[g.id], 'a', near);
    expect(commuteFrom(towns, 'a')).toBe(g.id);
    const r = commutersAt(W, towns, 'a', 600);
    expect(r.want).toBe(LIFE.digCrew);
    expect(r.got).toBeGreaterThan(0); // the start's people have nothing else to do yet
    setCommute(towns[g.id], 'a', null);
    expect(towns[g.id].commute).toBeUndefined();
    expect(commutersAt(W, towns, 'a', 600).got).toBe(0);
  });
});
