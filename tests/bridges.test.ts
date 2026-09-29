import { describe, it, expect } from 'vitest';
import { regionFords, deckY, deckAt, bridgeNeeds, bridgeRows, handOverBridge, bridgeProgress, planBridge, bridgeProblem, PLACE, BRIDGE, type BridgeState, type Ford } from '../src/gen/bridges';
import { riversOf, riverSegsIn, riverNear } from '../src/gen/rivers';
import { Terrain } from '../src/gen/terrain';
import { regionOf, NR, REGION } from '../src/gen/regions';
import { network, edgePath } from '../src/gen/roads';

const W = 12345, t = new Terrain(W), ground = (x: number, z: number) => t.heightAt(x, z);
/** Fords found where roads meet rivers (walking the first roads of the network). */
function someFords(max: number): Ford[] {
  const out = new Map<string, Ford>();
  for (const e of network(W).slice(0, 150)) {
    const p = edgePath(W, e);
    if (!p) continue;
    for (const [x, z] of p.pts) {
      const [rx, rz] = regionOf(x, z);
      for (const f of regionFords(W, rx, rz, ground)) out.set(f.id, f);
    }
    if (out.size >= max) break;
  }
  return [...out.values()];
}

describe('bridges', () => {
  const fords = someFords(12);
  it('stand where roads ford the rivers', () => {
    expect(fords.length).toBeGreaterThan(3);
    for (const f of fords) {
      const w = t.water(f.x, f.z);
      expect(w?.kind, f.id).toBe('fresh');
      expect(w!.depth).toBeLessThan(0.7); // a ford
      expect(Math.hypot(f.dx, f.dz)).toBeCloseTo(1, 6);
      // the deck: over the water in the middle, on the ground at both ends
      expect(deckY(f, 0)).toBeCloseTo(f.level + BRIDGE.clear, 6);
      expect(deckY(f, -f.end)).toBeCloseTo(f.g0, 6); expect(deckY(f, f.end)).toBeCloseTo(f.g1, 6);
      expect(Math.abs(f.g0 - ground(f.x - f.dx * f.end, f.z - f.dz * f.end))).toBeLessThan(1e-6);
      expect(deckAt(f, f.x, f.z)).toBeCloseTo(f.level + BRIDGE.clear, 6);
      expect(deckAt(f, f.x - f.dz * (BRIDGE.w / 2 + 1), f.z + f.dx * (BRIDGE.w / 2 + 1))).toBeNull();
    }
  });
  it('are the same on every copy of the planet', () => {
    const f = fords[0], [rx, rz] = regionOf(f.x, f.z), g = regionFords(W, rx + NR, rz, (x, z) => ground(x - NR * REGION, z)).find((o) => o.id === f.id)!;
    expect(g).toBeTruthy(); expect(g.x - f.x).toBeCloseTo(NR * REGION, 6); expect(g.level).toBeCloseTo(f.level, 9);
  });
  it('are built bit by bit from what is handed over', () => {
    const f = fords[0], st: BridgeState = { given: {} }, need = new Map(bridgeNeeds(f));
    expect(need.get('log')).toBeGreaterThan(10);
    let r = handOverBridge(f, st, (k) => (k === 'log' ? 5 : 0), 100);
    expect(r.built).toBe(false); expect(st.given.log).toBe(5);
    expect(bridgeProgress(f, st)).toBeGreaterThan(0); expect(bridgeProgress(f, st)).toBeLessThan(1);
    r = handOverBridge(f, st, () => 999, 200);
    expect(r.built).toBe(true); expect(st.done).toBe(200); expect(bridgeProgress(f, st)).toBe(1);
    expect(r.taken.find(([k]) => k === 'log')![1]).toBe(need.get('log')! - 5);
    expect(handOverBridge(f, st, () => 999, 300).taken).toEqual([]);
    expect(bridgeRows(f, undefined).every((x) => x.given === 0)).toBe(true);
  });
  it('can be staked out anywhere over a river, straight across it', () => {
    let ok = 0, n = 0;
    for (const r of riversOf(W).list.filter((q) => q.x.length > 200).slice(0, 25)) {
      const i = Math.floor(r.x.length / 2), fx = r.x[i + 1] - r.x[i], fz = r.z[i + 1] - r.z[i], L = Math.hypot(fx, fz), nx = -fz / L, nz = fx / L;
      // look at a point on the bank, standing further back on the same side
      const f = planBridge(W, r.x[i] + nx * (r.half[i] + 3), r.z[i] + nz * (r.half[i] + 3), r.x[i] + nx * 40, r.z[i] + nz * 40, ground)!;
      expect(f, r.name).toBeTruthy(); n++;
      expect(f.dx * (f.x - (r.x[i] + nx * 40)) + f.dz * (f.z - (r.z[i] + nz * 40))).toBeGreaterThan(0); // away from the player
      const h = riverNear(riverSegsIn(W, f.x - 5, f.z - 5, f.x + 5, f.z + 5), f.x, f.z)!;
      expect(h.d).toBeLessThan(0.5);
      expect(Math.abs(f.dx * h.fx + f.dz * h.fz)).toBeLessThan(0.35); // square to the flow there (the stretch next to it may bend a little)
      const p = bridgeProblem(W, f, []);
      if (!p) { ok++; expect(bridgeProblem(W, f, [f])).toMatch(/too close/); }
      if (f.half > PLACE.maxHalf) expect(p).toMatch(/too wide/);
    }
    expect(n).toBeGreaterThan(10); expect(ok).toBeGreaterThan(3);
    expect(planBridge(W, 0, 0, 10, 10, ground)).toBeNull(); // by Gridholm there is no river
    expect(bridgeProblem(W, null, [])).toMatch(/Look at a river/);
  });
});
