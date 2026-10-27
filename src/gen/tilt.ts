// (0.275, the owner's request: the colossi stand crooked, half buried, not straight from the quarry) A frame that
// leans a statue forward, rolls it to a side and turns it, and the capsules its collision is made of. Pure.

export type V = [number, number, number];
/** Statue frame (x across, y up, z out of the face) → its place: lean forward about x, roll about the face's axis, turn by yaw. */
export function tiltFrame(lean: number, roll: number, yaw: number, ox = 0, oy = 0, oz = 0): (x: number, y: number, z: number) => V {
  const cl = Math.cos(lean), sl = Math.sin(lean), cr = Math.cos(roll), sr = Math.sin(roll), cy = Math.cos(yaw), sy = Math.sin(yaw);
  return (x, y, z) => {
    const y1 = y * cl - z * sl, z1 = y * sl + z * cl;
    const x2 = x * cr - y1 * sr, y2 = x * sr + y1 * cr;
    return [ox + cy * x2 + sy * z1, oy + y2, oz - sy * x2 + cy * z1];
  };
}
/** A rounded rod between two points: the solid of a tilted statue's body, neck or head. */
export interface Capsule { a: V; b: V; r: number }
/** Distance from a point to a capsule's axis. */
export function capsuleDist(c: Capsule, x: number, y: number, z: number): number {
  const [ax, ay, az] = c.a, dx = c.b[0] - ax, dy = c.b[1] - ay, dz = c.b[2] - az, L = dx * dx + dy * dy + dz * dz;
  const t = L > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy + (z - az) * dz) / L)) : 0;
  return Math.hypot(ax + dx * t - x, ay + dy * t - y, az + dz * t - z);
}
/** A body (feet at y, r wide, h tall) runs into one of the capsules: tested at the knee, the waist and the head. */
export function capsulesHit(caps: readonly Capsule[], x: number, y: number, z: number, r: number, h = 1.7): boolean {
  for (const c of caps) for (const yy of [y + 0.35, y + h * 0.55, y + h - 0.2]) if (capsuleDist(c, x, yy, z) < c.r + r) return true;
  return false;
}
