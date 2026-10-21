import { ModelBuilder, eye, leg, type Point, type Section } from './geometry';

export function koronotytan() {
  const b = new ModelBuilder('koronotytan'), body = b.part('body');
  body.shape.oval([0, 5.65, -.9], [2.9, 2.05, 5.5], 12);
  body.shape.oval([0, 5.9, 2.8], [2.35, 1.65, 2.7], 10);
  for (const [row, z, height, width] of [['front', 2.65, 5.5, 1], ['rear', -4.2, 5.1, 1.15]] as const) {
    for (const side of [-1, 1]) leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * 1.8, height, z],
      [side * .14, -height * .48, -.16], [side * .22, .1 - height, .28], width, false, 4);
  }
  const neck = b.part('neck', [0, 6.4, 3.5], body.group);
  const neckPath: Section[] = [{ p: [0, 0, 0], width: 1.65, depth: 1.6 }, { p: [0, 2.3, 2.9], width: 1.35, depth: 1.3 },
    { p: [0, 5.3, 5.9], width: .96, depth: 1 }, { p: [0, 8.4, 8.1], width: .63, depth: .8 },
    { p: [0, 10.45, 11.2], width: .48, depth: .61 }];
  neck.shape.tube(neckPath, 10);
  const head = b.part('head', [0, 10.55, 11.6], neck.group);
  head.shape.oval([0, 0, .15], [.59, .48, .94]);
  head.shape.oval([0, -.1, .84], [.39, .27, .52]);
  for (const side of [-1, 1]) {
    eye(head.shape, side, .56, .12, .27, .13);
    head.shape.stroke([[side * .24, .07, 1.21], [side * .28, .12, 1.19]]);
  }
  const jaw = b.part('jaw', [0, -.29, .05], head.group);
  jaw.shape.oval([0, -.05, .57], [.38, .16, .78]);
  const crown = b.part('crown', [0, .34, -.31], head.group);
  for (const side of [-1, 0, 1]) crown.shape.fin([[side * .3, 0, .08], [side * .33, .68 - Math.abs(side) * .18, -.28],
    [side * .3, .46, -.57], [side * .3, -.04, -.35]], .07);
  for (let i = 0; i < neckPath.length - 1; i++) {
    const a = neckPath[i], c = neckPath[i + 1], dy = c.p[1] - a.p[1], dz = c.p[2] - a.p[2], n = Math.hypot(dy, dz);
    const y = (a.p[1] + c.p[1]) / 2, z = (a.p[2] + c.p[2]) / 2;
    // Follow the sloped skin: a crest grows from the neck, not from a parallel floating row.
    const depth = (a.depth + c.depth) / 2 * .95;
    const point = (along: number, outward: number): Point => [0,
      y + dy / n * along + dz / n * (depth + outward), z + dz / n * along - dy / n * (depth + outward)];
    neck.shape.fin([point(-.55, -.05), point(0, .65), point(.55, -.05)], .09);
  }
  for (let i = 0; i < 5; i++) {
    const z = -3.7 + i * 1.35;
    body.shape.fin([[0, 7.35, z - .5], [0, 7.9 + (i % 2) * .2, z], [0, 7.47, z + .6]], .12);
  }
  const tail = b.part('tail', [0, 5.5, -5.5], body.group);
  tail.shape.tube([{ p: [0, 0, 0], width: 1.85, depth: 1.45 }, { p: [0, -.8, -3], width: 1.3, depth: 1.1 },
    { p: [.25, -1.7, -6.2], width: .8, depth: .72 }, { p: [.8, -2.3, -9.1], width: .43, depth: .43 },
    { p: [1.9, -2.2, -12.1], width: .19, depth: .21 }, { p: [3, -1.55, -14], width: .025, depth: .04 }], 10);
  return b.finish();
}
