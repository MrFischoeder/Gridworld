import { describe, it, expect } from 'vitest';
import { PROAD, newRoad, roadNeeds, roadHours, roadWage, handOverRoad, roadShare, roadBuilt, stretchProblem, routeProblem, proposeWay, terrainWays, waysKey, smoothPts, roadLength, newRoadProblem, type RoadGround, type RoadEnd } from '../src/gen/playerroads';
import { Terrain } from '../src/gen/terrain';
import { chunkTrees } from '../src/gen/trees';

const A: RoadEnd = { kind: 'gate', id: 'g:1:N', name: 'Alpha', x: 0, z: 0 };
const B: RoadEnd = { kind: 'outpost', id: 'o:x', name: 'Beta', x: 300, z: 0 };
const flat: RoadGround = { h: () => 5, bad: () => '' };

describe('(0.280) tracks the heroes build', () => {
  it('the cost grows with the length; the work starts once everything is in', () => {
    const r = newRoad('t1', A, B, [[0, 0], [150, 0], [300, 0]], 'Ala', 'p1', 100);
    expect(r.len).toBe(300); expect(r.h).toBe(roadHours(300));
    expect(roadNeeds(600).every(([, n], i) => n >= roadNeeds(300)[i][1])).toBe(true);
    const half = handOverRoad(r, () => 5, 10, 200);
    expect(half.started).toBe(false); expect(r.paid).toBe(10);
    const rest = handOverRoad(r, () => 999, 999, 300);
    expect(rest.started).toBe(true); expect(rest.paid).toBe(roadWage(300) - 10); expect(r.t0).toBe(300);
    expect(roadShare(r, 300 + r.h * 30)).toBeCloseTo(0.5);
    expect(roadBuilt(r, 300 + r.h * 60 - 1)).toBe(false); expect(roadBuilt(r, 300 + r.h * 60)).toBe(true);
    // the land takes only finished tracks
    expect(terrainWays({ t1: r }, 301)).toHaveLength(0);
    expect(terrainWays({ t1: r }, 300 + r.h * 60)[0].gate).toBe('player');
    expect(waysKey({ t1: r }, 300 + r.h * 60)).toBe('t1');
  });
  it('a stretch: water, places and steep ground are refused; the ends are let off', () => {
    const wall: RoadGround = { h: () => 0, bad: (x) => (Math.abs(x - 50) < 3 ? 'wall' : '') };
    expect(stretchProblem(wall, [0, 0], [100, 0])).toBe('wall');
    expect(stretchProblem(wall, [0, 0], [50, 0], false, true)).toBe('');
    const hill: RoadGround = { h: (x) => x * 0.5, bad: () => '' };
    expect(stretchProblem(hill, [0, 0], [40, 0])).toMatch(/steep/i);
    expect(stretchProblem({ h: (x) => x * 0.1, bad: () => '' }, [0, 0], [40, 0])).toBe('');
    expect(routeProblem(flat, [[0, 0], [PROAD.len + 10, 0]])).toMatch(/Too long/);
    expect(newRoadProblem(flat, A, { ...B, x: 20 }, [[0, 0], [20, 0]], 0)).toMatch(/too close/);
    expect(newRoadProblem(flat, A, B, [[0, 0], [300, 0]], PROAD.open)).toMatch(/finish or pull/);
  });
  it('the surveyors find the gap in a wall and every stretch they stake passes', () => {
    const g: RoadGround = { h: () => 3, bad: (x, z) => (Math.abs(x - 150) < 6 && Math.abs(z - 120) > 10 ? 'wall' : '') };
    const way = proposeWay(g, [0, 0], [300, 0])!;
    expect(way).not.toBeNull();
    expect(way[0]).toEqual([0, 0]); expect(way[way.length - 1]).toEqual([300, 0]);
    for (let i = 1; i < way.length; i++) {
      expect(Math.hypot(way[i][0] - way[i - 1][0], way[i][1] - way[i - 1][1])).toBeLessThanOrEqual(PROAD.seg + 0.01);
      expect(stretchProblem(g, way[i - 1], way[i], i === 1, i === way.length - 1)).toBe('');
    }
    expect(routeProblem(g, way)).toBe('');
    expect(roadLength(way)).toBeGreaterThan(300); // round by the gap
    const shut: RoadGround = { h: () => 3, bad: (x) => (Math.abs(x - 150) < 6 ? 'wall' : '') };
    expect(proposeWay(shut, [0, 0], [300, 0])).toBeNull();
  });
  it('rounded off, the ends stay where they were staked', () => {
    const s = smoothPts([[0, 0], [50, 0], [50, 50]]);
    expect(s[0]).toEqual([0, 0]); expect(s[s.length - 1]).toEqual([50, 50]); expect(s.length).toBeGreaterThan(3);
  });
  it('the land grades a finished track flat across, and the generated trees keep their places', () => {
    const t = new Terrain(-424242, false), x0 = 1800, z0 = 900;
    const before = chunkTrees(t, Math.floor(x0 / 64), Math.floor(z0 / 64)).map((q) => q.seed);
    const pts: [number, number][] = [[x0 - 60, z0], [x0 + 60, z0 + 10]];
    t.setWays([{ id: 'proad:x', from: -1, to: -1, gate: 'player', pts, half: PROAD.half }]);
    const f = t.featuresIn({ x0: x0 - 10, z0: z0 - 10, x1: x0 + 10, z1: z0 + 10 });
    expect(f.ways).toHaveLength(1);
    const mid = t.exact(x0, z0 + 5), side = t.exact(x0, z0 + 5 + PROAD.half * 0.8);
    expect(Math.abs(mid - side)).toBeLessThan(0.05);
    expect(chunkTrees(t, Math.floor(x0 / 64), Math.floor(z0 / 64)).map((q) => q.seed)).toEqual(before);
  });
});
