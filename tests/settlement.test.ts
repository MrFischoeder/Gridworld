import { describe, it, expect } from 'vitest';
import { newChar, loadChar, SAVE_KEY } from '../src/save';
import { allVillages, GRIDHOLM_ID, villageSeed } from '../src/gen/regions';
import { initializeSettlements, PROJECTS, buildProject, projectProblem, projectDone, tutorialStep, progressive, housingCapacity, smithAllows, starterRecipe, commsRuin, RESOURCE_PLOTS } from '../src/gen/settlement';
import { siteBuilt, industryOf, production, industrySite } from '../src/gen/industry';
import { powerCondition, powerSite, type TownState } from '../src/gen/town';
import { baseKw } from '../src/gen/energy';
import { hallSpec, VEHICLE_HALL, deposit, holdOf, holdVol, stockOf, settleOwn, anchorNew, refineStock, unloadCargo, cargoVehicleInside } from '../src/gen/hall';
import { handOverFarm, farmTarget, farmPlot } from '../src/gen/farms';
import { peopleAt, retarget } from '../src/gen/people';
import { generateVillage } from '../src/gen/village';
import { settlementVillage } from '../src/gen/settlement-village';
import { VEHICLES } from '../src/data/vehicles';
import { basicQuest, GRIDHOLM_TOWN } from '../src/gen/quests';
import { mergeWorld } from '../src/net/worlddoc.mjs';
import type { ItemKey } from '../src/data/items';

const fresh = (): TownState => ({ settlement: { v: 1 } });
const world = 12345;
const home = () => allVillages(world).find((v) => v.id === GRIDHOLM_ID)!;

