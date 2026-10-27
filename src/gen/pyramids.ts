// (0.275, the owner's request) The stepped pyramids of the old builders, in the manner of the Aztec and Maya temple
// mountains: stacked terraces, a great staircase up a face between two balustrades, and a shrine on the top whose
// door is the way into the pyramid (a labyrinth below, world/level.ts `enterPyramid`). Five of them stand among the
// megaliths (gen/megaliths.ts appends their designs, so the older sites keep their places): the Feathered Serpent
// (nine terraces, a stair up every face, serpent heads at the stairs' feet), the Devoured Sun (five broad terraces of
// sloping and upright panels), the Twin Shrines (two stairs, two shrines on the top), the Jaguar Spire (steep and
// tall, a pierced roof comb over its shrine) and the Pale Moon.
//
// Pure, in the megaliths' plan units (gen/megaliths.ts scales them). The site's frame: the main stair climbs the +z
// face (from far out towards the middle), the shrines' doors face +z.

export type PyramidLayout = 'serpent' | 'sun' | 'twin' | 'spire' | 'moon';
/** A terrace: half sizes at its foot, its foot's height and its height; `bat` = how far its top is set in (the batter). */
export interface PyrTier { hx: number; hz: number; y: number; h: number; bat: number }
/**
 * A staircase up a face (0 +z, 1 +x, 2 −z, 3 −x), `off` across the face from its middle, `w` wide (balustrades
 * included), from the ground at `u0` out from the middle to the top terrace (`top` high) at `u1`.
 */
export interface PyrStair { face: number; off: number; w: number; u0: number; u1: number; top: number }
/** A shrine on the top: its middle, half sizes, floor height, wall height, door (width, height), roof kind and comb. */
export interface PyrShrine { x: number; z: number; hx: number; hz: number; y: number; h: number; door: number; doorH: number; roof: 'flat' | 'stepped' | 'comb'; comb: number }
export interface PyramidPlan { layout: PyramidLayout; tiers: PyrTier[]; stairs: PyrStair[]; shrines: PyrShrine[]; body: number; panels: 'framed' | 'talud' | 'plain'; serpents: boolean }

/** Sizes in plan units: the walls' thickness, the balustrades' width and how far above the treads they stand, a step's rise. */
export const PYR = { wall: 2.6, rail: 2.4, railH: 1.5, step: 0.86, roof: 3 };

interface Spec { n: number; bx: number; bz: number; tx: number; tz: number; body: number; faces: number[]; offs: number[]; w: number; shrines: Omit<PyrShrine, 'y'>[]; panels: PyramidPlan['panels']; serpents?: boolean }
function spec(layout: PyramidLayout, height: number, n: number): Spec {
  const s = (x: number, z: number, hx: number, hz: number, h: number, roof: PyrShrine['roof'] = 'flat', comb = 0): Omit<PyrShrine, 'y'> => ({ x, z, hx, hz, h, door: 6, doorH: 10, roof, comb });
  switch (layout) {
    case 'serpent': return { n, bx: 82, bz: 82, tx: 22, tz: 22, body: height * 0.76, faces: [0, 1, 2, 3], offs: [0], w: 18, shrines: [s(0, 0, 14, 13, 17)], panels: 'framed', serpents: true };
    case 'sun': return { n, bx: 88, bz: 88, tx: 40, tz: 40, body: height * 0.8, faces: [0], offs: [0], w: 24, shrines: [s(0, -4, 16, 12, 15)], panels: 'talud' };
    case 'twin': return { n, bx: 86, bz: 70, tx: 44, tz: 28, body: height * 0.78, faces: [0], offs: [-19, 19], w: 14, shrines: [s(-19, -2, 14, 12, 16, 'stepped'), s(19, -2, 14, 12, 16)], panels: 'framed' };
    case 'spire': return { n, bx: 50, bz: 50, tx: 16, tz: 16, body: height * 0.6, faces: [0], offs: [0], w: 12, shrines: [s(0, -1, 12, 9, 15, 'comb', height * 0.2)], panels: 'plain' };
    case 'moon': return { n, bx: 76, bz: 76, tx: 30, tz: 30, body: height * 0.8, faces: [0], offs: [0], w: 20, shrines: [s(0, -3, 14, 11, 14)], panels: 'talud' };
  }
}
/** The pyramid of a design (its layout, total height and number of terraces), in plan units. */
export function pyramidPlan(layout: PyramidLayout, height: number, n: number): PyramidPlan {
  const p = spec(layout, height, n), h = p.body / p.n, sx = (p.bx - p.tx) / (p.n - 1), sz = (p.bz - p.tz) / (p.n - 1), bat = Math.min(sx, sz) * 0.22;
  const tiers: PyrTier[] = Array.from({ length: p.n }, (_, i) => ({ hx: p.bx - i * sx, hz: p.bz - i * sz, y: i * h, h, bat }));
  // a stair starts 1.3 setbacks out from the foot, so its slope stays above every terrace's edge (they only meet at the top)
  const stairs: PyrStair[] = [];
  // and it reaches the top where the top terrace's walkable surface begins (inside its batter)
  const plan0: PyramidPlan = { layout, tiers, stairs: [], shrines: [], body: p.body, panels: p.panels, serpents: !!p.serpents };
  const [ttx, ttz] = tierTop(plan0, tiers[tiers.length - 1]);
  for (const face of p.faces) for (const off of p.offs) {
    const along = face % 2 === 0, B = along ? p.bz : p.bx, s = along ? sz : sx;
    stairs.push({ face, off, w: p.w, u0: B + 1.3 * s, u1: along ? ttz : ttx, top: p.body });
  }
  return { layout, tiers, stairs, shrines: p.shrines.map((q) => ({ ...q, y: p.body })), body: p.body, panels: p.panels, serpents: !!p.serpents };
}
/** Outward and across a face (unit vectors in the site's plan frame). */
export const faceAxes = (face: number): [[number, number], [number, number]] => {
  const n: [number, number] = [[0, 1], [1, 0], [0, -1], [-1, 0]][face % 4] as [number, number];
  return [n, [n[1], -n[0]]];
};
/** A point on a face: `u` out from the middle, `a` across, at height y (plan units). */
export function facePoint(face: number, u: number, a: number, y: number): [number, number, number] {
  const [n, t] = faceAxes(face); return [n[0] * u + t[0] * a, y, n[1] * u + t[1] * a];
}
/** A stair's height over the ground `u` out from the middle (0 beyond its foot, `top` at its head). */
export const stairHeight = (s: PyrStair, u: number) => s.top * Math.max(0, Math.min(1, (s.u0 - u) / (s.u0 - s.u1)));
/** The walkable top of a terrace (half sizes): set in by its batter, or for sloping-and-upright panels to the overhanging upright. */
export function tierTop(p: PyramidPlan, t: PyrTier): [number, number] {
  const k = p.panels === 'talud' ? 1.6 * t.bat - 1.1 : t.bat;
  return [t.hx - k, t.hz - k];
}
