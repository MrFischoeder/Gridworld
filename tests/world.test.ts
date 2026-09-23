import { describe, it, expect } from 'vitest';
import { Terrain, inRect, rectDist, MAX_H } from '../src/gen/terrain';
import { regionInfo, poisNear, findPoi, CHUNK } from '../src/gen/regions';
import { regionRoads, gatePoint } from '../src/gen/roads';
import { generateVillage, villageGates } from '../src/gen/village';
import { generateRuin } from '../src/gen/ruins';
import { chunkTrees } from '../src/gen/trees';
import { VoxelGrid, type Space } from '../src/core/voxel';
import { tryPlaceDoor, setDoorCells } from '../src/gen/doors';
import { reachableCells } from '../src/gen/reach';
import { hash, DIRV } from '../src/core/rng';

const WORLDS = Array.from({ length: 60 }, (_, i) => hash(99, i));

describe('regions and places', () => {
  it('are deterministic', () => {
    for (const w of WORLDS.slice(0, 20)) for (let rx = -3; rx <= 3; rx++) for (let rz = -3; rz <= 3; rz++) {
      const a = regionInfo(w, rx, rz);
      expect(JSON.parse(JSON.stringify(a))).toEqual(JSON.parse(JSON.stringify(regionInfo(w + 0, rx, rz))));
    }
  });
  it('region (0,0) holds the starting village at the origin and at least 2 ruins lie within ~300 m', () => {
    for (const w of WORLDS) {
      const v = regionInfo(w, 0, 0).pois.find((p) => p.type === 'village')!;
      expect(v, 'world ' + w).toBeTruthy();
      expect(Math.hypot(v.x, v.z)).toBeLessThan(5);
      const ruins = poisNear(w, 0, 0, 400).filter((p) => p.type === 'ruin' && Math.hypot(p.x, p.z) <= 300);
      expect(ruins.length, 'world ' + w).toBeGreaterThanOrEqual(2);
      for (const r of ruins) expect(findPoi(w, r.id)).toEqual(r);
    }
  });
  it('places never overlap', () => {
    for (const w of WORLDS.slice(0, 20)) {
      const all = poisNear(w, 0, 0, 1200);
      for (const a of all) for (const b of all) if (a !== b) expect(Math.hypot(a.x - b.x, a.z - b.z), `${a.name} / ${b.name}`).toBeGreaterThan(80);
    }
  });
});

describe('terrain', () => {
  it('is deterministic and stays within 0..25 m', () => {
    for (const w of WORLDS.slice(0, 10)) {
      const a = new Terrain(w), b = new Terrain(w);
      let lo = Infinity, hi = -Infinity;
      for (let x = -900; x <= 900; x += 97) for (let z = -900; z <= 900; z += 89) {
        const h = a.heightAt(x, z);
        expect(h).toBe(b.heightAt(x, z));
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      expect(lo).toBeGreaterThanOrEqual(0); expect(hi).toBeLessThanOrEqual(MAX_H);
      expect(hi - lo, 'relief of world ' + w).toBeGreaterThan(6);
    }
    expect(new Terrain(1).heightAt(123, 456)).not.toBe(new Terrain(2).heightAt(123, 456));
  });
  it('gives the same heights when revisited in a different order (fresh caches)', () => {
    const w = WORLDS[3], far = new Terrain(w);
    for (let x = 3000; x < 3300; x += 16) far.heightAt(x, -2000);
    const pts = [[10, 20], [-150, 77], [260, -300], [-411, -12]];
    const fresh = new Terrain(w);
    for (const [x, z] of pts) expect(far.heightAt(x, z)).toBe(fresh.heightAt(x, z));
  });
  it('is flat under the village and every ruin', () => {
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (const p of poisNear(w, 0, 0, 500)) {
        const y = t.padY(p), r = p.rect;
        for (let x = r.x0 - p.flat; x <= r.x1 + p.flat; x += 2) for (let z = r.z0 - p.flat; z <= r.z1 + p.flat; z += 2) {
          if (rectDist(r, x, z) > p.flat) continue;
          expect(t.heightAt(x, z), `${p.name} at ${x},${z} world ${w}`).toBe(y);
        }
        expect(Number.isInteger(y)).toBe(true);
      }
    }
  });
  it('slopes stay walkable almost everywhere', () => {
    const t = new Terrain(WORLDS[5]);
    let steep = 0, n = 0;
    for (let x = -600; x < 600; x += 3) for (let z = -600; z < 600; z += 3) {
      const g = Math.hypot(t.heightAt(x + 1, z) - t.heightAt(x - 1, z), t.heightAt(x, z + 1) - t.heightAt(x, z - 1)) / 2;
      n++; if (g > 0.85) steep++;
    }
    expect(steep / n).toBeLessThan(0.02);
  });
});

