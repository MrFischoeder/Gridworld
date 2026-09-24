// The village markets. Every village makes a couple of goods (cheap there, plenty in stock) and wants a couple
// (dear there, little in stock); the rest trade at about their base price. What a village makes and wants follows
// its seed and its land: villages in the hills mine ore and salt, big lowland ones farm, a village on a diesel
// generator always wants fuel, and the further from Gridholm, the more raw goods and the more hunger for made ones.
// Prices also drift slowly over the days.
//
// Trading moves the market: buying empties a village's stock (its price rises), selling floods it (its price
// falls), and both fade back to normal with time (half-life `MARKET.half`). That shift is the only state there is
// (`MarketState`, keyed "villageId:good"), serialisable and pure to update: in single player it lives in the save;
// on the future server it is one shared state that every player trades against, which makes it a global economy.
import { hash, rng } from '../core/rng';
import { worldDist, type Poi } from './regions';
import { mountainMask } from './mountains';
import { powerKind } from './town';
import type { ItemKey } from '../data/items';
import { caravanShift } from './caravans';

export type Good = 'grain' | 'timber' | 'ore' | 'salt' | 'fish' | 'cloth' | 'tools' | 'meds' | 'fuel' | 'tech';
export const GOODS: Good[] = ['grain', 'timber', 'ore', 'salt', 'fish', 'cloth', 'tools', 'meds', 'fuel', 'tech'];
/** Base price (gold per crate), and whether the good is raw (made far out) or made (crafted near home). */
export const GOOD_INFO: Record<Good, { base: number; raw: boolean }> = {
  grain: { base: 20, raw: true }, timber: { base: 24, raw: true }, ore: { base: 36, raw: true }, salt: { base: 30, raw: true }, fish: { base: 26, raw: true },
  cloth: { base: 44, raw: false }, tools: { base: 68, raw: false }, meds: { base: 85, raw: false }, fuel: { base: 52, raw: false }, tech: { base: 110, raw: false },
};
export const isGood = (k: ItemKey): k is Good => k in GOOD_INFO;
/**
 * Market tuning: price factors for made / wanted goods, the normal stock of made / neutral / wanted goods (crates),
 * the buy/sell spread, how strongly a flooded or emptied stock moves the price, and the half-life (game minutes)
 * of the shift a trade leaves behind.
 */
export const MARKET = { make: 0.6, want: 1.6, stock: { make: 40, none: 14, want: 4 }, spread: 0.1, give: 0.9, half: 36 * 60, drift: 0.12 };

