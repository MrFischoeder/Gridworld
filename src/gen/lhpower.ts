// (0.221, PLAN_PRAD_I_LUDZIE.md stage Z7) An electric lighthouse in a towns world: its lamp turns only while it has
// power, from a village within `LH.grid` of it with `LH.kw` to spare, or from an outposts' grid whose source reaches
// it and that meets at least `LH.share` of its demand. Old worlds keep their lamps lit without power, as before. Pure:
// everything comes from the world seed and the shared `towns` / `outposts`, so every game sees the same lamp.
import { townsWorld } from './worldrules';
import { allVillages, villageSeed, worldDist } from './regions';
import { balance } from './energy';
import { grids, gridState, reachOf } from './grid';
import { LH, type Lighthouse } from './lighthouses';
import type { TownState } from './town';
import type { OutpostState } from './outposts';

export interface LhPower { ok: boolean; by: 'old' | 'village' | 'grid' | ''; name: string }
export function lhPower(world: number, l: Lighthouse, towns: Record<string, TownState>, outposts: Record<string, OutpostState>, t: number): LhPower {
  if (!townsWorld(world)) return { ok: true, by: 'old', name: '' };
  for (const v of allVillages(world)) {
    if (worldDist(v.x, v.z, l.x, l.z) > LH.grid) continue;
    if (balance(world, v, villageSeed(world, v), towns[v.id], t).free >= LH.kw) return { ok: true, by: 'village', name: v.name };
  }
  let g: ReturnType<typeof grids> | null = null, st: ReturnType<typeof gridState> | null = null;
  for (const [id, o] of Object.entries(outposts)) {
    if (!o?.k || !o.done?.power || !o.pk || worldDist(o.x, o.z, l.x, l.z) > reachOf(o)) continue;
    g ??= grids(outposts); st ??= gridState(world, outposts, g, t);
    const n = g.get(id);
    if (n !== undefined && (st.share[n] ?? 0) >= LH.share) return { ok: true, by: 'grid', name: o.name };
  }
  return { ok: false, by: '', name: '' };
}
