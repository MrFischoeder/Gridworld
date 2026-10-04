// Seeded randomness. World generation must only ever use these, never Math.random().

export { rng, hash } from '../../shared/random.mjs';

/** Integer range helper bound to a generator: ri(a, b) is uniform in [a, b]. */
export const rangeInt = (R: () => number) => (a: number, b: number): number => a + Math.floor(R() * (b - a + 1));

export type Dir = 'N' | 'S' | 'E' | 'W';
export const DIRV: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
