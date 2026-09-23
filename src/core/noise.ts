// Seeded 2D value noise (lattice hash + smoothstep), fBm on top. Pure and deterministic.

/** 32-bit integer hash of (seed, x, z) mapped to [0, 1). */
export function hash2(seed: number, x: number, z: number): number {
  let h = (seed | 0) ^ Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t: number) => t * t * (3 - 2 * t);

/** Value noise in [0, 1) with a lattice spacing of 1. */
export function valueNoise(seed: number, x: number, z: number): number {
  const x0 = Math.floor(x), z0 = Math.floor(z), fx = smooth(x - x0), fz = smooth(z - z0);
  const a = hash2(seed, x0, z0), b = hash2(seed, x0 + 1, z0), c = hash2(seed, x0, z0 + 1), d = hash2(seed, x0 + 1, z0 + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

/** Fractal sum of octaves, normalised back to [0, 1). */
export function fbm(seed: number, x: number, z: number, octaves: number): number {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let o = 0; o < octaves; o++) {
    sum += valueNoise(seed + o * 1013, x * f, z * f) * amp;
    norm += amp; amp *= 0.5; f *= 2;
  }
  return sum / norm;
}
