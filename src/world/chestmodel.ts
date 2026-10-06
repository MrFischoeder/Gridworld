// Chests. Four designs share one frame: the body stands on y = 0 within x ±.45, z ±.3 with its rim at y = .5, and the
// lid is drawn relative to its rear hinge (y = .5, z = -.3), opening upwards about x (world/interact.ts). Most are
// military sci-fi cases (`CHEST_KINDS`: an ammunition footlocker, a sealed tech canister, an armoured strongbox with a
// keypad); the old wooden treasure chest turns up only now and then (`chestKind`).
import { PropBatch } from './props';
import { hash } from '../core/rng';
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
export function drawClosedChest(pb: PropBatch, x: number, y: number, z: number, kind: ChestKind = 'wood') {
  const body = new PropBatch(), lid = new PropBatch(); CHEST_KINDS[kind].base(body); CHEST_KINDS[kind].lid(lid);
  const append = (part: PropBatch, yy: number, zz: number) => {
    for (let i = 0; i < part.tri.length; i += 3) pb.tri.push(part.tri[i] + x, part.tri[i + 1] + yy, part.tri[i + 2] + zz);
    for (const [color, pts] of part.lines) for (let i = 0; i < pts.length; i += 6) pb.seg(color, [pts[i] + x, pts[i + 1] + yy, pts[i + 2] + zz], [pts[i + 3] + x, pts[i + 4] + yy, pts[i + 5] + zz]);
  };
  append(body, y, z); append(lid, y + .5, z - .3);
}

// ---------- the military sci-fi cases ----------
const GOLD = 0xffd060, DIM = 0xa8823c, GLOW = 0xfff0b0;
/** Hollow walls of a box body (floor and four sides, open on top) with the fill on both faces. */
function shell(pb: PropBatch, x: number, z: number, top: number, t = .05, c = GOLD) {
  pb.box(-x, 0, -z, x, t, z, c);
  pb.box(-x, t, -z, -x + t, top, z, c); pb.box(x - t, t, -z, x, top, z, c);
  pb.box(-x + t, t, -z, x - t, top, -z + t, c); pb.box(-x + t, t, z - t, x - t, top, z, c);
}
/** Diagonal hazard stripes in the rect x0..x1, y0..y1 on the plane z (a panel with a frame). */
function stripes(pb: PropBatch, x0: number, x1: number, y0: number, y1: number, z: number) {
  pb.line(GOLD, [x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z], [x0, y0, z]);
  const h = y1 - y0;
  for (let x = x0 - h; x < x1; x += .07) {
    const a = Math.max(x0, x), b = Math.min(x1, x + h);
    if (b > a) pb.seg(DIM, [a, y0 + (a - x), z], [b, y0 + (b - x), z]);
  }
}

/** A1 ammunition footlocker: ribbed steel box on skids, corner guards, hazard panel, latches and side handles. */
function lockerBase(pb: PropBatch) {
  shell(pb, .45, .3, .5);
  for (const z of [-.24, .24]) pb.box(-.43, -.04, z - .03, .43, 0, z + .03, DIM); // skids
  for (const y of [.12, .38]) pb.line(DIM, [-.455, y, -.305], [.455, y, -.305], [.455, y, .305], [-.455, y, .305], [-.455, y, -.305]); // ribs
  for (const x of [-.45, .45]) for (const z of [-.3, .3]) { // corner guards
    const sx = Math.sign(x), sz = Math.sign(z);
    pb.box(Math.min(x, x - sx * .07), 0, Math.min(z, z + sz * .012), Math.max(x, x - sx * .07), .5, Math.max(z, z + sz * .012), GOLD);
    pb.box(Math.min(x, x + sx * .012), 0, Math.min(z, z - sz * .07), Math.max(x, x + sx * .012), .5, Math.max(z, z - sz * .07), GOLD);
  }
  stripes(pb, -.2, .2, .17, .33, .302);
  for (const x of [-.3, .3]) { pb.box(x - .045, .36, .3, x + .045, .47, .33, GOLD); pb.seg(GLOW, [x - .02, .41, .331], [x + .02, .41, .331]); } // latches
  for (const x of [-.455, .455]) { const o = Math.sign(x) * .05; pb.line(GOLD, [x, .36, -.1], [x + o, .36, -.1], [x + o, .36, .1], [x, .36, .1]); } // handles
}
function lockerLid(pb: PropBatch) {
  pb.box(-.46, 0, 0, .46, .07, .61, GOLD);
  pb.box(-.36, .07, .08, .36, .1, .53, DIM); // raised centre panel
  for (const x of [-.24, 0, .24]) pb.seg(GOLD, [x, .101, .1], [x, .101, .51]);
  for (const x of [-.3, .3]) pb.box(x - .05, -.02, -.03, x + .05, .04, .03, GOLD); // hinges
  pb.seg(GLOW, [-.3, .072, .608], [.3, .072, .608]); // a lit seal along the front edge
}

