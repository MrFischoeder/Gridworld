import { hash } from '../core/rng';
import type { Space } from '../core/voxel';
import type { DungeonMap } from './dungeon';
import type { MountedTurretSpec, TurretMount } from '../data/mountedturrets';
/** Independent RNG namespace: defence placement never changes rooms, loot or door indices. */
/** `max`: how many of the wall / floor / ceiling guns to keep, in that order (a crashed ship keeps fewer). */
export function dungeonTurrets(map: DungeonMap, space: Space, max = 3): MountedTurretSpec[] {
  const rooms = map.boxes.filter(b => !b.tunnel && Math.hypot(b.x + b.w / 2 - map.spawn[0], b.z + b.d / 2 - map.spawn[2]) > 12)
    .sort((a, b) => hash(map.seed, a.x, a.z, 0x7a11) - hash(map.seed, b.x, b.z, 0x7a11));
  const out: MountedTurretSpec[] = [];
  for (const mount of ['wall', 'floor', 'ceiling'] as TurretMount[]) for (const b of rooms) {
    const x = mount === 'wall' ? b.x + 0.7 : Math.floor(b.x + b.w / 2) + 0.5;
    const z = Math.floor(b.z + b.d / 2) + 0.5, y = mount === 'floor' ? 0.55 : mount === 'wall' ? 1.5 : b.h - 0.55;
    const nx = mount === 'wall' ? 1 : 0, ny = mount === 'floor' ? 1 : mount === 'ceiling' ? -1 : 0;
    if (!space.empty(Math.floor(x), Math.floor(y), Math.floor(z)) || space.empty(Math.floor(x - nx), Math.floor(y - ny), Math.floor(z))) continue;
    if (out.some(t => Math.hypot(t.x - x, t.z - z) < 5)) continue;
    out.push({ id: out.length, mount, x, y, z, normal: [nx, ny, 0] }); break;
  }
  return out.slice(0, max);
}
/** How many anchored guns a labyrinth sector has: one in about half of them (they hit hard), none in the rest. */
export const labyrinthTurrets = (seed: number) => (hash(seed, 0x7a12) % 2);
