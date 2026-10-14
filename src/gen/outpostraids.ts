// (0.186, PLAN_PLACOWEK.md stage O5) Bandit raids on the outposts. Every outpost worth robbing (it digs, or people live
// there) is raided now and then from the wilds: a raid every 3-6 game days by its own timetable from the world seed
// and the stake's time, none in the first period, none in the safe ring round Gridholm. With a player there the raid
// is fought (world/outpostraid.ts) and its outcome saved; anywhere else it is rolled from the seed against the
// outpost's defences: its wall tier, its turrets and the people who stand up for it, less the band's strength (the
// danger there). A lost raid carries off most of the crates on site, half the pantry and some of the people.
// The animals: without even a stake fence they trample a share of the fields and now and then raid the pantry
// (`PESTS` in gen/outpostlife.ts).
//
// Pure: raids are settled in order when their time is over (`settleRaids`, from gen/grid.ts settleAll), so every game
// reaches the same state. A live raid has its whole `duration` to record the fought outcome first.
import { hash } from '../core/rng';
import { dangerAt } from './danger';
import { settle, wallOf, turretsOf, type OutpostState } from './outposts';
import { settleLife } from './outpostlife';
import type { Lode } from './lodes';

export const OUTRAID = {
  /** Game minutes between raids (before the hashed spread); the warning before and how long one lasts. */
  period: [3 * 1440, 6 * 1440] as const, warn: 60, duration: 120,
  /** No raids where the danger is below this (the ring round Gridholm). */
  from: 1,
  /** Chance to hold without a player, by wall tier; each turret adds, people add up to `peopleMax`; strength takes. */
  hold: [0.3, 0.55, 0.75, 0.88], turret: 0.06, person: 0.008, peopleMax: 0.1, strength: 0.05,
  /** What a lost raid takes: the share of the crates, of the pantry, of the people. */
  stock: 0.6, food: 0.5, people: 0.2,
};
export interface OutRaid { k: number; t0: number; strength: number }

const periodOf = (world: number, id: string) => OUTRAID.period[0] + (hash(world, id.length, id.charCodeAt(id.length - 1), 0x0a5e) % (OUTRAID.period[1] - OUTRAID.period[0]));
/** The band's strength at the outpost (the danger there, 1..8); 0 = too near Gridholm for raids. */
export function strengthAt(world: number, o: OutpostState): number {
  const d = dangerAt(world, o.x, o.z);
  return d < OUTRAID.from ? 0 : Math.max(1, Math.min(8, d));
}
/** Raid k on outpost `id` (k ≥ 1; its time wobbles within its period, counted from the stake). */
export function outRaid(world: number, id: string, o: OutpostState, k: number): OutRaid | null {
  const s = strengthAt(world, o);
  if (!s || k < 1) return null;
  const P = periodOf(world, id), t0 = o.t + k * P + (hash(world, o.x | 0, o.z | 0, k, 0x0a5f) % Math.floor(P * 0.6));
  return { k, t0, strength: s };
}
/** The first raid after `t` (for the warning and the window), or null. */
export function nextRaid(world: number, id: string, o: OutpostState, t: number): OutRaid | null {
  if (!strengthAt(world, o)) return null;
  const P = periodOf(world, id);
  for (let k = Math.max(1, Math.floor((t - o.t) / P) - 1); k < 100000; k++) { const r = outRaid(world, id, o, k); if (!r) return null; if (r.t0 + OUTRAID.duration > t) return r; }
  return null;
}
/** Is there anything to rob (it digs, or people live there)? */
export const worthRobbing = (o: OutpostState) => o.k !== 'port' && (!!o.done?.dig || (o.life?.n ?? 0) >= 1); // (0.216) ports are not raided yet (stage Z7)
/** The chance the outpost holds raid r on its own. */
export function holdChance(o: OutpostState, strength: number): number {
  const wall = Math.min(OUTRAID.hold.length - 1, wallOf(o));
  const v = OUTRAID.hold[wall] + turretsOf(o) * OUTRAID.turret + Math.min(OUTRAID.peopleMax, Math.floor(o.life?.n ?? 0) * OUTRAID.person) - (strength - 2) * OUTRAID.strength;
  return Math.max(0.05, Math.min(0.97, v));
}
/** How raid r ended: as fought with a player there (saved), else rolled from the seed. */
export function raidResult(world: number, o: OutpostState, r: OutRaid): 'won' | 'lost' {
  const seen = o.raids?.[r.k];
  if (seen) return seen;
  return (hash(world, o.x | 0, o.z | 0, r.k, 0x0a60) % 1000) / 1000 < holdChance(o, r.strength) ? 'won' : 'lost';
}
/** What a lost raid does: most of the crates and half the pantry go, some people leave (at the raid's end). */
function plunder(o: OutpostState) {
  if (o.stock) for (const g in o.stock.n) { const k = g as keyof typeof o.stock.n; o.stock.n[k] = Math.floor((o.stock.n[k] ?? 0) * (1 - OUTRAID.stock)); }
  if (o.life) { o.life.food *= 1 - OUTRAID.food; o.life.n = Math.max(0, o.life.n * (1 - OUTRAID.people)); }
}
/** Settle every raid on outpost `id` whose time is over by `now`, in order (`pw` = its digging factor); the raids settled. */
export function settleRaids(world: number, id: string, o: OutpostState, l: Lode | null, now: number, pw = 1): { k: number; won: boolean }[] {
  const out: { k: number; won: boolean }[] = [];
  if (!strengthAt(world, o)) return out;
  for (let k = (o.rk ?? 0) + 1; ; k++) {
    const r = outRaid(world, id, o, k);
    if (!r || r.t0 + OUTRAID.duration > now) break;
    const end = r.t0 + OUTRAID.duration;
    if (l) settle(o, l, end, pw); settleLife(world, o, end);
    o.rk = k;
    if (!worthRobbing(o)) { if (o.raids) delete o.raids[k]; continue; } // nothing there to rob: the band passes by
    const won = raidResult(world, o, r) === 'won';
    if (!won) plunder(o);
    o.rlast = [k, won ? 'won' : 'lost']; if (o.raids) delete o.raids[k];
    out.push({ k, won });
  }
  return out;
}
