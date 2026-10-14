// (0.211.1) Pure: how a walking foe gets past what blocks it (world/creatures.ts, robots.ts, bandits.ts).
/** (0.211.1) One step of a walking foe from (x, z) by (sx, sz): straight on, else along either axis, else turned
 *  aside by up to 80° (round a trunk or a corner rather than standing against it). `stuck`: the foe stands inside
 *  something already (spawned there, shoved in): it walks out the way it wants to go, unless that way is `forbidden`. */
export function footStep(x: number, z: number, sx: number, sz: number, blocked: (x: number, z: number) => boolean, stuck = false, forbidden?: (x: number, z: number) => boolean): [number, number] | null {
  if (stuck) return forbidden?.(x + sx, z + sz) ? null : [x + sx, z + sz];
  if (!blocked(x + sx, z + sz)) return [x + sx, z + sz];
  if (sx && !blocked(x + sx, z)) return [x + sx, z];
  if (sz && !blocked(x, z + sz)) return [x, z + sz];
  for (const a of [0.7, -0.7, 1.4, -1.4]) {
    const c = Math.cos(a), s = Math.sin(a), tx = sx * c - sz * s, tz = sx * s + sz * c;
    if (!blocked(x + tx, z + tz)) return [x + tx, z + tz];
  }
  return null;
}
