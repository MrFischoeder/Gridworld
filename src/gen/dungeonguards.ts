// (0.194) Robots standing guard in the labyrinths under the ruins, by depth: the first level has light machines
// (scouts and guardian drones), the deeper ones heavier ones (repair drones, sentinels, assault constructs, and in the
// biggest halls of the third an artillery walker). Pure: from the level's seed, so every player meets the same ones.
import { rng } from '../core/rng';
import type { RobotKind } from '../data/robots';
import type { DungeonMap } from './dungeon';

export type Guard = { kind: RobotKind; x: number; z: number };
export const DEPTH_GUARDS: { chance: number; pair: number; mix: [RobotKind, number][] }[] = [
  { chance: 0.35, pair: 0.12, mix: [['scout', 6], ['guardian', 4]] },
  { chance: 0.5, pair: 0.3, mix: [['scout', 3], ['guardian', 5], ['repair', 2], ['sentinel', 2]] },
  { chance: 0.65, pair: 0.5, mix: [['guardian', 3], ['sentinel', 4], ['assault', 3], ['repair', 2], ['artillery', 1]] },
];
/** Robots too big for a room are left out of it. */
const BIG: Partial<Record<RobotKind, number>> = { artillery: 14, sentinel: 9, assault: 9 };

export function labyrinthGuards(map: DungeonMap, depth: number): Guard[] {
  const T = DEPTH_GUARDS[Math.max(0, Math.min(DEPTH_GUARDS.length, depth) - 1)], R = rng(map.seed ^ 0x6a7d31), out: Guard[] = [];
  const bossRoom = (b: DungeonMap['boxes'][number]) => map.bosses.some((s) => s.room.x === b.x && s.room.z === b.z);
  map.boxes.forEach((b, i) => {
    if (i === 0 || b.tunnel || bossRoom(b) || b.w < 7 || b.d < 7) return; // not where you come in, nor with a boss
    if (R() >= T.chance) return;
    const n = R() < T.pair ? 2 : 1;
    for (let k = 0; k < n; k++) {
      const fits = T.mix.filter(([m]) => Math.min(b.w, b.d) >= (BIG[m] ?? 0) && b.h >= 5);
      let roll = R() * fits.reduce((s, [, w]) => s + w, 0), kind = fits[0][0];
      for (const [m, w] of fits) { if ((roll -= w) < 0) { kind = m; break; } }
      out.push({ kind, x: Math.floor(b.x + 2 + R() * (b.w - 4)), z: Math.floor(b.z + 2 + R() * (b.d - 4)) });
    }
  });
  return out;
}
