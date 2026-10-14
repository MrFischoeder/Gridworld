import { describe, it, expect } from 'vitest';
import type { OutpostState } from '../src/gen/outposts';
import { fertility } from '../src/gen/fertility';
import { LINE, newLine, assignShip, recallShip, fuelShip, settleLine, unloadLines, arriving, shipCap, voyageOf, periodOf, voyageFuel, dueVoyages, lineTargets, shipAt } from '../src/gen/shiplines';

const W = -98765;
const port = (x: number, name: string): OutpostState => ({
  o: 'crew', by: 'Ala', t: 0, k: 'port', x, z: 0, name, pier: 'pier:' + name,
  done: { port: true, power: true }, pk: 'generator', fuel: { n: 20, t: 0 }, n: { bunks: 2 },
  life: { t: 0, n: 10, food: 80, fed: 1 },
});
let X0 = 2000;
while (fertility(W, X0, 0) < 0.8 || fertility(W, X0 + 5000, 0) < 0.8) X0 += 500; // both ports on good land (the fields feed them)
const world = () => { const a = port(X0, 'A'), b = port(X0 + 5000, 'B'); return { A: a, B: b, all: { 'port:a': a, 'port:b': b } as Record<string, OutpostState> }; };

describe('cargo lines (stage Z3)', () => {
  it('reaches the other ports and times a voyage', () => {
    const { A, all } = world(), t = lineTargets(all, 'port:a');
    expect(t.map((q) => q.id)).toEqual(['port:b']);
    const l = newLine(A, 'port:b', all['port:b'], 0);
    expect(l.km).toBeCloseTo(5 * LINE.detour, 1);
    expect(voyageOf(l, 'steamer')).toBeLessThan(voyageOf(l, 'ship')); // the motor ship is faster
    expect(periodOf(l, 'steamer')).toBe(2 * (voyageOf(l, 'steamer') + LINE.load));
    expect(voyageFuel(l, 'ship')).toBe(0);
    expect(voyageFuel(l, 'steamer')).toBeGreaterThan(0);
  });
  it('carries the hold to the other port, once', () => {
    const { A, B, all } = world();
    A.hold = { grain: 30, stone: 200 };
    A.line = newLine(A, 'port:b', B, 0);
    assignShip(A.line, { id: 'boat:p:1:0', k: 'steamer', fuel: 200, by: 'Ala' }, 0);
    const P = periodOf(A.line, 'steamer'), arrive = LINE.load + voyageOf(A.line, 'steamer');
    expect(dueVoyages(A.line, arrive - 1)).toBe(0);
    expect(dueVoyages(A.line, arrive)).toBe(1);
    const v = settleLine(W, all, 'port:a', arrive);
    expect(v).toEqual([{ k: 0, fate: 'ok', n: shipCap('steamer') }]);
    const sent = Object.values(A.line.sent).reduce((a, n) => a + (n ?? 0), 0);
    expect(sent).toBe(shipCap('steamer'));
    expect(A.line.ship!.fuel).toBeCloseTo(200 - voyageFuel(A.line, 'steamer'), 5);
    expect(settleLine(W, all, 'port:a', arrive)).toEqual([]); // settled once
    expect(arriving(all, 'port:b')[0].n).toBe(sent);
    const got = unloadLines(W, all, 'port:b', arrive).reduce((a, [, n]) => a + n, 0);
    expect(got).toBe(sent);
    expect(unloadLines(W, all, 'port:b', arrive)).toEqual([]); // never twice
    expect(arriving(all, 'port:b')[0].n).toBe(0);
    expect(shipAt(A.line, arrive + 1).at).toBe('there');
    expect(dueVoyages(A.line, arrive + P)).toBe(1);
  });
  it('carries only the chosen goods', () => {
    const { A, B, all } = world();
    A.hold = { grain: 5, stone: 5 };
    A.line = newLine(A, 'port:b', B, 0); A.line.only = ['stone'];
    assignShip(A.line, { id: 'x', k: 'steamer', fuel: 200, by: 'Ala' }, 0);
    settleLine(W, all, 'port:a', LINE.load + voyageOf(A.line, 'steamer'));
    expect(A.line.sent).toEqual({ stone: 5 });
    expect(A.hold.grain).toBe(5);
  });
  it('stays in port without a crane crew at either end, or without diesel', () => {
    const { A, B, all } = world();
    A.hold = { grain: 5 };
    B.life!.n = 2; // too few for the crane
    A.line = newLine(A, 'port:b', B, 0);
    assignShip(A.line, { id: 'x', k: 'steamer', fuel: 200, by: 'Ala' }, 0);
    expect(settleLine(W, all, 'port:a', LINE.load + voyageOf(A.line, 'steamer'))[0].fate).toBe('idle');
    expect(A.hold.grain).toBe(5);
    B.life!.n = 10; A.line.ship!.fuel = 1;
    const P = periodOf(A.line, 'steamer');
    expect(settleLine(W, all, 'port:a', P + LINE.load + voyageOf(A.line, 'steamer'))[0].fate).toBe('dry');
    expect(fuelShip(A.line, 99)).toBe(Math.floor((200 - 1) / 20));
  });
  it('a sailing ship burns nothing, but lies becalmed now and then', () => {
    const { A, B, all } = world();
    for (const p of [A, B]) { p.n = { bunks: 3, field: 3 }; p.life = { t: 0, n: 20, food: 80, fed: 1 }; p.fuel = { n: 1e6, t: 0 }; } // fed and powered for months
    A.line = newLine(A, 'port:b', B, 0);
    assignShip(A.line, { id: 'x', k: 'ship', by: 'Ala' }, 0);
    const P = periodOf(A.line, 'ship');
    const v = settleLine(W, all, 'port:a', 60 * P);
    expect(v.filter((q) => q.fate === 'ok').length).toBeGreaterThan(30);
    const calm = v.filter((q) => q.fate === 'calm').length;
    expect(v.length).toBeGreaterThan(50);
    expect(calm).toBeGreaterThan(0);
    expect(calm / v.length).toBeLessThan(0.35);
    expect(fuelShip(A.line, 3)).toBe(0);
  });
  it('a new line counts from nothing at the other port', () => {
    const { A, B, all } = world();
    A.hold = { grain: 10 };
    A.line = newLine(A, 'port:b', B, 0);
    assignShip(A.line, { id: 'x', k: 'steamer', fuel: 200, by: 'Ala' }, 0);
    const at = LINE.load + voyageOf(A.line, 'steamer');
    settleLine(W, all, 'port:a', at); unloadLines(W, all, 'port:b', at);
    recallShip(A.line); delete A.line;
    A.hold = { grain: 10 };
    A.line = newLine(A, 'port:b', B, at + 1);
    assignShip(A.line, { id: 'x', k: 'steamer', fuel: 200, by: 'Ala' }, at + 1);
    settleLine(W, all, 'port:a', at + 1 + at);
    expect(arriving(all, 'port:b')[0].n).toBe(10);
  });
});
