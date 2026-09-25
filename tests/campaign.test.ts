import { describe, it, expect } from 'vitest';
import { campaign, visible, WONDER_KINDS } from '../src/gen/campaign';
import { GOOD_INFO } from '../src/gen/market';

describe('campaign', () => {
  const c = campaign(12345);
  it('is the same for the same world (every player on a server meets the same surprises)', () => {
    expect(JSON.stringify(campaign(12345))).toBe(JSON.stringify(c));
    expect(JSON.stringify(campaign(777).blockers)).not.toBe(JSON.stringify(c.blockers));
  });
  it('has twenty different wonders and three surprises on different ones, each further out', () => {
    expect(c.wonders.length).toBe(WONDER_KINDS.length);
    expect(new Set(c.wonders.map((w) => w.kind.name)).size).toBe(WONDER_KINDS.length);
    expect(c.blockers.map((b) => b.after)).toEqual([1, 2, 4]);
    expect(new Set(c.blockers.map((b) => b.wonder)).size).toBe(3);
    for (let i = 1; i < 3; i++) expect(c.wonders[c.blockers[i].wonder].dist).toBeGreaterThan(c.wonders[c.blockers[i - 1].wonder].dist);
  });
  it('asks only for goods that exist (or relics)', () => {
    for (const st of [...c.chariot.map((s) => s.needs), ...c.wonders.flatMap((w) => w.stages.map((s) => s.needs))])
      for (const [g, n] of st) { expect(g === 'relic' || g in GOOD_INFO).toBe(true); expect(n).toBeGreaterThan(0); }
  });
  it('keeps the surprises hidden until they happen, and a wonder\'s troubles one stage at a time', () => {
    const b = c.blockers[0];
    expect(visible(c, { chariot: 0, wonders: {} }).surprises).toEqual([]);
    const after1 = visible(c, { chariot: 1, wonders: {} });
    expect(after1.blocked).toBe(true);
    expect(after1.surprises.length).toBe(1);
    expect(after1.wonderNeeds(b.wonder)).toEqual(c.wonders[b.wonder].stages[0]);
    const mended = visible(c, { chariot: 1, wonders: { [b.wonder]: 3 } });
    expect(mended.blocked).toBe(false);
    expect(visible(c, { chariot: 2, wonders: { [b.wonder]: 3 } }).blocked).toBe(true); // the second surprise
    const all = Object.fromEntries(c.blockers.map((x) => [x.wonder, 3]));
    expect(visible(c, { chariot: c.chariot.length, wonders: {} }).ready).toBe(false);
    expect(visible(c, { chariot: c.chariot.length, wonders: all }).ready).toBe(true);
  });
});