/** T7 sealed tech canister: an octagonal case lying along x, thick end rings with bolts, a glowing seam. */
const CAN = [[-.3, .14], [-.2, .04], [.2, .04], [.3, .14]] as const;
function canisterBase(pb: PropBatch) {
  // the lower half of the octagon, open at the top so the inside shows when it opens
  const prof: [number, number][] = [[-.3, .5], ...CAN.map(([z, y]) => [z, y] as [number, number]), [.3, .5]];
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
    pb.face([-.38, y0, z0], [.38, y0, z0], [.38, y1, z1], [-.38, y1, z1]);
    pb.seg(GOLD, [-.38, y1, z1], [.38, y1, z1]);
  }
  for (const x of [-.38, .38]) { const pts = prof.map(([z, y]) => [x, y, z]); pb.face(...pts); pb.line(GOLD, ...pts); }
  // end rings standing proud of the hull, and feet
  for (const x of [-.45, .38]) {
    const ring: [number, number][] = [[-.32, .5], [-.32, .13], [-.21, .02], [.21, .02], [.32, .13], [.32, .5]];
    pb.face(...ring.map(([z, y]) => [x, y, z])); pb.face(...ring.map(([z, y]) => [x + .07, y, z]));
    for (let i = 0; i < ring.length - 1; i++) {
      const [z0, y0] = ring[i], [z1, y1] = ring[i + 1];
      pb.face([x, y0, z0], [x + .07, y0, z0], [x + .07, y1, z1], [x, y1, z1]);
      pb.seg(GOLD, [x, y0, z0], [x, y1, z1]); pb.seg(GOLD, [x + .07, y0, z0], [x + .07, y1, z1]);
    }
    for (const [z, y] of [[-.28, .3], [.28, .3], [0, .06]]) pb.seg(DIM, [x - .005, y - .02, z], [x - .005, y + .02, z]);
    pb.box(x, -.03, -.18, x + .07, .02, .18, DIM);
  }
  for (const y of [.25, .42]) pb.seg(GLOW, [-.37, y, .301], [.37, y, .301]); // the lit strips along the front
  pb.box(-.1, .28, .3, .1, .4, .315, DIM); pb.seg(GLOW, [-.06, .34, .316], [.06, .34, .316]); // the release
}
function canisterLid(pb: PropBatch) {
  // the upper half of the octagon, from the hinge (z 0) to the front (z .6)
  const prof: [number, number][] = [[0, 0], [0, .1], [.1, .2], [.5, .2], [.6, .1], [.6, 0]];
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
    pb.face([-.38, y0, z0], [.38, y0, z0], [.38, y1, z1], [-.38, y1, z1]);
    pb.seg(GOLD, [-.38, y1, z1], [.38, y1, z1]);
  }
  for (const x of [-.38, .38]) { const pts = prof.map(([z, y]) => [x, y, z]); pb.face(...pts); pb.line(GOLD, ...pts); }
  pb.face([-.38, 0, 0], [.38, 0, 0], [.38, 0, .6], [-.38, 0, .6]);
  // a readout on the top and a carrying bar over it
  pb.line(DIM, [-.2, .201, .18], [.2, .201, .18], [.2, .201, .42], [-.2, .201, .42], [-.2, .201, .18]);
  for (const [z, w] of [[.24, .14], [.3, .09], [.36, .12]]) pb.seg(GLOW, [-w, .202, z], [w, .202, z]);
  for (const x of [-.28, .28]) pb.seg(GOLD, [x, .2, .3], [x, .28, .3]);
  pb.seg(GOLD, [-.28, .28, .3], [.28, .28, .3]);
}

