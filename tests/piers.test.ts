import { describe, it, expect } from 'vitest';
import { planPier, pierAt, pierY, pierNeeds, pierProgress, handOverPier, PIER, type Pier } from '../src/gen/piers';
import { Terrain } from '../src/gen/terrain';
import { seaMask, SEA } from '../src/gen/seas';
import { POLAR_Z } from '../src/gen/regions';

const W = 12345, t = new Terrain(W), ground = (x: number, z: number) => t.heightAt(x, z), water = (x: number, z: number) => t.water(x, z);
/** Standing spots on beaches: walking east along lines of latitude, 20 m before the first sea water. */
function beaches(n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let z = -POLAR_Z + 3000; z < POLAR_Z - 3000 && out.length < n; z += 1700) {
    let x = 6000, land = 0;
    for (; x < 60000; x += 40) { if (seaMask(W, x, z) < 0.01) land++; else if (land > 20) break; }
    if (x >= 60000) continue;
    for (let s = x - 400; s < x + 800; s += 2) if (water(s, z)?.kind === 'sea') { out.push([s - 20, z]); break; }
  }
  return out;
}

describe('piers', () => {
  const spots = beaches(14);
  it('are staked out from the beach straight out to deep enough water', () => {
    expect(spots.length).toBeGreaterThan(5);
    let ok = 0;
    for (const [x, z] of spots) {
      const { p, problem } = planPier(W, x, z, 1, 0, ground, water, []);
      expect(p, `${x},${z}`).toBeTruthy();
      if (problem) continue;
      ok++;
      expect(p!.len).toBeGreaterThanOrEqual(PIER.min); expect(p!.len).toBeLessThanOrEqual(PIER.max);
      const head = water(p!.x + p!.dx * (p!.len - PIER.head / 2), p!.z + p!.dz * (p!.len - PIER.head / 2));
      expect(head?.kind).toBe('sea'); expect(head!.depth).toBeGreaterThanOrEqual(PIER.depth);
      expect(pierY(p!, 0)).toBeCloseTo(p!.g0, 6); expect(pierY(p!, p!.len)).toBeCloseTo(SEA.level + PIER.clear, 6);
      expect(pierAt(p!, p!.x + p!.dx * p!.len * 0.7, p!.z + p!.dz * p!.len * 0.7)).toBeCloseTo(SEA.level + PIER.clear, 6);
      expect(pierAt(p!, p!.x - p!.dz * 3, p!.z + p!.dx * 3)).toBeNull();
      // a second one right beside it is refused
      expect(planPier(W, x, z + 5, 1, 0, ground, water, [p!]).problem).toMatch(/Another dock/);
    }
    expect(ok).toBeGreaterThan(2);
  });
  it('need the sea in front', () => {
    expect(planPier(W, 0, 0, 1, 0, ground, water, []).p).toBeNull(); // Gridholm: no sea in sight
  });
  it('are built bit by bit', () => {
    const [x, z] = spots[0], p = { ...planPier(W, x, z, 1, 0, ground, water, []).p!, id: 'pier:t', given: {} } as Pier;
    const need = new Map(pierNeeds(p));
    expect(need.get('scrap')).toBe(PIER.fittings.scrap);
    expect(handOverPier(p, (k) => (k === 'planks' ? 2 : 0), 10).built).toBe(false);
    expect(pierProgress(p)).toBeGreaterThan(0);
    const r = handOverPier(p, () => 999, 20);
    expect(r.built).toBe(true); expect(p.done).toBe(20); expect(pierProgress(p)).toBe(1);
  });
});
