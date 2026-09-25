// The village computer: a terminal on a desk in every elder's hall (gen/village.ts furniture 'terminal', drawn by
// world/houses.ts). E in front of it opens ui/terminal.ts.
import { G } from '../game';
import { loadedVillages } from './overworld';
import type { VillageMap } from '../gen/village';

/** The terminal you stand at, and its village. */
export function nearTerminal(): { vid: number; vm: VillageMap } | null {
  if (G.char.loc !== 'overworld') return null;
  for (const v of loadedVillages()) {
    if (Math.abs(G.pos.y - v.vm.y) > 1.2) continue;
    for (const b of v.vm.buildings) {
      if (b.role !== 'elder') continue;
      for (const f of b.furniture) {
        if (f.k !== 'terminal') continue;
        // in front of it: its middle, a little out into the room (towards the door)
        const cx = (f.x0 + f.x1) / 2 + f.n[0] * ((f.x1 - f.x0) / 2 + 0.6), cz = (f.z0 + f.z1) / 2 + f.n[1] * ((f.z1 - f.z0) / 2 + 0.6);
        if (Math.hypot(G.pos.x - cx, G.pos.z - cz) < 1.1) return { vid: v.id, vm: v.vm };
      }
    }
  }
  return null;
}
