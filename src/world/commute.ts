// (0.220, PLAN_PRAD_I_LUDZIE.md stage Z6) The commuters in the world: once a second the game works out, from the shared
// `towns`, how many of each settlement's free people walk out to the outposts that asked (gen/commute.ts), and hands
// gen/outpostlife.ts the count per outpost; a few of them are drawn on their way between the village and the outpost.
import { scene } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { makeFigure, type Figure } from './npc';
import { poseRig } from './rig';
import { setCommuteHook } from '../gen/outpostlife';
import { commutersAt } from '../gen/commute';
import { allVillages, nearX } from '../gen/regions';
import type { OutpostState } from '../gen/outposts';

let tick = 0, world: number | null = null, phase = 0;
const count = new Map<OutpostState, number>();
interface Walker { f: Figure; ax: number; az: number; bx: number; bz: number; s: number; v: number }
const walkers = new Map<string, Walker[]>();

function recount() {
  const c = G.char;
  count.clear();
  for (const [id, o] of Object.entries(c.outposts)) { if (!o?.k) continue; const n = commutersAt(c.world, c.towns, id, c.time).got; if (n) count.set(o, n); }
}
function dropWalkers(id?: string) {
  for (const [k, list] of walkers) if (!id || k === id) { for (const w of list) scene.remove(w.f.g); walkers.delete(k); }
}
export const dropCommuters = () => dropWalkers();
/** Main loop: the counts once a second; the walkers on the paths near you every frame. */
export function updateCommute(dt: number) {
  const c = G.char;
  if (world !== c.world) { world = c.world; setCommuteHook((o) => count.get(o) ?? 0); count.clear(); }
  phase += dt;
  const T = OW.terrain;
  for (const list of walkers.values()) for (const w of list) {
    w.s = (w.s + w.v * dt) % 2; const f = w.s < 1 ? w.s : 2 - w.s, x = w.ax + (w.bx - w.ax) * f, z = w.az + (w.bz - w.az) * f;
    w.f.g.position.set(x, T ? T.heightAt(x, z) : 0, z); w.f.g.rotation.y = Math.atan2(w.bx - w.ax, w.bz - w.az) + (w.s < 1 ? 0 : Math.PI);
    poseRig(w.f.rig, { swing: Math.sin(phase * 6 + w.v * 50) * 0.6 });
  }
  if ((tick -= dt) > 0) return;
  tick = 1;
  recount();
  if (!T || c.loc !== 'overworld') { dropWalkers(); return; }
  const vs = allVillages(c.world), seen = new Set<string>();
  for (const [id, o] of Object.entries(c.outposts)) {
    const n = o ? count.get(o) ?? 0 : 0;
    if (!n) continue;
    const r = commutersAt(c.world, c.towns, id, c.time), v = vs.find((q) => q.id === r.v);
    if (!v) continue;
    const ax = nearX(v.x, G.pos.x), bx = nearX(o.x, ax), mx = (ax + bx) / 2, mz = (v.z + o.z) / 2;
    if (Math.hypot(mx - G.pos.x, mz - G.pos.z) > Math.hypot(bx - ax, o.z - v.z) / 2 + 400) continue;
    seen.add(id);
    const want = Math.min(3, Math.ceil(n / 2)), have = walkers.get(id) ?? [];
    if (have.length === want && have[0]?.ax === ax) continue;
    dropWalkers(id);
    const d = Math.hypot(bx - ax, o.z - v.z) || 1, list: Walker[] = [];
    for (let i = 0; i < want; i++) { // from the village's edge to the outpost's, walking at ~1.4 m/s, spread along the way
      const f = makeFigure(0xdce8ff, i % 2 ? 'hammer' : 'pick'); scene.add(f.g);
      list.push({ f, ax: ax + (bx - ax) * 60 / d, az: v.z + (o.z - v.z) * 60 / d, bx: bx - (bx - ax) * 30 / d, bz: o.z - (o.z - v.z) * 30 / d, s: (i / want) * 2, v: 1.4 / Math.max(50, d - 90) });
    }
    walkers.set(id, list);
  }
  for (const id of [...walkers.keys()]) if (!seen.has(id)) dropWalkers(id);
}
