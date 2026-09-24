import { describe, it, expect } from 'vitest';
import { generateShip, SHIP_CX } from '../src/gen/ship';
import { generateWreck, wreckXZ } from '../src/gen/wreck';
import { regionInfo, type Poi } from '../src/gen/regions';
import { VoxelGrid, floorNear } from '../src/core/voxel';
import { placeTunnelDoors, tryPlaceDoor, setDoorCells } from '../src/gen/doors';
import { reachableCells } from '../src/gen/reach';
import { DIRV, hash } from '../src/core/rng';

const SEEDS = Array.from({ length: 40 }, (_, i) => hash(77, i));

describe('ship interiors', () => {
  it('are deterministic and mirrored about the keel', () => {
    for (const s of SEEDS) {
      const a = generateShip(s);
      expect(a).toEqual(generateShip(s));
      for (const b of a.boxes.filter((b) => !b.tunnel)) {
        const mx = 2 * SHIP_CX - (b.x + b.w - 1);
        expect(a.boxes.some((o) => !o.tunnel && o.x === mx && o.z === b.z && o.w === b.w && o.d === b.d), 'seed ' + s).toBe(true);
      }
      expect(a.portals.map((p) => p.key)).toEqual(['V']);
      expect(a.hatch).toBeNull();
    }
  });
  it('with doors open, every chest, the guardian and the way out are reachable from the airlock', () => {
    for (const s of SEEDS) {
      const map = generateShip(s), grid = VoxelGrid.fromOps(map.ops);
      const doors = placeTunnelDoors(grid, map.doorCands);
      expect(doors.length, 'bulkhead doors, seed ' + s).toBeGreaterThan(3);
      for (const p of map.portals) tryPlaceDoor(grid, { axis: p.axis, m: p.m, c: p.c, stair: true }, doors);
      for (const d of doors) if (!d.stair) setDoorCells(grid, d.cells, false);
      const seen = reachableCells(grid, [Math.floor(map.spawn[0]), 0, Math.floor(map.spawn[2])]);
      const at = (x: number, z: number) => seen.has(floorNear(grid, x, z, 0, grid.oy + 1, grid.oy + grid.ny - 1)!.join(','));
      map.chests.forEach((c, i) => expect(at(c.x, c.z), `chest ${i}, seed ${s}`).toBe(true));
      expect(at(map.bosses[0].x, map.bosses[0].z), 'engine room, seed ' + s).toBe(true);
      const p = map.portals[0], o = DIRV[p.dir];
      expect(seen.has([p.m - (o[0] || o[1]), 0, p.c].join(',')), 'airlock door, seed ' + s).toBe(true);
    }
  });
});

describe('crash sites', () => {
  const w = hash(3, 9);
  const wrecks: Poi[] = [];
  for (let rx = -20; rx <= 20; rx++) for (let rz = -20; rz <= 20; rz++) wrecks.push(...regionInfo(w, rx, rz).pois.filter((p) => p.type === 'wreck'));
  it('turn up now and then, well away from other places', () => {
    expect(wrecks.length).toBeGreaterThan(20);
    for (const p of wrecks) for (const q of regionInfo(w, Math.round(p.x / 256), Math.round(p.z / 256)).pois) if (q !== p) expect(Math.hypot(q.x - p.x, q.z - p.z)).toBeGreaterThan(100);
  });
  it('the stairwell behind the hatch is walled in by the hull: only the vestibule leads to it', () => {
    for (const p of wrecks.slice(0, 15)) {
      const y = 10, wm = generateWreck(w, p, y), grid = VoxelGrid.surface(wm.ops, wm.rect, y), port = wm.portal, o = DIRV[port.dir];
      // on the landing and the first steps (above and at ground level), both sides of the stairwell are solid hull
      for (let t = 1; t <= 3; t++) for (const side of [-2, 2]) for (let h = 0; h < 3; h++) {
        const a = port.m + (o[0] || o[1]) * t, x = port.axis === 'x' ? a : port.c + side, z = port.axis === 'x' ? port.c + side : a;
        if (!grid.inside(x, y + h, z)) continue;
        expect(grid.empty(x, y + h, z), `${p.name} t=${t} side=${side} h=${h}`).toBe(false);
      }
      // the hatch opens onto the side of the hull where the vestibule is
      const [hx, hz] = wreckXZ(wm.deco.frame, wm.deco.hatchU + 2.5, wm.deco.hatchS * 5);
      expect(grid.empty(Math.floor(hx), y, Math.floor(hz))).toBe(true);
    }
  });
});
