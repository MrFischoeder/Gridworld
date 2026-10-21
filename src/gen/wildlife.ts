// (0.240) The planet's wildlife: animals that live in the land rather than hunt the player. Each kind has a temper
// that says what sets it off (the owner's request: not all of them aggressive; some when you come close, some when
// you come at them the wrong way, some only when attacked), the lands it lives in and how many go together.
// Pure: the runtime (world/creatures.ts) asks it how a beast takes you each frame.
import type { BiomeHere } from './biomes';

/**
 * timid     — never attacks: it flees when you come near (less near when you keep low and slow).
 * wary      — warns you off (stands, growls) when you come close; keep coming and it charges.
 * touchy    — lets you pass if you come quietly (crouched, slow, not straight at its face); upright, running or head-on
 *             and its temper rises until it strikes.
 * ambush    — lies still and strikes at whatever comes within a few metres, without a warning.
 * defensive — minds its own business; hurt one, and it (and its herd) turns on you.
 * Every temper but timid turns on whoever hurts it; a timid one runs.
 */
export type Temper = 'timid' | 'wary' | 'touchy' | 'ambush' | 'defensive';
export type WildKind = 'ridgeback' | 'hexastrider' | 'serpent' | 'crestjaw' | 'titan' | 'hopling' | 'tusker' | 'scorpid';

export interface WildSpec {
  temper: Temper;
  /** The fauna model (src/models/fauna) it is drawn with. */
  model: string;
  /** Where it lives, how often it turns up there (relative weight), from what danger, and in what numbers. */
  biomes: BiomeHere[]; weight: number; from: number; herd: [number, number];
  /** It notices you within `notice` m (× how much you stand out); the temper's own distances. */
  notice: number;
  /** wary: the warning ring; touchy / ambush: it strikes from here. */
  warn: number; strike: number;
  /** timid: it bolts when you come this close (standing). */
  flee: number;
  /** How long it keeps after you once roused (s), and how far from its ground it will go (m). */
  chase: number; ground: number;
  /** Lives by fresh water (it is placed at a shore). */
  shore?: boolean;
  /** At most this many of it within 600 m (the giants). */
  only?: number;
}

export const WILD: Record<WildKind, WildSpec> = {
  ridgeback: { temper: 'wary', model: 'grzbietowiec', biomes: ['forest', 'taiga', 'mountain', 'tundra'], weight: 3, from: 0.5, herd: [1, 1],
    notice: 34, warn: 22, strike: 10, flee: 0, chase: 14, ground: 55 },
  hexastrider: { temper: 'timid', model: 'szescionog', biomes: ['plains', 'savanna', 'tundra', 'coast'], weight: 6, from: 0, herd: [3, 7],
    notice: 60, warn: 0, strike: 0, flee: 34, chase: 0, ground: 0 },
  serpent: { temper: 'touchy', model: 'waz-pregowy', biomes: ['swamp', 'jungle'], weight: 2, from: 1, herd: [1, 1],
    notice: 30, warn: 0, strike: 9, flee: 0, chase: 10, ground: 40, only: 1 },
  crestjaw: { temper: 'ambush', model: 'szczekorog', biomes: ['swamp', 'jungle', 'coast', 'plains', 'savanna', 'forest'], weight: 3, from: 0.5, herd: [1, 2],
    notice: 16, warn: 0, strike: 8, flee: 0, chase: 6, ground: 25, shore: true },
  titan: { temper: 'defensive', model: 'koronotytan', biomes: ['plains', 'savanna', 'forest', 'jungle'], weight: 0.6, from: 1.5, herd: [1, 2],
    notice: 80, warn: 0, strike: 11, flee: 0, chase: 25, ground: 90, only: 1 },
  hopling: { temper: 'timid', model: 'skoczek', biomes: ['plains', 'forest', 'taiga', 'tundra', 'savanna', 'coast', 'mountain'], weight: 7, from: 0, herd: [2, 5],
    notice: 30, warn: 0, strike: 0, flee: 16, chase: 0, ground: 0 },
  tusker: { temper: 'defensive', model: 'klowiec', biomes: ['forest', 'jungle', 'plains', 'taiga', 'swamp'], weight: 4, from: 0, herd: [2, 4],
    notice: 30, warn: 0, strike: 2.2, flee: 0, chase: 12, ground: 45 },
  scorpid: { temper: 'touchy', model: 'skorpid', biomes: ['desert', 'savanna', 'crystal', 'mountain'], weight: 4, from: 0.5, herd: [1, 2],
    notice: 18, warn: 0, strike: 4, flee: 0, chase: 8, ground: 30 },
};
export const WILD_KINDS = Object.keys(WILD) as WildKind[];
export const isWild = (k: string): k is WildKind => k in WILD;

