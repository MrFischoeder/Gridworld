import { describe, it, expect } from 'vitest';
import { Terrain } from '../src/gen/terrain';
import { allVillages, villageSeed, GRIDHOLM_ID, findPoi } from '../src/gen/regions';
import { warehouseProblem, reservedZones } from '../src/gen/fields';
import { buildProject, placeWarehouse, projectDone } from '../src/gen/settlement';
import { hallSpec, hallTerminal, warehouseSpot, warehouseAt, apronOf, hallPoint, VEHICLE_HALL, WAREHOUSE, type HallSpot } from '../src/gen/hall';
import { finishJob } from '../src/gen/jobs';
import { jobOf } from '../src/gen/construction';
import type { TownState } from '../src/gen/town';

const world = 12345;
const ready = (): TownState => ({ settlement: { v: 1, done: { power: true, sawmill: true } }, farms: 2 });
describe('the staked-out warehouse (0.197)', () => {
  const T = new Terrain(world), home = findPoi(world, GRIDHOLM_ID)!, seed = villageSeed(world, home);
  /** The first spot round the village (ring r, plaza-local) the rules allow, its doors towards the village. */
  const find = (v = home, s: TownState = ready()): HallSpot | null => {
    const sd = villageSeed(world, v);
    for (const r of [80, 110, 150, 200, 260]) for (let a = 0; a < 48; a++) {
      const x = Math.round(36 + Math.cos(a / 48 * 6.283) * r), z = Math.round(36 + Math.sin(a / 48 * 6.283) * r);
      const d = Math.abs(x - 36) > Math.abs(z - 36) ? (x > 36 ? 3 : 1) : (z > 36 ? 2 : 0);
      const p = { x, z, d };
      if (!warehouseProblem(T, v, sd, s, p, [])) return p;
    }
    return null;
  };
  it('waits for its spot when the materials are in, then the builders start there', () => {
    const s = ready(), all = () => 999;
    const r = buildProject(s, 'warehouse', all, 100);
    expect('wait' in r && r.wait).toBe(true); expect(s.settlement!.whWait).toBe(true); expect(jobOf(s, 'project', 'warehouse')).toBeFalsy();
    expect(warehouseSpot(s)).toBeNull(); // nothing levelled or marked yet
    expect(buildProject(s, 'warehouse', all, 100).taken).toEqual([]);
    const p = find(home, s)!; expect(p).not.toBeNull();
    expect(placeWarehouse(s, p, 200)).toBe(true); expect(placeWarehouse(s, p, 200)).toBe(false);
    expect(s.settlement!.whWait).toBeUndefined(); expect(warehouseSpot(s)).toEqual(p);
    finishJob(world, home, s, jobOf(s, 'project', 'warehouse')!, 10_000);
    expect(projectDone(s, 'warehouse')).toBe(true);
    const h = hallSpec(s); expect((h.x0 + h.x1) / 2).toBe(p.x); expect((h.z0 + h.z1) / 2).toBe(p.z); expect(h.d).toBe(p.d); expect(h.vol).toBe(VEHICLE_HALL.vol);
    // the terminal stands against the back wall, away from the doors
    const t = hallTerminal(s), [bx, bz] = hallPoint(h, 0, -(h.z1 - h.z0) / 2);
    expect(Math.hypot(t.x - bx, t.z - bz)).toBeCloseTo(1.1, 5);
    expect(reservedZones(world, home, seed, s).some((z) => z.k === 'warehouse')).toBe(true);
  });
  it('keeps old warehouses on their plot', () => {
    const s = ready(); s.settlement!.done!.warehouse = true;
    expect(warehouseSpot(s)).toEqual({ x: 14, z: -41, d: 0 }); expect(hallSpec(s)).toMatchObject(VEHICLE_HALL);
    const j = ready(); buildProject(j, 'warehouse', () => 999); // built at once (no timing): the old plot too
    expect(hallSpec(j)).toMatchObject({ x0: VEHICLE_HALL.x0, z0: VEHICLE_HALL.z0 });
  });
  it('refuses the village, doors facing the wall, too far out; finds room round every village', () => {
    expect(warehouseProblem(T, home, seed, ready(), { x: 36, z: 36, d: 0 }, [])).toMatch(/village/i);
    expect(warehouseProblem(T, home, seed, ready(), { x: 36, z: -30, d: 0 }, [])).toMatch(/wall|village/i); // doors onto the wall
    expect(warehouseProblem(T, home, seed, ready(), { x: 36 + WAREHOUSE.reach + 40, z: 36, d: 1 }, [])).toMatch(/far/i);
    for (const v of allVillages(world).slice(0, 10)) expect(find(v), v.name).not.toBeNull();
  });
  it('the apron lies before the doors on every side', () => {
    for (const d of [0, 1, 2, 3]) {
      const h = warehouseAt({ x: 0, z: 0, d }), a = apronOf(h), [dx, dz] = hallPoint(h, 0, 20);
      expect(dx > a.x0 && dx < a.x1 && dz > a.z0 && dz < a.z1).toBe(true);
    }
  });
});
