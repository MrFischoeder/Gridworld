import { describe, it, expect } from 'vitest';
import { findRoad, roadToWorks, reachable, endNode, wayAt, wayPose } from '../src/gen/roadnet';
import { network } from '../src/gen/roads';
import { newRoad, handOverRoad, coverOf, fedOf, foodFor, PROAD, startUpgrade, handOverUp, upCover, type PlayerRoad, type RoadEnd } from '../src/gen/playerroads';
import { newHubLine, hlLeg, hlEnergy } from '../src/gen/hublines';
import { worldDist } from '../src/gen/regions';
import type { Hub } from '../src/gen/warehouses';

const WORLD = -499177371;
/** A track built long ago from a to b, straight, with the surface `cls`. */
function built(id: string, a: RoadEnd, b: RoadEnd, cls = 0): PlayerRoad {
  const r = newRoad(id, a, b, [[a.x, a.z], [(a.x + b.x) / 2, (a.z + b.z) / 2], [b.x, b.z]], 'Ala', 'p1', 0);
  r.t0 = 0; r.cls = cls;
  return r;
}

describe('(0.283) the road network and the convoys on it', () => {
  const e = network(WORLD)[0], A = e.a, B = e.b;
  it('two villages on an old road are joined; the way is no shorter than the straight line', () => {
    const w = findRoad(WORLD, {}, 1e6, 'v:' + A.id, 'v:' + B.id, A.x)!;
    expect(w).not.toBeNull();
    expect(w.km * 1000).toBeGreaterThan(worldDist(A.x, A.z, B.x, B.z) * 0.95);
    expect(w.pts.length).toBeGreaterThan(2);
    expect(w.t).toBeLessThan(w.km); // an old road is quicker than a dirt track
  });
  it('an outpost is off the network until a finished track joins it', () => {
    const gate: RoadEnd = { kind: 'gate', id: `g:${A.id}:N`, name: A.name, x: A.x, z: A.z - 60 };
    const out: RoadEnd = { kind: 'outpost', id: 'o:lode:test', name: 'Quarry', x: A.x + 300, z: A.z - 600 };
    expect(findRoad(WORLD, {}, 1e6, 'lode:test', 'v:' + A.id, A.x)).toBeNull();
    expect(roadToWorks(WORLD, {}, 1e6, 'v:' + A.id, { 'lode:test': {} })).toBe(false);
    const t = built('t1', gate, out);
    expect(endNode(t, 'a')).toBe('v:' + A.id); expect(endNode(t, 'b')).toBe('lode:test');
    const unbuilt = { ...t, t0: undefined };
    expect(findRoad(WORLD, { t1: unbuilt }, 1e6, 'lode:test', 'v:' + A.id, A.x)).toBeNull();
    const w = findRoad(WORLD, { t1: t }, 1e6, 'lode:test', 'v:' + A.id, A.x)!;
    expect(w).not.toBeNull();
    expect(roadToWorks(WORLD, { t1: t }, 1e6, 'v:' + A.id, { 'lode:test': {} })).toBe(true);
    // over the old road on to the next village
    expect(reachable(WORLD, { t1: t }, 1e6, 'lode:test').has('v:' + B.id)).toBe(true);
    // a paved track is quicker and burns less
    const p = findRoad(WORLD, { t1: built('t1', gate, out, 2) }, 1e6, 'lode:test', 'v:' + A.id, A.x)!;
    expect(p.t).toBeLessThan(w.t); expect(p.f).toBeLessThan(w.f);
  });
  it('a track ending on an old road or on another track joins it at a junction', () => {
    const mid = { x: (A.x + B.x) / 2, z: (A.z + B.z) / 2 };
    const onRoad: RoadEnd = { kind: 'road', id: 'r:road:' + e.key, name: 'the road', x: mid.x, z: mid.z };
    const op: RoadEnd = { kind: 'outpost', id: 'o:lode:j', name: 'Well', x: mid.x + 400, z: mid.z };
    const t = built('t2', onRoad, op);
    const r = reachable(WORLD, { t2: t }, 1e6, 'lode:j');
    expect(r.has('v:' + A.id) && r.has('v:' + B.id)).toBe(true);
    const w = findRoad(WORLD, { t2: t }, 1e6, 'lode:j', 'v:' + B.id, op.x)!;
    expect(w).not.toBeNull();
    const op2: RoadEnd = { kind: 'outpost', id: 'o:lode:k', name: 'Mine', x: op.x + 200, z: op.z + 300 };
    const t3 = built('t3', { kind: 'track', id: 't:t2', name: t.name, x: (mid.x + op.x) / 2, z: mid.z }, op2);
    expect(reachable(WORLD, { t2: t, t3 }, 1e6, 'lode:k').has('v:' + A.id)).toBe(true);
  });
  it('a convoy line on a way times and fuels its trips by it; trucks are drawn along it', () => {
    const w = findRoad(WORLD, {}, 1e6, 'v:' + A.id, 'v:' + B.id, A.x)!;
    const ha: Hub = { id: 'v:' + A.id, kind: 'village', x: A.x, z: A.z, hex: '0:0', name: A.name, vid: A.id };
    const hb: Hub = { ...ha, id: 'v:' + B.id, x: B.x, z: B.z, name: B.name, vid: B.id };
    const l = newHubLine(ha, hb, 0, w), old = newHubLine(ha, hb, 0);
    expect(l.km).toBe(w.km); expect(l.way).toBe(w); expect(old.way).toBeUndefined();
    const slow = { ...l, way: { ...w, t: w.t * 2 } };
    expect(hlLeg(slow)).toBeGreaterThan(hlLeg(l));
    l.truck = { id: 'x', model: 'scout', parts: { fuel: 50 } as never, by: 'Ala' };
    const thirsty = { ...l, way: { ...w, f: w.f * 2 } };
    expect(hlEnergy(thirsty)[1]).toBeGreaterThan(hlEnergy(l)[1]);
    const [x0, z0] = wayAt(w.pts, 0), [x1, z1] = wayAt(w.pts, 1);
    expect(Math.hypot(x0 - w.pts[0][0], z0 - w.pts[0][1])).toBeLessThan(0.01);
    expect(Math.hypot(x1 - w.pts[w.pts.length - 1][0], z1 - w.pts[w.pts.length - 1][1])).toBeLessThan(0.01);
    const p = wayPose(w.pts, 'out', 0.5, w.pts[0][0]);
    expect(Number.isFinite(p[0] + p[1] + p[2])).toBe(true);
  });
  it('a track and its surface want food for the crew', () => {
    const r = newRoad('f1', { kind: 'gate', id: 'g:1:N', name: 'Alpha', x: 0, z: 0 }, { kind: 'outpost', id: 'o:x', name: 'Beta', x: 2000, z: 0 }, [[0, 0], [2000, 0]], 'Ala', 'p1', 0,
      { home: { id: '1', k: 'village', name: 'Alpha', x: 0, z: 0, d: 0 }, wet: 0, logs: 0 });
    expect(r.food).toBe(foodFor(2000)); expect(r.food).toBe(Math.ceil(2 * PROAD.food));
    handOverRoad(r, (k) => (k === 'stone' || k === 'planks' ? 999 : 0), 9999, 0, () => 8);
    expect(coverOf(r)).toBe(0); // no food: no front
    handOverRoad(r, (k) => (k === 'grain' ? 3 : 0), 0, 0, () => 8);
    expect(fedOf(r.given)).toBe(3);
    expect(coverOf(r)).toBe(Math.floor(3 / r.food! * r.len));
    const st = handOverRoad(r, (k) => (k === 'milk' ? 99 : 0), 0, 0, () => 8);
    expect(fedOf(r.given)).toBeGreaterThanOrEqual(r.food!); expect(fedOf(r.given) - r.food!).toBeLessThan(4 / 3);
    expect(coverOf(r)).toBe(r.len); expect(st.started).toBe(false); expect(r.t0).toBe(0);
    r.fr = [r.len, 0]; // done
    expect(startUpgrade(r, 1e6)).toBe(true);
    expect(r.up!.food).toBe(foodFor(2000, PROAD.upFood[1]));
    handOverUp(r, (k) => (k in { stone: 1, sand: 1 } ? 999 : 0), 9999, 1e6, () => 8);
    expect(upCover(r)).toBe(0);
    handOverUp(r, (k) => (k === 'grain' ? 99 : 0), 0, 1e6, () => 8);
    expect(upCover(r)).toBe(r.len);
  });
});
