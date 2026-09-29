// Delivery contracts between villages, offered at every general store. Two kinds:
// - supply: the village orders crates of a good it wants, to be brought here by a deadline; it pays well above its
//   market price (you find the goods where you like: another market, a caravan, ...).
// - haul: the village sends crates of what it makes to another village (2-9 km off, preferably one that wants them);
//   you take the crates here against a deposit (their price here), and get the deposit back with your pay when you
//   hand them over at the other end. Pay grows with the distance and the danger on the way.
// - fuel order: a village far out that still runs an old reactor of its own (`oldReactor`) orders Nuclear Fuel Rods
//   (made only by the restored Old Enrichment Plant, gen/installs.ts) now and then, and pays very well for them.
// - chip order: a craft village (industry 'workshop') away from Gridholm orders Microchips (made only by the restored
//   Old Chip Foundry) for its radios and tools, the same way.
// Offers are posted every `CONTRACT.period` game minutes, two per village, from the seed: pure, so on the future
// server every player sees the same notices (a taken offer is marked in the save).
import { hash, rng } from '../core/rng';
import { allVillages, worldDist, villageSeed, GRIDHOLM_ID, type Poi } from './regions';
import { dangerAt, ringDanger } from './danger';
import { profileOf, quote, GOOD_INFO, type Good } from './market';
import { industryOf } from './industry';

/** What a contract carries: a market good, or fuel rods (gen/installs.ts: not on any market). */
export type Cargo = Good | 'nfuel' | 'microchip' | 'powercell';
/** Cargo that never goes to a market (a delivery moves no prices). */
export const offMarket = (g: Cargo): g is 'nfuel' | 'microchip' | 'powercell' => g === 'nfuel' || g === 'microchip' || g === 'powercell';
export const CONTRACT = { period: 720, perVillage: 2, maxActive: 3, near: 2000, far: 9000, premium: 1.35 };
export interface Contract {
  id: string; kind: 'supply' | 'haul';
  /** Where it was offered, and where the crates are to go (for supply: the same village). */
  from: number; fromName: string; to: number; toName: string; tx: number; tz: number;
  good: Cargo; n: number;
  /** Crates handed over so far, pay per crate, the deposit (haul: paid when taken, returned in full at the end) and the deadline (game time). */
  done: number; pay: number; deposit: number; due: number;
}
export const postingOf = (now: number) => Math.floor(now / CONTRACT.period);
/** The offers posted at village v in the posting that is on at time `now` (priced from its normal market at the posting's start). */
export function offersAt(world: number, v: Poi, seed: number, now: number): Contract[] {
  // everything is fixed at the posting's start, so a notice reads the same all through the posting
  const post = postingOf(now), t0 = post * CONTRACT.period, R = rng(hash(seed, post, 0xc0de)), p = profileOf(world, v, seed), out: Contract[] = [];
  for (let i = 0; i < CONTRACT.perVillage; i++) {
    const id = `${v.id}:${post}:${i}`, days = 1 + R() * 2;
    if (R() < 0.5 && p.wants.length) {
      const g = p.wants[Math.floor(R() * p.wants.length)], n = 4 + Math.floor(R() * 9);
      const per = Math.round(quote(v, seed, world, g, {}, t0, false).sell * CONTRACT.premium);
      out.push({ id, kind: 'supply', from: v.id, fromName: v.name, to: v.id, toName: v.name, tx: v.x, tz: v.z, good: g, n, done: 0, pay: per, deposit: 0, due: t0 + Math.round(days * 1440) });
      continue;
    }
    if (!p.makes.length) continue;
    const g = p.makes[Math.floor(R() * p.makes.length)];
    const near = allVillages(world).filter((o) => o.id !== v.id).map((o) => ({ o, d: worldDist(o.x, o.z, v.x, v.z) })).filter(({ d }) => d > CONTRACT.near && d < CONTRACT.far);
    if (!near.length) continue;
    const wanting = near.filter(({ o }) => profileOf(world, o, villageSeed(world, o)).wants.includes(g));
    const pickFrom = wanting.length && R() < 0.75 ? wanting : near, { o, d } = pickFrom[Math.floor(R() * pickFrom.length)];
    const n = 5 + Math.floor(R() * 11), km = d / 1000, per = haulPay(world, v, o, g, km);
    const deposit = n * quote(v, seed, world, g, {}, t0, false).buy;
    out.push({ id, kind: 'haul', from: v.id, fromName: v.name, to: o.id, toName: o.name, tx: o.x, tz: o.z, good: g, n, done: 0, pay: per, deposit, due: t0 + Math.round((1 + km / 2.5 + R()) * 1440) });
  }
  return out;
}
/** Pay per crate for a haul from v to o (km apart): distance, the good's worth and the danger on the way. */
function haulPay(world: number, v: Poi, o: Poi, g: Good, km: number) {
  const danger = Math.max(dangerAt(world, v.x, v.z), dangerAt(world, o.x, o.z), dangerAt(world, (v.x + o.x) / 2, (v.z + o.z) / 2));
  return Math.round((6 + km * 5 + GOOD_INFO[g].base * 0.15) * (1 + danger * 0.2));
}
/** What delivering `k` more crates of contract c pays (a finished haul also returns the deposit). */
export function payFor(c: Contract, k: number): number {
  const finishing = c.done + k >= c.n;
  return k * c.pay + (c.kind === 'haul' && finishing ? c.deposit : 0);
}

