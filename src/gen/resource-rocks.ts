// Collision follows the same faceted rings as PropBatch.rock, including its flat crown.
import { rockShape, type RockShape, type RockPoint } from './rockshape';
export const resourceRock = (x: number, y: number, z: number, r: number, h: number, sides: number, rot: number): RockShape => rockShape(r, h, sides, rot).map(ring => ring.map(p => [x + p[0], y + p[1], z + p[2]])) as RockShape;
const bounds = new WeakMap<RockShape, { x0: number; x1: number; z0: number; z1: number }>();
function near(s: RockShape, x: number, z: number, r = 0): boolean {
  let b = bounds.get(s);
  if (!b) { const p = s.flat(); b = { x0: Math.min(...p.map(a => a[0])), x1: Math.max(...p.map(a => a[0])), z0: Math.min(...p.map(a => a[2])), z1: Math.max(...p.map(a => a[2])) }; bounds.set(s, b); }
  return x >= b.x0 - r && x <= b.x1 + r && z >= b.z0 - r && z <= b.z1 + r;
}
function polygonNear(points: RockPoint[], x: number, z: number, radius: number): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const a = points[j], b = points[i];
    if ((a[2] > z) !== (b[2] > z) && x < (b[0] - a[0]) * (z - a[2]) / (b[2] - a[2]) + a[0]) inside = !inside;
    const dx = b[0] - a[0], dz = b[2] - a[2], t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[2]) * dz) / (dx * dx + dz * dz)));
    if (Math.hypot(x - a[0] - dx * t, z - a[2] - dz * t) < radius) return true;
  }
  return inside;
}
export function resourceRockHit(s: RockShape, x: number, y: number, z: number, radius: number): boolean {
  if (!near(s, x, z, radius) || y >= s[2][0][1] - .01 || y + 1.7 <= s[0][0][1]) return false;
  const top = resourceRockFloor(s, x, Infinity, z);
  if (Number.isFinite(top) && y >= top - .03) return false;
  const low = Math.max(y, s[0][0][1]), high = Math.min(y + 1.7, s[2][0][1]);
  for (const yy of [low, high, s[1][0][1]]) {
    if (yy < low || yy > high) continue;
    const band = yy <= s[1][0][1] ? 0 : 1, a = s[band], b = s[band + 1], t = (yy - a[0][1]) / (b[0][1] - a[0][1]);
    const points = a.map((p, i): RockPoint => [p[0] + (b[i][0] - p[0]) * t, yy, p[2] + (b[i][2] - p[2]) * t]);
    if (polygonNear(points, x, z, radius)) return true;
  }
  return false;
}
export function resourceRockFloor(s: RockShape, x: number, y: number, z: number): number {
  if (!near(s, x, z)) return -Infinity;
  let floor = -Infinity;
  const tri = (a: RockPoint, b: RockPoint, c: RockPoint) => {
    const den = (b[2] - c[2]) * (a[0] - c[0]) + (c[0] - b[0]) * (a[2] - c[2]); if (Math.abs(den) < 1e-8) return;
    const u = ((b[2] - c[2]) * (x - c[0]) + (c[0] - b[0]) * (z - c[2])) / den;
    const v = ((c[2] - a[2]) * (x - c[0]) + (a[0] - c[0]) * (z - c[2])) / den;
    if (u < -1e-6 || v < -1e-6 || u + v > 1 + 1e-6) return;
    const h = u * a[1] + v * b[1] + (1 - u - v) * c[1]; if (h <= y + .03) floor = Math.max(floor, h);
  };
  for (let band = 0; band < 2; band++) for (let i = 0; i < s[0].length; i++) {
    const j = (i + 1) % s[0].length; tri(s[band][i], s[band][j], s[band + 1][j]); tri(s[band][i], s[band + 1][j], s[band + 1][i]);
  }
  for (let i = 1; i + 1 < s[2].length; i++) tri(s[2][0], s[2][i], s[2][i + 1]);
  return floor;
}
