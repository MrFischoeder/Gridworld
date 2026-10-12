import { describe, it, expect } from 'vitest';
import { rivalHomes, homeOf, makeHome, seatOwner, seatOf, addPartner, dropPartner, RIVALS, isRivalHome } from '../src/gen/rivals';
import { allVillages, findPoi, GRIDHOLM_ID, worldDist } from '../src/gen/regions';
import { initializeSettlements, progressive } from '../src/gen/settlement';
import { newOutpost, mayUse } from '../src/gen/outposts';
import { startLodes } from '../src/gen/lodes';
import type { TownState } from '../src/gen/town';

const W = -24680;
describe('stage O8: rivals', () => {
  it('gives every seat its own home, Gridholm first, the others far out and far apart, the same every time', () => {
    const h = rivalHomes(W);
    expect(h.length).toBe(RIVALS.seats); expect(h[0]).toBe(GRIDHOLM_ID);
    expect(new Set(h).size).toBe(h.length);
    const towns = new Set(allVillages(W).map((v) => v.id));
    for (const id of h) expect(towns.has(id)).toBe(true);
    const p = h.map((id) => findPoi(W, id)!);
    for (let i = 1; i < p.length; i++) {
      expect(Math.hypot(p[i].x, p[i].z)).toBeGreaterThanOrEqual(RIVALS.from);
      for (let j = 0; j < i; j++) expect(worldDist(p[i].x, p[i].z, p[j].x, p[j].z)).toBeGreaterThan(6000);
    }
    expect(homeOf(W, 3)).toBe(h[3]); expect(homeOf(W, 99)).toBe(GRIDHOLM_ID);
    expect(isRivalHome(W, h[2])).toBe(true); expect(isRivalHome(W, GRIDHOLM_ID)).toBe(false);
  });
  it('turns a seat\'s home town into a settlement once, and the towns rule leaves it so', () => {
    const c = { settlementRules: 1, world: W, towns: {} as Record<string, TownState> };
    initializeSettlements(c);
    const vid = homeOf(W, 2);
    expect(c.towns[vid].wall).toBeGreaterThan(0); expect(progressive(c.towns[vid])).toBe(false);
    expect(makeHome(c, 2)).toBe(true);
    expect(progressive(c.towns[vid])).toBe(true); expect(c.towns[vid].wall).toBeUndefined();
    expect(c.towns[vid].settlement!.deposits?.v).toBe(3);
    initializeSettlements(c);
    expect(c.towns[vid].wall).toBeUndefined(); expect(progressive(c.towns[vid])).toBe(true);
    expect(makeHome(c, 2)).toBe(false); expect(makeHome(c, 0)).toBe(false); // Gridholm is a settlement already
  });
  it('an outpost is its seat\'s and the partners\' it lets in; the crew\'s are everyone\'s', () => {
    const l = startLodes(W)[0], crew = newOutpost(l, 'Ada', 0), mine = newOutpost(l, 'Ada', 0, seatOwner(0));
    expect(seatOwner(-1)).toBe('crew'); expect(seatOf('s4')).toBe(4); expect(seatOf('crew')).toBe(-1);
    expect(mayUse(crew, 's1')).toBe(true);
    expect(mayUse(mine, 's0')).toBe(true); expect(mayUse(mine, 's1')).toBe(false);
    expect(addPartner(mine, 's1')).toBe(true); expect(addPartner(mine, 's1')).toBe(false); expect(addPartner(mine, 's0')).toBe(false);
    expect(mayUse(mine, 's1')).toBe(true); expect(mayUse(mine, 's2')).toBe(false);
    expect(dropPartner(mine, 's1')).toBe(true); expect(mine.pp).toBeUndefined(); expect(mayUse(mine, 's1')).toBe(false);
  });
});
