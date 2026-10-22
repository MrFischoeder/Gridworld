import { describe, it, expect } from 'vitest';
import type { OutpostState } from '../src/gen/outposts';
import type { TownState } from '../src/gen/town';
import type { ItemKey } from '../src/data/items';
import { fertility } from '../src/gen/fertility';
import { noteArrival, setForward, takeTransit, transitCount, dropWay, type Transit } from '../src/gen/transit';
import { newLine, assignShip, settleLine, unloadLines, rcvKey, voyageOf, LINE } from '../src/gen/shiplines';
import { hlDrain, hlKey, lineLoad, type HubLine } from '../src/gen/hublines';
import { linkedHubs } from '../src/gen/radio';

const W = -98765;
const port = (x: number, name: string): OutpostState => ({
  o: 'crew', by: 'Ala', t: 0, k: 'port', x, z: 0, name, pier: 'pier:' + name,
  done: { port: true, power: true, radio: true }, pk: 'generator', fuel: { n: 20, t: 0 }, n: { bunks: 2 },
  life: { t: 0, n: 10, food: 80, fed: 1 },
});
let X0 = 2000;
while (fertility(W, X0, 0) < 0.8 || fertility(W, X0 + 30000, 0) < 0.8) X0 += 500;

describe('goods passing through (0.253)', () => {
  it('counts what comes in from a line sent on, and loads it first', () => {
    const st: Transit = {};
    noteArrival(st, 'k1', 'stone', 5); // not forwarded: nothing counted
    expect(st.tr).toBeUndefined();
    setForward(st, 'k1', 'hl');
    noteArrival(st, 'k1', 'stone', 5); noteArrival(st, 'k2', 'log', 3);
    expect(transitCount(st, 'hl')).toBe(5);
    const hold: Partial<Record<ItemKey, number>> = { stone: 8, wire: 20 };
    const take = (k: ItemKey, n: number) => { hold[k] = (hold[k] ?? 0) - n; return n; };
    expect(lineLoad(st, hold, 10, ['wire'], take)).toEqual([['stone', 5], ['wire', 5]]); // the transit first, whatever the line carries
    expect(transitCount(st, 'hl')).toBe(0); expect(st.tr).toBeUndefined();
  });
  it('trims to what is still in the hold, and forgets a way given up', () => {
    const st: Transit = {}; setForward(st, 'k', 'sl'); noteArrival(st, 'k', 'grain', 10);
    const hold: Partial<Record<ItemKey, number>> = { grain: 4 };
    expect(takeTransit(st, 'sl', hold, 2, (k, n) => { hold[k]! -= n; return n; })).toEqual([['grain', 2]]);
    expect(transitCount(st, 'sl')).toBe(2);
    dropWay(st, 'sl');
    expect(st.tr).toBeUndefined(); expect(st.fwd).toBeUndefined();
  });
  it('a convoy\'s cargo taken in at a port goes on by its cargo line', () => {
    const A = port(X0, 'A'), B = port(X0 + 30000, 'B'), all: Record<string, OutpostState> = { 'port:a': A, 'port:b': B };
    const hl: HubLine = { id: 7, to: 'port:a', toName: 'A', tx: A.x, tz: 0, km: 3, k: 0, sent: { steel: 12 } };
    const towns: Record<string, TownState> = { 1: { hline: hl } };
    setForward(A, hlKey('v:1', hl), 'sl');
    expect(hlDrain('port:a', towns, all, A, (k, n) => { A.hold = { ...A.hold, [k]: (A.hold?.[k] ?? 0) + n }; return n; })).toEqual([['steel', 12]]);
    expect(transitCount(A, 'sl')).toBe(12);
    A.hold = { ...A.hold, stone: 500 };
    A.line = newLine(A, 'port:b', B, 0); A.line.only = ['grain'];
    assignShip(A.line, { id: 'boat:x', k: 'steamer', fuel: 400, by: 'Ala' }, 0);
    const v = settleLine(W, all, 'port:a', LINE.load + voyageOf(A.line, 'steamer'));
    expect(v[0].fate).toBe('ok');
    expect(A.line.sent).toEqual({ steel: 12 }); // only the goods sent on, not the stone
    setForward(B, rcvKey('port:a', A.line), 'hl');
    expect(unloadLines(W, all, 'port:b', LINE.load + voyageOf(A.line, 'steamer'))).toEqual([['steel', 12]]);
    expect(transitCount(B, 'hl')).toBe(12);
  });
  it('a ship on a cargo line joins two far ports\' radio', () => {
    const A = port(X0, 'A'), B = port(X0 + 30000, 'B'), all: Record<string, OutpostState> = { 'port:a': A, 'port:b': B };
    expect(linkedHubs(W, {}, all, 'port:a', 0).map((h) => h.id)).toEqual([]);
    A.line = newLine(A, 'port:b', B, 0);
    expect(linkedHubs(W, {}, all, 'port:a', 0).map((h) => h.id)).toEqual([]); // no ship yet
    assignShip(A.line, { id: 'boat:x', k: 'ship', by: 'Ala' }, 0);
    expect(linkedHubs(W, {}, all, 'port:a', 0).map((h) => h.id)).toEqual(['port:b']);
    expect(linkedHubs(W, {}, all, 'port:b', 0).map((h) => h.id)).toEqual(['port:a']);
  });
});
