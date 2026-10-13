// City vaults use their own RNG/ID namespace; adding them never moves the existing city or its buildings.
import { hash, rng } from '../core/rng';
import { CITY, citySites, cityLayout, cityToWorld, bldsNear, carsNear, inBld, type CitySite } from './cities';
import { ruinName } from './regions';
import type { DungeonPos } from '../save';
import { TL } from '../i18n';

export const CITY_VAULTS = 6;
const LEGACY_VAULTS = 4, EXTRA_BASE = CITY.n * LEGACY_VAULTS;
export const cityVaultCount = (world: number, city: CitySite) => 4 + hash(world, city.i, 0xc17f) % 3;
/** Preserve the original four addresses; extra entrances use a separate range. */
const vaultId = (city: number, n: number) => CITY_VAULT_BASE + (n < LEGACY_VAULTS ? city * LEGACY_VAULTS + n : EXTRA_BASE + city * 2 + n - LEGACY_VAULTS);
/** Outside the signed 32-bit region POI namespace (JSON saves retain these safe integers exactly). */
export const CITY_VAULT_BASE = 2 ** 32;
export interface CityEntrance { id: number; city: number; n: number; name: string; u: number; v: number; x: number; z: number }
const cache = new Map<string, CityEntrance[]>();
/** (0.195) The metro's stations are named; k < CITY_VAULTS are the entrances' stations, the rest lie underground only. */
export function stationName(world: number, city: number, k: number): string { return ruinName(rng(hash(world, city, k, 0x57a7))); }
/** Wide, open street spots (in the city's frame), best first: the entrances take theirs first, the decoys the rest. */
const spotCache = new Map<string, { u: number; v: number }[]>();
function streetSpots(world: number, city: CitySite) {
  const key = world + ':' + city.i, found = spotCache.get(key);
  if (found) return found;
  const L = cityLayout(world, city);
  // Wide, open street locations; keep both the marker and the arrival spot clear of rubble and wrecks.
  const out = L.streets.flatMap((s, k) => {
    if (Math.hypot(s.bx - s.ax, s.bz - s.az) < 12) return [];
    return [0.25, 0.5, 0.75].map((t, j) => ({ u: s.ax + (s.bx - s.ax) * t, v: s.az + (s.bz - s.az) * t, rank: hash(world, city.i, k, j, 0xc17e) }));
  }).filter(({ u, v }) => Math.hypot(u, v) < city.r - 30 &&
    bldsNear(L, u, v, 6).every((i) => !inBld(L.blds[i], u, v, 5)) &&
    carsNear(L, u, v, 7).every((i) => Math.hypot(L.cars[i].x - u, L.cars[i].z - v) > 7))
    .sort((a, b) => a.rank - b.rank || a.u - b.u || a.v - b.v);
  spotCache.set(key, out);
  return out;
}
export function cityEntrances(world: number, city: CitySite): CityEntrance[] {
  const key = world + ':' + city.i, found = cache.get(key);
  if (found) return found;
  const target = cityVaultCount(world, city), out: CityEntrance[] = [];
  for (const p of streetSpots(world, city)) {
    if (out.some((e) => Math.hypot(e.u - p.u, e.v - p.v) < city.r * 0.35)) continue;
    const n = out.length, [x, z] = cityToWorld(city, p.u, p.v);
    out.push({ id: vaultId(city.i, n), city: city.i, n, name: TL`${stationName(world, city.i, n)} Station, ${city.name} Metro`, u: p.u, v: p.v, x, z });
    if (out.length === target) break;
  }
  if (out.length < target) throw new Error(TL`Not enough clear city vault sites in world ${world}, city ${city.i}`);
  cache.set(key, out);
  return out;
}
/** (0.195) Metro entrances that lead nowhere: caved in, the stairs full of rubble. 2–3 a city, on the surface only. */
export interface CityDecoy { city: number; u: number; v: number; x: number; z: number }
const decoyCache = new Map<string, CityDecoy[]>();
export function cityDecoys(world: number, city: CitySite): CityDecoy[] {
  const key = world + ':' + city.i, found = decoyCache.get(key);
  if (found) return found;
  const real = cityEntrances(world, city), out: CityDecoy[] = [], want = 2 + hash(world, city.i, 0xdec0) % 2;
  for (const p of streetSpots(world, city)) {
    if (real.some((e) => Math.hypot(e.u - p.u, e.v - p.v) < 70) || out.some((e) => Math.hypot(e.u - p.u, e.v - p.v) < city.r * 0.25)) continue;
    const [x, z] = cityToWorld(city, p.u, p.v);
    out.push({ city: city.i, u: p.u, v: p.v, x, z });
    if (out.length === want) break;
  }
  decoyCache.set(key, out);
  return out;
}
export function cityEntrance(world: number, id: number): CityEntrance | undefined {
  const offset = id - CITY_VAULT_BASE;
  if (!Number.isInteger(offset) || offset < 0 || offset >= CITY.n * CITY_VAULTS) return;
  const city = citySites(world).find((c) => c.i === (offset < EXTRA_BASE ? Math.floor(offset / LEGACY_VAULTS) : Math.floor((offset - EXTRA_BASE) / 2)));
  return city && cityEntrances(world, city).find((e) => e.id === id);
}
/** Existing ruins keep their exact seed. City vaults cannot alias a region ID through hash's 32-bit conversion. */
export function dungeonSeed(world: number, d: Pick<DungeonPos, 'ruinId' | 'depth' | 'gx' | 'gz'>): number {
  return d.ruinId >= CITY_VAULT_BASE
    ? hash(world, d.ruinId - CITY_VAULT_BASE, d.depth, d.gx, d.gz, 0xc17d)
    : hash(world, d.ruinId, d.depth, d.gx, d.gz);
}
