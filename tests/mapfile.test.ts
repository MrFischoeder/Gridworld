// (0.207) The map editor's files (gen/mapfile.ts): a hand-made dungeon in each style becomes a level the game can play.
import { describe, it, expect } from 'vitest';
import { VoxelGrid } from '../src/core/voxel';
import { newDungeon, expandDungeon, dungeonProblems, readMapFile, newWorld, newVillage, reachable, storedMaps, EDITOR_KEY, type DungeonFile } from '../src/gen/mapfile';

const temple = (): DungeonFile => ({
  ...newDungeon('Test ruin', 'temple'),
  pieces: [
    { k: 'room', x: 0, z: 0, w: 10, d: 10, h: 5 },
    { k: 'corridor', x: 10, z: 4, w: 12, d: 3, h: 4 },
    { k: 'hall', x: 22, z: -2, w: 16, d: 14, h: 9 },
    { k: 'solid', x: 28, z: 3, w: 2, d: 2, h: 9 },
  ],
  marks: [{ k: 'exit', x: 1, z: 5 }, { k: 'chest', x: 34, z: 8 }, { k: 'boss', x: 30, z: 0 }, { k: 'guard', x: 25, z: 9, kind: 'sentinel' }, { k: 'door', x: 15, z: 5 }],
});
const metro = (): DungeonFile => ({
  ...newDungeon('Test metro', 'metro'),
  pieces: [
    { k: 'station', x: 0, z: 0, w: 34, d: 12, name: 'Alpha' },
    { k: 'tunnel', x: 33, z: 4, w: 40, d: 4 },
    { k: 'station', x: 72, z: 0, w: 34, d: 12, name: 'Beta' },
  ],
  marks: [{ k: 'exit', x: 10, z: 0 }, { k: 'chest', x: 80, z: 10 }],
});
const ship = (): DungeonFile => ({
  ...newDungeon('Test ship', 'ship'),
  pieces: [{ k: 'bay', x: 0, z: 0, w: 8, d: 6, h: 4 }, { k: 'shipcorr', x: 8, z: 2, w: 10, d: 3, h: 4 }, { k: 'engine', x: 18, z: -2, w: 14, d: 10, h: 7 }],
  marks: [{ k: 'exit', x: 4, z: 0 }, { k: 'spawn', x: 3, z: 3 }, { k: 'chest', x: 25, z: 3 }, { k: 'crystal', x: 20, z: 0 }],
});

describe('the map editor\'s dungeons', () => {
  for (const make of [temple, metro, ship]) it(make().name, () => {
    const f = make(), map = expandDungeon(f);
    expect(map.style).toBe(f.style);
    expect(map.portals.map((p) => p.key)).toEqual(['V0']);
    expect(dungeonProblems(f)).toEqual([]);
    // the stairs are carved: the portal's doorway cell is open above its floor
    const g = VoxelGrid.fromOps(map.ops), p = map.portals[0];
    const [cx, cz] = p.axis === 'x' ? [p.m, p.c] : [p.c, p.m];
    expect(g.empty(cx, (p.y0 ?? 0) + 1, cz)).toBe(true);
    // the chests can be walked to from the start
    const got = reachable(g, Math.floor(map.spawn[0]), Math.floor(map.spawn[2]), Math.floor(map.spawn[1]));
    for (const c of map.chests) expect(got.has(c.x + ',' + c.z)).toBe(true);
    expect(expandDungeon(f)).toEqual(map); // deterministic
  });
  it('a ruin keeps its boss, guard, door and solids', () => {
    const map = expandDungeon(temple());
    expect(map.bosses).toHaveLength(1);
    expect(map.bosses[0].room.w).toBe(16);
    expect(map.guards).toEqual([{ kind: 'sentinel', x: 25, z: 9 }]);
    expect(map.doorCands).toEqual([{ axis: 'x', m: 15, c: 5 }]);
    expect(VoxelGrid.fromOps(map.ops).empty(28, 1, 3)).toBe(false);
  });
  it('a metro has its stations on platforms over the track, and its rails', () => {
    const map = expandDungeon(metro()), m = map.metro!;
    expect(m.stations.map((s) => s.name)).toEqual(['Alpha', 'Beta']);
    expect(m.stations[0].entrance).toBe(0);
    expect(m.stations[1].entrance).toBe(-1);
    expect(m.decks.length).toBe(4);
    expect(m.rails.length).toBe(3);
    expect(map.portals[0].y0).toBe(1); // the stairs leave from the platform
  });
  it('says what is wrong', () => {
    expect(dungeonProblems(newDungeon('x', 'temple')).map((p) => p.k)).toEqual(['noRooms']);
    const f = temple();
    f.marks = f.marks.filter((m) => m.k !== 'exit');
    f.marks.push({ k: 'chest', x: 100, z: 100 });
    const ks = dungeonProblems(f).map((p) => p.k);
    expect(ks).toContain('noExit');
    expect(ks).toContain('outside');
  });
  it('a walled-off chest is found out', () => {
    const f = temple();
    f.pieces.push({ k: 'room', x: 50, z: 50, w: 4, d: 4, h: 4 });
    f.marks.push({ k: 'chest', x: 51, z: 51 });
    expect(dungeonProblems(f).some((p) => p.k === 'unreached' && p.x === 51)).toBe(true);
  });
});
describe('the map files', () => {
  it('come back from JSON as they went', () => {
    for (const f of [temple(), metro(), newWorld('W', 60, 30), newVillage('V')]) expect(readMapFile(JSON.parse(JSON.stringify(f)))).toEqual(readMapFile(f));
  });
  it('refuse what is not a map', () => {
    expect(readMapFile(null)).toBeNull();
    expect(readMapFile({ kind: 'dungeon', name: 'x', format: 1, style: 'castle', pieces: [], marks: [] })).toBeNull();
    expect(readMapFile({ kind: 'world', name: 'x', format: 1, w: 10, h: 10, land: [1, 2] })).toBeNull();
    expect(readMapFile({ ...temple(), format: 99 })).toBeNull();
  });
  it('the game reads the editor\'s store', () => {
    const data: Record<string, string> = { [EDITOR_KEY.dungeon]: JSON.stringify({ a: temple(), b: { junk: 1 } }) };
    const got = storedMaps('dungeon', { getItem: (k) => data[k] ?? null });
    expect(Object.keys(got)).toEqual(['a']);
  });
});
