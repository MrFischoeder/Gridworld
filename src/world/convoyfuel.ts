// (0.178) Convoys burn fuel: a settlement's caravan sets out only if its home's stock had the canisters for it
// (gen/hall.ts `settleConvoys`). This asks, settling the home village first when the departure is not counted yet.
// Multiplayer: the count lives in the shared `towns` (TownState.convoy); whoever asks first settles it, the same way
// on every game, so everyone sees the same caravans stay home.
import { G } from '../game';
import { findPoi, villageSeed } from '../gen/regions';
import { progressive } from '../gen/settlement';
import { settleConvoys, stayedHome } from '../gen/hall';
import type { Caravan } from '../gen/caravans';

/** Did caravan c stay home for lack of fuel? (Departures still to come are not known yet: false.) */
export function dryCaravan(c: Caravan): boolean {
  const s = G.char.towns[c.from], now = G.char.time;
  if (!progressive(s) || c.t0 > now) return false;
  if ((s!.convoy?.t ?? -Infinity) < c.t0) {
    const v = findPoi(G.char.world, c.from);
    if (v) settleConvoys(G.char.world, v, villageSeed(G.char.world, v), s!, now);
  }
  return stayedHome(s, c.id);
}