describe('new settlements and frozen saves', () => {
  it('new worlds start small and empty, while old saves preserve their buildings and an exact backup', () => {
    const c = newChar(); c.world = world; initializeSettlements(c);
    for (const v of allVillages(world)) expect(progressive(c.towns[v.id])).toBe(true);
    const v = home(), seed = villageSeed(world, v), s = c.towns[v.id], k = industryOf(world, v, seed);
    expect(peopleAt(seed, true, s, 1e6)).toBe(8);
    expect(siteBuilt(k, s)).toBe(false); expect(powerCondition(seed, s, 500)).toBe(0);
    expect(baseKw(world, v, seed, s, 500)).toBe(0); expect(production(world, v, seed, s, 500)).toBe(0);
    const stock = stockOf(world, v, seed, s, 1e6);
    for (const g of stock.own) expect(stock.has(g)).toBe(0);
    expect(hallSpec(s).vol).toBe(800);
    const raw = JSON.stringify({ v: 3, world, gold: 71, towns: { [GRIDHOLM_ID]: { farms: 2, built: true, hold: { stone: 17 } } } });
    const data: Record<string, string> = { [SAVE_KEY]: raw };
    const store = { getItem: (key: string) => data[key] ?? null, setItem: (key: string, value: string) => { data[key] = value; } };
    const old = loadChar(store); initializeSettlements(old);
    expect(old.settlementRules).toBe(0); expect(old.gold).toBe(71); expect(old.towns[GRIDHOLM_ID].hold?.stone).toBe(17);
    expect(progressive(old.towns[GRIDHOLM_ID])).toBe(false); expect(hallSpec(old.towns[GRIDHOLM_ID]).vol).toBe(6000);
    expect(data['gridWorld.frozen.0.130.0']).toBe(raw);
    data[SAVE_KEY] = raw.replace('71', '81'); loadChar(store); expect(data['gridWorld.frozen.0.130.0']).toBe(raw);
    expect(loadChar({ getItem: (key) => key === 'gridWorld.frozen.0.130.0' ? null : store.getItem(key), setItem: () => { throw Error('quota'); } }).gold).toBe(81);
  });
  it('partial shared deliveries enforce development order and never charge a completed project twice', () => {
    const s = fresh();
    expect(tutorialStep(s)?.supplies).toBe(true);
    expect(buildProject(s, 'warehouse', () => 999)).toEqual({ taken: [], built: false });
    expect(handOverFarm(s, world, true, 1000, () => 999).built).toBe(false);
    s.settlement!.supplies = true;
    expect(handOverFarm(s, world, true, 1000, () => 999).built).toBe(true);
    expect(tutorialStep(s)?.project).toBe('comms');
    const first = buildProject(s, 'comms', (k) => k === 'log' ? 3 : 0);
    expect(first.built).toBe(false); expect(first.taken).toEqual([['log', 3]]);
    const rest = buildProject(s, 'comms', () => 999); expect(rest.built).toBe(true);
    expect(rest.taken).toEqual([['log', 3], ['stone', 6], ['scrap', 4]]);
    expect(buildProject(s, 'comms', () => 999)).toEqual({ taken: [], built: false });
    expect(projectProblem(s, 'warehouse')).not.toBe('');
    handOverFarm(s, world, true, 1000, () => 999);
    for (const k of ['warehouse', 'power', 'mine', 'lumber', 'oil', 'refinery'] as const) {
      expect(projectProblem(s, k)).toBe(''); expect(buildProject(s, k, () => 999).built).toBe(true); expect(projectDone(s, k)).toBe(true);
    }
    const loaded = loadChar({ getItem: (key) => key === SAVE_KEY ? JSON.stringify({ ...newChar(), world, towns: { [GRIDHOLM_ID]: s } }) : null });
    expect(loaded.towns[GRIDHOLM_ID]).toEqual(s); expect(loaded.settlementRules).toBe(1);
    expect(hallSpec(s)).toEqual(VEHICLE_HALL);
  });
  it('farms support gradual immigration and matching repairs of vacant homes', () => {
    const s = fresh(), v = home(), seed = villageSeed(world, v), now = 1000;
    const empty = generateVillage(seed, 5, 0, 0, 'Gridholm', true);
    settlementVillage(empty, s, 8, false);
    const ruined = empty.buildings.filter((b) => b.role === 'house');
    expect(ruined.length).toBeGreaterThan(0); expect(ruined.every((b) => b.condition === 0 && b.furniture.length === 0)).toBe(true);
    expect(ruined.flatMap((b) => b.walls).every((w) => w[4] <= 6.6)).toBe(true);
    s.settlement!.supplies = true; handOverFarm(s, seed, true, now, () => 999);
    retarget(s, seed, true, now, farmTarget(seed, true, s, 0));
    expect(peopleAt(seed, true, s, now)).toBe(8);
    const late = peopleAt(seed, true, s, now + 100000);
    expect(late).toBeGreaterThan(8); expect(late).toBeLessThanOrEqual(housingCapacity(s));
    const repaired = generateVillage(seed, 5, 0, 0, 'Gridholm', true);
    settlementVillage(repaired, s, late, false);
    expect(repaired.buildings.some((b) => b.role === 'house' && !b.mine && b.condition === undefined)).toBe(true);
    const owned = generateVillage(seed, 5, 0, 0, 'Gridholm', true); settlementVillage(owned, fresh(), 8, true);
    expect(owned.buildings.find((b) => b.mine)?.condition).toBeUndefined(); expect(owned.house).not.toBeNull();
  });
  it('limits the starting smith and offers only small delivery or kill quests', () => {
    const s = fresh(); expect(smithAllows(s, 'hatchet')).toBe(true); expect(smithAllows(s, 'rifle')).toBe(false);
    expect(smithAllows(s, 'hideCoat')).toBe(false); expect(starterRecipe(s, 'planks')).toBe(false);
    s.farms = 1; expect(starterRecipe(s, 'planks')).toBe(true); expect(smithAllows(s, 'hideCoat')).toBe(true);
    s.settlement!.done = { power: true }; expect(smithAllows(s, 'rifle')).toBe(true); expect(smithAllows({}, 'rifle')).toBe(true);
    for (let i = 0; i < 40; i++) { const q = basicQuest(world, i, GRIDHOLM_TOWN); expect(['resource', 'bounty']).toContain(q.kind); expect(q.count).toBeLessThanOrEqual(3); expect(q).toEqual(basicQuest(world, i, GRIDHOLM_TOWN)); }
    const ruin = commsRuin(world, home())!; expect(ruin.type).toBe('ruin'); expect(Math.hypot(ruin.x, ruin.z)).toBeLessThan(600);
  });
  it('creates extraction stocks only after construction and converts actual crude into fuel', () => {
    const s = fresh(), v = home(), seed = villageSeed(world, v);
    s.people = { n: 60, t: 0, tg: 60 }; // hands for every yard (gen/workforce.ts)
    settleOwn(world, v, seed, s, 1000); s.settlement!.done = { mine: true, lumber: true, oil: true, refinery: true, power: true }; s.settlement!.refinedAt = 1000;
    anchorNew(world, v, seed, s, 1000);
    expect(stockOf(world, v, seed, s, 1000).has('crude')).toBe(0);
    const later = stockOf(world, v, seed, s, 1240); expect(later.ownOf('crude')).toBeGreaterThan(0); expect(later.ownOf('ore')).toBeGreaterThan(0);
    deposit(s, 'crude', 10);
    const before = stockOf(world, v, seed, s, 1240), crude = before.has('crude');
    expect(refineStock(world, v, seed, s, 1240)).toBe(2);
    expect(stockOf(world, v, seed, s, 1240).has('crude')).toBe(crude - 2);
    expect(stockOf(world, v, seed, s, 1240).ownOf('fuel')).toBe(2);
    expect(refineStock(world, v, seed, s, 1240)).toBe(0);
    s.hold = {}; s.own!.crude = { n: 0, t: 1360 }; expect(refineStock(world, v, seed, s, 1360)).toBe(0);
  });
  it('keeps overflow in vehicle trunks and leaves weapons aboard when unloading', () => {
    const s = fresh(); s.settlement!.done = { warehouse: true };
    deposit(s, 'stone', 11998); // 23996 litres; exactly two stones still fit.
    const cargo: ({ k: ItemKey; n: number } | null)[] = [{ k: 'stone', n: 5 }, { k: 'rifle', n: 1 }, { k: 'log', n: 3 }];
    expect(unloadCargo(s, cargo)).toBe(2); expect(holdOf(s, 'stone')).toBe(12000);
    expect(cargo).toEqual([{ k: 'stone', n: 3 }, { k: 'rifle', n: 1 }, { k: 'log', n: 3 }]); expect(holdVol(s)).toBe(24000);
    expect(unloadCargo(s, cargo)).toBe(0);
  });
  it('fits the largest vehicle and keeps new plots clear of farm corners and old works', () => {
    const h = VEHICLE_HALL; expect(h.door).toBeGreaterThan(VEHICLES.mastodon.width + 1); expect(h.z1 - h.z0).toBeGreaterThan(VEHICLES.mastodon.length * 2); expect(h.h).toBeGreaterThan(VEHICLES.mastodon.height + 1);
    expect(cargoVehicleInside(h, { x: 14, z: -41, heading: Math.PI / 2 }, VEHICLES.mastodon)).toBe(true);
    expect(cargoVehicleInside(h, { x: 5, z: -41, heading: Math.PI / 2 }, VEHICLES.mastodon)).toBe(false);
    const overlap = (a: { x0: number; x1: number; z0: number; z1: number }, b: { x0: number; x1: number; z0: number; z1: number }) => a.x0 < b.x1 && b.x0 < a.x1 && a.z0 < b.z1 && b.z0 < a.z1;
    const plots = [h, ...Object.values(RESOURCE_PLOTS).map((p) => ({ x0: p.x - 7, x1: p.x + 7, z0: p.z - 6, z1: p.z + 6 }))];
    for (let seed = 1; seed < 100; seed++) {
      const sites = [powerSite(seed), industrySite(seed, 'mine')].map((p) => ({ x0: p.x - p.w / 2, x1: p.x + p.w / 2, z0: p.z - p.d / 2, z1: p.z + p.d / 2 }));
      for (let i = 0; i < 3; i++) sites.push(farmPlot(seed, i));
      for (const p of plots) for (const q of sites) expect(overlap(p, q)).toBe(false);
    }
  });
  it('merges different players completing independent settlement projects', () => {
    const base = fresh(); base.settlement!.done = { comms: true }; const a = structuredClone(base), b = structuredClone(base);
    a.settlement!.done!.warehouse = true; b.settlement!.done!.power = true;
    const combined = mergeWorld(a, base, b) as TownState;
    expect(combined.settlement!.done).toEqual({ comms: true, warehouse: true, power: true });
    const copy = JSON.parse(JSON.stringify(combined)); expect(projectDone(copy, 'warehouse')).toBe(true);
    expect(Object.keys(PROJECTS)).toContain('refinery');
  });
});
