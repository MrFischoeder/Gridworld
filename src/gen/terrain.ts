// Heightfield of the open world: seeded noise, shaped per region, flattened under places and along roads.
import { fbm } from '../core/noise';
import { hash } from '../core/rng';
import { regionInfo, regionOf, poisNear, wrapR, CHUNK, REGION, WORLD_W, POLAR_Z, POLE_Z, type Poi, type Rect } from './regions';
import { regionRoads, nearestOnRoad, roadBounds, type Road } from './roads';

export const STEP = 2, CELLS = CHUNK / STEP, VERTS = CELLS + 1;
export const MAX_H = 25;
const smooth = (t: number) => t * t * (3 - 2 * t);

export const rectDist = (r: Rect, x: number, z: number) => Math.hypot(Math.max(r.x0 - x, 0, x - r.x1), Math.max(r.z0 - z, 0, z - r.z1));
export const inRect = (r: Rect, x: number, z: number) => x >= r.x0 && x < r.x1 && z >= r.z0 && z < r.z1;

export interface Pad { poi: Poi; y: number }
export interface Features { pads: Pad[]; roads: Road[] }

const ROAD_BLEND = 5;
/**
 * Noise scale s adjusted so a whole number of lattice cells fits round the planet: returns [scale, cells].
 * The adjustment is tiny (e.g. 170 m -> 169.94 m), so the land near Gridholm is practically unchanged.
 */
const wrapScale = (s: number): [number, number] => { const n = Math.round(WORLD_W / s); return [WORLD_W / n, n]; };
const [S170, P170] = wrapScale(170), [S48, P48] = wrapScale(48), [S90, P90] = wrapScale(90), [S60, P60] = wrapScale(60);
/** Ice sheet height and the ice wall at the poles. */
const ICE_Y = 16, WALL_H = 70;

export class Terrain {
  private s1: number; private s2: number;
  private lat = new Map<number, Float32Array>();
  private feat = new Map<number, Features>();
  private padCache = new Map<number, number>();
  constructor(public world: number) { this.s1 = hash(world, 0x7e11) * 7919; this.s2 = hash(world, 0x7e12) * 7919; }

  /** Region roughness, blended smoothly between region centres so there are no seams. */
  private rough(x: number, z: number): number {
    const fx = x / REGION, fz = z / REGION, x0 = Math.floor(fx), z0 = Math.floor(fz), tx = smooth(fx - x0), tz = smooth(fz - z0);
    const v = (rx: number, rz: number) => regionInfo(this.world, wrapR(rx), rz).rough;
    const a = v(x0, z0), b = v(x0 + 1, z0), c = v(x0, z0 + 1), d = v(x0 + 1, z0 + 1);
    return a + (b - a) * tx + (c - a) * tz + (a - b - c + d) * tx * tz;
  }
  /** Natural terrain before any flattening: gentle hills in 0..25 m; towards the poles an ice sheet, then the ice wall. */
  base(x: number, z: number): number {
    const amp = 0.55 + 0.8 * this.rough(x, z);
    const raw = 12.5 + amp * (46 * (fbm(this.s1, x / S170, z / 170, 4, P170) - 0.5) + 8 * (fbm(this.s2, x / S48, z / 48, 3, P48) - 0.5));
    let h = 12.5 + 12.5 * Math.tanh((raw - 12.5) / 12.5);
    const az = Math.abs(z);
    if (az > POLAR_Z) {
      const ice = ICE_Y + 3 * (fbm(this.s2 + 5, x / S60, z / 60, 2, P60) - 0.5);
      h += (ice - h) * smooth(Math.min(1, (az - POLAR_Z) / 2500));
      if (az > POLE_Z - 120) h += WALL_H * smooth(Math.min(1, (az - (POLE_Z - 120)) / 70)); // a sheer cliff of ice
    }
    return h;
  }
  /** Floor height of a place (whole metres, so voxel structures sit exactly on it). */
  padY(p: Poi): number {
    let y = this.padCache.get(p.id);
    if (y === undefined) { y = Math.max(2, Math.min(MAX_H - 2, Math.round(this.base(p.x, p.z)))); this.padCache.set(p.id, y); }
    return y;
  }

