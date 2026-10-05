import type { VillageMap } from './village';
import type { TownState } from './town';
import { progressive, development } from './settlement';

/** Keep seeded footprints and streets; vacant homes have matching broken walls and collision boxes. */
export function settlementVillage(vm: VillageMap, s: TownState | undefined, population: number, ownsHome: boolean) {
  if (!progressive(s)) return;
  const stage = development(s), occupied = Math.max(0, Math.floor((population - 8) / 6));
  let house = 0;
  for (const b of vm.buildings) {
    const vacant = b.role === 'house' ? (b.mine ? !ownsHome : house++ >= occupied) : b.role === 'merchant' && stage < 2;
    if (!vacant) continue;
    b.condition = stage >= 5 ? 2 : stage >= 2 ? 1 : 0;
    if (b.condition === 2) continue;
    b.furniture = [];
    b.walls = b.walls.filter((_, i) => b.condition === 1 || i % 3 !== 1).map((w, i) => {
      const a = [...w]; a[4] = Math.min(a[4], vm.y + (b.condition === 1 ? 2.3 : .6 + (i % 3) * .5)); return a;
    }).filter((w) => w[4] > w[1]);
  }
  // The private chest/bed remain usable only in an owned or fully restored house.
  if (!ownsHome && vm.buildings.some((b) => b.mine && b.condition !== undefined && b.condition < 2)) vm.house = null;
}
