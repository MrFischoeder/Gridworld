import { describe, it, expect } from 'vitest';
import { riversOf, riverSegsIn, riverNear, nearRiver, RIVER } from '../src/gen/rivers';
import { seaMask, SEA } from '../src/gen/seas';
import { Terrain } from '../src/gen/terrain';
import { allVillages, regionInfo, wrapDx, WORLD_W } from '../src/gen/regions';
import { network, edgePath } from '../src/gen/roads';

const W = 12345;
const len = (xs: number[], zs: number[]) => { let s = 0; for (let i = 1; i < xs.length; i++) s += Math.hypot(xs[i] - xs[i - 1], zs[i] - zs[i - 1]); return s; };

describe('rivers', () => {
  const { list } = riversOf(W);
  it('form a network of main rivers and tributaries that run down to the seas', () => {
    expect(list.length).toBeGreaterThan(60);
    expect(list.reduce((a, r) => a + len(r.x, r.z), 0) / 1000).toBeGreaterThan(400);
    for (const r of list) {
      for (let i = 1; i < r.lv.length; i++) expect(r.lv[i], `${r.name} ${i}`).toBeLessThanOrEqual(r.lv[i - 1] + 1e-9);
      const n = r.x.length - 1;
      if (r.into < 0) { expect(seaMask(W, r.x[n], r.z[n])).toBeGreaterThan(0.3); expect(r.lv[n]).toBeCloseTo(SEA.level, 6); }
      else {
        const p = list[r.into];
        let bd = Infinity, bi = 0;
        for (let i = 0; i < p.x.length; i++) { const d = Math.hypot(wrapDx(p.x[i] - r.x[n]), p.z[i] - r.z[n]); if (d < bd) { bd = d; bi = i; } }
        expect(bd).toBeLessThan(0.01);
        expect(r.lv[n]).toBeCloseTo(p.lv[bi], 6);
      }
      for (let i = 0; i < r.half.length; i++) { expect(r.half[i]).toBeLessThanOrEqual(RIVER.maxHalf); expect(r.half[i]).toBeGreaterThan(1.5); }
    }
    expect(list.some((r) => r.into >= 0)).toBe(true);
  });
  it('keep away from Gridholm, the villages and the places', () => {
    const vs = allVillages(W);
    for (const r of list) for (let i = 0; i < r.x.length; i += 3) {
      expect(Math.hypot(wrapDx(r.x[i]), r.z[i])).toBeGreaterThan(RIVER.clear - RIVER.cell);
      for (const v of vs) if (Math.abs(wrapDx(v.x - r.x[i])) < 400) expect(Math.hypot(wrapDx(v.x - r.x[i]), v.z - r.z[i])).toBeGreaterThan(250);
    }
    for (let rx = -60; rx <= 60; rx += 2) for (let rz = -60; rz <= 60; rz += 2)
      for (const p of regionInfo(W, rx, rz).pois) if (p.type !== 'village') expect(nearRiver(W, p.x, p.z, 60), `${p.type} ${p.name}`).toBe(false);
  });
  it('hold running fresh water in their channels', () => {
    const t = new Terrain(W);
    let n = 0;
    for (const r of list.filter((r) => r.into < 0).slice(0, 12)) {
      const i = Math.floor(r.x.length * 0.4), w = t.water(r.x[i], r.z[i]);
      expect(w?.kind, r.name).toBe('fresh');
      expect(w!.depth).toBeGreaterThan(0.5);
      const dx = r.x[i + 1] - r.x[i], dz = r.z[i + 1] - r.z[i];
      expect(w!.flow![0] * dx + w!.flow![1] * dz).toBeGreaterThan(0); // downstream
      // dry a little way past the bank
      const L = Math.hypot(dx, dz), o = r.half[i] + 5;
      expect(t.water(r.x[i] - dz / L * o, r.z[i] + dx / L * o)).toBeNull();
      n++;
    }
    expect(n).toBeGreaterThan(5);
  });
  it('are the same on every copy of the planet', () => {
    const r = list[3], i = 5, a = riverSegsIn(W, r.x[i] - 20, r.z[i] - 20, r.x[i] + 20, r.z[i] + 20), b = riverSegsIn(W, r.x[i] + WORLD_W - 20, r.z[i] - 20, r.x[i] + WORLD_W + 20, r.z[i] + 20);
    const ha = riverNear(a, r.x[i], r.z[i])!, hb = riverNear(b, r.x[i] + WORLD_W, r.z[i])!;
    expect(hb.d).toBeCloseTo(ha.d, 6); expect(hb.level).toBeCloseTo(ha.level, 6);
  });
  it('are crossed by roads only at shallow fords', () => {
    const t = new Terrain(W);
    let fords = 0;
    for (const e of network(W).slice(0, 150)) {
      const p = edgePath(W, e);
      if (!p) continue;
      for (let k = 0; k + 1 < p.pts.length; k++) {
        const [ax, az] = p.pts[k], [bx, bz] = p.pts[k + 1], L = Math.hypot(bx - ax, bz - az);
        for (let s = 0; s < L; s += 2) {
          const x = ax + (bx - ax) * s / L, z = az + (bz - az) * s / L, w = t.water(x, z);
          if (w?.flow) { fords++; expect(w.depth, `${x},${z}`).toBeLessThan(0.7); }
        }
      }
    }
    expect(fords).toBeGreaterThan(0);
  }, 120000);
});
