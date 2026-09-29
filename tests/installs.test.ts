import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { installSites, installMisfit, inInstall, INSTALLS, INSTALL_STAGES, INSTALL_WORK, newInstall, installPlan, handOverInstall, runInstall, installDone, loadInstall, fixInstall, pickInstallLead, installLeadText, installLeadId, INSTALL_LEAD, RADAR, radarPlaces, INSTALL_DRAW, HALL_SETS, HALL_STAGE, fuelHall, hallKw, hallPick, hallReady, workOf, installWorks, setInstallRec, INSTALL_SCALE, type InstallState } from '../src/gen/installs';
import { ITEMS } from '../src/data/items';
import { chunkTrees } from '../src/gen/trees';
import { CHUNK } from '../src/gen/regions';
import { PLANTS } from '../src/gen/plants';
import { cellVillages, cellOrder } from '../src/gen/contracts';

describe('great installations', () => {
  it('stand in fixed, fitting places in their band, on bare ground', () => {
    for (const w of [12345, 777, 1, 4242]) {
      const t = new Terrain(w), a = installSites(t);
      expect(a).toEqual(installSites(new Terrain(w)));
      expect(a.length).toBe(INSTALLS.length);
      for (const s of a) {
        const spec = INSTALLS.find((x) => x.k === s.k)!, d = Math.hypot(s.x, s.z);
        expect(d).toBeGreaterThanOrEqual(spec.band[0] - 1); expect(d).toBeLessThanOrEqual(spec.band[1] + 1);
        expect(installMisfit(t, s.x, s.z, spec.r)).toBeNull(); // (searched at the plan's radius, so a plant keeps its place when it grows)
        const cx = Math.floor(s.x / CHUNK), cz = Math.floor(s.z / CHUNK);
        for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const tr of chunkTrees(t, cx + i, cz + j)) expect(inInstall(t, tr.x, tr.z)).toBe(false);
      }
    }
  }, 120000);

  it('are restored stage by stage, the last one only with the plans', () => {
    const s = newInstall(), plenty = () => 99;
    for (const st of INSTALL_STAGES.uranium) for (const [k] of st.needs) expect(ITEMS[k]).toBeTruthy();
    // bit by bit: half of each first
    const half = handOverInstall('uranium', s, {}, (k) => Math.floor((INSTALL_STAGES.uranium[0].needs.find((n) => n[0] === k)?.[1] ?? 0) / 2), 0);
    expect(half.built).toBe(false); expect(s.stage).toBe(0);
    expect(handOverInstall('uranium', s, {}, plenty, 0).built).toBe(true); expect(s.stage).toBe(1);
    expect(handOverInstall('uranium', s, {}, plenty, 0).built).toBe(true); expect(s.stage).toBe(2);
    // the core needs Uranium Enrichment
    expect(installPlan('uranium', s, {})!.plans).toBe(false);
    expect(handOverInstall('uranium', s, {}, plenty, 0)).toEqual({ taken: [], built: false });
    expect(handOverInstall('uranium', s, { enrichment: 5 }, plenty, 100).built).toBe(true);
    expect(installDone('uranium', s)).toBe(true); expect(installPlan('uranium', s, {})).toBeNull(); expect(s.t).toBe(100);
  });
  it('turn ore and chemicals into fuel by game time, while fed, powered and with room', () => {
    const w = INSTALL_WORK.uranium!, s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.uranium.length, inp: { uranium: 7, chems: 30 }, t: 0, pw: { nfuel: 4 } };
    runInstall('uranium', s, w.batch - 1); expect(s.out).toBe(0);
    runInstall('uranium', s, w.batch * 10); // ore for two batches only
    expect(s.out).toBe(2); expect(s.inp.uranium).toBe(1); expect(s.inp.chems).toBe(28); expect(s.t).toBe(w.batch * 10);
    expect(s.pw!.nfuel).toBeCloseTo(4 - 2 * w.batch / 5760, 6); // its own reactor burnt a little of a crate for each batch
    s.inp.uranium = 30; runInstall('uranium', s, w.batch * 10 + 5); runInstall('uranium', s, w.batch * 13 + 5);
    expect(s.out).toBe(5); expect(s.inp.uranium).toBe(21);
    runInstall('uranium', s, w.batch * 100); expect(s.out).toBe(w.bay); expect(s.inp.uranium).toBe(30 - (w.bay - 2) * 3);
    // an unrestored plant makes nothing
    const u = { ...newInstall(), inp: { uranium: 9, chems: 9 }, pw: { nfuel: 4 } }; runInstall('uranium', u, 99999); expect(u.out).toBe(0);
    // old saves kept the ore as a number
    expect(fixInstall('uranium', { ...newInstall(), inp: 4 as unknown as Record<string, number> }).inp).toEqual({ uranium: 4 });
  });
  it('a plant makes nothing without power: its hall comes back with the second stage and burns what you bring', () => {
    const w = INSTALL_WORK.uranium!, done = INSTALL_STAGES.uranium.length;
    const s: InstallState = { ...newInstall(), stage: done, inp: { uranium: 30, chems: 30 }, t: 0 };
    runInstall('uranium', s, w.batch * 5); expect(s.out).toBe(0); // no fuel in the hall
    expect(fuelHall('uranium', s, 'coal', 50, w.batch * 5)).toBe(HALL_SETS[0].bunker);
    runInstall('uranium', s, w.batch * 10); expect(s.out).toBe(0); // the coal boiler alone gives 120 of 200 kW
    expect(hallKw('uranium', s)).toBe(120);
    expect(fuelHall('uranium', s, 'fuel', 10, w.batch * 10)).toBe(10);
    expect(hallPick('uranium', s)!.map((h) => h.fuel)).toEqual(['coal', 'fuel']);
    runInstall('uranium', s, w.batch * 12); expect(s.out).toBe(2);
    expect(s.pw!.coal).toBeCloseTo(30 - 2 * w.batch / 120, 6); expect(s.pw!.fuel).toBeCloseTo(10 - 2 * w.batch / 150, 6);
    // the hall is a ruin until the second stage; the chip foundry has no reactor, and one set is enough for it
    const early: InstallState = { ...newInstall(), stage: HALL_STAGE - 1 };
    expect(fuelHall('uranium', early, 'coal', 5, 0)).toBe(0); expect(hallReady('uranium', early)).toBe(false);
    const chips: InstallState = { ...newInstall(), stage: HALL_STAGE };
    expect(fuelHall('chips', chips, 'nfuel', 2, 0)).toBe(0); expect(fuelHall('chips', chips, 'fuel', 5, 0)).toBe(5);
    chips.stage = INSTALL_STAGES.chips.length;
    expect(hallPick('chips', chips)!.map((h) => h.fuel)).toEqual(['fuel']);
    expect(INSTALL_DRAW.radar).toBeUndefined(); // the radar station runs on nothing
  });
  it('the propellant plant and the battery plant: fed by the player, powered by their halls, the fuel only from the old plant', () => {
    const w = INSTALL_WORK.propellant!, s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.propellant.length, pw: { coal: 30 } };
    for (const [i] of w.inp) expect(loadInstall('propellant', s, i, 30, 0)).toBe(30);
    runInstall('propellant', s, w.batch * 2); expect(s.out).toBe(2 * (w.n ?? 1)); expect(s.inp.fuel).toBe(30 - 2 * 3); // the coal boiler alone runs it
    runInstall('propellant', s, w.batch * 100); expect(s.out).toBeLessThanOrEqual(w.bay); expect(s.out % 3).toBe(0);
    expect(INSTALL_STAGES.propellant[2].tech).toBe('propellant'); expect(INSTALL_STAGES.battery[2].tech).toBe('powercells');
    const b = INSTALL_WORK.battery!, bs: InstallState = { ...newInstall(), stage: INSTALL_STAGES.battery.length, pw: { coal: 30 } };
    for (const [i] of b.inp) loadInstall('battery', bs, i, 5, 0);
    runInstall('battery', bs, b.batch * 3); expect(bs.out).toBe(0); // 150 kW: the boiler alone is not enough
    fuelHall('battery', bs, 'fuel', 10, b.batch * 3); runInstall('battery', bs, b.batch * 6); expect(bs.out).toBe(3);
    // nobody else makes rocket propellant now: no village works has it
    expect(Object.values(PLANTS).some((p) => p.recipes.some((r) => r.out[0] === 'propellant'))).toBe(false);
    // every installation stands in its own place, the new ones well apart from the old
    const t = new Terrain(12345), sites = installSites(t);
    expect(sites.map((x) => x.k)).toEqual(INSTALLS.map((x) => x.k));
    // salvagers far out order the cells
    const cv = cellVillages(12345); expect(cv.length).toBeGreaterThan(0);
    let orders = 0; for (let d = 0; d < 10; d++) if (cellOrder(12345, cv[0], d * 1440 + 10)) orders++;
    expect(orders).toBeGreaterThan(0);
  });
  it('the optical works and the alloy complex; the alloy complex makes ceramics instead when set to, its bay empty', () => {
    const s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.alloy.length, pw: { coal: 30, fuel: 30 } };
    const a = workOf('alloy', s)!; expect(a.out).toBe('ancalloy');
    for (const w of installWorks('alloy')) for (const [i] of w.inp) loadInstall('alloy', s, i, 12, 0);
    runInstall('alloy', s, a.batch * 2); expect(s.out).toBe(2);
    expect(setInstallRec('alloy', s, 1, a.batch * 2)).toBe(false); // the bay holds ancient alloy: empty it first
    s.out = 0; expect(setInstallRec('alloy', s, 1, a.batch * 2)).toBe(true);
    const c = workOf('alloy', s)!; expect(c.out).toBe('ceramics');
    runInstall('alloy', s, a.batch * 2 + c.batch * 2); expect(s.out).toBe(2 * (c.n ?? 1));
    expect(INSTALL_STAGES.optical[2].tech).toBe('sensors'); expect(INSTALL_STAGES.alloy[2].tech).toBe('ancmetal');
    expect(workOf('optical')!.out).toBe('sensor');
    // the plants stand INSTALL_SCALE times their plans, on the same spots as ever (searched at the plan's radius)
    const sites = installSites(new Terrain(12345));
    for (const x of sites) expect(x.r).toBe(INSTALLS.find((q) => q.k === x.k)!.r * INSTALL_SCALE);
  });
  it('the precision works and the robotics plant: the top of the chain, fed with what the other old plants make, off the ice', () => {
    const p = workOf('precision')!, r = workOf('robotics')!;
    expect(p.out).toBe('precision'); expect(r.out).toBe('automation');
    expect(p.inp.map(([i]) => i)).toEqual(['steel', 'ancalloy', 'microchip']);
    expect(r.inp.map(([i]) => i)).toEqual(['microchip', 'sensor', 'precision', 'powercell']);
    expect(ITEMS.precision.name).toBe('Precision Components'); expect(ITEMS.automation.name).toBe('Automation Units');
    expect(INSTALL_STAGES.precision[2].tech).toBe('precision'); expect(INSTALL_STAGES.robotics[2].tech).toBe('automation');
    expect(INSTALL_DRAW.precision).toBeGreaterThan(0); expect(INSTALL_DRAW.robotics).toBeGreaterThan(0);
    const s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.robotics.length, pw: { coal: 30, fuel: 30 } } // (200 kW: the boiler and the diesel sets together);
    for (const [i] of r.inp) expect(loadInstall('robotics', s, i, 3, 0)).toBe(3);
    runInstall('robotics', s, r.batch * 5); expect(s.out).toBe(3);
    for (const w of [12345, 777]) for (const x of installSites(new Terrain(w))) if (x.k === 'precision' || x.k === 'robotics') expect(Math.abs(x.z)).toBeLessThan(25000 - 1999);
  }, 120000);
  it('the chip foundry needs every input for a batch', () => {
    const w = INSTALL_WORK.chips!, s: InstallState = { ...newInstall(), stage: INSTALL_STAGES.chips.length, pw: { coal: 30 } };
    expect(loadInstall('chips', s, 'glass', 99, 0)).toBe(w.hopper);
    expect(loadInstall('chips', s, 'uranium', 5, 0)).toBe(0);
    expect(loadInstall('chips', s, 'chems', 10, 0)).toBe(10); expect(loadInstall('chips', s, 'rareearth', 10, 0)).toBe(10);
    runInstall('chips', s, w.batch * 5); expect(s.out).toBe(0); // no copper yet
    expect(loadInstall('chips', s, 'copperbar', 3, w.batch * 5)).toBe(3);
    runInstall('chips', s, w.batch * 20); expect(s.out).toBe(3); expect(s.inp.glass).toBe(w.hopper - 6); expect(s.inp.copperbar).toBe(0);
    expect(s.inp.chems).toBe(7); expect(s.inp.rareearth).toBe(7);
    expect(INSTALL_STAGES.chips[2].tech).toBe('chips');
  });
  it('villagers tell of the nearest installation they know of, once', () => {
    const t = new Terrain(12345), sites = installSites(t), s = sites[0];
    const vx = s.x + 9000, vz = s.z; // a village 9 km east of it
    const got = pickInstallLead(sites, [], () => false, vx, vz);
    expect(got).not.toBeNull();
    expect(installLeadText(got!, vx, vz, 12345)).toMatch(/about \d+(\.\d)? km (north|south|east|west)/);
    expect(pickInstallLead(sites.filter((x) => x.k === got!.k), [installLeadId(got!.k)], () => false, vx, vz)).toBeNull(); // heard of
    expect(pickInstallLead(sites.filter((x) => x.k === got!.k), [], () => true, vx, vz)).toBeNull(); // found
    expect(pickInstallLead(sites, [], () => false, s.x + INSTALL_LEAD + 30000, s.z + 40000)).toBeNull(); // too far
    expect(installLeadText(s, s.x + 9000, s.z, 12345)).toMatch(/west/);
  });
  it('the radar station makes nothing but shows the places round it', () => {
    expect(INSTALL_WORK.radar).toBeUndefined();
    expect(INSTALL_STAGES.radar[2].tech).toBe('radio');
    const s = { ...newInstall(), stage: 3 };
    runInstall('radar', s, 9999); expect(s.out).toBe(0);
    expect(loadInstall('radar', s, 'glass', 5, 0)).toBe(0);
    const t = new Terrain(777), site = installSites(t).find((x) => x.k === 'radar')!, p = radarPlaces(777, site);
    expect(p.some((q) => q.type === 'village')).toBe(true);
    for (const q of p) expect(Math.hypot(q.x - site.x, q.z - site.z)).toBeLessThanOrEqual(RADAR.r + 1);
    for (const o of installSites(t)) if (o !== site) expect(Math.hypot(o.x - site.x, o.z - site.z)).toBeGreaterThan(3000);
  });
});