  /** Places and roads that can affect heights inside the rect. */
  featuresIn(r: Rect): Features {
    const cx = (r.x0 + r.x1) / 2, cz = (r.z0 + r.z1) / 2, half = Math.max(r.x1 - r.x0, r.z1 - r.z0) / 2;
    const pads = poisNear(this.world, cx, cz, half + 80)
      .filter((p) => rectDist(p.rect, cx, cz) <= half * 1.42 + p.flat + p.blend)
      .map((poi) => ({ poi, y: this.padY(poi) }));
    const roads: Road[] = [];
    const [ax, az] = regionOf(cx - 600, cz - 600), [bx, bz] = regionOf(cx + 600, cz + 600);
    for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) {
      for (const road of regionRoads(this.world, rx, rz)) {
        const b = roadBounds(road), m = road.half + ROAD_BLEND;
        if (b.x1 + m >= r.x0 && b.x0 - m <= r.x1 && b.z1 + m >= r.z0 && b.z0 - m <= r.z1) roads.push(road);
      }
    }
    return { pads, roads };
  }
  chunkFeatures(cx: number, cz: number): Features {
    const k = key(cx, cz);
    let f = this.feat.get(k);
    if (!f) {
      if (this.feat.size > 4096) this.feat.clear();
      f = this.featuresIn({ x0: cx * CHUNK, z0: cz * CHUNK, x1: cx * CHUNK + CHUNK, z1: cz * CHUNK + CHUNK });
      this.feat.set(k, f);
    }
    return f;
  }

  /** Exact height with roads (flat across their width) and places (perfectly flat footprint) applied. */
  exact(x: number, z: number, f: Features = this.chunkFeatures(Math.floor(x / CHUNK), Math.floor(z / CHUNK))): number {
    let h = this.base(x, z);
    for (const r of f.roads) {
      const [d, px, pz] = nearestOnRoad(r, x, z);
      if (d >= r.half + ROAD_BLEND) continue;
      const w = d <= r.half ? 1 : 1 - smooth((d - r.half) / ROAD_BLEND), rh = this.base(px, pz);
      h = w >= 1 ? rh : h + (rh - h) * w;
    }
    for (const p of f.pads) {
      const d = rectDist(p.poi.rect, x, z);
      if (d <= p.poi.flat) h = p.y;
      else if (d < p.poi.flat + p.poi.blend) h += (p.y - h) * (1 - smooth((d - p.poi.flat) / p.poi.blend));
    }
    return h;
  }

  /** Heights on the 2 m lattice of a chunk, VERTS x VERTS, row-major along x. */
  lattice(cx: number, cz: number): Float32Array {
    const k = key(cx, cz);
    let a = this.lat.get(k);
    if (a) return a;
    if (this.lat.size > 2048) this.lat.clear();
    const f = this.chunkFeatures(cx, cz);
    a = new Float32Array(VERTS * VERTS);
    for (let j = 0; j < VERTS; j++) for (let i = 0; i < VERTS; i++) a[i + VERTS * j] = this.exact(cx * CHUNK + i * STEP, cz * CHUNK + j * STEP, f);
    this.lat.set(k, a);
    return a;
  }
  /** Ground height anywhere: bilinear interpolation of the 2 m lattice. */
  heightAt(x: number, z: number): number {
    const cx = Math.floor(x / CHUNK), cz = Math.floor(z / CHUNK), a = this.lattice(cx, cz);
    const lx = (x - cx * CHUNK) / STEP, lz = (z - cz * CHUNK) / STEP;
    const i = Math.min(CELLS - 1, Math.floor(lx)), j = Math.min(CELLS - 1, Math.floor(lz)), fx = lx - i, fz = lz - j;
    const h00 = a[i + VERTS * j], h10 = a[i + 1 + VERTS * j], h01 = a[i + VERTS * (j + 1)], h11 = a[i + 1 + VERTS * (j + 1)];
    return h00 + (h10 - h00) * fx + (h01 - h00) * fz + (h00 - h10 - h01 + h11) * fx * fz;
  }
  /** Forest density 0..1 at a point: regional amount modulated by large blotches of noise. */
  forest(x: number, z: number): number {
    const [rx, rz] = regionOf(x, z), reg = regionInfo(this.world, rx, rz).forest;
    const n = fbm(this.s2 + 17, x / S90, z / 90, 3, P90);
    const cold = Math.abs(z) > POLAR_Z - 3000 ? Math.max(0, 1 - (Math.abs(z) - (POLAR_Z - 3000)) / 2500) : 1; // forests thin out towards the ice
    return Math.max(0, Math.min(1, (n - 0.62 + reg * 0.3) * 3.2)) * cold;
  }
}
const key = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
