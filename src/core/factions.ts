export type Faction = 'player' | 'bandit' | 'robot' | 'wildlife';
/** Machines and wildlife share no targets among themselves; humans are their common enemy. */
export function hostile(a: Faction, b: Faction): boolean {
  if (a === b) return false;
  return a === 'player' || b === 'player' || a === 'bandit' || b === 'bandit';
}
/** First intersection of a swept shot with a sphere, in metres along a unit ray. */
export function shotSphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, length: number, x: number, y: number, z: number, radius: number): number | null {
  const vx = ox - x, vy = oy - y, vz = oz - z, b = vx * dx + vy * dy + vz * dz;
  const c = vx * vx + vy * vy + vz * vz - radius * radius;
  if (c <= 0) return 0;
  const disc = b * b - c; if (disc < 0) return null;
  const hit = -b - Math.sqrt(disc); return hit >= 0 && hit <= length ? hit : null;
}
