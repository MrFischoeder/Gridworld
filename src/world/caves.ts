// Cave mouths (gen/caves.ts) drawn into the mountainside: a ragged arch framed by boulders and a dark tunnel running
// into the rock. E at the mouth takes you into the cave system (world/cavelevel.ts).
import type { PropBatch } from './props';
import type { Cave } from '../gen/caves';
import type { Terrain } from '../gen/terrain';

const ROCK = 0x8fb89a, RIM = 0xc8ffd8;
/** Arch outline, (across, up) as shares of the mouth's width and height, from the left foot round to the right. */
const ARCH: [number, number][] = [[-0.5, 0], [-0.53, 0.45], [-0.4, 0.8], [-0.15, 0.98], [0.1, 1], [0.35, 0.82], [0.5, 0.5], [0.47, 0]];
/** A repeatable pseudo-random number for a cave (drawing only; the cave itself is generated in gen/caves.ts). */
const rnd = (c: Cave, i: number) => { const s = Math.sin(c.id * 0.0013 + i * 12.9898) * 43758.5453; return s - Math.floor(s); };

export function drawCave(pb: PropBatch, c: Cave, T: Terrain) {
  const fx = Math.cos(c.face), fz = Math.sin(c.face), rx = -fz, rz = fx, y0 = T.heightAt(c.x, c.z) - 0.1;
  /** A point: `s` across the mouth, `h` up, `d` into the mountain. */
  const P = (s: number, h: number, d: number) => [c.x + rx * s - fx * d, y0 + h, c.z + rz * s - fz * d];
  const ring = (d: number, k: number, drop: number) => ARCH.map(([a, b]) => P(a * c.w * k, b * c.h * k - drop, d));
  const front = ring(0, 1, 0), back = ring(7, 0.7, 1.2);
  // the tunnel: dark walls and roof running back into the rock, closed at the far end
  for (let i = 0; i + 1 < ARCH.length; i++) pb.face(front[i], front[i + 1], back[i + 1], back[i]);
  pb.face(front[ARCH.length - 1], front[0], back[0], back[ARCH.length - 1]);
  pb.face(...back);
  pb.line(RIM, ...front, front[0]);
  for (const d of [2.3, 4.6]) pb.line(ROCK, ...ring(d, 1 - d * 0.045, d * 0.17));
  // boulders framing the arch
  for (let i = 1; i < ARCH.length - 1; i++) {
    const [a, b] = ARCH[i], out = 0.55 + rnd(c, i) * 0.4, [x, y, z] = P(a * c.w * (1 + out * 0.5), b * c.h + out * (b > 0.7 ? 0.9 : 0.2), -0.3);
    const r = 0.9 + rnd(c, i + 20) * 0.7; pb.rock(x, y - 0.5, z, r, r * (0.8 + rnd(c, i + 40) * 0.4), 7, rnd(c, i + 60) * 6.28, ROCK);
  }
  for (const s of [-1, 1]) { const [x, y, z] = P(s * c.w * 0.72, 0, 0.2); pb.rock(x, y - 0.3, z, 1.3, 1.3 + rnd(c, s + 80) * 0.5, 8, rnd(c, s + 90) * 6.28, ROCK); }
}
/** Solid: the boulders at the feet of the arch. */
export function caveHit(c: Cave, x: number, y: number, z: number, r: number, ground: number): boolean {
  if (y > ground + c.h + 1) return false;
  const fx = Math.cos(c.face), fz = Math.sin(c.face), rx = -fz, rz = fx;
  for (const s of [-1, 1]) if (Math.hypot(x - (c.x + rx * s * c.w * 0.72), z - (c.z + rz * s * c.w * 0.72)) < 1.1 + r) return true;
  return false;
}
/** Standing at the mouth, in front of it. */
export const atMouth = (c: Cave, x: number, z: number) => Math.hypot(x - (c.x + Math.cos(c.face) * 0.6), z - (c.z + Math.sin(c.face) * 0.6)) < c.w * 0.5 + 2.2;
