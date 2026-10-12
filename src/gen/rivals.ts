// (0.189, PLAN_PLACOWEK.md stage O8) The rivals mode: a server picked as rivals when it was made gives every player a
// seat of their own (the server keeps it per account, net.slot). Seat 0 starts at Gridholm; every other seat at a home
// village of its own, one of the world's towns as far from Gridholm and the other homes as the planet allows. A home
// becomes a settlement the moment its player first comes (like Gridholm: ruined houses, farms and works to build up
// from nothing). Whoever stakes a deposit first owns its outpost; the owner can let partners in. No guns between
// players: the rivalry is over the deposits and the time.
//
// Pure: the homes come from the world seed, so every game and the server agree without saving them.
import { allVillages, GRIDHOLM_ID, worldDist } from './regions';
import { initializeSettlements } from './settlement';
import { hash } from '../core/rng';
import type { TownState } from './town';
import type { OutpostState } from './outposts';

/** Seats a rivals world has (the server's players at most), and how far from Gridholm the other homes keep (m). */
export const RIVALS = { seats: 8, from: 8000 };
/** A seat in the shared roster (`Char.rivals[slot]`): the name its player goes by now and the home village's id. */
export interface RivalSeat { n: string; v: number }
/** The owner id of what a seat stakes (`OutpostState.o`); in co-op everything is the crew's. */
export const seatOwner = (slot: number) => (slot >= 0 ? 's' + slot : 'crew');
/** The seat an owner id names (-1 for the crew or a player id). */
export const seatOf = (owner: string) => (/^s\d+$/.test(owner) ? +owner.slice(1) : -1);

const homeCache = new Map<number, number[]>();
/** The home villages by seat: Gridholm first, then towns at least `RIVALS.from` out, each the farthest from Gridholm
 *  and the homes chosen before it (ties by hash). A world with fewer such towns falls back to any town. */
export function rivalHomes(world: number): number[] {
  let out = homeCache.get(world);
  if (out) return out;
  const towns = allVillages(world).filter((v) => v.id !== GRIDHOLM_ID), far = towns.filter((v) => Math.hypot(v.x, v.z) >= RIVALS.from);
  const pool = (far.length >= RIVALS.seats - 1 ? far : towns).slice(), picked: { x: number; z: number }[] = [{ x: 0, z: 0 }];
  out = [GRIDHOLM_ID];
  while (out.length < RIVALS.seats && pool.length) {
    let bi = 0, bd = -1;
    for (let i = 0; i < pool.length; i++) {
      const v = pool[i], d = Math.min(...picked.map((p) => worldDist(p.x, p.z, v.x, v.z)));
      if (d > bd || (d === bd && hash(world, v.id, 0x41e5) < hash(world, pool[bi].id, 0x41e5))) { bi = i; bd = d; }
    }
    const v = pool.splice(bi, 1)[0]; out.push(v.id); picked.push(v);
  }
  homeCache.set(world, out);
  return out;
}
/** Seat `slot`'s home village (Gridholm for seat 0 and anything out of range). */
export const homeOf = (world: number, slot: number) => rivalHomes(world)[slot] ?? GRIDHOLM_ID;
/** Is village `vid` a rival's home (not Gridholm)? */
export const isRivalHome = (world: number, vid: number) => vid !== GRIDHOLM_ID && rivalHomes(world).includes(vid);

/**
 * Make seat `slot`'s home a settlement, if it is not one yet: the town is cleared to a ruin that its player builds up
 * like Gridholm (its old state goes: walls, stores, its people). Returns true when it changed the town.
 */
export function makeHome(c: { settlementRules: number; world: number; towns: Record<string, TownState> }, slot: number): boolean {
  const vid = homeOf(c.world, slot);
  if (vid === GRIDHOLM_ID || c.towns[vid]?.settlement) return false;
  c.towns[vid] = { settlement: { v: 1 } };
  initializeSettlements({ ...c, settlementRules: 1 });
  return true;
}

// ---------- who may work an outpost ----------
/** Let seat `who` in (the owner's choice). */
export function addPartner(o: OutpostState, who: string): boolean {
  if (who === o.o || o.pp?.includes(who)) return false;
  (o.pp ??= []).push(who);
  return true;
}
export function dropPartner(o: OutpostState, who: string): boolean {
  const i = o.pp?.indexOf(who) ?? -1;
  if (i < 0) return false;
  o.pp!.splice(i, 1); if (!o.pp!.length) delete o.pp;
  return true;
}
