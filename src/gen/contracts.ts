// Delivery contracts between villages, offered at every general store. Two kinds:
// - supply: the village orders crates of a good it wants, to be brought here by a deadline; it pays well above its
//   market price (you find the goods where you like: another market, a caravan, ...).
// - haul: the village sends crates of what it makes to another village (2-9 km off, preferably one that wants them);
//   you take the crates here against a deposit (their price here), and get the deposit back with your pay when you
//   hand them over at the other end. Pay grows with the distance and the danger on the way.
// Offers are posted every `CONTRACT.period` game minutes, two per village, from the seed: pure, so on the future
// server every player sees the same notices (a taken offer is marked in the save).
import { hash, rng } from '../core/rng';
import { allVillages, worldDist, villageSeed, type Poi } from './regions';
import { dangerAt } from './danger';
import { profileOf, quote, GOOD_INFO, type Good } from './market';

export const CONTRACT = { period: 720, perVillage: 2, maxActive: 3, near: 2000, far: 9000, premium: 1.35 };
export interface Contract {
  id: string; kind: 'supply' | 'haul';
  /** Where it was offered, and where the crates are to go (for supply: the same village). */
  from: number; fromName: string; to: number; toName: string; tx: number; tz: number;
  good: Good; n: number;
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
    const n = 5 + Math.floor(R() * 11), km = d / 1000, danger = Math.max(dangerAt(world, v.x, v.z), dangerAt(world, o.x, o.z), dangerAt(world, (v.x + o.x) / 2, (v.z + o.z) / 2));
    const per = Math.round((6 + km * 5 + GOOD_INFO[g].base * 0.15) * (1 + danger * 0.2));
    const deposit = n * quote(v, seed, world, g, {}, t0, false).buy;
    out.push({ id, kind: 'haul', from: v.id, fromName: v.name, to: o.id, toName: o.name, tx: o.x, tz: o.z, good: g, n, done: 0, pay: per, deposit, due: t0 + Math.round((1 + km / 2.5 + R()) * 1440) });
  }
  return out;
}
/** What delivering `k` more crates of contract c pays (a finished haul also returns the deposit). */
export function payFor(c: Contract, k: number): number {
  const finishing = c.done + k >= c.n;
  return k * c.pay + (c.kind === 'haul' && finishing ? c.deposit : 0);
}
