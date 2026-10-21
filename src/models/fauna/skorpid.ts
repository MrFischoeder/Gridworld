import { ModelBuilder, eye, leg, type Section } from './geometry';

/** (0.240) Scorpid: a desert scorpion the size of a calf, pincers before it and the sting curled over its back. */
export function skorpid() {
  const b = new ModelBuilder('skorpid'), body = b.part('body');
  body.shape.oval([0, .42, -.2], [.42, .2, .62], 10);
  for (let i = 0; i < 5; i++) body.shape.stroke([[-.4 + Math.abs(i - 2) * .02, .5, -.6 + i * .2], [0, .63, -.6 + i * .2], [.4 - Math.abs(i - 2) * .02, .5, -.6 + i * .2]]);
  const neck = b.part('neck', [0, .44, .4], body.group);
  neck.shape.oval([0, 0, .05], [.3, .16, .14], 8);
  const head = b.part('head', [0, .0, .16], neck.group);
  head.shape.oval([0, 0, .1], [.24, .13, .18], 8);
  for (const side of [-1, 1]) {
    eye(head.shape, side, .1, .12, .14, .03); eye(head.shape, side, .17, .1, .07, .025);
    // the pincer arm and its claw
    head.shape.tube([{ p: [side * .2, 0, .1], width: .06, depth: .06 }, { p: [side * .5, .06, .35], width: .05, depth: .05 }, { p: [side * .42, .08, .7], width: .07, depth: .06 }], 6);
    head.shape.oval([side * .42, .08, .82], [.13, .08, .16], 6);
    head.shape.thorn([side * .38, .1, .94], [-side * .2, 0, 1], .2, .05);
    head.shape.thorn([side * .48, .06, .94], [-side * .1, -.1, 1], .18, .04);
  }
  const jaw = b.part('jaw', [0, -.06, .26], head.group);
  for (const side of [-1, 1]) jaw.shape.thorn([side * .05, 0, 0], [side * .3, -.2, 1], .12, .03);
  for (const [row, z] of [['front', .2], ['middle', -.15], ['rear', -.5]] as const) for (const side of [-1, 1]) {
    leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .36, .44, z], [side * .38, .12, z * .3], [side * .55, .1 - .44, z * .4], .045, false, 2);
  }
  const tail = b.part('tail', [0, .5, -.78], body.group);
  const path: Section[] = [[0, 0, 0, .12], [0, .14, -.28, .11], [0, .42, -.46, .1], [0, .72, -.42, .09], [0, .92, -.2, .08], [0, .98, .06, .07]]
    .map(([x, y, z, w]) => ({ p: [x, y, z], width: w, depth: w * .9 }));
  tail.shape.tube(path, 6, 1, 1);
  tail.shape.oval([0, .94, .16], [.07, .07, .1], 6);
  tail.shape.thorn([0, .9, .24], [0, -.8, .6], .22, .04);
  return b.finish();
}
