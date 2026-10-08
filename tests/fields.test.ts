import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { allVillages, villageSeed, GRIDHOLM_ID, findPoi } from '../src/gen/regions';
import { FIELD, fieldProblem, fieldPad, fieldClaim, farmField, reservedZones } from '../src/gen/fields';
import { RESOURCE_PLOTS } from '../src/gen/resource-sites';
import { handOverFarm, placeFarm, farmsOf, FARM } from '../src/gen/farms';
import { finishJob } from '../src/gen/jobs';
import { jobOf } from '../src/gen/construction';
import type { TownState } from '../src/gen/town';

const world = 12345;
describe('farm fields', () => {
  const T = new Terrain(world), home = findPoi(world, GRIDHOLM_ID)!, seed = villageSeed(world, home);
  it('refuses the village, the resource yards, too far out; finds room within reach', () => {
    expect(fieldProblem(T, home, seed, {}, home.x, home.z, [])).toMatch(/village/);
    const q = RESOURCE_PLOTS.quarry, ox = home.x - 36, oz = home.z - 36;
    expect(fieldProblem(T, home, seed, {}, ox + q.x, oz + q.z, [])).toMatch(/quarry/);
    expect(fieldProblem(T, home, seed, {}, ox + RESOURCE_PLOTS.oil.x, oz + RESOURCE_PLOTS.oil.z, [])).toMatch(/oil/);
    expect(fieldProblem(T, home, seed, {}, home.x + FIELD.reach + 50, home.z, [])).toMatch(/far/);
    for (const v of allVillages(world).slice(0, 12)) {
      const sd = villageSeed(world, v); let ok = 0;
      for (let a = 0; a < 64 && !ok; a++) for (const r of [120, 200, 300, 420]) { const x = v.x + Math.cos(a) * r, z = v.z + Math.sin(a) * r; if (!fieldProblem(T, v, sd, {}, x, z, [])) { ok++; break; } }
      expect(ok, v.name).toBeGreaterThan(0);
    }
    expect(reservedZones(world, home, seed, {}).length).toBeGreaterThan(8);
  });
  it('a farm waits for its field, then the builders start there; the ground is levelled', () => {
    const s: TownState = {}, all = () => 99;
    const r = handOverFarm(s, seed, true, 100, all, true);
    expect(r.wait).toBe(true); expect(s.fwait).toBe(true); expect(jobOf(s, 'farm')).toBeFalsy();
    expect(handOverFarm(s, seed, true, 100, all, true).taken).toEqual([]); // nothing more while it waits
    let spot: { x: number; z: number; y: number } | null = null;
    for (let a = 0; a < 64 && !spot; a++) { const x = Math.round(home.x + Math.cos(a) * 250), z = Math.round(home.z + Math.sin(a) * 250); if (!fieldProblem(T, home, seed, s, x, z, [])) spot = { x, z, y: fieldPad(T, x, z) }; }
    expect(spot).not.toBeNull();
    expect(placeFarm(s, spot!, 200)).toBe(true); expect(placeFarm(s, spot!, 200)).toBe(false);
    expect(s.fwait).toBeUndefined(); expect(jobOf(s, 'farm')).toBeTruthy();
    finishJob(world, home, s, jobOf(s, 'farm')!, 10_000);
    expect(farmsOf(s)).toBe(1);
    const f = farmField(home, seed, s, 0);
    expect((f.x0 + f.x1) / 2).toBe(spot!.x); expect(f.x1 - f.x0).toBe(2 * FIELD.half);
    const t2 = new Terrain(world); t2.setClaims([fieldClaim(spot!)]);
    for (const [u, v] of [[0, 0], [5, 5], [-5, 4]]) { const nat = T.base(spot!.x + u, spot!.z + v); expect(Math.abs(t2.heightAt(spot!.x + u, spot!.z + v) - spot!.y)).toBeLessThanOrEqual(Math.abs(nat - spot!.y) * FIELD.soft + 0.05); } // (0.181) eased, not table-flat
    // the next field may not sit on this one
    expect(fieldProblem(T, home, seed, s, spot!.x + 4, spot!.z, [fieldClaim(spot!)])).toMatch(/field/);
    expect(FARM.max).toBeGreaterThan(1);
  });
});
