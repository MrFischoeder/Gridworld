// The wall-walk of a palisade or a stone wall (gen/village.ts `WalkRun`): a plank deck along the inside of the wall,
// reached by ladders (world/ladders.ts, `Ladder.walk`). On it you stand with your chest over the wall and shoot over
// it. The deck is a floor (G.floor), and a rail on its inner side and at its ends keeps you on it (open where a
// ladder comes up); the wall itself is the outer side.
import { WALK, type WalkRun, type Ladder } from '../gen/village';

interface Placed extends WalkRun { y0: number; L: number; ux: number; uz: number; gaps: number[] }
const sets = new Map<number, Placed[]>();
let all: Placed[] = [];

/** A village was loaded / dropped: its wall-walk comes and goes with it. */
export function setWalkways(id: number, runs: WalkRun[], ladders: Ladder[], y0: number) {
  sets.set(id, runs.map((r) => {
    const L = Math.hypot(r.x1 - r.x0, r.z1 - r.z0), ux = (r.x1 - r.x0) / L, uz = (r.z1 - r.z0) / L;
    // where along the run each ladder comes up (a gap in the rail)
    const gaps = ladders.filter((l) => Math.abs((l.x - r.x0) * r.nx + (l.z - r.z0) * r.nz - (WALK.in1 + 0.05)) < 0.2)
      .map((l) => (l.x - r.x0) * ux + (l.z - r.z0) * uz).filter((a) => a > -0.5 && a < L + 0.5);
    return { ...r, y0, L, ux, uz, gaps };
  }));
  all = [...sets.values()].flat();
}
export function dropWalkways(id: number) { sets.delete(id); all = [...sets.values()].flat(); }

/** Point (x, z) in a run's frame: along it and inwards from the wall line. */
const frame = (w: Placed, x: number, z: number) => ({ a: (x - w.x0) * w.ux + (z - w.z0) * w.uz, o: (x - w.x0) * w.nx + (z - w.z0) * w.nz });
/** The deck under (x, z) you can stand on from height y. */
export function walkFloor(x: number, y: number, z: number): number {
  let best = -Infinity;
  for (const w of all) {
    const top = w.y0 + w.h;
    if (y < top - 0.6) continue;
    const { a, o } = frame(w, x, z);
    if (a >= -0.05 && a <= w.L + 0.05 && o >= WALK.in0 - 0.6 && o <= WALK.in1 + 0.05) best = Math.max(best, top);
  }
  return best;
}
/** The rail along the deck's inner edge and across its ends (up at deck height only). */
export function walkHit(x: number, y: number, z: number, r: number): boolean {
  for (const w of all) {
    const top = w.y0 + w.h;
    if (y < top - 0.3 || y > top + 1.6) continue;
    const { a, o } = frame(w, x, z);
    if (a < -r - 0.1 || a > w.L + r + 0.1 || o < WALK.in0 - 0.8 || o > WALK.in1 + r + 0.05) continue;
    if (Math.abs(o - WALK.in1) < r && a > 0 && a < w.L && !w.gaps.some((g) => Math.abs(a - g) < 0.45)) return true; // the inner rail
    if ((a < r && a > -r) || (a > w.L - r && a < w.L + r)) if (o > WALK.in0 - 0.6 && o < WALK.in1) return true; // the ends
  }
  return false;
}
