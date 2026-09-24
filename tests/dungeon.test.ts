import { describe, it, expect } from 'vitest';
import { generateDungeon, type DungeonMap } from '../src/gen/dungeon';
import { generateVillage } from '../src/gen/village';
import { VoxelGrid, floorAt, floorNear } from '../src/core/voxel';
import { placeTunnelDoors, tryPlaceDoor, setDoorCells, type PlacedDoor } from '../src/gen/doors';
import { reachableCells, columnReached } from '../src/gen/reach';
import { DIRV, hash } from '../src/core/rng';

const SEEDS = Array.from({ length: 64 }, (_, i) => hash(1234, i));

/** Builds the level the way the game does: grid, tunnel doors, then stairwell doors. */
function build(map: DungeonMap) {
  const grid = VoxelGrid.fromOps(map.ops);
  const doors: PlacedDoor[] = placeTunnelDoors(grid, map.doorCands);
  const stairDoors = map.portals.map((p) => tryPlaceDoor(grid, { axis: p.axis, m: p.m, c: p.c, stair: true }, doors)!);
  return { grid, doors, stairDoors };
}

/** Standing cell in front of a stairwell door, inside the room. */
const stairFront = (p: DungeonMap['portals'][number]): [number, number] => {
  const o = DIRV[p.dir], m = p.m - (o[0] || o[1]);
  return p.axis === 'x' ? [m, p.c] : [p.c, m];
};

const spawnCell = (map: DungeonMap): [number, number, number] => [Math.floor(map.spawn[0]), 0, Math.floor(map.spawn[2])];

describe('generateDungeon', () => {
  it('is deterministic', () => {
    for (const s of SEEDS) {
      expect(generateDungeon(s).ops).toEqual(generateDungeon(s).ops);
      expect(generateDungeon(s, { surfaceExit: true })).toEqual(generateDungeon(s, { surfaceExit: true }));
    }
  });

  it('places all four stairwells (and the surface exit when asked)', () => {
    for (const s of SEEDS) {
      const keys = generateDungeon(s).portals.map((p) => p.key).sort();
      expect(keys, 'seed ' + s).toEqual(['E', 'N', 'S', 'W']);
      expect(generateDungeon(s, { surfaceExit: true }).portals.map((p) => p.key)).toContain('V');
    }
  });

  it('with doors open, the hatch, every chest and every stairwell are reachable from the spawn', () => {
    for (const s of SEEDS) {
      const map = generateDungeon(s, { surfaceExit: s % 2 === 0 });
      const { grid, doors, stairDoors } = build(map);
      for (const d of doors) if (!d.stair) setDoorCells(grid, d.cells, false);
      const seen = reachableCells(grid, spawnCell(map));
      const at = (x: number, z: number) => columnReached(seen, x, z, -1, 12);
      // objects stand where the game puts them: on the nearest floor cell around their nominal spot
      const floor = (x: number, z: number) => floorAt(grid, x, z, grid.oy + 1, grid.oy + grid.ny - 1)!;
      const chestFloor = (x: number, z: number) => floorNear(grid, x, z, 0, grid.oy + 1, grid.oy + grid.ny - 1)!;
      expect(seen.has(floor(map.hatch!.x, map.hatch!.z).join(',')), 'hatch, seed ' + s).toBe(true);
      map.chests.forEach((c, i) => expect(seen.has(chestFloor(c.x, c.z).join(',')), `chest ${i}, seed ${s}`).toBe(true));
      map.portals.forEach((p, i) => { expect(stairDoors[i]).toBeTruthy(); expect(at(...stairFront(p)), `stair ${p.key}, seed ${s}`).toBe(true); });
    }
  });

  it('locked gate doors seal the hatch, while the first guardian stays reachable', () => {
    let gated = 0;
    for (const s of SEEDS) {
      const map = generateDungeon(s);
      const { grid, doors } = build(map);
      if (!map.gates.length) continue;
      gated++;
      for (const d of doors) if (!d.stair && !d.locked) setDoorCells(grid, d.cells, false);
      expect(doors.some((d) => d.locked), 'locked door placed, seed ' + s).toBe(true);
      const seen = reachableCells(grid, spawnCell(map));
      expect(columnReached(seen, map.hatch!.x, map.hatch!.z, -1, 12), 'hatch sealed, seed ' + s).toBe(false);
      const guard = map.bosses.filter((b) => b.guard).sort((a, b) => a.gate! - b.gate!)[0];
      const r = guard.room;
      let reached = false;
      for (let x = r.x; x < r.x + r.w && !reached; x++) for (let z = r.z; z < r.z + r.d && !reached; z++) reached = columnReached(seen, x, z, -1, 12);
      expect(reached, 'first guardian room, seed ' + s).toBe(true);
    }
    expect(gated).toBeGreaterThan(SEEDS.length / 2);
  });
});

describe('generateVillage', () => {
  it('is deterministic', () => {
    for (const s of SEEDS) expect(generateVillage(s)).toEqual(generateVillage(s));
  });
});

describe('tower ladders', () => {
  it('stand in the open, and lead to a deck you can stand on', () => {
    for (const s of SEEDS) for (const tier of [0, 1, 2]) {
      const vm = generateVillage(s, 0, 0, 0, 'Test', false, tier), g = VoxelGrid.surface(vm.ops, vm.rect, vm.y);
      const free = (x: number, y: number, z: number) => [-0.3, 0.3].every((a) => [-0.3, 0.3].every((b) => g.empty(Math.floor(x + a), Math.floor(y), Math.floor(z + b))));
      for (const t of vm.towers) {
        const l = t.ladder!;
        const sx = l.x + l.nx * 0.45, sz = l.z + l.nz * 0.45;
        for (let y = 0; y < l.top + 1.7; y += 0.5) expect(free(sx, vm.y + y + 0.01, sz), `${s} tier ${tier} climb at ${sx},${y},${sz}`).toBe(true);
        const tx = l.x - l.nx * 0.9, tz = l.z - l.nz * 0.9;
        expect(tx > l.deck.x0 && tx < l.deck.x1 && tz > l.deck.z0 && tz < l.deck.z1).toBe(true);
        expect(free(tx, vm.y + l.top + 0.01, tz) && free(tx, vm.y + l.top + 1.2, tz), `${s} tier ${tier} deck`).toBe(true);
        if (!l.stilts) expect(g.empty(Math.floor(tx), vm.y + l.top - 1, Math.floor(tz))).toBe(false);
      }
    }
  });
});
