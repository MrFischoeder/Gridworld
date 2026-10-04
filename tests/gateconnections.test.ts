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
