// Houses for the heroes (pure). Every village has at least `HOMES_MIN` houses (gen/village.ts: the buildings of role
// 'house', numbered by `Building.hero` in the order they were laid out) that the elder sells to the castaways, one
// house a hero in each village. Who owns which is the world's (`TownState.homes`, shared on a server); which house a
// hero has where is theirs (`Char.houses` village ids, `Char.homeOf` village id → house index; Gridholm's first house
// for older saves). A house's chest is the hero's own container ('home:chest' for Gridholm's first house, as before,
// 'home:<village id>:<index>' for the others), never shared.
import { GRIDHOLM_ID } from './regions';

/** Houses for sale in every village (the generator lays out at least this many). */
export const HOMES_MIN = 6;
/** Who owns a house: their character's `pid` and name (for the sign over the door). */
export interface HomeOwner { p: string; n: string }
export interface HomeHolder { houses: number[]; homeOf?: Record<string, number>; pid: string }
/** The house index a hero has in a village, or -1. */
export const myHome = (c: HomeHolder, vid: number) => (c.houses.includes(vid) ? c.homeOf?.[vid] ?? 0 : -1);
/** The hero's chest in a house. */
export const chestKey = (vid: number, i: number) => (vid === GRIDHOLM_ID && i === 0 ? 'home:chest' : `home:${vid}:${i}`);
/** The owner of house `i` of a village (shared state), if any. */
export const ownerOf = (homes: Record<string, HomeOwner> | undefined, i: number) => homes?.[i];
/** Why the hero cannot buy house `i` here ('' = they can). */
export function buyProblem(c: HomeHolder & { gold: number }, vid: number, homes: Record<string, HomeOwner> | undefined, i: number, price: number): string {
  if (myHome(c, vid) >= 0) return 'You already have a house here.';
  const o = homes?.[i];
  if (o) return o.p === c.pid ? '' : `That house is ${o.n}'s.`;
  if (c.gold < price) return 'That is not enough gold, I am afraid.';
  return '';
}
