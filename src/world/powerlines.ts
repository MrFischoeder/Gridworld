// (0.219, PLAN_PRAD_I_LUDZIE.md stage Z5) Power lines in the world: the game's side of gen/grid.ts's lines (each village's
// balance without its line, and what its line brings in, both read from the shared `towns` and `outposts`), and the
// poles and cable drawn between an outpost (or a port) and its village: yellow stakes while staked out, poles rising
// from the outpost's end while the builders are at it, the cable strung when it stands.
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { G } from '../game';
import { OW } from './overworld';
import { allVillages, villageSeed, nearX, type Poi } from '../gen/regions';
import { balance, setLineHook } from '../gen/energy';
import { setLineBalance, clearLineMemo, lineInto, linePoles, type PowerLine } from '../gen/grid';
import { jobEnd, type OutpostState } from '../gen/outposts';

const NEAR = 700, DROP = 850, POLE = 8.5, ARM = 1.1, SAG = 0.7;
const WOOD = 0xc8a060, STAKE = 0xffd060, WIRE = 0xb8d0a0, GLASS = 0x9dffe0;
interface Live { id: string; g: THREE.Group; sig: string; ox: number }
const live = new Map<string, Live>();
let tick = 0, world: number | null = null, byId = new Map<number, Poi>();

/** Hook the lines up to the world being played (the village balances and the lines' flows read the shared state). */
function register(w: number) {
  world = w; byId = new Map(allVillages(w).map((v) => [v.id, v]));
  setLineBalance((vid, t) => { const v = byId.get(vid); return v ? balance(w, v, villageSeed(w, v), G.char.towns[vid], t, true) : null; });
  setLineHook((wd, vid, t) => (wd === w ? lineInto(wd, G.char.outposts, vid, t) : 0));
}
const shareOf = (o: OutpostState) => (o.done?.pline ? 1 : o.job?.p === 'pline' ? Math.max(0, Math.min(1, 1 - (jobEnd(o) - G.char.time) / (o.job.h * 60))) : 0);
const sigOf = (o: OutpostState) => `${o.pl?.v}|${o.done?.pline ? 1 : 0}|${Math.floor(shareOf(o) * 40)}`;
/** The nearest point of the line's straight way to the player (m). */
function distTo(o: OutpostState, l: PowerLine): number {
  const ax = nearX(o.x, G.pos.x), bx = nearX(l.x, ax), dx = bx - ax, dz = l.z - o.z, L2 = dx * dx + dz * dz || 1;
  const s = Math.max(0, Math.min(1, ((G.pos.x - ax) * dx + (G.pos.z - o.z) * dz) / L2));
  return Math.hypot(ax + dx * s - G.pos.x, o.z + dz * s - G.pos.z);
}
function build(id: string, o: OutpostState): Live {
  const T = OW.terrain!, l = o.pl!, ox = nearX(o.x, G.pos.x), sh = ox - o.x, poles = linePoles(o, l), up = o.done?.pline ? poles.length : Math.floor(poles.length * shareOf(o));
  const g = new THREE.Group(), pb = new PropBatch(), y0 = T.heightAt(ox, o.z);
  const dx = poles[poles.length - 1][0] - poles[0][0], dz = poles[poles.length - 1][1] - poles[0][1], d = Math.hypot(dx, dz) || 1, ax = -dz / d, az = dx / d; // across the line
  const tops: [number, number, number][][] = [];
  poles.forEach(([px, pz], i) => {
    const x = px + sh - ox, z = pz - o.z, y = T.heightAt(px + sh, pz) - y0;
    if (i >= up) { pb.box(x - 0.06, y, z - 0.06, x + 0.06, y + 1, z + 0.06, STAKE); return; } // a stake where a pole will stand
    pb.box(x - 0.13, y, z - 0.13, x + 0.13, y + POLE, z + 0.13, WOOD);
    const yt = y + POLE - 0.5;
    pb.box(x - ax * ARM - 0.06, yt - 0.08, z - az * ARM - 0.06, x + ax * ARM + 0.06, yt + 0.08, z + az * ARM + 0.06, WOOD); // the crossarm
    pb.seg(WOOD, [x, yt - 1.1, z], [x + ax * 0.7, yt, z + az * 0.7]); pb.seg(WOOD, [x, yt - 1.1, z], [x - ax * 0.7, yt, z - az * 0.7]); // braces
    const t: [number, number, number][] = [-0.9, 0, 0.9].map((k) => [x + ax * k, yt + 0.32, z + az * k]);
    for (const [tx, ty, tz] of t) pb.box(tx - 0.05, ty - 0.3, tz - 0.05, tx + 0.05, ty, tz + 0.05, GLASS); // insulators
    tops.push(t);
  });
  if (o.done?.pline || up > 1) for (let i = 1; i < tops.length; i++) for (let k = 0; k < 3; k++) { // the cable: three wires sagging between the poles
    const [a, b] = [tops[i - 1][k], tops[i][k]], pts: number[][] = [];
    for (let s = 0; s <= 4; s++) { const f = s / 4; pts.push([a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f - SAG * 4 * f * (1 - f), a[2] + (b[2] - a[2]) * f]); }
    for (let s = 1; s < pts.length; s++) pb.seg(WIRE, pts[s - 1], pts[s]);
  }
  g.add(pb.build()); g.position.set(ox, y0, o.z); scene.add(g);
  return { id, g, sig: sigOf(o), ox };
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((q) => (q as THREE.Mesh).geometry?.dispose()); }
export function dropPowerLines() { for (const L of live.values()) drop(L); live.clear(); }

/** Main loop, twice a second: the hooks for this world, the flows worked out afresh, the lines within reach drawn. */
export function updatePowerLines(dt: number) {
  const c = G.char;
  if (world !== c.world) register(c.world);
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  clearLineMemo(); // the shared state may have changed since
  if (!OW.terrain || c.loc !== 'overworld') { if (live.size) dropPowerLines(); return; }
  const seen = new Set<string>();
  for (const [id, o] of Object.entries(c.outposts)) {
    if (!o?.pl || !o.k || distTo(o, o.pl) > (live.has(id) ? DROP : NEAR)) continue;
    seen.add(id);
    const L = live.get(id), ox = nearX(o.x, G.pos.x);
    if (L && L.sig === sigOf(o) && L.ox === ox) continue;
    if (L) drop(L);
    live.set(id, build(id, o));
  }
  for (const [id, L] of live) if (!seen.has(id)) { drop(L); live.delete(id); }
}
