import { describe, it, expect } from 'vitest';
import { markId, toggleId, pruneMarks } from '../src/gen/journal';

describe('the journal (0.230)', () => {
  it('switches a marker off and on again', () => {
    const id = markId('q', 'q7');
    expect(id).toBe('q:q7');
    const off = toggleId([], id);
    expect(off).toEqual(['q:q7']);
    expect(toggleId(off, id)).toEqual([]);
    expect(toggleId(['c:x'], id)).toEqual(['c:x', 'q:q7']);
  });
  it('forgets the switches of things no longer held', () => {
    expect(pruneMarks(['q:a', 'q:b', 'elder'], ['q:b', 'elder', 'side'])).toEqual(['q:b', 'elder']);
  });
});
