import { describe, it, expect } from 'vitest';
import { industryOf, industrySite, production, siteCondition, handOverBuild, buildPlan, INDUSTRY, SITE, type Industry } from '../src/gen/industry';
import { powerSite, type TownState } from '../src/gen/town';
import { raidsBetween, RAID } from '../src/gen/raids';
import { profileOf } from '../src/gen/market';
import { allVillages, villageSeed, worldDist } from '../src/gen/regions';
import { hash } from '../src/core/rng';

describe('village industries', () => {
  it('differ from village to village; refineries only near oil wells; the market makes what the industry makes', () => {
    const seen = new Set<Industry>();
    for (const w of [hash(9, 1), hash(9, 2), hash(9, 3)]) {
      const vs = allVillages(w);
      for (const v of vs) {
        const s = villageSeed(w, v), k = industryOf(w, v, s);
        seen.add(k);
        for (const g of profileOf(w, v, s).makes) expect(INDUSTRY[k].pool).toContain(g);
        if (k === 'refinery') expect(vs.some((o) => o !== v && worldDist(o.x, o.z, v.x, v.z) < 9000 && industryOf(w, o, villageSeed(w, o)) === 'oil')).toBe(true);
        // the site lies outside the fence, on another side than the power plant
        const site = industrySite(s, k), p = powerSite(s);
        expect(site.side).not.toBe(p.side); expect(site.side).not.toBe('N');
      }
    }
    for (const k of ['farm', 'mine', 'oil', 'refinery'] as Industry[]) expect(seen.has(k)).toBe(true);
  });
  it('a refinery produces nothing until it is built; raids knock a site down and it heals', () => {
    const w = hash(9, 1), vs = allVillages(w);
    const ref = vs.find((v) => industryOf(w, v, villageSeed(w, v)) === 'refinery')!, s = villageSeed(w, ref), st: TownState = {};
    expect(production(w, ref, s, st, 5000)).toBe(0);
    handOverBuild('refinery', st, () => 5);
    expect(st.built).toBeFalsy();
    const r = handOverBuild('refinery', st, () => 999);
    expect(r.built).toBe(true); expect(buildPlan('refinery', st)).toBeNull();
    expect(production(w, ref, s, st, 5000)).toBeGreaterThan(0);
    const raided = vs.find((v) => raidsBetween(w, v, 0, 30 * 1440).length)!;
    const raid = raidsBetween(w, raided, 0, 30 * 1440)[1], end = raid.t0 + RAID.duration, lost: TownState = { raids: { [raid.k]: 'lost' } };
    const hit = siteCondition(w, raided, lost, end + 1);
    expect(hit).toBeLessThan(100 - SITE.raid * 0.9);
    expect(siteCondition(w, raided, lost, end + SITE.heal / 2)).toBeGreaterThan(hit);
    expect(siteCondition(w, raided, { ...lost, siteFixed: end + 10 }, end + 20)).toBe(100);
  });
});
