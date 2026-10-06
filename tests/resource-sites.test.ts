import { describe, it, expect } from 'vitest';
import { allVillages, villageSeed, GRIDHOLM_ID, WORLD_W } from '../src/gen/regions';
import { villageDeposits, ORES, RESOURCE_PLOTS, RESOURCE_YARD } from '../src/gen/resource-sites';
import { initializeSettlements, projectAvailable, buildProject, tutorialStep, localIndustryDone, resourceYield } from '../src/gen/settlement';
import { resourceRock, resourceRockFloor, resourceRockHit } from '../src/gen/resource-rocks';
import { Terrain } from '../src/gen/terrain';
import { stockOf, settleOwn, anchorNew } from '../src/gen/hall';
import { profileFor, quote } from '../src/gen/market';
import { newChar, loadChar, SAVE_KEY } from '../src/save';
import { farmProblem } from '../src/gen/farms';
import type { TownState } from '../src/gen/town';

const world = 12345, villages = allVillages(world), home = villages.find(v => v.id === GRIDHOLM_ID)!;
const developed = (ore?: 'iron' | 'copper'): TownState => ({ farms: 2, settlement: { v: 1, supplies: true, deposits: { ore, oil: false }, done: { comms: true, warehouse: true, power: true } } });
describe('village extraction landmarks', () => {
  it('gives every settlement common resources but distributes typed ore and oil sparsely and deterministically', () => {
    const c = newChar(); c.world = world; initializeSettlements(c);
    const counts = { ore: 0, oil: 0 }; const types = new Set();
    for (const v of villages) {
      const s = c.towns[v.id], d = s.settlement!.deposits!;
      expect(d).toEqual(villageDeposits(world, v.id)); expect(projectAvailable(s, 'quarry')).toBe(true); expect(projectAvailable(s, 'lumber')).toBe(true);
      expect(projectAvailable(s, 'mine')).toBe(!!d.ore); expect(projectAvailable(s, 'oil')).toBe(d.oil);
      if (d.ore) { counts.ore++; types.add(d.ore); } if (d.oil) counts.oil++;
    }
    expect(counts.ore / villages.length).toBeGreaterThan(.15); expect(counts.ore / villages.length).toBeLessThan(.5);
    expect(counts.oil / villages.length).toBeGreaterThan(.08); expect(counts.oil / villages.length).toBeLessThan(.4);
    expect(types.size).toBeGreaterThanOrEqual(4); expect(c.towns[GRIDHOLM_ID].settlement!.deposits!.ore).toBe('iron');
    expect(new Set(Object.values(ORES).map(o => o.color)).size).toBe(5);
  });
  it('keeps extraction yards about 100 m from the fence, separate from each other and room for infrastructure', () => {
    const plots = Object.values(RESOURCE_PLOTS);
    for (const p of plots) {
      const d = Math.hypot(Math.max(-p.x, p.x - 72, 0), Math.max(-p.z, p.z - 72, 0));
      expect(d).toBeGreaterThanOrEqual(100); expect(d).toBeLessThan(125);
    }
    for (let i = 0; i < plots.length; i++) for (let j = i + 1; j < plots.length; j++) expect(Math.abs(plots[i].x - plots[j].x) >= 2 * RESOURCE_YARD.halfX || Math.abs(plots[i].z - plots[j].z) >= 2 * RESOURCE_YARD.halfZ).toBe(true);
  });
  it('never charges for absent deposits and lets villages without rare resources finish their tutorial', () => {
    const s = developed();
    expect(buildProject(s, 'mine', () => 999)).toEqual({ taken: [], built: false }); expect(s.settlement!.given).toBeUndefined();
    expect(buildProject(s, 'oil', () => 999).built).toBe(false); expect(tutorialStep(s)?.project).toBe('quarry');
    for (const k of ['quarry', 'lumber'] as const) expect(buildProject(s, k, () => 999).built).toBe(true);
    expect(localIndustryDone(s)).toBe(true); expect(farmProblem(s)).toBe(''); expect(tutorialStep(s)?.farm).toBe(3);
    s.farms = 3; expect(tutorialStep(s)?.project).toBe('foodworks');
    expect(buildProject(s, 'foodworks', () => 999).built).toBe(true); expect(tutorialStep(s)?.title).toBe('A thriving settlement');
  });
  it('produces stone and wood everywhere after building, and only the ore named by the local seam', () => {
    const s = developed('copper'), seed = villageSeed(world, home);
    s.people = { n: 60, t: 0, tg: 60 }; // hands for every yard (gen/workforce.ts)
    settleOwn(world, home, seed, s, 1000);
    for (const k of ['quarry', 'lumber', 'mine'] as const) buildProject(s, k, () => 999);
    anchorNew(world, home, seed, s, 1000);
    const out = resourceYield(s); expect(out.stone).toBeGreaterThan(0); expect(out.log).toBeGreaterThan(0); expect(out.copper).toBeGreaterThan(0); expect(out.copperO).toBeGreaterThan(0); expect(out.ore).toBeUndefined(); expect(out.crude).toBeUndefined();
    const stock = stockOf(world, home, seed, s, 1600); expect(stock.ownOf('copper')).toBeGreaterThan(0); expect(stock.ownOf('ore')).toBe(0);
    const profile = profileFor(world, home, seed, s); expect(profile.makes).toContain('copper'); expect(profile.makes).not.toContain('ore');
    expect(quote(home, seed, world, 'copper', {}, 1600, false, 0, s).role).toBe('make');
  });
  it('preserves existing mines, oil wells, deliveries and previously extracted stocks across load and multiplayer initialization', () => {
    const target = villages.find(v => !villageDeposits(world, v.id).ore && !villageDeposits(world, v.id).oil)!;
    const c = newChar(); c.world = world;
    c.towns[target.id] = { own: { copper: { n: 9, t: 1000 }, coal: { n: 7, t: 1000 } }, settlement: { v: 1, done: { mine: true }, given: { oil: { scrap: 5 } } } };
    const loaded = loadChar({ getItem: k => k === SAVE_KEY ? JSON.stringify(c) : null }); initializeSettlements(loaded);
    const s = loaded.towns[target.id]; expect(s.settlement!.deposits).toEqual({ ore: 'iron', oil: true }); expect(s.settlement!.given!.oil!.scrap).toBe(5);
    const stock = stockOf(world, target, villageSeed(world, target), s, 1100); expect(stock.ownOf('copper')).toBe(9); expect(stock.ownOf('coal')).toBe(7);
    const copy = JSON.parse(JSON.stringify(loaded)); initializeSettlements(copy); expect(copy.towns[target.id]).toEqual(s);
  });
  it('renders a dry walkable terrain bowl continuously through the planet seam', () => {
    const T = new Terrain(world, false), p = RESOURCE_PLOTS.mine, x = home.x - 36 + p.x, z = home.z - 36 + p.z;
    T.setSettlementPads([{ y: 6, surface: true, depression: true, poi: { ...home, id: -44, rect: { x0: x - 18, x1: x + 18, z0: z - 14, z1: z + 14 }, flat: 3, blend: 12 } }]);
    const centre = T.heightAt(x, z), rim = T.heightAt(x + 10, z); expect(rim - centre).toBeGreaterThan(1.4); expect(rim - centre).toBeLessThan(1.7); expect(T.water(x, z)).toBeNull();
    for (let a = 0; a < 10; a += .25) expect(Math.abs(T.heightAt(x + a + .25, z) - T.heightAt(x + a, z))).toBeLessThan(.12);
    expect(T.heightAt(x + WORLD_W, z)).toBeCloseTo(centre, 5);
    expect(T.chunkFeatures(Math.floor(x / 32), Math.floor(z / 32)).pads.some(p => p.surface && p.depression)).toBe(true);
  });
  it('allows moving off faceted boulder crowns and shoulders without invisible bounding-box collisions', () => {
    const s = resourceRock(0, 2, 0, 3, 4, 7, .5);
    expect(resourceRockFloor(s, 0, 6, 0)).toBeCloseTo(6); expect(resourceRockHit(s, 0, 6, 0, .3)).toBe(false);
    expect(resourceRockHit(s, 0, 3, 0, .3)).toBe(true); expect(resourceRockFloor(s, 30, 8, 0)).toBe(-Infinity);
    for (let x = -3; x <= 3; x += .1) { const h = resourceRockFloor(s, x, Infinity, 0); if (Number.isFinite(h)) expect(resourceRockHit(s, x, h, 0, .3)).toBe(false); }
  });
});
