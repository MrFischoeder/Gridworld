// Wooden treasure chest. Lid coordinates are relative to its rear hinge (y=.5, z=-.3).
import { PropBatch } from './props';
const WOOD = 0xc8a060, IRON = 0xffd060;
export function chestBase(pb: PropBatch) {
  // Hollow body: its interior stays visible when the lid opens.
  pb.box(-.45, 0, -.3, .45, .06, .3, WOOD);
  pb.box(-.45, .06, -.3, -.39, .5, .3, WOOD);
  pb.box(.39, .06, -.3, .45, .5, .3, WOOD);
  pb.box(-.39, .06, -.3, .39, .5, -.24, WOOD);
  pb.box(-.39, .06, .24, .39, .5, .3, WOOD);
  for (const y of [.17, .32]) for (const z of [-.301, .301]) pb.seg(WOOD, [-.45, y, z], [.45, y, z]);
  for (const x of [-.3, .3]) for (const z of [-.31, .3]) pb.box(x - .035, .03, z, x + .035, .5, z + .01, IRON);
  pb.box(-.065, .32, .305, .065, .5, .325, IRON);
  pb.box(-.025, .37, .326, .025, .43, .34, IRON);
  for (const x of [-.46, .46]) pb.line(IRON, [x, .32, -.08], [x, .24, -.08], [x, .24, .08], [x, .32, .08]);
  for (const x of [-.36, .29]) for (const z of [-.26, .19]) pb.box(x, -.03, z, x + .07, .06, z + .07, IRON);
}
export function chestLid(pb: PropBatch) {
  const profile = [[0, 0], [.06, .12], [.18, .21], [.3, .24], [.42, .21], [.54, .12], [.6, 0]];
  for (let i = 0; i < profile.length - 1; i++) {
    const [z0, y0] = profile[i], [z1, y1] = profile[i + 1];
    pb.face([-.46, y0, z0], [.46, y0, z0], [.46, y1, z1], [-.46, y1, z1]);
    pb.seg(WOOD, [-.46, y0, z0], [.46, y0, z0]);
    for (const x of [-.3, .3]) {
      pb.face([x - .035, y0 + .006, z0], [x + .035, y0 + .006, z0], [x + .035, y1 + .006, z1], [x - .035, y1 + .006, z1]);
      for (const dx of [-.035, .035]) pb.seg(IRON, [x + dx, y0 + .007, z0], [x + dx, y1 + .007, z1]);
    }
  }
  for (const x of [-.46, .46]) { const points = profile.map(([z, y]) => [x, y, z]); pb.face(...points); pb.line(WOOD, ...points, points[0]); }
  pb.face([-.46, 0, 0], [.46, 0, 0], [.46, 0, .6], [-.46, 0, .6]);
  for (const x of [-.3, .3]) pb.box(x - .05, -.025, -.02, x + .05, .035, .035, IRON);
}
export function drawClosedChest(pb: PropBatch, x: number, y: number, z: number) {
  const body = new PropBatch(), lid = new PropBatch(); chestBase(body); chestLid(lid);
  const append = (part: PropBatch, yy: number, zz: number) => {
    for (let i = 0; i < part.tri.length; i += 3) pb.tri.push(part.tri[i] + x, part.tri[i + 1] + yy, part.tri[i + 2] + zz);
    for (const [color, pts] of part.lines) for (let i = 0; i < pts.length; i += 6) pb.seg(color, [pts[i] + x, pts[i + 1] + yy, pts[i + 2] + zz], [pts[i + 3] + x, pts[i + 4] + yy, pts[i + 5] + zz]);
  };
  append(body, y, z); append(lid, y + .5, z - .3);
}
