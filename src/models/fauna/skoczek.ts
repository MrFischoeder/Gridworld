import { ModelBuilder, eye, leg } from './geometry';

/** (0.240) Hopling: a small long-eared hopper with strong hind legs, a grazer of the open land. */
export function skoczek() {
  const b = new ModelBuilder('skoczek'), body = b.part('body');
  body.shape.oval([0, .36, -.08], [.17, .17, .28], 8);
  body.shape.oval([0, .4, .14], [.13, .14, .14], 8);
  const neck = b.part('neck', [0, .44, .24], body.group);
  neck.shape.oval([0, .02, .04], [.09, .09, .08], 6);
  const head = b.part('head', [0, .06, .1], neck.group);
  head.shape.oval([0, 0, .06], [.09, .085, .13], 8);
  for (const side of [-1, 1]) {
    eye(head.shape, side, .085, .03, .07, .025);
    head.shape.fin([[side * .04, .05, .0], [side * .07, .36, -.08], [side * .09, .38, -.02], [side * .06, .06, .05]], .012);
    head.shape.stroke([[side * .03, -.03, .19], [side * .12, -.02, .23]]);
  }
  const jaw = b.part('jaw', [0, -.05, .08], head.group);
  jaw.shape.oval([0, -.01, .05], [.05, .03, .07], 6);
  for (const [row, z, hipY, width, knee, foot] of [
    ['front', .14, .3, .045, [0, -.14, .03], [0, .1 - .3, .05]],
    ['rear', -.22, .36, .07, [0, -.16, .14], [0, .1 - .36, -.1]],
  ] as const) for (const side of [-1, 1]) leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .12, hipY, z],
    [side * .02 + knee[0], knee[1], knee[2]], [side * .03 + foot[0], foot[1], foot[2]], width, false, 3);
  const tail = b.part('tail', [0, .4, -.36], body.group);
  tail.shape.oval([0, .02, -.04], [.06, .06, .06], 6);
  return b.finish();
}
