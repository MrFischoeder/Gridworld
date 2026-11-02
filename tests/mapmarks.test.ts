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
