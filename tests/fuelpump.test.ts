import { describe, it, expect } from 'vitest';
import { projectProblem, buildProject, projectDone, optionalProjects, PROJECTS, RESOURCE_PLOTS } from '../src/gen/settlement';
import { hoursOf } from '../src/gen/construction';
import type { TownState } from '../src/gen/town';

const town = (): TownState => ({ farms: 2, people: { n: 60, t: 0, tg: 60 }, settlement: { v: 1, deposits: { kind: 'lumber', v: 2, oil: false, grove: true }, done: { power: true } } } as TownState);

describe('the fuel pump (0.179)', () => {
  it('is built like a project after the warehouse, never there by itself', () => {
    const s = town();
    expect(projectDone(s, 'fuelpump')).toBe(false);
    expect(projectProblem(s, 'fuelpump')).toMatch(/warehouse/);
    expect(optionalProjects(s)).not.toContain('fuelpump');
    s.settlement!.done!.warehouse = true;
    expect(projectProblem(s, 'fuelpump')).toBe(''); expect(optionalProjects(s)).toContain('fuelpump');
    expect(buildProject(s, 'fuelpump', () => 0).built).toBe(false); // nothing without the materials
    expect(buildProject(s, 'fuelpump', () => 99).built).toBe(true); expect(projectDone(s, 'fuelpump')).toBe(true);
    expect(optionalProjects(s)).not.toContain('fuelpump');
    expect(PROJECTS.fuelpump.needs.length).toBeGreaterThan(0); expect(hoursOf('project', 'fuelpump')).toBeGreaterThan(0);
    expect(RESOURCE_PLOTS.fuelpump).toBeDefined();
  });
});
