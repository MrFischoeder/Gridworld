import { describe, it, expect } from 'vitest';
import { PORT, partProblem, handOver, finishDue, jobEnd, bare, type OutpostState } from '../src/gen/outposts';
import { newPort, portId, portSpots, portProblem, portPut, portTake, portVol, portWorks, portPoint, isPort, portClaims } from '../src/gen/ports';
import { crews, pantryOf, LIFE } from '../src/gen/outpostlife';
import { demandOf, grids } from '../src/gen/grid';
import { worthRobbing, settleRaids } from '../src/gen/outpostraids';
import type { Pier } from '../src/gen/piers';

const W = -123456;
const dock = (x = 9000, z = 4000): Pier => ({ id: 'pier:p1:100:0', x, z, dx: 1, dz: 0, len: 20, g0: 1.5, given: {}, done: 50 });
const all = () => 9999;

describe('ports (stage Z2)', () => {
  it('a port is founded behind its dock and keyed by it', () => {
    const p = dock(), o = newPort(W, p, 'Ala', 0);
    expect(isPort(o)).toBe(true);
    expect(portId(p.id)).toBe('port:pier:p1:100:0');
    expect(o.pier).toBe(p.id);
    const [x, z] = portPoint(p, -PORT.back, 0);
    expect(o.x).toBe(Math.round(x)); expect(o.z).toBe(Math.round(z));
    expect(o.x).toBeLessThan(p.x); // inland of the root (the dock points +x)
    expect(o.name).toMatch(/ Port$/);
  });
  it('needs dry, gentle ground behind the dock', () => {
    const p = dock(), flat = () => 2;
    expect(portProblem(p, flat, () => true)).toBe('');
    expect(portProblem(p, flat, (x) => x > p.x - 10)).toBe('wet');
    expect(portProblem(p, (x) => (p.x - x), () => true)).toBe('steep');
    expect(portProblem({ ...p, done: undefined }, flat, () => true)).toBe('unbuilt');
  });
  it('lays out its pieces on dry land, apart', () => {
    const p = dock(), sp = portSpots(p, (x) => x < p.x - 1);
    for (const q of [sp.house, sp.power, ...sp.bunks, ...sp.fields]) expect(q[0]).toBeLessThan(p.x - 1);
    const pts = [sp.house, sp.power, ...sp.bunks, ...sp.fields];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) expect(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1])).toBeGreaterThan(5);
  });
  it('builds its warehouse, power, bunks and fields, nothing else', () => {
    const o = newPort(W, dock(), 'Ala', 0);
    expect(partProblem(o, 'dig')).not.toBe('');
    expect(partProblem(o, 'store')).not.toBe('');
    expect(partProblem(o, 'wall')).not.toBe('');
    expect(partProblem(o, 'port')).toBe('');
    expect(partProblem(o, 'bunks')).toBe('');
    expect(partProblem(o, 'power')).not.toBe(''); // choose a source first
    const r = handOver(o, 'port', all, 100);
    expect(r.started).toBe(true);
    expect(bare(o)).toBe(false);
    expect(finishDue(o, null, jobEnd(o), 1)).toBe('port');
    expect(o.done?.port).toBe(true);
    expect(pantryOf(o)).toBe(LIFE.shed);
    expect(demandOf(o)).toBe(PORT.kw);
  });
  it('the hold takes crates by volume and gives them back', () => {
    const o = newPort(W, dock(), 'Ala', 0);
    expect(portPut(o, 'grain', 5)).toBe(0); // no warehouse yet
    o.done = { port: true };
    expect(portPut(o, 'grain', 5)).toBe(5);
    expect(portVol(o)).toBeGreaterThan(0);
    const huge = portPut(o, 'stone', 1e6);
    expect(huge).toBeGreaterThan(0);
    expect(portVol(o)).toBeLessThanOrEqual(PORT.vol + 1e-6);
    expect(portTake(o, 'grain', 9)).toBe(5);
    expect(o.hold?.grain).toBeUndefined();
  });
  it('its crane needs the whole crew and power', () => {
    const now = 120 * 500, id = 'port:x', o: OutpostState = { ...newPort(W, dock(), 'Ala', 0), done: { port: true } };
    const outs = { [id]: o };
    expect(portWorks(W, {}, id, now).why).toBe('unbuilt');
    expect(portWorks(W, outs, id, now).why).toBe('hands');
    o.n = { bunks: 2 }; o.life = { t: now, n: 10, food: 50, fed: 1 };
    expect(crews(o, 10).dig).toBe(PORT.crew);
    expect(portWorks(W, outs, id, now).why).toBe('power'); // no grid reaches it
    o.done!.power = true; o.pk = 'generator'; o.fuel = { n: 20, t: now };
    expect(grids(outs).has(id)).toBe(true);
    expect(portWorks(W, outs, id, now).why).toBe('');
    o.life.n = PORT.crew - 1;
    expect(portWorks(W, outs, id, now).why).toBe('hands');
  });
  it('levels the ground under what is built or going up', () => {
    const p = dock(), o = newPort(W, p, 'Ala', 0, 'crew', portSpots(p, (x) => x < p.x - 1));
    expect(portClaims(W, { a: o })).toEqual([]);
    handOver(o, 'port', all, 0);
    expect(portClaims(W, { a: o }).length).toBe(1);
    finishDue(o, null, jobEnd(o));
    o.n = { bunks: 1, field: 2 };
    const c = portClaims(W, { a: o });
    expect(c.length).toBe(4);
    expect(portClaims(W, { a: o })).toEqual(c); // the same on every game
  });
  it('is not raided yet', () => {
    const o: OutpostState = { ...newPort(W, dock(30000, 9000), 'Ala', 0), done: { port: true }, life: { t: 0, n: 20, food: 10, fed: 1 } };
    expect(worthRobbing(o)).toBe(false);
    expect(settleRaids(W, 'port:x', o, null, 1440 * 60)).toEqual([]);
  });
});
