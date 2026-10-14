import { describe, it, expect } from 'vitest';
import { generateVillage, setVillageLayout, villageSides, villageGates, layoutFields, VILLAGE_OFFSET, type VillageLayout } from '../src/gen/village';
import { HOMES_MIN } from '../src/gen/homes';
import { newWorld, newVillage, type VillageFile } from '../src/gen/mapfile';
import { customSeed, setCustomWorld } from '../src/gen/customworld';
import { allVillages, villageSeed, GRIDHOLM_ID } from '../src/gen/regions';
import { applyLayouts } from '../src/gen/layouts';
import { farmPlot } from '../src/gen/farms';
import type { TownState } from '../src/gen/town';

const LAYOUT: VillageLayout = { sides: 6, wall: 2, items: [
  { k: 'b:tavern', x: -20, z: -10, w: 13, d: 10, rot: 0, label: 'The Rusty Cog' },
  { k: 'b:elder', x: 20, z: -10, w: 11, d: 9, rot: 90 },
  { k: 'b:house', x: -25, z: 20, w: 8, d: 7, rot: 180 },
  { k: 'b:house', x: 25, z: 20, w: 8, d: 7, rot: 270 },
  { k: 'b:well', x: 0, z: 10, w: 2, d: 2, rot: 0 },
  { k: 'b:board', x: 6, z: -4, w: 2, d: 1, rot: 0 },
  { k: 'farm:cows', x: 70, z: 0, w: 14, d: 14, rot: 0 },
  { k: 'farm:wheat', x: -70, z: 0, w: 12, d: 12, rot: 0 },
  { k: 'b:house', x: 300, z: 0, w: 8, d: 7, rot: 0 }, // outside the wall: left out
] };
const S = 778899;

describe('stage E3: village layouts from the editor', () => {
  it('builds the drawn buildings, wall shape, well and board; the game fills in what is missing', () => {
    const before = generateVillage(S, 5, 1000, 2000, 'Plain', false);
    setVillageLayout(S, LAYOUT);
    const v = generateVillage(S, 5, 1000, 2000, 'Laid', false);
    expect(villageSides(S)).toBe(6);
    expect(villageGates(S)).toEqual(['N', 'S']);
    const ox = VILLAGE_OFFSET.x + 1000, oz = VILLAGE_OFFSET.z + 2000, mid = (b: { x: number; z: number; w: number; d: number }) => [b.x + b.w / 2 - ox - 36, b.z + b.d / 2 - oz - 36];
    const tav = v.buildings.find((b) => b.role === 'innkeeper')!;
    expect(tav.name).toBe('THE RUSTY COG');
    expect(tav.side).toBe('S');
    const [tx, tz] = mid(tav); expect(Math.abs(tx + 20)).toBeLessThanOrEqual(1); expect(Math.abs(tz + 10)).toBeLessThanOrEqual(1);
    const eld = v.buildings.find((b) => b.role === 'elder')!;
    expect(eld.side).toBe('W'); expect(eld.w).toBe(9); expect(eld.d).toBe(11); // turned a quarter: the footprint swaps
    for (const r of ['blacksmith', 'merchant', 'grocer'] as const) expect(v.buildings.some((b) => b.role === r)).toBe(true); // filled in
    const houses = v.buildings.filter((b) => b.role === 'house');
    expect(houses.length).toBe(HOMES_MIN); // two drawn, the rest to the least the heroes need
    expect(houses.some((b) => b.side === 'N')).toBe(true);
    expect(v.well).toEqual({ x: 36 + ox, z: 46 + oz });
    expect(v.board).toEqual({ x: 42 + ox, z: 32 + oz });
    for (let i = 0; i < v.buildings.length; i++) for (let j = i + 1; j < v.buildings.length; j++) {
      const a = v.buildings[i], b = v.buildings[j];
      expect(a.x < b.x + b.w && b.x < a.x + a.w && a.z < b.z + b.d && b.z < a.z + a.d).toBe(false);
    }
    setVillageLayout(S, null);
    expect(generateVillage(S, 5, 1000, 2000, 'Plain', false)).toEqual(before); // without it: as it always was
  });
  it('a village of a drawn world takes its layout: the wall, worked fields with their crops', () => {
    const f = newWorld('Layout land', 60, 40);
    f.land = f.land.map(() => 12);
    f.places.push({ k: 'start', x: 15000, z: 10000 }, { k: 'village', x: 15000 + 3000, z: 10000, layout: 'Mine', name: 'Laidholm' });
    const vf: VillageFile = { ...newVillage('Mine'), ...LAYOUT };
    const W = customSeed('Layout land');
    setCustomWorld(W, f, { Mine: vf });
    const v = allVillages(W).find((p) => p.name === 'Laidholm')!;
    const seed = villageSeed(W, v);
    expect(villageSides(seed)).toBe(6);
    expect(villageSides(villageSeed(W, allVillages(W)[0]), true)).toBe(8); // Gridholm keeps its own: no layout at the start
    expect(layoutFields(seed).map((q) => q.crop)).toEqual(['cows', 'wheat']);
    expect(farmPlot(seed, 0)).toEqual({ x0: 106 - 7, z0: 36 - 7, x1: 106 + 7, z1: 36 + 7 });
    const c = { world: W, towns: {} as Record<string, TownState> };
    applyLayouts(c);
    expect(c.towns[v.id]).toMatchObject({ wall: 2, farms: 2, crops: ['cows', 'wheat'], lay: 1 });
    expect(c.towns[GRIDHOLM_ID]).toBeUndefined();
    c.towns[v.id].wall = 0; applyLayouts(c); expect(c.towns[v.id].wall).toBe(0); // once only: later changes stay
    setCustomWorld(W, null);
    expect(villageSides(seed)).not.toBe(undefined);
  });
});