export interface MarketProfile { makes: Good[]; wants: Good[] }
export type MarketState = Record<string, { d: number; t: number }>;
const cache = new Map<string, MarketProfile>();
/** What village `v` makes and wants. */
export function profileOf(world: number, v: Poi, seed: number): MarketProfile {
  const key = world + ':' + v.id;
  let p = cache.get(key);
  if (p) return p;
  const R = rng(hash(seed, 0x3a4e7)), far = Math.min(1, worldDist(v.x, v.z, 0, 0) / 30000);
  // the land round the village: hills (a mountain within ~1.5 km)
  let hills = 0;
  for (let a = 0; a < 8; a++) hills = Math.max(hills, mountainMask(world, v.x + Math.cos(a * 0.785) * 1500, v.z + Math.sin(a * 0.785) * 1500));
  const weight = (g: Good, making: boolean) => {
    let w = 1;
    const info = GOOD_INFO[g];
    if (making) {
      w *= info.raw ? 0.6 + 1.6 * far : 1.6 - 1.2 * far;          // raw goods far out, made goods near home
      if ((g === 'ore' || g === 'salt') && hills > 0.1) w *= 4;    // mines in the hills
      if ((g === 'ore' || g === 'salt') && hills <= 0.1) w *= 0.3;
    } else {
      w *= info.raw ? 1.4 - 0.9 * far : 0.6 + 1.4 * far;          // near home they want raw goods, far out made ones
    }
    return w;
  };
  const pick = (from: Good[], making: boolean): Good => {
    let r = R() * from.reduce((a, g) => a + weight(g, making), 0);
    for (const g of from) if ((r -= weight(g, making)) <= 0) return g;
    return from[from.length - 1];
  };
  const makes: Good[] = [], wants: Good[] = [];
  if (powerKind(seed) === 'generator') wants.push('fuel'); // the generator drinks diesel
  while (makes.length < 2) makes.push(pick(GOODS.filter((g) => !makes.includes(g) && !wants.includes(g)), true));
  while (wants.length < 2) wants.push(pick(GOODS.filter((g) => !makes.includes(g) && !wants.includes(g)), false));
  p = { makes, wants };
  if (cache.size > 4000) cache.clear();
  cache.set(key, p);
  return p;
}
const role = (p: MarketProfile, g: Good) => (p.makes.includes(g) ? 'make' : p.wants.includes(g) ? 'want' : 'none') as 'make' | 'want' | 'none';
/** The shift a village's stock of a good carries now (positive: sold into it, negative: bought out of it). */
export function shiftNow(state: MarketState, vid: number, g: Good, now: number): number {
  const s = state[vid + ':' + g];
  return s ? s.d * Math.pow(0.5, Math.max(0, now - s.t) / MARKET.half) : 0;
}
export interface Quote { good: Good; role: 'make' | 'want' | 'none'; stock: number; buy: number; sell: number }
/** What a village's merchant asks (`buy`: you pay) and pays (`sell`: you get) for a good now, and how much is in stock. */
const carCache = new Map<string, Partial<Record<Good, number>>>();
/** The stock shift caravans (gen/caravans.ts) leave at village v, cached per game minute. */
function caravanShiftAt(world: number, vid: number, now: number) {
  const k = world + ':' + vid + ':' + Math.floor(now);
  let s = carCache.get(k);
  if (!s) { if (carCache.size > 500) carCache.clear(); s = caravanShift(world, vid, now, MARKET.half); carCache.set(k, s); }
  return s;
}
export function quote(v: Poi, seed: number, world: number, g: Good, state: MarketState, now: number, caravans = true): Quote {
  const p = profileOf(world, v, seed), r = role(p, g), info = GOOD_INFO[g];
  const factor = r === 'make' ? MARKET.make : r === 'want' ? MARKET.want : 1;
  const ph = (hash(seed, g.length * 131 + g.charCodeAt(0), 0xd71f) % 6283) / 1000, period = 3 + (hash(seed, g.charCodeAt(1), 0xd720) % 5);
  const drift = 1 + MARKET.drift * Math.sin(now / (period * 1440) * Math.PI * 2 + ph);
  const normal = MARKET.stock[r], shift = shiftNow(state, v.id, g, now) + (caravans ? caravanShiftAt(world, v.id, now)[g] ?? 0 : 0), stock = Math.max(0, Math.round(normal + shift));
  // a flooded stock cheapens, an emptied one dearens, gently (the shift measured against the normal stock)
  const glut = Math.min(2.5, Math.max(0.4, Math.exp(-MARKET.give * shift / (normal + 10))));
  const mid = info.base * factor * drift * glut;
  return { good: g, role: r, stock, buy: Math.max(1, Math.round(mid * (1 + MARKET.spread))), sell: Math.max(1, Math.round(mid * (1 - MARKET.spread))) };
}
/** Record a trade: `n` crates sold into the village (negative: bought from it). Pure on the state object. */
export function trade(state: MarketState, vid: number, g: Good, n: number, now: number) {
  const k = vid + ':' + g, d = shiftNow(state, vid, g, now) + n;
  if (Math.abs(d) < 0.05) delete state[k]; else state[k] = { d, t: now };
}
/** Forget shifts that have faded away (keeps the save small). */
export function tidyMarket(state: MarketState, now: number) {
  for (const k of Object.keys(state)) if (Math.abs(state[k].d) * Math.pow(0.5, (now - state[k].t) / MARKET.half) < 0.1) delete state[k];
}