describe('village and roads', () => {
  it('has 2–4 gates, each with a road that starts at the gate and ends at a ruin', () => {
    for (const w of WORLDS) {
      const gates = villageGates(w);
      expect(gates.length).toBeGreaterThanOrEqual(2); expect(gates.length).toBeLessThanOrEqual(4);
      const v = regionInfo(w, 0, 0).pois[0], roads = regionRoads(w, 0, 0);
      const vm = generateVillage(w, 7);
      for (const g of vm.gates) {
        const road = roads.find((r) => r.gate === g.dir)!;
        expect(road, `gate ${g.dir}, world ${w}`).toBeTruthy();
        expect(road.pts[0]).toEqual(gatePoint(v, g.dir));
        expect(Math.hypot(road.pts[0][0] - g.x, road.pts[0][1] - g.z)).toBeLessThan(0.01);
        expect(findPoi(w, road.to)!.type).toBe('ruin');
        const end = road.pts[road.pts.length - 1], to = findPoi(w, road.to)!;
        expect(end).toEqual([to.x, to.z]);
      }
    }
  });
  it('the gate openings are walkable from inside the plaza to outside', () => {
    for (const w of WORLDS.slice(0, 20)) {
      const vm = generateVillage(w, 5), g = VoxelGrid.surface(vm.ops, vm.rect, 5);
      const ground: Space = { empty: (x, y, z) => (g.covers(x, z) ? g.empty(x, y, z) : y >= 5 && Math.abs(x) < 50 && Math.abs(z) < 50), setCell: () => {} };
      const seen = reachableCells(ground, [Math.floor(vm.spawn[0]), 5, Math.floor(vm.spawn[2])]);
      for (const gate of vm.gates) {
        const o = DIRV[gate.dir], x = Math.floor(gate.x + o[0] * 3), z = Math.floor(gate.z + o[1] * 3);
        expect(seen.has(`${x},5,${z}`), `gate ${gate.dir} world ${w}`).toBe(true);
      }
    }
  });
  it('is deterministic', () => {
    for (const w of WORLDS.slice(0, 10)) expect(generateVillage(w, 3)).toEqual(generateVillage(w, 3));
  });
});

describe('ruins', () => {
  it('are deterministic and their stairwell door is reachable from the surrounding fields', () => {
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (const p of poisNear(w, 0, 0, 500).filter((q) => q.type === 'ruin')) {
        const y = t.padY(p), a = generateRuin(w, p, y);
        expect(generateRuin(w, p, y)).toEqual(a);
        const g = VoxelGrid.surface(a.ops, a.rect, y);
        const near = (x: number, z: number) => x > a.rect.x0 - 6 && x < a.rect.x1 + 6 && z > a.rect.z0 - 6 && z < a.rect.z1 + 6;
        const ground: Space = { empty: (x, yy, z) => (g.covers(x, z) ? g.empty(x, yy, z) : yy >= y && near(x, z)), setCell: (x, yy, z, v) => g.setCell(x, yy, z, v) };
        const pt = a.portal;
        expect(tryPlaceDoor(ground, { axis: pt.axis, m: pt.m, c: pt.c, stair: true, y0: y }, [])).toBeTruthy();
        const seen = reachableCells(ground, [a.rect.x0 - 3, y, a.rect.z0 - 3]);
        const o = DIRV[pt.dir], fm = pt.m - (o[0] || o[1]);
        const [fx, fz] = pt.axis === 'x' ? [fm, pt.c] : [pt.c, fm];
        expect(seen.has(`${fx},${y},${fz}`), `${p.name} world ${w}`).toBe(true);
        // the shaft itself leads down: open the door and walk to the bottom landing
        const d = tryPlaceDoor(ground, { axis: pt.axis, m: pt.m, c: pt.c, stair: true, y0: y }, [])!; setDoorCells(ground, d.cells, false);
        const deep = reachableCells(ground, [fx, y, fz]);
        const bm = pt.m + (o[0] || o[1]) * 8, [bx, bz] = pt.axis === 'x' ? [bm, pt.c] : [pt.c, bm];
        expect(deep.has(`${bx},${y - 6},${bz}`), `shaft of ${p.name}`).toBe(true);
      }
    }
  });
});

describe('forests', () => {
  it('are deterministic and keep off roads and places', () => {
    for (const w of WORLDS.slice(0, 10)) {
      const t = new Terrain(w), t2 = new Terrain(w);
      let total = 0;
      for (let cx = -8; cx < 8; cx++) for (let cz = -8; cz < 8; cz++) {
        const a = chunkTrees(t, cx, cz);
        expect(chunkTrees(t2, cx, cz)).toEqual(a);
        total += a.length;
        for (const tr of a) {
          expect(tr.x >= cx * CHUNK && tr.x < cx * CHUNK + CHUNK).toBe(true);
          for (const p of poisNear(w, tr.x, tr.z, 60)) expect(inRect(p.rect, tr.x, tr.z)).toBe(false);
        }
      }
      expect(total).toBeGreaterThan(20);
    }
  });
});
