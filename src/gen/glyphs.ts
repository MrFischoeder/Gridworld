// (0.241, the owner's request) The script of the old builders: glyphs in the manner of the ancient gates' symbols
// (data/gates.ts), carved on the walls of the ruins' labyrinths and stencilled inside the crashed ships. Each glyph
// is built from a seed out of a few strokes (a ring, an eye, a crescent, a bar, a fork, a zigzag, a triangle, dots)
// inside the unit square [-1, 1]². Pure and deterministic.
import { rng, hash } from '../core/rng';

export type Stroke = [number, number][];
const TAU = Math.PI * 2;
const arc = (cx: number, cy: number, r: number, a0: number, a1: number, n = 10): Stroke =>
  Array.from({ length: n + 1 }, (_, i) => { const a = a0 + (a1 - a0) * i / n; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r]; });

/** The building blocks: each returns strokes in the unit square, drawn about (cx, cy) at size s. */
const PARTS: ((R: () => number, cx: number, cy: number, s: number) => Stroke[])[] = [
  (R, cx, cy, s) => [arc(cx, cy, s, 0, TAU, R() < 0.5 ? 6 : 12)], // ring (hexagonal or round)
  (_, cx, cy, s) => [[[cx - s, cy], [cx, cy + s * 0.6], [cx + s, cy], [cx, cy - s * 0.6], [cx - s, cy]], [[cx, cy - s * 0.25], [cx, cy + s * 0.25]]], // eye
  (R, cx, cy, s) => { const a = R() * TAU; return [arc(cx, cy, s, a, a + Math.PI * 1.2, 8)]; }, // crescent
  (R, cx, cy, s) => (R() < 0.5 ? [[[cx - s, cy], [cx + s, cy]]] : [[[cx, cy - s], [cx, cy + s]]]), // bar
  (_, cx, cy, s) => [[[cx, cy - s], [cx, cy + s * 0.2]], [[cx - s * 0.7, cy + s], [cx, cy + s * 0.2], [cx + s * 0.7, cy + s]]], // fork
  (R, cx, cy, s) => { const up = R() < 0.5 ? 1 : -1; return [[[cx - s, cy - s * 0.5 * up], [cx - s * 0.33, cy + s * 0.5 * up], [cx + s * 0.33, cy - s * 0.5 * up], [cx + s, cy + s * 0.5 * up]]]; }, // zigzag
  (R, cx, cy, s) => { const u = R() < 0.5 ? 1 : -1; return [[[cx - s, cy - s * 0.8 * u], [cx, cy + s * u], [cx + s, cy - s * 0.8 * u], [cx - s, cy - s * 0.8 * u]]]; }, // triangle
  (_, cx, cy, s) => [arc(cx - s * 0.5, cy, s * 0.18, 0, TAU, 5), arc(cx + s * 0.5, cy, s * 0.18, 0, TAU, 5)], // two dots
  (_, cx, cy, s) => [[[cx - s, cy + s], [cx + s, cy + s], [cx + s, cy - s], [cx - s * 0.2, cy - s], [cx - s * 0.2, cy + s * 0.2], [cx + s * 0.4, cy + s * 0.2]]], // square spiral
  (_, cx, cy, s) => [[[cx, cy + s], [cx + s * 0.3, cy + s * 0.3], [cx + s, cy], [cx + s * 0.3, cy - s * 0.3], [cx, cy - s], [cx - s * 0.3, cy - s * 0.3], [cx - s, cy], [cx - s * 0.3, cy + s * 0.3], [cx, cy + s]]], // star
];

/** One glyph: a frame-filling main stroke and one to three smaller ones round or inside it, every point in [-1, 1]. */
export function alienGlyph(seed: number): Stroke[] {
  const R = rng(hash(seed, 0x91f)), out: Stroke[] = [];
  const pick = () => PARTS[Math.floor(R() * PARTS.length)];
  out.push(...pick()(R, 0, 0, 0.75 + R() * 0.2));
  const n = 1 + Math.floor(R() * 3);
  for (let i = 0; i < n; i++) {
    const inner = R() < 0.4, a = R() * TAU, d = inner ? 0 : 0.55, s = inner ? 0.28 + R() * 0.12 : 0.22 + R() * 0.12;
    out.push(...pick()(R, Math.cos(a) * d, Math.sin(a) * d, s));
  }
  return out.map((st) => st.map(([u, v]) => [Math.max(-1, Math.min(1, u)), Math.max(-1, Math.min(1, v))] as [number, number]));
}
/** An inscription: `n` glyphs of one hand (seeded), for a column or a row on a wall. */
export const inscription = (seed: number, n: number) => Array.from({ length: n }, (_, i) => alienGlyph(hash(seed, i)));
