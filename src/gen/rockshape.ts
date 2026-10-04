// Local boulder geometry: independent of world placement, so wrapped copies have identical stone faces.
import { hash, rng } from '../core/rng';
export type RockPoint = [number, number, number];
export type RockShape = [RockPoint[], RockPoint[], RockPoint[]];
export function rockShape(r: number, h: number, sides: number, rot: number): RockShape {
  const count = Math.max(5, sides);
  const R = rng(hash(Math.round(r * 1000), Math.round(h * 1000), sides, Math.round(rot * 1000000)));
  const shoulder = h * (.42 + R() * .14), lean = rot + R() * 2;
  const offsets = [0, .05, .12].map(k => [Math.cos(lean) * r * k, Math.sin(lean) * r * k]);
  return [0, shoulder, h].map((y, level) => Array.from({ length: count }, (_, i): RockPoint => {
    const angle = rot + i * Math.PI * 2 / count;
    const radius = r * (level === 0 ? .80 + R() * .18 : level === 1 ? .73 + R() * .19 : .42 + R() * .12);
    return [Math.cos(angle) * radius + offsets[level][0], y, Math.sin(angle) * radius + offsets[level][1]];
  })) as RockShape;
}
/** Point and outward unit normal on the actual triangle used to fill a stone face (not a curved approximation). */
export function rockFacePoint(shape: RockShape, band: 0 | 1, face: number, s: number, t: number): { point: RockPoint; normal: RockPoint } {
  const j = (face + 1) % shape[0].length, a = shape[band][face], b = shape[band][j], c = shape[band + 1][j], d = shape[band + 1][face];
  const vertices = s >= t ? [a, b, c] : [a, c, d], weights = s >= t ? [1 - s, s - t, t] : [1 - t, s, t - s];
  const point = [0, 1, 2].map(k => vertices.reduce((sum, v, i) => sum + v[k] * weights[i], 0)) as RockPoint;
  const u = vertices[1].map((v, k) => v - a[k]), v = vertices[2].map((v, k) => v - a[k]);
  const normal: RockPoint = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const length = Math.hypot(...normal), direction = normal[0] * point[0] + normal[2] * point[2] < 0 ? -1 : 1;
  return { point, normal: normal.map(n => n * direction / length) as RockPoint };
}
