import { describe, it, expect, afterAll } from 'vitest';
import { departures, caravanOf, caravanShift, roadsOf, setConvoyStart, convoyStart } from '../src/gen/caravans';
import { convoyStartOf, projectProblem, optionalProjects, buildProject, GRIDHOLM_ID, type Project } from '../src/gen/settlement';
import { finishJob } from '../src/gen/jobs';
import { findPoi } from '../src/gen/regions';
import type { TownState } from '../src/gen/town';
import { hash } from '../src/core/rng';

const w = hash(6, 6);
const town = (done: Partial<Record<Project, boolean>> = {}, depotAt?: number): TownState => ({ settlement: { v: 1, done, depotAt } } as TownState);
afterAll(() => setConvoyStart(w, -Infinity));

describe('convoys come with the convoy depot (0.214)', () => {
  it('an old world always had them; a new one none until a depot stands, then from its completion', () => {
    expect(convoyStartOf({})).toBe(-Infinity);
    expect(convoyStartOf({ [GRIDHOLM_ID]: town() })).toBe(Infinity);
    expect(convoyStartOf({ [GRIDHOLM_ID]: town({ depot: true }, 5000), 7: town({ depot: true }, 3000) })).toBe(3000);
  });
  it('the depot waits for the mechanic and the warehouse, then the elder offers it', () => {
    expect(projectProblem(town({ power: true, warehouse: true }), 'depot')).not.toBe('');
    const ready = town({ power: true, warehouse: true, quarry: true });
    expect(projectProblem(ready, 'depot')).toBe('');
    expect(optionalProjects(ready)).toContain('depot');
    expect(optionalProjects(town({ power: true, warehouse: true, quarry: true, depot: true }))).not.toContain('depot');
  });
  it('finishing it records when trade began', () => {
    const s = town({ power: true, warehouse: true, quarry: true });
    const v = findPoi(w, GRIDHOLM_ID)!;
    const have = { planks: 99, stone: 99, scrap: 99, wire: 99, parts: 99 } as Record<string, number>;
    buildProject(s, 'depot', (k) => have[k] ?? 0, 1000);
    const job = Object.values(s.jobs ?? {})[0]!;
    expect(job).toBeTruthy();
    finishJob(w, v, s, job, 1000 + job.h * 60);
    expect(s.settlement!.depotAt).toBe(1000 + job.h * 60);
    expect(convoyStartOf({ [GRIDHOLM_ID]: s })).toBe(1000 + job.h * 60);
  });
  it('no departure before trade began: no caravans, no market shift', () => {
    const roads = roadsOf(w, GRIDHOLM_ID);
    expect(departures(w, roads[0], 0, 3 * 1440).length).toBeGreaterThan(0);
    setConvoyStart(w, Infinity);
    expect(convoyStart(w)).toBe(Infinity);
    expect(departures(w, roads[0], 0, 3 * 1440)).toEqual([]);
    expect(caravanOf(w, roads[0], 3)).toBeNull();
    expect(Object.keys(caravanShift(w, GRIDHOLM_ID, 3 * 1440, 2160))).toEqual([]);
    setConvoyStart(w, 1440);
    const d = departures(w, roads[0], 0, 4 * 1440);
    expect(d.length).toBeGreaterThan(0);
    for (const c of d) expect(c.t0).toBeGreaterThanOrEqual(1440);
  });
});
