// (0.209) Villages laid out in the map editor (gen/village.ts VillageLayout, stage E3 of PLAN_EDYTORA.md): what their
// file says beyond the buildings, put into the village's shared state once. A town of a drawn world takes the drawn
// wall and stands with the drawn fields already worked (up to FARM.max, growing the drawn crops). Gridholm, a
// settlement, keeps its own rules: its people build the wall and the farms themselves. Pure.
import { allVillages, villageSeed } from './regions';
import { villageLayout, layoutFields, WALL_TIERS } from './village';
import { FARM, CROPS, type Crop } from './farms';
import type { TownState } from './town';

export function applyLayouts(c: { world: number; towns: Record<string, TownState> }): void {
  for (const v of allVillages(c.world)) {
    const seed = villageSeed(c.world, v), lay = villageLayout(seed);
    if (!lay) continue;
    const t = (c.towns[v.id] ??= {});
    if (t.settlement || t.lay) continue;
    t.lay = 1;
    t.wall = Math.max(0, Math.min(WALL_TIERS.length - 1, Math.round(lay.wall)));
    const crops = layoutFields(seed).map((f) => f.crop).filter((k): k is Crop => k in CROPS).slice(0, FARM.max);
    if (crops.length) { t.farms = Math.max(t.farms ?? 0, crops.length); t.crops = crops; }
  }
}
