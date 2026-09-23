// Roads: from every village gate a road runs to a ruin (the nearest one roughly in that direction).
import { rng, hash, DIRV } from '../core/rng';
import { regionInfo, poisNear, type Poi, type Rect } from './regions';
import { villageGates, VILLAGE_OFFSET } from './village';

export interface Road { id: string; from: number; to: number; gate: string; pts: [number, number][]; half: number }

const GATE_POINT = { N: [36, -2], S: [41, 74], E: [74, 37], W: [-2, 39] } as const;
/** Where the road of a gate starts (just outside the wall apron), for a village centred at its POI. */
export function gatePoint(v: Poi, dir: keyof typeof GATE_POINT): [number, number] {
  const p = GATE_POINT[dir];
  return [p[0] + VILLAGE_OFFSET.x + v.x, p[1] + VILLAGE_OFFSET.z + v.z];
}

function segHitsRect(ax: number, az: number, bx: number, bz: number, r: Rect): boolean {
  for (let i = 0; i <= 20; i++) {
    const t = i / 20, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
    if (x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1) return true;
  }
  return false;
}

const cache = new Map<string, Road[]>();
/** Roads leaving the villages of region (rx, rz). */
export function regionRoads(world: number, rx: number, rz: number): Road[] {
  const key = world + ':' + rx + ':' + rz;
  let out = cache.get(key);
  if (out) return out;
  if (cache.size > 1024) cache.clear();
  out = [];
  for (const v of regionInfo(world, rx, rz).pois) {
    if (v.type !== 'village') continue;
    const ruins = poisNear(world, v.x, v.z, 420).filter((p) => p.type === 'ruin');
    if (!ruins.length) continue;
    for (const dir of villageGates(world)) {
      const [sx, sz] = gatePoint(v, dir), o = DIRV[dir];
      // prefer ruins in the gate's direction; distance is stretched for ruins off to the side
      const cost = (p: Poi) => { const dx = p.x - sx, dz = p.z - sz, d = Math.hypot(dx, dz); return d * (1 + (1 - (dx * o[0] + dz * o[1]) / d) * 1.5); };
      const to = ruins.slice().sort((a, b) => cost(a) - cost(b))[0];
      const R = rng(hash(world, v.id, to.id, dir.charCodeAt(0)));
      const pts: [number, number][] = [[sx, sz], [sx + o[0] * 14, sz + o[1] * 14]];
      const [ax, az] = pts[1], dist = Math.hypot(to.x - ax, to.z - az), n = Math.floor(dist / 70);
      for (let j = 1; j <= n; j++) {
        const t = j / (n + 1), px = ax + (to.x - ax) * t, pz = az + (to.z - az) * t, nx = -(to.z - az) / dist, nz = (to.x - ax) / dist, off = (R() - 0.5) * 30;
        pts.push([px + nx * off, pz + nz * off]);
      }
      pts.push([to.x, to.z]);
      // keep clear of the village itself: go round the nearest corner when a leg would cut through
      const keep: Rect = { x0: v.rect.x0 - 8, z0: v.rect.z0 - 8, x1: v.rect.x1 + 8, z1: v.rect.z1 + 8 };
      for (let i = 1; i + 1 < pts.length; i++) {
        const [ax2, az2] = pts[i], [bx2, bz2] = pts[i + 1];
        if (!segHitsRect(ax2, az2, bx2, bz2, keep)) continue;
        const corners: [number, number][] = [[keep.x0 - 4, keep.z0 - 4], [keep.x1 + 4, keep.z0 - 4], [keep.x0 - 4, keep.z1 + 4], [keep.x1 + 4, keep.z1 + 4]];
        const c = corners.sort((p, q) => Math.hypot(p[0] - ax2, p[1] - az2) + Math.hypot(p[0] - bx2, p[1] - bz2) - Math.hypot(q[0] - ax2, q[1] - az2) - Math.hypot(q[0] - bx2, q[1] - bz2))[0];
        pts.splice(i + 1, 0, c);
        if (pts.length > 16) break;
      }
      out.push({ id: v.id + ':' + dir, from: v.id, to: to.id, gate: dir, pts, half: 2.5 });
    }
  }
  cache.set(key, out);
  return out;
}

/** Nearest point on a polyline: returns [distance, x, z]. */
export function nearestOnRoad(r: Road, x: number, z: number): [number, number, number] {
  let best = Infinity, bx = 0, bz = 0;
  for (let i = 0; i + 1 < r.pts.length; i++) {
    const [ax, az] = r.pts[i], [cx, cz] = r.pts[i + 1], dx = cx - ax, dz = cz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    const px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
    if (d < best) { best = d; bx = px; bz = pz; }
  }
  return [best, bx, bz];
}
export function roadBounds(r: Road): Rect {
  const xs = r.pts.map((p) => p[0]), zs = r.pts.map((p) => p[1]);
  return { x0: Math.min(...xs), z0: Math.min(...zs), x1: Math.max(...xs), z1: Math.max(...zs) };
}
