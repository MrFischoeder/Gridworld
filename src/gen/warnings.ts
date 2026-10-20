// (0.237, PLAN_SPAWNOW.md stage L4) Warnings before you see what is coming: calls heard from afar (a howl, a bellow,
// a machine's hum, bandits talking), prints left on the ground by whatever walked there, and the smoke of bandits
// lying in wait by a road. The numbers and the shapes; world/farcalls.ts, world/foetracks.ts and world/restsmoke.ts
// run them. Pure.
import type { SfxName } from '../audio/synth';

/** What a kind calls out when it is not fighting, how far it carries (m) and how often (s, [least, most]). */
export interface FarCall { s: SfxName; far: number; every: [number, number]; vol: number }
export const FAR_CALLS: Record<string, FarCall> = {
  ravager: { s: 'howl_ravager', far: 260, every: [22, 45], vol: 0.9 },
  bramble: { s: 'bellow_bramble', far: 160, every: [18, 34], vol: 0.9 },
  gnawer: { s: 'chitter_gnawer', far: 90, every: [10, 22], vol: 0.6 },
  leechwing: { s: 'screech_leechwing', far: 250, every: [16, 30], vol: 0.8 },
  skitter: { s: 'chirp_skitter', far: 80, every: [8, 16], vol: 0.6 },
  scout: { s: 'robot_chirp', far: 120, every: [12, 24], vol: 0.6 },
  guardian: { s: 'robot_chirp', far: 140, every: [14, 26], vol: 0.7 },
  repair: { s: 'robot_chirp', far: 110, every: [12, 22], vol: 0.5 },
  sentinel: { s: 'robot_hum', far: 170, every: [10, 20], vol: 0.9 },
  artillery: { s: 'robot_hum', far: 200, every: [10, 20], vol: 1 },
  assault: { s: 'robot_hum', far: 180, every: [10, 20], vol: 1 },
  bandit: { s: 'bandit_talk', far: 130, every: [14, 28], vol: 0.8 },
};
/** Bandits round a fire talk more and laugh now and then. */
export const REST_TALK = { every: [7, 14] as [number, number], laugh: 0.3 };
/** Nearer than this the near voices (world/sound.ts) do the job; a call is for what you cannot see yet. */
export const CALL_NEAR = 45;
/** How loud a call carrying `far` m is at `d` m: falls off more gently than near sounds, so it reaches the ring. */
export function farGain(d: number, far: number): number {
  if (d >= far) return 0;
  return Math.pow(1 - d / far, 0.8) / (1 + d / 60);
}
/** The low-pass cut (Hz) a call gets at `d` m: far ones sound muffled. */
export const muffle = (d: number) => Math.max(600, 18000 * Math.exp(-d / 70));

// ---------- prints on the ground ----------
export type PrintKind = 'paw' | 'small' | 'hoof' | 'boot' | 'claw';
export interface PrintSpec { k: PrintKind; step: number; size: number; c: number }
/** Who leaves what: a print every `step` m, `size` × the base shape, in colour `c`. Fliers and swimmers leave none. */
export const PRINTS: Record<string, PrintSpec> = {
  ravager: { k: 'paw', step: 1.5, size: 1.3, c: 0xffb347 },
  gnawer: { k: 'small', step: 0.8, size: 0.7, c: 0xffb347 },
  bramble: { k: 'hoof', step: 1.9, size: 1.8, c: 0xb8b060 },
  bandit: { k: 'boot', step: 0.8, size: 1, c: 0xffb347 },
  scout: { k: 'claw', step: 1.0, size: 0.9, c: 0xffb347 },
  guardian: { k: 'claw', step: 1.2, size: 1.1, c: 0xffb347 },
  sentinel: { k: 'claw', step: 1.6, size: 1.8, c: 0xffb347 },
  artillery: { k: 'claw', step: 1.7, size: 1.7, c: 0xffb347 },
  assault: { k: 'claw', step: 1.6, size: 1.9, c: 0xffb347 },
};
/** Prints fade over `life` s (game minutes, a real second each), at most `max` at once, laid within `reach` m of you,
 *  dimmed to `dim` of the kind's colour when fresh. */
export const TRACKS = { life: 120, max: 900, reach: 160, dim: 0.55, segs: 8 };
/** How bright a print `age` s old is (1 fresh .. 0 gone). */
export const printFade = (age: number) => (age <= 0 ? 1 : age >= TRACKS.life ? 0 : Math.pow(1 - age / TRACKS.life, 0.7));
type Seg = [number, number, number, number];
const BASE: Record<PrintKind, Seg[]> = {
  // x to the right, z forward (the way it went), metres for size 1
  paw: [[-0.05, -0.03, 0.05, -0.03], [-0.05, -0.03, 0, 0.04], [0.05, -0.03, 0, 0.04],
    [-0.07, 0.08, -0.07, 0.11], [-0.025, 0.1, -0.025, 0.14], [0.025, 0.1, 0.025, 0.14], [0.07, 0.08, 0.07, 0.11]],
  small: [[-0.03, 0, 0.03, 0], [-0.04, 0.05, -0.05, 0.09], [0, 0.06, 0, 0.1], [0.04, 0.05, 0.05, 0.09]],
  hoof: [[-0.02, -0.06, -0.08, 0], [-0.08, 0, -0.06, 0.08], [0.02, -0.06, 0.08, 0], [0.08, 0, 0.06, 0.08]],
  boot: [[-0.05, -0.13, 0.05, -0.13], [0.05, -0.13, 0.055, 0.08], [0.055, 0.08, 0.03, 0.14], [0.03, 0.14, -0.03, 0.14],
    [-0.03, 0.14, -0.055, 0.08], [-0.055, 0.08, -0.05, -0.13], [-0.05, -0.05, 0.05, -0.05]],
  claw: [[0, 0, 0, 0.22], [0, 0, -0.13, 0.17], [0, 0, 0.13, 0.17], [0, 0, 0, -0.1]],
};
/** A print's segments in the ground's plane (x, z world offsets from its spot), facing `heading` (sin, cos like the
 *  foes'), set `side` (−1 left foot, 1 right) half a stride to the side. */
export function printSegs(k: PrintKind, size: number, heading: number, side: number): Seg[] {
  const s = Math.sin(heading), c = Math.cos(heading), off = side * (k === 'claw' ? 0.2 : 0.11) * size;
  // local (x right, z forward) → world: forward = (s, c), right = forward × up = (−c, s)
  const w = (x: number, z: number): [number, number] => [-(x + off) * c + z * s, (x + off) * s + z * c];
  return BASE[k].map(([x0, z0, x1, z1]) => [...w(x0 * size, z0 * size), ...w(x1 * size, z1 * size)] as Seg);
}

// ---------- smoke of bandits lying in wait ----------
/** One fire for the resting bandits within `join` m of it; it smokes on `linger` s after they are gone; a puff rises
 *  `rise` m/s for `life` s; `puffs` at once; seen from `far` m (the column is drawn nearer, at the same angle). */
export const SMOKE = { join: 25, linger: 60, rise: 2, life: 22, puffs: 16, far: 1200, glow: 1500 };