// ---------- fuel orders: villages with an old reactor ----------
/** Old reactors: none within `from` m of Gridholm, a `chance` of the villages further out; an order most days (`skip`), 1-3 crates, paid by the danger of its ring (the village itself is a refuge). */
export const FUEL = { from: 8000, chance: 0.12, period: 1440, skip: 0.35, pay: 520, perDanger: 70, board: 20000 };
/** Does village v still run an old reactor of its own (so it orders fuel rods)? Fixed per world. */
export function oldReactor(world: number, v: Poi): boolean {
  if (v.id === GRIDHOLM_ID || worldDist(v.x, v.z, 0, 0) < FUEL.from) return false;
  return hash(world, v.id, 0xf0e1) % 1000 < FUEL.chance * 1000;
}
/** Every village of a world with an old reactor. */
export const reactorVillages = (world: number) => allVillages(world).filter((v) => oldReactor(world, v));
/** The fuel order village v posts for the game day that is on at `now` (null: no reactor, or no order today). */
export function fuelOrder(world: number, v: Poi, now: number): Contract | null {
  if (!oldReactor(world, v)) return null;
  const post = Math.floor(now / FUEL.period), R = rng(hash(world, v.id, post, 0xf0e2));
  if (R() < FUEL.skip) return null;
  const n = 1 + Math.floor(R() * 3), pay = Math.round((FUEL.pay + FUEL.perDanger * ringDanger(worldDist(v.x, v.z, 0, 0))) / 10) * 10;
  return { id: `fuel:${v.id}:${post}`, kind: 'supply', from: v.id, fromName: v.name, to: v.id, toName: v.name, tx: v.x, tz: v.z, good: 'nfuel', n, done: 0, pay, deposit: 0, due: post * FUEL.period + Math.round((3 + R() * 3) * 1440) };
}

// ---------- chip orders: craft villages building radios and tools ----------
/** Craft villages from `from` m out order chips; an order on most days (`skip`), 1-4 crates, paid by the danger of their ring. */
export const CHIPS = { from: 3000, period: 1440, skip: 0.45, pay: 680, perDanger: 45, board: 20000 };
/** Does village v order microchips (a craft village away from Gridholm)? Fixed per world. */
export function chipBuyer(world: number, v: Poi): boolean {
  if (v.id === GRIDHOLM_ID || worldDist(v.x, v.z, 0, 0) < CHIPS.from) return false;
  return industryOf(world, v, villageSeed(world, v)) === 'workshop';
}
export const chipVillages = (world: number) => allVillages(world).filter((v) => chipBuyer(world, v));
/** The chip order village v posts for the game day that is on at `now` (null: not a buyer, or no order today). */
export function chipOrder(world: number, v: Poi, now: number): Contract | null {
  if (!chipBuyer(world, v)) return null;
  const post = Math.floor(now / CHIPS.period), R = rng(hash(world, v.id, post, 0xc419));
  if (R() < CHIPS.skip) return null;
  const n = 1 + Math.floor(R() * 4), pay = Math.round((CHIPS.pay + CHIPS.perDanger * ringDanger(worldDist(v.x, v.z, 0, 0))) / 10) * 10;
  return { id: `chip:${v.id}:${post}`, kind: 'supply', from: v.id, fromName: v.name, to: v.id, toName: v.name, tx: v.x, tz: v.z, good: 'microchip', n, done: 0, pay, deposit: 0, due: post * CHIPS.period + Math.round((3 + R() * 3) * 1440) };
}
// ---------- cell orders: salvage villages keeping the old machines going ----------
/** Salvage villages from `from` m out order power cells; an order on some days (`skip`), 1-3 crates, paid by the danger of their ring. */
export const CELLS = { from: 5000, period: 1440, skip: 0.5, pay: 900, perDanger: 60 };
/** Does village v order power cells (a salvage village away from Gridholm)? Fixed per world. */
export function cellBuyer(world: number, v: Poi): boolean {
  if (v.id === GRIDHOLM_ID || worldDist(v.x, v.z, 0, 0) < CELLS.from) return false;
  return industryOf(world, v, villageSeed(world, v)) === 'salvage';
}
export const cellVillages = (world: number) => allVillages(world).filter((v) => cellBuyer(world, v));
/** The cell order village v posts for the game day that is on at `now` (null: not a buyer, or no order today). */
export function cellOrder(world: number, v: Poi, now: number): Contract | null {
  if (!cellBuyer(world, v)) return null;
  const post = Math.floor(now / CELLS.period), R = rng(hash(world, v.id, post, 0xce11));
  if (R() < CELLS.skip) return null;
  const n = 1 + Math.floor(R() * 3), pay = Math.round((CELLS.pay + CELLS.perDanger * ringDanger(worldDist(v.x, v.z, 0, 0))) / 10) * 10;
  return { id: `cell:${v.id}:${post}`, kind: 'supply', from: v.id, fromName: v.name, to: v.id, toName: v.name, tx: v.x, tz: v.z, good: 'powercell', n, done: 0, pay, deposit: 0, due: post * CELLS.period + Math.round((3 + R() * 3) * 1440) };
}
/** The fuel, chip and cell orders village v posts today. */
export const specialOrders = (world: number, v: Poi, now: number): Contract[] => [fuelOrder(world, v, now), chipOrder(world, v, now), cellOrder(world, v, now)].filter((o): o is Contract => !!o);