/** K4 armoured strongbox: a wedge-fronted steel case with riveted plates, a keypad and a status lamp, vents at the sides. */
function vaultBase(pb: PropBatch) {
  const T = .5, F = .22; // the front leans back from z .3 at the foot to z .22 at the rim
  pb.box(-.45, 0, -.3, .45, .05, .3, GOLD);
  pb.box(-.45, .05, -.3, .45, T, -.25, GOLD); // back
  for (const x of [-.45, .4]) { // sides (wedge plates)
    const pts = [[0, .05, -.25], [0, .05, .3], [0, T, F], [0, T, -.25]];
    for (const dx of [0, .05]) pb.face(...pts.map(([, y, z]) => [x + dx, y, z]));
    pb.line(GOLD, ...pts.map(([, y, z]) => [x + (x < 0 ? 0 : .05), y, z]), [x + (x < 0 ? 0 : .05), .05, -.25]);
    for (let y = .14; y < .42; y += .07) { const xx = x + (x < 0 ? -.002 : .052); pb.seg(DIM, [xx, y, -.12], [xx, y + .04, .02]); } // vents
  }
  // the sloped front: an outer and an inner face, a riveted frame, the keypad and the lamp
  const fr = (y: number) => .3 - (.3 - F) * (y / T), out = (y: number) => fr(y) + .001;
  for (const d of [0, -.05]) pb.face([-.45, .05, fr(.05) + d], [.45, .05, fr(.05) + d], [.45, T, F + d], [-.45, T, F + d]);
  pb.line(GOLD, [-.45, .05, out(.05)], [.45, .05, out(.05)], [.45, T, out(T)], [-.45, T, out(T)], [-.45, .05, out(.05)]);
  for (const x of [-.4, .4]) for (const y of [.1, .45]) pb.seg(DIM, [x, y, out(y) + .002], [x + .015, y, out(y) + .002]);
  const kx = .17, ky0 = .16, ky1 = .38; // the keypad
  pb.line(GOLD, [kx, ky0, out(ky0)], [kx + .18, ky0, out(ky0)], [kx + .18, ky1, out(ky1)], [kx, ky1, out(ky1)], [kx, ky0, out(ky0)]);
  for (let r = 0; r < 4; r++) for (let c = 0; c < 3; c++) { const x = kx + .035 + c * .055, y = ky0 + .035 + r * .05; pb.seg(r === 3 ? GLOW : DIM, [x, y, out(y) + .003], [x + .025, y, out(y) + .003]); }
  stripes(pb, -.38, .06, .16, .3, out(.23) + .002);
  pb.box(-.12, .37, out(.4), -.06, .43, out(.4) + .03, GLOW); // status lamp
}
function vaultLid(pb: PropBatch) {
  // an armour plate over the wedge (z 0 .. .52 from the hinge) with a bevelled front and three ribs
  const prof: [number, number][] = [[0, 0], [0, .08], [.46, .08], [.53, .03], [.53, 0]];
  for (let i = 0; i < prof.length - 1; i++) {
    const [z0, y0] = prof[i], [z1, y1] = prof[i + 1];
    pb.face([-.46, y0, z0], [.46, y0, z0], [.46, y1, z1], [-.46, y1, z1]);
    pb.seg(GOLD, [-.46, y1, z1], [.46, y1, z1]);
  }
  for (const x of [-.46, .46]) { const pts = prof.map(([z, y]) => [x, y, z]); pb.face(...pts); pb.line(GOLD, ...pts); }
  pb.face([-.46, 0, 0], [.46, 0, 0], [.46, 0, .53], [-.46, 0, .53]);
  for (const x of [-.3, 0, .3]) pb.box(x - .03, .08, .04, x + .03, .11, .44, DIM);
  for (const x of [-.4, .4]) for (const z of [.06, .42]) pb.seg(DIM, [x, .081, z], [x + .015, .081, z]);
  pb.box(-.35, -.02, -.035, .35, .03, .02, GOLD); // one long hinge
}

export type ChestKind = 'wood' | 'locker' | 'canister' | 'vault';
export const CHEST_KINDS: Record<ChestKind, { name: string; base: (pb: PropBatch) => void; lid: (pb: PropBatch) => void }> = {
  wood: { name: 'Old chest', base: chestBase, lid: chestLid },
  locker: { name: 'Ammunition footlocker', base: lockerBase, lid: lockerLid },
  canister: { name: 'Sealed canister', base: canisterBase, lid: canisterLid },
  vault: { name: 'Armoured strongbox', base: vaultBase, lid: vaultLid },
};
/** Which case a chest is: the three military designs in turn by hash, the wooden chest about one time in fourteen. */
export function chestKind(...seed: number[]): ChestKind {
  const h = hash(...seed, 0xc4e57);
  return h % 14 === 0 ? 'wood' : (['locker', 'canister', 'vault'] as const)[(h >>> 4) % 3];
}
