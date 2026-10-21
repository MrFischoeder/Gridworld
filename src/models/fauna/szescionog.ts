import { ModelBuilder, eye, leg } from './geometry';

export function szescionog() {
  const b = new ModelBuilder('szescionog'), body = b.part('body');
  body.shape.oval([0, 1.82, -.6], [.61, .59, 1.8], 10);
  const neck = b.part('neck', [0, 2.05, .95], body.group);
  neck.shape.tube([
    { p: [0, 0, 0], width: .4, depth: .42 }, { p: [0, .43, .35], width: .3, depth: .35 },
    { p: [0, .85, .53], width: .22, depth: .27 }, { p: [0, 1.01, .77], width: .2, depth: .23 },
  ]);
  const head = b.part('head', [0, 1, 1.08], neck.group);
  head.shape.oval([0, -.04, .03], [.25, .29, .48]);
  head.shape.oval([0, -.23, .45], [.2, .18, .3]);
  for (const side of [-1, 1]) {
    eye(head.shape, side, .235, .03, .15, .075);
    head.shape.fin([[side * .14, .18, -.17], [side * .22, .34, -.42], [side * .18, .24, -.49], [side * .12, .1, -.25]], .035);
    head.shape.stroke([[side * .13, -.2, .66], [side * .16, -.16, .65]]);
  }
  const jaw = b.part('jaw', [0, -.23, .02], head.group);
  jaw.shape.oval([0, -.08, .23], [.17, .1, .46]);
  const mane = b.part('mane', [0, 0, 0], neck.group);
  mane.shape.fin([[0, -.12, -.27], [0, .2, -.16], [0, .63, .12], [0, 1.11, .5],
    [0, 1.22, .68], [0, .88, .23], [0, .7, -.02], [0, .32, -.3], [0, .02, -.49]], .035);
  for (const [row, z, offset] of [['front', .98, .17], ['middle', -.45, -.02], ['rear', -1.82, -.16]] as const) {
    for (const side of [-1, 1]) {
      body.shape.oval([side * .44, 1.77, z], [.25, .4, .32]);
      leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .46, 1.8, z],
        [side * .05, -.85, offset - .14], [side * .09, -1.7, offset + (side > 0 ? -.14 : .1)], .17, true);
    }
  }
  const tail = b.part('tail', [0, 1.95, -2.27], body.group);
  tail.shape.tube([{ p: [0, 0, 0], width: .12, depth: .12 }, { p: [.12, -.2, -.52], width: .095, depth: .09 },
    { p: [.2, -.67, -1.19], width: .025, depth: .035 }]);
  for (const side of [-1, 0, 1]) tail.shape.stroke([[.12 + side * .06, -.2, -.48], [.2 + side * .09, -.62, -1.02], [.22 + side * .1, -.91, -1.2]]);
  return b.finish();
}
