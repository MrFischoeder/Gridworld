// Cave mouths (gen/caves.ts) drawn into the mountainside (or, 0.244, into a heap of great boulders on open ground): a
// ragged arch framed by boulders under a lintel stone, teeth hanging in it, rubble before it, a dark tunnel running
// into the rock. E at the mouth takes you into the cave system (world/cavelevel.ts).
import type { PropBatch } from './props';
import type { Cave } from '../gen/caves';
import type { Terrain } from '../gen/terrain';

const ROCK = 0x8fb89a, RIM = 0xc8ffd8;
/** Arch outline, (across, up) as shares of the mouth's width and height, from the left foot round to the right. */
const ARCH: [number, number][] = [[-0.5, 0], [-0.53, 0.45], [-0.4, 0.8], [-0.15, 0.98], [0.1, 1], [0.35, 0.82], [0.5, 0.5], [0.47, 0]];
/** A repeatable pseudo-random number for a cave (drawing only; the cave itself is generated in gen/caves.ts). */
const rnd = (c: Cave, i: number) => { const s = Math.sin(c.id * 0.0013 + i * 12.9898) * 43758.5453; return s - Math.floor(s); };

/** (0.244) The heap of boulders over a lowland cave: its middle this far behind the mouth, and its radius. */
const moundOf = (c: Cave) => { const r = c.w * 0.75 + 3.5; return { d: r - 0.5, r }; };
export function drawCave(pb: PropBatch, c: Cave, T: Terrain) {
  const fx = Math.cos(c.face), fz = Math.sin(c.face), rx = -fz, rz = fx, y0 = T.heightAt(c.x, c.z) - 0.1;
  /** A point: `s` across the mouth, `h` up, `d` into the mountain. */
  const P = (s: number, h: number, d: number) => [c.x + rx * s - fx * d, y0 + h, c.z + rz * s - fz * d];
  const ring = (d: number, k: number, drop: number) => ARCH.map(([a, b]) => P(a * c.w * k, b * c.h * k - drop, d));
  const front = ring(0, 1, 0), back = ring(10, 0.62, 1.8);
  const boulder = (s: number, h: number, d: number, r: number, tall: number, i: number) => { const [x, y, z] = P(s, h, d); pb.rock(x, y, z, r, tall, 7 + (i % 3), rnd(c, i + 60) * 6.28, ROCK); };
  // (0.244) a heap of great boulders over a lowland cave, the tunnel running down into it
  if (c.kind === 'outcrop') {
    const m = moundOf(c);
    for (let i = 0; i < 11; i++) {
      const a = (i / 11) * 6.283 + rnd(c, i + 300) * 0.3, ca = Math.cos(a), sa = Math.sin(a);
      if (ca > 0.6) continue; // the gap in front: the mouth
      const rr = m.r * (0.62 + rnd(c, i + 310) * 0.12), r = 2.8 + rnd(c, i + 320) * 1.6;
      boulder(sa * rr, -0.6, m.d - ca * rr, r, r * (1.1 + rnd(c, i + 330) * 0.6), i + 340);
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * 6.283 + 0.4, rr = m.r * 0.32, r = 2.6 + rnd(c, i + 350) * 1.2;
      boulder(Math.sin(a) * rr, c.h * 0.55 + rnd(c, i + 360), m.d - Math.cos(a) * rr, r, r * 1.2, i + 370);
    }
    boulder(0, c.h * 0.95, m.d + 0.5, 3.4, 3.2, 380);
  }
  // the tunnel: dark walls and roof running back into the rock, closed at the far end
  for (let i = 0; i + 1 < ARCH.length; i++) pb.face(front[i], front[i + 1], back[i + 1], back[i]);
  pb.face(front[ARCH.length - 1], front[0], back[0], back[ARCH.length - 1]);
  pb.face(...back);
  pb.line(RIM, ...front, front[0]);
  for (const d of [2.5, 5, 7.5]) pb.line(ROCK, ...ring(d, 1 - d * 0.038, d * 0.18));
  // boulders framing the arch, a lintel stone over it
  for (let i = 1; i < ARCH.length - 1; i++) {
    const [a, b] = ARCH[i], out = 0.55 + rnd(c, i) * 0.4;
    const r = 1.3 + rnd(c, i + 20) * 1.1; boulder(a * c.w * (1 + out * 0.45), b * c.h + out * (b > 0.7 ? 1.1 : 0.2) - 0.6, -0.2, r, r * (0.8 + rnd(c, i + 40) * 0.4), i);
  }
  boulder(0, c.h * 0.98, 0.3, 2.3, 1.6, 90);
  // great stones at its feet, a second pair standing out further, and rubble before it
  for (const s of [-1, 1]) {
    boulder(s * c.w * 0.72, -0.3, 0.2, 2.1, 2.6 + rnd(c, s + 80) * 1.2, s + 81);
    boulder(s * c.w * (1.15 + rnd(c, s + 100) * 0.2), -0.4, -1.5 - rnd(c, s + 110) * 2, 1.5 + rnd(c, s + 120) * 0.8, 1.8 + rnd(c, s + 130) * 1.5, s + 141);
  }
  for (let i = 0; i < 9; i++) {
    const side = i % 2 ? 1 : -1, s = side * (1.6 + rnd(c, i + 200) * c.w * 0.7), d = -1 - rnd(c, i + 210) * 8, r = 0.35 + rnd(c, i + 220) * 0.75;
    boulder(s, -0.15, d, r, r * 0.8, i + 230);
  }
  // teeth: stalactites hanging inside the arch
  for (let i = 0; i < 7; i++) {
    const s = (rnd(c, i + 250) - 0.5) * c.w * 0.6, d = 0.6 + rnd(c, i + 260) * 3, [x, y, z] = P(s, c.h * (0.92 - Math.abs(s) / c.w * 0.5) - d * 0.12, d);
    pb.cone(x, y, z, 0.18 + rnd(c, i + 270) * 0.2, -(0.6 + rnd(c, i + 280) * 1.4), ROCK, 6);
  }
}
/** Solid: the great stones at the feet of the arch, and a lowland cave's heap of boulders. */
export function caveHit(c: Cave, x: number, y: number, z: number, r: number, ground: number): boolean {
  if (y > ground + c.h + 5) return false;
  const fx = Math.cos(c.face), fz = Math.sin(c.face), rx = -fz, rz = fx;
  for (const s of [-1, 1]) if (Math.hypot(x - (c.x + rx * s * c.w * 0.72), z - (c.z + rz * s * c.w * 0.72)) < 1.8 + r) return true;
  if (c.kind === 'outcrop') { const m = moundOf(c); if (Math.hypot(x - (c.x - fx * m.d), z - (c.z - fz * m.d)) < m.r * 0.82 + r) return true; }
  return false;
}
/** Standing at the mouth, in front of it. */
export const atMouth = (c: Cave, x: number, z: number) => Math.hypot(x - (c.x + Math.cos(c.face) * 0.8), z - (c.z + Math.sin(c.face) * 0.8)) < c.w * 0.5 + 2.5;
