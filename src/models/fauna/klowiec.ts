import { ModelBuilder, eye, leg } from './geometry';

/** (0.240) Tusker: a bristled boar with four tusks; grazes in a sounder and turns on whoever hurts one of them. */
export function klowiec() {
  const b = new ModelBuilder('klowiec'), body = b.part('body');
  body.shape.oval([0, .72, -.1], [.36, .34, .7], 10);
  body.shape.oval([0, .8, .32], [.38, .37, .42], 10);
  const neck = b.part('neck', [0, .78, .62], body.group);
  neck.shape.oval([0, -.02, .08], [.3, .3, .22], 8);
  const head = b.part('head', [0, -.06, .22], neck.group);
  head.shape.tube([{ p: [0, .04, -.05], width: .25, depth: .25 }, { p: [0, -.04, .25], width: .17, depth: .17 },
    { p: [0, -.1, .48], width: .11, depth: .1 }], 8);
  head.shape.oval([0, -.1, .52], [.12, .09, .04], 6);
  for (const side of [-1, 1]) {
    eye(head.shape, side, .2, .06, .12, .04);
    head.shape.fin([[side * .14, .16, -.04], [side * .24, .32, -.14], [side * .2, .14, -.12]], .015);
  }
  const jaw = b.part('jaw', [0, -.17, .1], head.group);
  jaw.shape.oval([0, -.02, .16], [.12, .06, .24], 6);
  for (const side of [-1, 1]) {
    jaw.shape.thorn([side * .1, .02, .28], [side * .35, 1, .45], .26, .035);
    jaw.shape.thorn([side * .08, .0, .18], [side * .5, .8, .2], .14, .025);
  }
  for (let i = 0; i < 8; i++) {
    const z = -.55 + i * .16, y = 1.02 + Math.sin(i / 7 * Math.PI) * .16;
    body.shape.fin([[0, y - .1, z - .1], [0, y + .1 + (i % 2) * .05, z - .02], [0, y - .1, z + .1]], .02);
  }
  for (const [row, z] of [['front', .38], ['rear', -.5]] as const) for (const side of [-1, 1]) {
    leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .24, .62, z], [side * .02, -.3, row === 'front' ? .02 : -.05], [side * .03, .1 - .62, .04], .09, true);
  }
  const tail = b.part('tail', [0, .82, -.78], body.group);
  tail.shape.tube([{ p: [0, 0, 0], width: .04, depth: .04 }, { p: [.05, -.12, -.12], width: .025, depth: .025 }, { p: [.04, -.26, -.14], width: .01, depth: .01 }], 5);
  return b.finish();
}
