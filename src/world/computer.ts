// Shared elder-house computer: CRT monitor, keyboard and separate case on a timber desk.
import type { PropBatch } from './props';
export function drawComputer(pb: PropBatch, f: { x0: number; z0: number; x1: number; z1: number; h: number; n: readonly number[] }, y: number, screen = 0x5cff9a) {
  const WOOD = 0xb8b060, TERM = 0xa8c8b8, SCREEN = screen;
  const { x0, z0, x1, z1, h } = f, alongX = f.n[1] !== 0, len = alongX ? x1 - x0 : z1 - z0;
  const front = (a: number, yy: number, o = 0) => alongX ? [x0 + a, yy, (f.n[1] > 0 ? z1 : z0) + f.n[1] * o] : [(f.n[0] > 0 ? x1 : x0) + f.n[0] * o, yy, z0 + a];
  pb.box(x0, y + h - 0.05, z0, x1, y + h, z1, WOOD); for (const [lx, lz] of [[x0 + 0.07, z0 + 0.07], [x1 - 0.13, z0 + 0.07], [x1 - 0.13, z1 - 0.13], [x0 + 0.07, z1 - 0.13]]) pb.box(lx, y, lz, lx + 0.06, y + h - 0.05, lz + 0.06, WOOD);
  const scr = (a: number, yy: number, o: number) => front(a, yy, o);
  const m = len / 2 - 0.12, t = y + h, d = alongX ? z1 - z0 : x1 - x0, back = -d + 0.12;
  // the monitor: a deep box, its screen a little inset on the side facing the room
  const b0 = [scr(m - 0.28, t, back), scr(m + 0.28, t, back), scr(m + 0.28, t, back + 0.45), scr(m - 0.28, t, back + 0.45)];
  pb.solid8(b0, b0.map((p) => [p[0], t + 0.46, p[2]]), TERM);
  const sf = back + 0.46, sy0 = t + 0.07, sy1 = t + 0.4;
  pb.line(SCREEN, scr(m - 0.22, sy0, sf), scr(m + 0.22, sy0, sf), scr(m + 0.22, sy1, sf), scr(m - 0.22, sy1, sf), scr(m - 0.22, sy0, sf));
  for (let k = 0; k < 5; k++) { const yy = sy1 - 0.06 - k * 0.055; pb.seg(SCREEN, scr(m - 0.18, yy, sf + 0.003), scr(m - 0.18 + 0.1 + ((k * 37) % 5) * 0.05, yy, sf + 0.003)); }
  // keyboard and separate case
  const k0 = [scr(m - 0.24, t, back + 0.52), scr(m + 0.24, t, back + 0.52), scr(m + 0.24, t, back + 0.7), scr(m - 0.24, t, back + 0.7)];
  pb.solid8(k0, k0.map((p) => [p[0], t + 0.035, p[2]]), TERM);
  for (let a = -0.2; a <= 0.2; a += 0.08) pb.seg(TERM, scr(m + a, t + 0.036, back + 0.55), scr(m + a, t + 0.036, back + 0.67));
  const c0 = [scr(len - 0.3, t, back), scr(len - 0.08, t, back), scr(len - 0.08, t, back + 0.4), scr(len - 0.3, t, back + 0.4)];
  pb.solid8(c0, c0.map((p) => [p[0], t + 0.42, p[2]]), TERM);
  pb.seg(SCREEN, scr(len - 0.26, t + 0.3, back + 0.401), scr(len - 0.18, t + 0.3, back + 0.401)); // the power light
}
