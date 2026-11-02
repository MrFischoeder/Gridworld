import { describe, it, expect } from 'vitest';
import { addMark, removeMark, renameMark, markNear, shownMarks, cleanMarkName, MARKS, type MapMark } from '../src/gen/mapmarks';

describe('map markers (0.289)', () => {
  it('adds with fresh ids and colours, up to the limit', () => {
    const list: MapMark[] = [];
    const a = addMark(list, 10, 20, (n) => `Marker ${n}`)!, b = addMark(list, 30, 40, (n) => `Marker ${n}`)!;
    expect(a.id).toBe('m1'); expect(b.id).toBe('m2'); expect(a.c).not.toBe(b.c); expect(a.on).toBe(true);
    removeMark(list, 'm1');
    expect(addMark(list, 0, 0, (n) => `M${n}`)!.id).toBe('m1');
    while (list.length < MARKS.max) addMark(list, 0, 0, (n) => `M${n}`);
    expect(addMark(list, 0, 0, (n) => `M${n}`)).toBeNull();
    expect(new Set(list.map((m) => m.id)).size).toBe(MARKS.max);
  });
  it('finds, renames and lists the shown ones nearest first', () => {
    const list: MapMark[] = [];
    addMark(list, 100, 0, (n) => `A${n}`); addMark(list, 10, 0, (n) => `B${n}`); addMark(list, 50, 0, (n) => `C${n}`);
    expect(markNear(list, 12, 1, 5)?.name).toBe('B2');
    expect(markNear(list, 30, 0, 5)).toBeNull();
    expect(renameMark(list, 'm1', '  <b>Camp</b> ')).toBe(true);
    expect(list[0].name).toBe('bCamp/b');
    expect(renameMark(list, 'm1', '   ')).toBe(false);
    list[2].on = false;
    expect(shownMarks(list, 0, 0).map((k) => k.m.id)).toEqual(['m2', 'm1']);
    expect(cleanMarkName('x'.repeat(60)).length).toBe(MARKS.name);
  });
});

import { shareMark, unshareMark, visibleMarks, mayEditPub, pubKey, PUB_MAX, type PubMark } from '../src/gen/mapmarks';
describe('shared map markers (0.290)', () => {
  it('moves a marker to everyone and back, seen by others until they hide it', () => {
    const mine: MapMark[] = [], theirs: MapMark[] = [], pub: Record<string, PubMark> = {};
    addMark(mine, 10, 0, (n) => `A${n}`);
    const p = shareMark(mine, pub, 'm1', 'Ala', 'p1', 100)!;
    expect(mine).toHaveLength(0); expect(pub[p.id].by).toBe('Ala');
    expect(visibleMarks(theirs, pub, [], 0, 0).map((k) => k.m.id)).toEqual([p.id]);
    expect(visibleMarks(theirs, pub, [pubKey(p.id)], 0, 0)).toHaveLength(0);
    expect(mayEditPub(p, 'p2', {})).toBe(false);
    expect(mayEditPub(p, 'p1', {})).toBe(true);
    expect(mayEditPub(p, 'p2', { ala: {} })).toBe(true); // the author has fallen
    const back = unshareMark(mine, pub, p.id)!;
    expect(back.name).toBe('A1'); expect(Object.keys(pub)).toHaveLength(0);
  });
  it('keeps ids apart and stops at the cap', () => {
    const own: MapMark[] = [], pub: Record<string, PubMark> = {};
    addMark(own, 0, 0, (n) => `M${n}`); addMark(own, 1, 0, (n) => `M${n}`);
    const a = shareMark(own, pub, 'm1', 'A', 'p', 5)!, b = shareMark(own, pub, 'm2', 'A', 'p', 5)!;
    expect(a.id).not.toBe(b.id);
    for (let i = 0; Object.keys(pub).length < PUB_MAX; i++) pub[`x${i}`] = { ...a, id: `x${i}` };
    addMark(own, 0, 0, (n) => `M${n}`);
    expect(shareMark(own, pub, own[0].id, 'A', 'p', 6)).toBeNull();
  });
});
describe('default names (0.290)', () => {
  it('skip names already in use', () => {
    const own: MapMark[] = [];
    expect(addMark(own, 0, 0, (n) => `Marker ${n}`, ['Marker 1'])!.name).toBe('Marker 2');
    expect(addMark(own, 0, 0, (n) => `Marker ${n}`, ['Marker 1'])!.name).toBe('Marker 3');
  });
});
