import { expect, it } from 'vitest';
import { GateConnections, gateAddresses } from '../shared/gates.mjs';
it('locks both ends for exactly 45 real seconds without travel or redial extending the clock', () => {
  let now = 1000; const c = new GateConnections(() => now), a = gateAddresses(12345);
  expect(c.open(12345, 0, a[20]).ok).toBe(true);
  expect(c.at(0)).toEqual(c.at(20)); expect(c.at(0)?.until).toBe(46000);
  now = 45000;
  expect(c.open(12345, 20, a[1]).ok).toBe(false);
  expect(c.open(12345, 1, a[20]).ok).toBe(false);
  expect(c.at(20)?.until).toBe(46000);
  now = 46000; expect(c.at(0)).toBeNull(); expect(c.at(20)).toBeNull();
  expect(c.open(12345, 20, a[1]).ok).toBe(true);
});
it('keeps disjoint connections independent and rejects malformed and self addresses', () => {
  const c = new GateConnections(), a = gateAddresses(12345);
  expect(c.open(12345, 0, a[0]).ok).toBe(false);
  expect(c.open(12345, 0, [NaN, 0, 0]).ok).toBe(false);
  expect(c.open(12345, 0, a[1]).ok).toBe(true);
  expect(c.open(12345, 2, a[3]).ok).toBe(true); expect(c.state()).toHaveLength(2);
  const copy = c.state(); copy[0].until = 0; expect(c.at(0)).not.toBeNull();
});
it('holds both terminals after a journey starts in second 44, until that journey completes', () => {
  let now = 0; const c = new GateConnections(() => now), a = gateAddresses(12345);
  c.open(12345, 0, a[20]); now = 44000;
  const journey = c.begin(0)!; expect(journey.to).toBe(20); expect(journey.finishAt).toBe(49000);
  now = 46000; expect(c.at(0)?.until).toBe(45000); expect(c.at(20)?.inTransit).toBe(1);
  expect(c.begin(20)).toBeNull(); expect(c.open(12345, 20, a[1]).ok).toBe(false);
  now = 50000; expect(c.at(0)).not.toBeNull(); // A delayed callback cannot close an unfinished transport.
  c.finish(journey.token); expect(c.at(0)).toBeNull(); expect(c.at(20)).toBeNull();
  expect(c.open(12345, 20, a[1]).ok).toBe(true);
});
it('waits for every accepted traveller without extending the admission deadline', () => {
  let now = 0; const c = new GateConnections(() => now), a = gateAddresses(12345);
  c.open(12345, 0, a[20]); now = 44000; const first = c.begin(0)!;
  now = 44500; const second = c.begin(20)!; expect(second.to).toBe(0);
  now = 49000; c.finish(first.token); expect(c.at(0)?.inTransit).toBe(1);
  c.finish(second.token); expect(c.state()).toEqual([]);
});
it('lights only a valid ordered draft, supports repeated symbols and cancellation, and locks edits after activation', () => {
  const c = new GateConnections(), a = gateAddresses(12345);
  expect(c.setDraft(0, [2])).toBe(true); expect(c.draft(0)).toEqual([2]);
  expect(c.setDraft(0, [2, 2, 5])).toBe(true); expect(c.draft(0)).toEqual([2, 2, 5]);
  expect(c.setDraft(0, [2, 2, 5, 1])).toBe(false); expect(c.setDraft(0, [8])).toBe(false);
  const copy = c.draftState(); copy[0].symbols[0] = 0; expect(c.draft(0)[0]).toBe(2);
  expect(c.setDraft(0, [])).toBe(true); expect(c.draft(0)).toEqual([]);
  c.setDraft(0, a[20]); c.open(12345, 0, a[20]);
  expect(c.draftState()).toEqual([]); expect(c.setDraft(20, [1])).toBe(false);
});
