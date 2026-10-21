// (0.244, the owner's request) Who lives in a cave: mostly the planet's beasts, now and then a stray machine. Each lair
// (gen/cavegen.ts `lairs`: the bigger chambers and the pockets) may hold a group: gnawer nests and ravager packs in
// the chambers, a lone ridgeback guarding its hall, scorpids and crestjaws waiting in the side pockets. The plan comes
// from the cave's seed, so the beasts are numbered the same on every game and a killed one stays dead
// (world/dungeonfoes.ts records them as the place's guards). Pure.
import { rng } from '../core/rng';
import type { CaveMap } from './cavegen';
import type { CreatureKind } from '../data/creatures';

export interface CaveBeast { kind: CreatureKind; x: number; z: number; group: number }
interface Den { kind: CreatureKind; n: [number, number]; from: number; big: number; small: number }
/** What may lie in a lair: how many, from what danger, and how likely in a chamber (`big`) or a pocket (`small`). */
export const DENS: Den[] = [
  { kind: 'gnawer', n: [3, 6], from: 0, big: 4, small: 1.5 },
  { kind: 'ravager', n: [2, 3], from: 1, big: 3, small: 0 },
  { kind: 'ridgeback', n: [1, 1], from: 0.5, big: 1.5, small: 0.5 },
  { kind: 'scorpid', n: [1, 2], from: 0.5, big: 1, small: 2 },
  { kind: 'crestjaw', n: [1, 1], from: 0.5, big: 0.5, small: 2 },
  { kind: 'tusker', n: [2, 3], from: 0, big: 1, small: 0 },
];
/** How many lairs are lived in (a share of them, at least `min`), how far from the way in they keep, and the machines. */
export const CAVE_FAUNA = { share: 0.55, min: 3, max: 10, clear: 28, drones: 0.3, droneMax: 2 };

/** The cave's beasts at danger `lv`. */
export function caveBeasts(m: CaveMap, lv: number): CaveBeast[] {
  const R = rng(m.seed ^ 0xbea57), out: CaveBeast[] = [];
  const lairs = m.lairs.filter((l) => m.exits.every((e) => Math.hypot(l.x - e.x, l.z - e.z) > CAVE_FAUNA.clear));
  // the lairs in a hashed order; the first so many are lived in
  const order = lairs.map((l) => ({ l, k: R() })).sort((a, b) => a.k - b.k).map((o) => o.l);
  const n = Math.min(CAVE_FAUNA.max, order.length, Math.max(CAVE_FAUNA.min, Math.round(order.length * CAVE_FAUNA.share)));
  for (let g = 0; g < n; g++) {
    const l = order[g], ok = DENS.filter((d) => lv >= d.from && (l.big ? d.big : d.small) > 0);
    const sum = ok.reduce((s, d) => s + (l.big ? d.big : d.small), 0);
    let r = R() * sum, den = ok[ok.length - 1];
    for (const d of ok) if ((r -= l.big ? d.big : d.small) < 0) { den = d; break; }
    const k = den.n[0] + Math.floor(R() * (den.n[1] - den.n[0] + 1));
    for (let i = 0; i < k; i++) { const a = R() * 6.283, d = i ? 1.2 + R() * 2 : 0; out.push({ kind: den.kind, x: l.x + Math.cos(a) * d, z: l.z + Math.sin(a) * d, group: g }); }
  }
  return out;
}
/** The stray machines (drones) of a cave: none most of the time. */
export function caveDrones(seed: number): number {
  const R = rng(seed ^ 0xd60e);
  return R() < CAVE_FAUNA.drones ? 1 + Math.floor(R() * CAVE_FAUNA.droneMax) : 0;
}
