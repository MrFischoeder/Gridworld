// Standing in a village (pure): what you have done for it earns its trust, and trust opens its storehouse. No prices:
// a village shares what its land makes with those who helped it grow (the development plan's simple economy). The
// share is a number of crates a game day by the trust tier, taken out of the storehouse, so it is still bounded by
// what the village actually makes.
import type { TownState } from './town';

/** Trust points for each kind of help. */
export const TRUST = {
  wall: 20,      // a wall tier raised
  work: 10,      // a defence work (turret, barricades)
  store: 12,     // a bigger storehouse
  works: 12,     // a processing works or a power station built
  refinery: 15,  // the refinery built
  farm: 8,       // a farm cleared and sown
  plantup: 10,   // the power plant upgraded
  power: 6,      // the power plant mended
  site: 5,       // the industry site mended
  raid: 15,      // a raid beaten off
  contract: 4,   // a delivery contract fulfilled here
  quest: 5,      // a notice of its board done
};
export type TrustWhy = keyof typeof TRUST;
/** The tiers: name, the trust they need, crates of the village's own goods a game day. */
export const TRUST_TIERS = [
  { name: 'Stranger', min: 0, crates: 0 },
  { name: 'Known', min: 25, crates: 2 },
  { name: 'Friend', min: 60, crates: 4 },
  { name: 'Honoured', min: 100, crates: 8 },
];
const DAY = 1440;

export const trustOf = (s: TownState | undefined) => s?.trust ?? 0;
export const trustTier = (s: TownState | undefined) => { const t = trustOf(s); let k = 0; TRUST_TIERS.forEach((x, i) => { if (t >= x.min) k = i; }); return k; };
/** Adds trust for a kind of help; returns the new tier if it went up, else -1. */
export function addTrust(s: TownState, why: TrustWhy): number {
  const before = trustTier(s);
  s.trust = trustOf(s) + TRUST[why];
  const after = trustTier(s);
  return after > before ? after : -1;
}
/** Crates still to take today (the share renews at midnight, game time). */
export function shareLeft(s: TownState | undefined, now: number): number {
  const day = Math.floor(now / DAY), used = s?.share && s.share.d === day ? s.share.n : 0;
  return Math.max(0, TRUST_TIERS[trustTier(s)].crates - used);
}
/** Records n crates taken today. */
export function useShare(s: TownState, n: number, now: number) {
  const day = Math.floor(now / DAY);
  s.share = { d: day, n: (s.share && s.share.d === day ? s.share.n : 0) + n };
}