/** How many wildlife groups may be about the player at once (within `reach` m), and how often one is tried (s). */
export const WILDLIFE = { groups: 5, reach: 350, every: 3.5, giantReach: 600 };

/** Pick a kind for a spot: weighted by where it lives and from what danger; `roll` in [0, 1). Null: nothing lives here. */
export function wildPick(biome: BiomeHere, lv: number, roll: number, shore: boolean, crowd: Partial<Record<WildKind, number>> = {}): WildKind | null {
  const ok = WILD_KINDS.filter((k) => {
    const w = WILD[k];
    return w.biomes.includes(biome) && lv >= w.from && (!w.shore || shore) && (w.only === undefined || (crowd[k] ?? 0) < w.only);
  });
  const sum = ok.reduce((s, k) => s + WILD[k].weight, 0);
  let r = roll * sum;
  for (const k of ok) if ((r -= WILD[k].weight) < 0) return k;
  return null;
}

/** How you come at it: distance (m), how much you stand out (1 standing in daylight; crouched ~0.5), your speed
 *  (m/s), whether you come at its face (cos of the angle between its facing and you, 1 = straight ahead). */
export interface Approach { d: number; vis: number; speed: number; front: number }

/** timid: whether it bolts. Keeping low and slow lets you come about half as near. */
export function scared(w: WildSpec, a: Approach): boolean {
  const k = Math.max(0.45, Math.min(1.3, a.vis)) * (a.speed > 5 ? 1.35 : 1);
  return a.d < w.flee * k;
}

/**
 * How fast its temper rises (per s; negative: it calms). At 1 it attacks. wary: inside its warning ring it rises the
 * faster the nearer you are, and it charges at once inside `strike`; touchy: only what you do counts (standing,
 * running, coming at its face, coming very close); ambush: it strikes at once inside `strike` (less near when you
 * keep low). defensive and timid never anger on their own.
 */
export function provoke(w: WildSpec, a: Approach): number {
  const calm = -0.35;
  const seen = Math.max(0.4, Math.min(1.3, a.vis));
  switch (w.temper) {
    case 'wary': {
      if (a.d < w.strike * seen) return 10;
      if (a.d > w.warn * seen) return calm;
      return 0.15 + 0.9 * (1 - a.d / (w.warn * seen));
    }
    case 'touchy': {
      if (a.d > w.notice * seen) return calm;
      const upright = a.vis > 0.7 ? 0.35 : 0, hurry = a.speed > 3 ? 0.25 * a.speed / 3 : 0;
      const face = a.front > 0.6 && a.d < w.strike * 2.5 ? 0.45 : 0, close = a.d < w.strike ? 1.4 : 0;
      const r = upright + hurry + face + close;
      return r > 0 ? r : calm;
    }
    case 'ambush': return a.d < w.strike * (a.vis < 0.7 ? 0.65 : 1) ? 10 : calm;
    default: return calm;
  }
}
/** Its temper after `dt` s of `rate`, kept in [0, 1.2]. */
export const temperAfter = (anger: number, rate: number, dt: number) => Math.max(0, Math.min(1.2, anger + rate * dt));
