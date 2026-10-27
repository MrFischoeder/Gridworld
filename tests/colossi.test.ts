import { expect, it } from 'vitest';
import { regionColossi, colossiNear, inColossus, colossusCapsules, colossusHit, COLOSSI, type ColossusSite } from '../src/gen/colossi';
import { capsulesHit } from '../src/gen/tilt';
import { NR, REGION, villageDist, wrapDx } from '../src/gen/regions';
import { seaMask } from '../src/gen/seas';
import { naturalHeight } from '../src/gen/heights';

it('scatters lone stone heads and sphinxes (alone or a gate of two) far apart, sunk and leaning, never on the sea or by a village', () => {
  const world = 12345, sites: ColossusSite[] = [];
  for (let rx = -120; rx <= 120; rx++) for (let rz = -40; rz <= 40; rz++) { const s = regionColossi(world, rx, rz); if (s) sites.push(s); }
  const heads = sites.filter((s) => s.k === 'head'), sphinx = sites.filter((s) => s.k === 'sphinx');
  expect(heads.length).toBeGreaterThan(15); expect(sphinx.length).toBeGreaterThan(6);
  expect(sphinx.some((s) => s.list.length === 2)).toBe(true); expect(sphinx.some((s) => s.list.length === 1)).toBe(true);
  expect(regionColossi(world, 7, 9)).toEqual(regionColossi(world, 7, 9));
  let tilted = 0, all = 0;
  for (const s of sites) {
    expect(Math.hypot(wrapDx(s.x), s.z)).toBeGreaterThan(COLOSSI.from);
    expect(seaMask(world, s.x, s.z)).toBe(0);
    expect(villageDist(world, s.x, s.z, COLOSSI.village + 60)).toBeGreaterThanOrEqual(COLOSSI.village);
    expect(inColossus(world, s.x, s.z)).toBe(true);
    for (const o of s.list) {
      all++; if (Math.abs(o.lean) > 0.07 || Math.abs(o.roll) > 0.07) tilted++;
      expect(o.y).toBeLessThan(naturalHeight(world, o.x, o.z)); // sunk into the ground
      const caps = colossusCapsules(o);
      expect(colossusHit([o], o.x, naturalHeight(world, o.x, o.z), o.z, 0.4) || capsulesHit(caps, caps[0].a[0], caps[0].a[1], caps[0].a[2], 0.4)).toBe(true);
      expect(colossusHit([o], o.x + o.h * 2, o.y, o.z + o.h * 2, 0.4)).toBe(false); // open ground round it
    }
    if (s.k === 'sphinx' && s.list.length === 2) { // a gate: the two face each other, the way between them open
      const [a, b] = s.list, mx = (a.x + b.x) / 2, mz = (a.z + b.z) / 2;
      expect(Math.cos(a.yaw - Math.atan2(b.x - a.x, b.z - a.z))).toBeGreaterThan(0.99);
      expect(colossusHit(s.list, mx, Math.max(a.y, b.y) + a.h * 0.2, mz, 0.4)).toBe(false);
    }
    // nothing else of its kind close by: scattered, not in crowds
    for (const n of colossiNear(world, s.x, s.z, 600)) if (n.id !== s.id) expect(Math.hypot(n.x - s.x, n.z - s.z)).toBeGreaterThan(REGION * 0.4);
  }
  expect(tilted / all).toBeGreaterThan(0.6);
  // the same on the other copy of the planet
  const s = sites[0], [, rx, rz] = s.id.split(':').map(Number), w = regionColossi(world, rx + NR, rz)!;
  expect(w.x - s.x).toBeCloseTo(NR * REGION); expect(w.list[0].y).toBe(s.list[0].y);
}, 120000);
