import { describe, it, expect } from 'vitest';
import { newWorld } from '../src/gen/mapfile';
import { customSeed, setCustomWorld, placeDungeon, cityDungeon } from '../src/gen/customworld';
import { regionInfo, regionOf } from '../src/gen/regions';
import { citySites } from '../src/gen/cities';
import { metroCity } from '../src/gen/metro';
import { cityEntrances } from '../src/gen/citydungeons';

describe('stage E4: dungeons from the editor under the places of a drawn world', () => {
  const f = newWorld('Deep land', 80, 50);
  f.land = f.land.map(() => 10);
  const at = (x: number, z: number) => ({ x: x + 20000, z: z + 12500 });
  f.places.push({ k: 'start', ...at(0, 0) },
    { k: 'ruin', ...at(1500, 800), dungeon: 'Crypt' }, { k: 'ruin', ...at(1530, 820), dungeon: 'Second' }, // the second in the same region is not placed
    { k: 'wreck', ...at(-2500, 1800), dungeon: 'Hulk' }, { k: 'ruin', ...at(-3000, -2000) },
    { k: 'city', ...at(6000, -3000), r: 600, dungeon: 'Tube' });
  const W = customSeed('Deep land');
  setCustomWorld(W, f);
  const poi = (type: string, x: number, z: number) => { const [rx, rz] = regionOf(x, z); return regionInfo(W, rx, rz).pois.find((p) => p.type === type)!; };
  it('names the level under a ruin, a wreck and a dead city', () => {
    expect(placeDungeon(W, poi('ruin', 1500, 800).id)).toBe('Crypt');
    expect(placeDungeon(W, poi('wreck', -2500, 1800).id)).toBe('Hulk');
    expect(placeDungeon(W, poi('ruin', -3000, -2000).id)).toBeUndefined(); // its own generated level
    const c = citySites(W)[0];
    expect(cityDungeon(W, c.i)).toBe('Tube');
    const e = cityEntrances(W, c)[0];
    expect(metroCity(W, e.id)?.i).toBe(c.i); // every entrance leads to the city's level
  });
  it('leaves the worlds of a seed alone', () => {
    expect(placeDungeon(12345, poi('ruin', 1500, 800).id)).toBeUndefined();
    expect(cityDungeon(12345, 0)).toBeUndefined();
  });
});
