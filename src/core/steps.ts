// Fractional stair solids: the voxel grid remains metre-sized, while walking uses real 25 cm risers.
import { DIRV } from './rng';
import type { Vec3Like } from './voxel';
import type { PortalSpec } from '../gen/stairs';
export interface StepBox { x: number; y: number; z: number; w: number; h: number; d: number }
export const STAIR_RISE = 0.25;
export function smallSteps(p: PortalSpec): StepBox[] {
  const [dx, dz] = DIRV[p.dir], cx = p.axis === 'x' ? p.m + 0.5 : p.c + 0.5, cz = p.axis === 'z' ? p.m + 0.5 : p.c + 0.5;
  const flight = Array.from({ length: 32 }, (_, i) => {
    const t = 1 + i * STAIR_RISE, top = (p.y0 ?? 0) + (p.up ? 1 : -1) * Math.min(6, (i + 1) * STAIR_RISE), bottom = (p.y0 ?? 0) - (p.up ? 0 : 7);
    const a = t - 0.5, b = a + STAIR_RISE;
    return { x: dx ? cx + Math.min(dx * a, dx * b) : cx - 1.5, z: dz ? cz + Math.min(dz * a, dz * b) : cz - 1.5,
      y: bottom, w: dx ? STAIR_RISE : 3, d: dz ? STAIR_RISE : 3, h: top - bottom };
  });
  const y = p.y0 ?? 0;
  const landing = { x: dx ? cx + Math.min(-3.5 * dx, 0.5 * dx) : cx - 1.5, z: dz ? cz + Math.min(-3.5 * dz, 0.5 * dz) : cz - 1.5,
    y: y - 1, w: dx ? 4 : 3, d: dz ? 4 : 3, h: 1 };
  return [landing, ...flight];
}
export function stepFloor(boxes: StepBox[], x: number, y: number, z: number, radius = 0.3): number {
  let floor = -Infinity;
  for (const b of boxes) if (x + radius > b.x && x - radius < b.x + b.w && z + radius > b.z && z - radius < b.z + b.d && b.y + b.h <= y + 0.6 + 1e-4) floor = Math.max(floor, b.y + b.h);
  return floor;
}
export function stepHit(boxes: StepBox[], x: number, y: number, z: number, r: number, h: number): boolean {
  // Point probes include shared tread edges; body probes leave a tiny clearance at contact.
  const eps = r ? 1e-4 : -1e-4;
  return boxes.some(b => x + r > b.x + eps && x - r < b.x + b.w - eps && z + r > b.z + eps && z - r < b.z + b.d - eps && y < b.y + b.h - 1e-4 && y + h > b.y + 1e-4);
}
export function boxRay(b: StepBox, o: Vec3Like, d: Vec3Like, max: number): number {
  let lo = 0, hi = max;
  for (const [axis, size] of [['x', 'w'], ['y', 'h'], ['z', 'd']] as const) {
    if (Math.abs(d[axis]) < 1e-9) { if (o[axis] < b[axis] || o[axis] > b[axis] + b[size]) return max; continue; }
    const a = (b[axis] - o[axis]) / d[axis], c = (b[axis] + b[size] - o[axis]) / d[axis];
    lo = Math.max(lo, Math.min(a, c)); hi = Math.min(hi, Math.max(a, c));
    if (lo > hi) return max;
  }
  return hi >= 0 ? lo : max;
}
