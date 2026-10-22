// (0.251, PLAN_MAGAZYNOW.md stage M3) A radio mast on a warehouse's roof (world/hall.ts for a village's, world/ports.ts
// for a port's or a wild one's): a three-legged lattice, a dish, a whip aerial and a red lamp at the top.
import type { PropBatch } from './props';

const STEEL = 0x9fd8b0, LAMP = 0xff5a3c;
/** The mast standing at (x, y, z) in the batch's frame; `on` lights the lamp. */
export function drawMast(pb: PropBatch, x: number, y: number, z: number, on = true) {
  const H = 8, r0 = 0.6, r1 = 0.14, legs = [0, 1, 2].map((i) => i / 3 * Math.PI * 2 + 0.3);
  const at = (a: number, h: number): [number, number, number] => { const r = r0 + (r1 - r0) * h / H; return [x + Math.cos(a) * r, y + h, z + Math.sin(a) * r]; };
  for (const a of legs) pb.seg(STEEL, at(a, 0), at(a, H));
  for (let h = 0; h < H; h += 1) for (let i = 0; i < 3; i++) { // rings and zig-zag braces
    pb.seg(STEEL, at(legs[i], h), at(legs[(i + 1) % 3], h));
    pb.seg(STEEL, at(legs[i], h), at(legs[(i + 1) % 3], h + 1));
  }
  pb.seg(STEEL, [x, y + H, z], [x, y + H + 2.2, z]); // the whip
  // the dish on an arm, facing out
  const dx = x + 0.9, dy = y + H * 0.7, n = 8, R = 0.7;
  pb.seg(STEEL, at(legs[0], H * 0.7), [dx, dy, z]);
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2, b = (i + 1) / n * Math.PI * 2; pb.seg(STEEL, [dx + 0.25, dy + Math.cos(a) * R, z + Math.sin(a) * R], [dx + 0.25, dy + Math.cos(b) * R, z + Math.sin(b) * R]); pb.seg(STEEL, [dx, dy, z], [dx + 0.25, dy + Math.cos(a) * R, z + Math.sin(a) * R]); }
  pb.box(x - 0.1, y + H - 0.1, z - 0.1, x + 0.1, y + H + 0.1, z + 0.1, on ? LAMP : STEEL);
}
