import { ModelBuilder, eye, leg } from './geometry';

export function szczekorog() {
  const b = new ModelBuilder('szczekorog'), body = b.part('body');
  body.shape.oval([0, .62, -.1], [.9, .36, 1.55], 10);
  const neck = b.part('neck', [0, .66, 1.05], body.group);
  neck.shape.oval([0, 0, .2], [.64, .29, .64]);
  const head = b.part('head', [0, .03, .58], neck.group);
  head.shape.tube([{ p: [0, 0, -.2], width: .56, depth: .25 }, { p: [0, -.03, .4], width: .54, depth: .2 },
    { p: [0, -.1, 1.3], width: .33, depth: .13 }, { p: [0, -.11, 1.55], width: .27, depth: .1 }]);
  for (const side of [-1, 1]) {
    head.shape.oval([side * .4, .18, .12], [.19, .18, .25]);
    eye(head.shape, side, .57, .22, .19, .085);
    head.shape.thorn([side * .38, .27, -.08], [side * .25, .5, -1], .34, .11);
    for (let i = 0; i < 7; i++) head.shape.thorn([side * (.47 - i * .025), -.15, .35 + i * .16], [0, -1, 0], .06 + (i % 3) * .018, .035);
  }
  const jaw = b.part('jaw', [0, -.2, .07], head.group);
  jaw.shape.oval([0, -.015, .66], [.45, .11, .88]);
  for (const [row, z] of [['front', .83], ['rear', -1.05]] as const) for (const side of [-1, 1]) {
    leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .7, .62, z],
      [side * .44, -.18, -.18], [side * .55, -.52, .17], .2, false, 4);
  }
  const tail = b.part('tail', [0, .6, -1.5], body.group);
  tail.shape.tube([{ p: [0, 0, 0], width: .68, depth: .3 }, { p: [.1, -.03, -.9], width: .41, depth: .32 },
    { p: [.27, -.13, -1.9], width: .24, depth: .27 }, { p: [.5, -.3, -2.9], width: .1, depth: .17 },
    { p: [.68, -.42, -4.25], width: .015, depth: .025 }]);
  for (const side of [-1, 1]) for (let i = 0; i < 6; i++) {
    const z = -1.05 + i * .4;
    body.shape.fin([[side * .31, .91, z - .15], [side * .31, 1.05 + (i % 2) * .1, z], [side * .31, .94, z + .18]], .055);
  }
  for (let i = 0; i < 7; i++) {
    const z = -.1 - i * .5, x = Math.max(0, -z) * .14, y = .88 - i * .08;
    for (const side of i < 4 ? [-1, 1] : [0]) tail.shape.fin([[x + side * .18, y - .6, z],
      [x + side * .18, y - .38, z - .18], [x + side * .18, y - .63, z - .39]], .035);
  }
  return b.finish();
}
