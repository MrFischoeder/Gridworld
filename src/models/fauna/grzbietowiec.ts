import { ModelBuilder, eye, leg } from './geometry';

export function grzbietowiec() {
  const b = new ModelBuilder('grzbietowiec'), body = b.part('body');
  body.shape.oval([0, 1.65, -.15], [.83, .75, 1.3], 10);
  body.shape.oval([0, 2.08, .55], [.9, .72, .83], 10);
  const neck = b.part('neck', [0, 1.9, 1.05], body.group);
  neck.shape.oval([0, 0, .04], [.63, .55, .6]);
  const head = b.part('head', [0, -.05, .48], neck.group);
  head.shape.oval([0, 0, .12], [.51, .39, .52]);
  head.shape.oval([0, -.15, .57], [.35, .22, .35]);
  head.shape.oval([0, -.13, .85], [.23, .13, .075]);
  for (const side of [-1, 1]) {
    head.shape.oval([side * .4, .32, -.06], [.17, .18, .12], 6);
    eye(head.shape, side, .44, .15, .34, .09);
    eye(head.shape, side, .505, .12, .08, .055);
    for (let i = 0; i < 3; i++) head.shape.thorn([side * .38, -.05 - i * .1, -.05], [side, -.7, -.4], .24, .08);
  }
  const jaw = b.part('jaw', [0, -.25, .28], head.group);
  jaw.shape.oval([0, -.035, .23], [.3, .12, .39]);
  // Irregular contour tufts instead of a rigid plated back.
  for (let i = 0; i < 9; i++) {
    const z = -.95 + i * .25, y = 2.12 + Math.sin(i / 8 * Math.PI) * .54;
    body.shape.fin([[0, y, z - .15], [0, y + .16 + (i % 3) * .04, z - .09], [0, y, z + .2]], .035);
  }
  for (const side of [-1, 1]) for (let i = 0; i < 4; i++) {
    body.shape.thorn([side * .7, 1.75 + i * .16, .55 - i * .18], [side * .5, -.3, -.8], .26, .065);
  }
  for (const [row, z, hipY, width] of [['front', .85, 1.65, .32], ['rear', -.95, 1.35, .28]] as const) {
    for (const side of [-1, 1]) leg(b, `${row}.${side < 0 ? 'left' : 'right'}`, [side * .64, hipY, z],
      [side * .05, -hipY * .47, row === 'front' ? .03 : -.12], [side * .08, .1 - hipY, .13], width, false, 5);
  }
  const tail = b.part('tail', [0, 1.38, -1.39], body.group);
  tail.shape.tube([{ p: [0, 0, 0], width: .15, depth: .15 }, { p: [0, -.1, -.35], width: .05, depth: .07 }]);
  return b.finish();
}
