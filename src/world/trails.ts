// Markers along the mountain trails (gen/trails.ts): a signpost at the trailhead, cairns (stacked stones) beside the
// way every ~60 m, and a cairn with a pole and pennant on the summit. Drawn into the chunk's PropBatch.
import type { PropBatch } from './props';
import type { Road } from '../gen/roads';
import type { Terrain } from '../gen/terrain';
import { CHUNK } from '../gen/regions';

const STONE = 0xa8c8b0, POST = 0xb8b060, PENNANT = 0xffd060;
export interface TrailMark { kind: 'head' | 'cairn' | 'summit'; x: number; z: number; dir: number; name: string }
/** The markers of these trails that stand in the chunk starting at (x0, z0). */
export function trailMarks(trails: Road[], x0: number, z0: number): TrailMark[] {
  const out: TrailMark[] = [], inside = (x: number, z: number) => x >= x0 && x < x0 + CHUNK && z >= z0 && z < z0 + CHUNK;
  for (const r of trails) {
    const p = r.pts, n = p.length, dir = (i: number) => Math.atan2(p[Math.min(n - 1, i + 1)][1] - p[Math.max(0, i - 1)][1], p[Math.min(n - 1, i + 1)][0] - p[Math.max(0, i - 1)][0]);
    // the signpost stands beside the start, facing up the trail
    const hd = dir(0), hx = p[0][0] - Math.sin(hd) * (r.half + 1.2), hz = p[0][1] + Math.cos(hd) * (r.half + 1.2);
    if (inside(hx, hz)) out.push({ kind: 'head', x: hx, z: hz, dir: hd, name: r.name ?? '' });
    for (let i = 7; i < n - 2; i += 7) {
      const d = dir(i), side = i % 14 ? 1 : -1, x = p[i][0] - Math.sin(d) * (r.half + 1) * side, z = p[i][1] + Math.cos(d) * (r.half + 1) * side;
      if (inside(x, z)) out.push({ kind: 'cairn', x, z, dir: d, name: '' });
    }
    const [sx, sz] = p[n - 1];
    if (inside(sx, sz)) out.push({ kind: 'summit', x: sx, z: sz, dir: dir(n - 1), name: r.name ?? '' });
  }
  return out;
}
export function drawTrailMark(pb: PropBatch, m: TrailMark, T: Terrain) {
  const y = T.heightAt(m.x, m.z);
  const cairn = (s: number) => {
    pb.rock(m.x, y - 0.1, m.z, 0.5 * s, 0.45 * s, 6, m.dir, STONE);
    pb.rock(m.x + 0.05, y + 0.3 * s, m.z - 0.04, 0.34 * s, 0.35 * s, 5, m.dir + 1, STONE);
    pb.rock(m.x - 0.03, y + 0.58 * s, m.z + 0.02, 0.2 * s, 0.25 * s, 5, m.dir + 2, STONE);
  };
  if (m.kind === 'cairn') { cairn(1); return; }
  const c = Math.cos(m.dir), s = Math.sin(m.dir);
  if (m.kind === 'head') {
    // a post with a board pointing up the trail
    pb.box(m.x - 0.07, y, m.z - 0.07, m.x + 0.07, y + 2.2, m.z + 0.07, POST);
    const bx = m.x + c * 0.45, bz = m.z + s * 0.45, hw = 0.55, hh = 0.18;
    pb.solid8(
      [[bx - c * hw, y + 1.75 - hh, bz - s * hw], [bx + c * hw, y + 1.75 - hh, bz + s * hw], [bx + c * hw + s * 0.04, y + 1.75 - hh, bz + s * hw - c * 0.04], [bx - c * hw + s * 0.04, y + 1.75 - hh, bz - s * hw - c * 0.04]],
      [[bx - c * hw, y + 1.75 + hh, bz - s * hw], [bx + c * hw, y + 1.75 + hh, bz + s * hw], [bx + c * hw + s * 0.04, y + 1.75 + hh, bz + s * hw - c * 0.04], [bx - c * hw + s * 0.04, y + 1.75 + hh, bz - s * hw - c * 0.04]], POST);
    pb.line(PENNANT, [bx + c * (hw + 0.2), y + 1.75, bz + s * (hw + 0.2)], [bx + c * hw, y + 1.75 + hh, bz + s * hw]);
    pb.line(PENNANT, [bx + c * (hw + 0.2), y + 1.75, bz + s * (hw + 0.2)], [bx + c * hw, y + 1.75 - hh, bz + s * hw]);
    return;
  }
  // the summit: a big cairn, a pole and a pennant
  cairn(1.8);
  pb.box(m.x - 0.05, y + 0.9, m.z - 0.05, m.x + 0.05, y + 4, m.z + 0.05, POST);
  pb.line(PENNANT, [m.x, y + 3.95, m.z], [m.x + 1.2, y + 3.6, m.z + 0.15], [m.x, y + 3.25, m.z]);
}
