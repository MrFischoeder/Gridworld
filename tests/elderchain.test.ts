import { describe, it, expect } from 'vitest';
import { elderTasks } from '../src/gen/elderchain';
import type { TownState } from '../src/gen/town';

describe("the elder's commissions", () => {
  it('open one after another: farms, then the wall, then the works, the plant, the improvements', () => {
    const at = (s: TownState) => [...elderTasks(s)];
    expect(at({})).toEqual(['farms']);
    expect(at({ fgiven: { planks: 3 } })).toEqual(['farms']); // begun, not built: nothing new yet
    expect(at({ farms: 1 })).toEqual(['farms', 'fortify']);
    expect(at({ farms: 1, wall: 1 })).toEqual(['farms', 'fortify', 'works']);
    expect(at({ farms: 1, works: { turret: 1 } as never })).toEqual(['farms', 'fortify', 'works']);
    expect(at({ farms: 2, wall: 1, plants: [{ k: 'sawmill', rec: 0, inp: {}, out: {}, t: 0 }] })).toEqual(['farms', 'fortify', 'works', 'plantup']);
    expect(at({ farms: 2, wall: 1, plants: [{ k: 'sawmill', rec: 0, inp: {}, out: {}, t: 0 }], pup: 1 })).toEqual(['farms', 'fortify', 'works', 'plantup', 'improve']);
    expect(at({ pup: 1 })).toEqual(['farms', 'plantup']); // whatever was begun before stays on the list
  });
});
