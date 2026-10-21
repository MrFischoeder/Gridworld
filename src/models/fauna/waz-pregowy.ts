import { ACCENT, ModelBuilder, eye, sections, type Point, type Section } from './geometry';

export function wazPregowy() {
  const b = new ModelBuilder('waz-pregowy');
  // Fit the centreline in metres, rather than confusing the S-shaped footprint with length.
  const path: Section[] = Array.from({ length: 37 }, (_, i) => {
    const t = i / 36, radius = .025 + .675 * Math.min(1, t * 4);
    const rise = Math.max(0, (t - .78) / .22);
    return { p: [Math.sin(t * Math.PI * 2) * 2, radius + rise * 3.28, (t - .5) * 14], width: radius, depth: radius * .94 };
  });
  const length = (scale: number) => path.slice(1).reduce((sum, s, i) => {
    const p = path[i].p; return sum + Math.hypot((s.p[0] - p[0]) * scale, s.p[1] - p[1], (s.p[2] - p[2]) * scale);
  }, 0);
  let low = .1, high = 3;
  for (let i = 0; i < 40; i++) { const mid = (low + high) / 2; if (length(mid) < 21.25) low = mid; else high = mid; }
  for (const s of path) { s.p[0] *= (low + high) / 2; s.p[2] *= (low + high) / 2; }
  const rings = sections(path);
  for (const [name, from, to] of [['tail', 0, 8], ['body', 8, 29], ['neck', 29, 36]] as const) {
    const pivot = path[from].p, part = b.part(name, [...pivot]);
    const local = rings.slice(from, to + 1).map(ring => ring.map(p => p.map((v, k) => v - pivot[k]) as Point));
    part.shape.surface(local, 3, 2);
    for (let i = from; i <= to; i++) if (i % 4 === 0) {
      const ring = local[i - from]; part.shape.stroke([...ring, ring[0]], ACCENT);
      if (i < to) {
        const next = local[i - from + 1];
        const stripe = ring.map((p, j) => p.map((v, k) => v + (next[j][k] - v) * .2) as Point);
        part.shape.stroke([...stripe, stripe[0]], ACCENT);
      }
    }
  }
  const end = path[36].p, head = b.part('head', [...end], b.parts.neck);
  head.group.position.set(end[0] - path[29].p[0], end[1] - path[29].p[1], end[2] - path[29].p[2]);
  head.shape.oval([0, .05, .34], [.77, .42, .65]);
  head.shape.oval([0, -.03, .82], [.46, .21, .25]);
  for (const side of [-1, 1]) {
    head.shape.oval([side * .55, .25, .33], [.2, .14, .29]);
    eye(head.shape, side, .734, .22, .48, .1);
    head.shape.stroke([[side * .22, .04, .98], [side * .26, .09, .97]]);
  }
  const jaw = b.part('jaw', [0, -.24, .1], head.group);
  jaw.shape.oval([0, -.03, .43], [.56, .12, .7]);
  return b.finish();
}
