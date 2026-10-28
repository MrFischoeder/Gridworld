import { describe, it, expect } from 'vitest';
import { nextCls, startUpgrade, handOverUp, upNeeds, upStalled, upFrontAt, upDone, upDoneAt, clsAt, clsOf, slicePts } from '../src/gen/playerroads';
import { SURFACE } from '../src/data/vehicles';
import { PROAD, MACHINE_X, frontAt, doneAt, stalled, coverOf, handOverPart, logsReady, startFrom, newRoad, roadNeeds, roadHours, roadWage, handOverRoad, roadShare, roadBuilt, stretchProblem, routeProblem, proposeWay, terrainWays, waysKey, smoothPts, roadLength, newRoadProblem, type RoadGround, type RoadEnd } from '../src/gen/playerroads';
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
    expect(waysKey({ t1: r }, 300 + r.h * 60)).toBe('t1|0|');
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

  it('(0.281, D2) a crew from home digs as far as the supplies go, waits, and goes on when more comes', () => {
    const home = { id: '7', k: 'village' as const, name: 'Home', x: 0, z: -100, d: 100 };
    const r = newRoad('t2', A, B, [[0, 0], [150, 0], [300, 0]], 'Ala', 'p1', 0, { home, wet: 40, logs: 12 });
    expect(r.v).toBe(2);
    const stone = r.len / 16;
    // half of everything: covers ~150 m, enough to start; the home sends 4
    const half = (k: string) => Math.ceil(({ stone: Math.ceil(300 / 16) + 10, planks: Math.ceil(300 / 22) } as Record<string, number>)[k] / 2);
    void stone;
    const st = handOverRoad(r, half as never, Math.ceil(105 / 2), 10, () => 4);
    expect(st.started).toBe(true); expect(r.crew).toBe(4);
    const cov = coverOf(r); expect(cov).toBeGreaterThanOrEqual(PROAD.first); expect(cov).toBeLessThan(r.len);
    // after the camp is pitched the front moves at 4 × dig and stops at the cover
    const t1 = 10 + PROAD.setup + 20;
    expect(frontAt(r, t1)).toBeCloseTo(4 * PROAD.dig * 20);
    expect(doneAt(r)).toBe(Infinity);
    expect(stalled(r, 10 + PROAD.setup + 1e4)).toBe('supply');
    expect(frontAt(r, 1e5)).toBeCloseTo(cov);
    // the rest comes later: the front goes on from where it waited, at the grader's pace
    handOverPart(r, 'mach', () => 99, 2e4);
    expect(r.has?.mach).toBe(2e4);
    handOverRoad(r, () => 999, 999, 3e4, () => 4);
    expect(coverOf(r)).toBe(r.len);
    expect(frontAt(r, 3e4)).toBeCloseTo(cov);
    expect(doneAt(r)).toBeCloseTo(3e4 + (r.len - cov) / (4 * PROAD.dig * MACHINE_X));
    expect(roadBuilt(r, doneAt(r))).toBe(true);
    expect(logsReady(r, doneAt(r))).toBe(12);
  });
  it('(0.281, D2) no free hands: the work waits; far from home it needs a road camp', () => {
    const far = newRoad('t3', A, { ...B, x: 3000 }, [[0, 0], [3000, 0]], 'Ala', 'p1', 0, { home: { id: '1', k: 'outpost', name: 'Camp', x: 0, z: 0, d: 0 }, wet: 0, logs: 0 });
    expect(handOverRoad(far, () => 999, 9999, 5, () => 1).noCrew).toBe(true);
    expect(far.t0).toBeUndefined();
    handOverRoad(far, () => 999, 9999, 6, () => 9);
    expect(far.crew).toBe(PROAD.crew);
    expect(frontAt(far, 1e6)).toBeCloseTo(PROAD.walk);
    expect(stalled(far, 1e6)).toBe('camp');
    handOverPart(far, 'camp', () => 99, 1e6);
    expect(stalled(far, 1e6)).toBe('');
    expect(roadBuilt(far, 1e6 + (3000 - PROAD.walk) / (PROAD.crew * PROAD.dig) + 1)).toBe(true);
  });
  it('(0.281, D2) the home nearer the far end turns the way round; swamp takes more stone', () => {
    const w = startFrom({ pts: [[0, 0], [300, 0]] as [number, number][], a: A, b: B }, { x: 320, z: 0 });
    expect(w.a.id).toBe(B.id); expect(w.pts[0]).toEqual([300, 0]);
    expect(roadNeeds(300, 40)[0][1]).toBe(roadNeeds(300)[0][1] + 10);
  });
  it('(0.282, D3) a gravel surface laid along a supplied front, then paved; the land gets it in steps', () => {
    const home = { id: '7', k: 'village' as const, name: 'Home', x: 0, z: -100, d: 100 };
    const r = newRoad('t4', A, B, [[0, 0], [150, 0], [300, 0]], 'Ala', 'p1', 0, { home, wet: 0, logs: 0 });
    handOverRoad(r, () => 999, 999, 1, () => 4);
    const end = doneAt(r);
    expect(nextCls(r, end - 1)).toBeNull();
    expect(nextCls(r, end)).toBe(1);
    expect(startUpgrade(r, end)).toBe(true);
    expect(terrainWays({ t4: r }, end)[0].cls).toBe(0);
    // a third of the gravel: the front waits at the cover
    handOverUp(r, (k) => Math.ceil((upNeeds(r.len, 1).find(([i]) => i === k)?.[1] ?? 0) / 2), 999, end + 10, () => 5);
    expect(r.up!.crew).toBe(5);
    expect(upStalled(r, end + 1e5)).toBe('supply');
    const half = upFrontAt(r, end + 1e5);
    expect(half).toBeGreaterThan(100); expect(half).toBeLessThan(r.len);
    const ways = terrainWays({ t4: r }, end + 1e5);
    expect(ways.map((w) => w.cls)).toEqual([1, 0]);
    expect(clsAt(r, 10, end + 1e5)).toBe(1); expect(clsAt(r, r.len - 1, end + 1e5)).toBe(0);
    handOverUp(r, () => 999, 999, end + 1e5, () => 5);
    expect(upDone(r, upDoneAt(r))).toBe(true);
    const t = upDoneAt(r);
    expect(terrainWays({ t4: r }, t).map((w) => w.cls)).toEqual([1]);
    expect(nextCls(r, t)).toBe(2);
    startUpgrade(r, t);
    expect(clsOf(r)).toBe(1); expect(r.up!.to).toBe(2);
    expect(nextCls(r, t)).toBeNull();
  });
  it('(0.282, D3) better surfaces are faster and thriftier; off the road slower and thirstier', () => {
    const order = ['off', 'dirt', 'road', 'gravel', 'paved'] as const;
    for (let i = 1; i < order.length; i++) {
      expect(SURFACE[order[i]].speed).toBeGreaterThan(SURFACE[order[i - 1]].speed);
      expect(SURFACE[order[i]].fuel).toBeLessThan(SURFACE[order[i - 1]].fuel);
    }
    expect(slicePts([[0, 0], [10, 0], [10, 10]], 5, 15)).toEqual([[5, 0], [10, 0], [10, 5]]);
  });
});
