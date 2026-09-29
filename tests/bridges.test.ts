import { describe, it, expect } from 'vitest';
import { regionFords, deckY, deckAt, bridgeNeeds, bridgeRows, handOverBridge, bridgeProgress, BRIDGE, type BridgeState, type Ford } from '../src/gen/bridges';
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
});
