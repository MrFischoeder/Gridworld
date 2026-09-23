// Seeded randomness. World generation must only ever use these, never Math.random().

/** mulberry32: returns a generator of floats in [0, 1). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Order-dependent hash of integers into [0, 1e6). Used to derive sector / region seeds. */
export function hash(...v: number[]): number {
  let h = 2166136261 >>> 0;
  for (const n of v) {
    h ^= (n | 0) + 0x9e3779b9 + (h << 6) + (h >>> 2);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h % 1000000;
}

/** Integer range helper bound to a generator: ri(a, b) is uniform in [a, b]. */
export const rangeInt = (R: () => number) => (a: number, b: number): number => a + Math.floor(R() * (b - a + 1));

export type Dir = 'N' | 'S' | 'E' | 'W';
export const DIRV: Record<Dir, [number, number]> = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
export const OPP: Record<Dir, Dir> = { N: 'S', S: 'N', E: 'W', W: 'E' };
