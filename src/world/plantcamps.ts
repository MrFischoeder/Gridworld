// (0.218, PLAN_PRAD_I_LUDZIE.md stage Z4) The crew camps at the old plants in the world: the crew rule handed to
// gen/installs.ts for the world being played, and each camp drawn within reach (its board, the bunkhouses and fields
// built or going up, the settlers on the fields and the crew at the plant). The camp's builds are finished by
// world/ports.ts (`finishPorts`, every port and camp) and managed at the plant's control desk (ui/install.ts).
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { textSprite, makeFigure, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { G } from '../game';
import { OW } from './overworld';
import { nearX } from '../gen/regions';
import { setCrewRule, installSitesReady } from '../gen/installs';
import { crewRuleFor, campId } from '../gen/plantcamps';
import { crews, lifeNow } from '../gen/outpostlife';
import { drawBunks, drawField, type DrawInto } from './lodes';
import { tl } from '../i18n';

const NEAR = 600, DROP = 720;
const WOOD = 0xc8a060, STAKE = 0xffd060;
interface Hand { f: Figure; x: number; z: number; face: number; phase: number }
interface Live extends DrawInto { id: string; sig: string; ox: number; oy: number; oz: number; hands: Hand[] }
const live = new Map<string, Live>();
let tick = 0, ruleWorld: number | null = null;

function sigOf(id: string): string {
  const o = G.char.outposts[id];
  return JSON.stringify([o?.n ?? {}, o?.job?.p ?? '', o?.job ? Math.floor((G.char.time - o.job.t) / (o.job.h * 6)) : 0, o?.life ? Math.floor(lifeNow(G.char.world, o, G.char.time).n) : 0]);
}
function build(id: string, ox: number, oz: number): Live {
  const T = OW.terrain!, o = G.char.outposts[id], sp = o.ps!, sh = ox - o.x, oy = T.heightAt(ox, oz);
  const H = (x: number, z: number) => T.heightAt(ox + x, oz + z) - oy, loc = (q: [number, number]): [number, number] => [q[0] + sh - ox, q[1] - oz];
  const g = new THREE.Group(), pb = new PropBatch(), L: Live = { id, g, rings: [], boxes: [], sig: sigOf(id), ox, oy, oz, hands: [] };
  const share = o.job ? Math.min(1, (G.char.time - o.job.t) / (o.job.h * 60)) : 0;
  const site = (cx: number, cz: number, w: number, d: number) => { // a building site: stakes, lines, a frame rising
    const y = H(cx, cz), c = [[cx - w, cz - d], [cx + w, cz - d], [cx + w, cz + d], [cx - w, cz + d]], top = y + 0.5 + 4 * share;
    for (const [x, z] of c) { pb.box(x - 0.06, H(x, z), z - 0.06, x + 0.06, H(x, z) + 1, z + 0.06, STAKE); pb.seg(WOOD, [x, y, z], [x, top, z]); }
    pb.line(WOOD, [c[0][0], top, c[0][1]], [c[1][0], top, c[1][1]], [c[2][0], top, c[2][1]], [c[3][0], top, c[3][1]], [c[0][0], top, c[0][1]]);
  };
  { const [x, z] = loc(sp.house), y = H(x, z);
    pb.box(x - 0.08, y, z - 0.08, x + 0.08, y + 2.2, z + 0.08, WOOD); pb.box(x - 0.7, y + 1.4, z - 0.05, x + 0.7, y + 2.1, z + 0.05, WOOD);
    const s = textSprite(tl('CREW CAMP'), '#ffd060', 2.2); s.position.set(x, y + 2.6, z); g.add(s); L.rings.push([x, z, 0.3]); }
  const nb = o.n?.bunks ?? 0, nf = o.n?.field ?? 0;
  sp.bunks.forEach((q, i) => { const [x, z] = loc(q); if (i < nb) drawBunks(pb, H, L, x, z); else if (i === nb && o.job?.p === 'bunks') site(x, z, 4, 2); });
  sp.fields.forEach((q, i) => { const [x, z] = loc(q); if (i < nf) drawField(pb, H, x, z, i); else if (i === nf && o.job?.p === 'field') site(x, z, 2, 2); });
  if (o.life) { // the settlers: hoes on the fields, the crew at the plant with hammers, the idle by a bunkhouse
    const w = crews(o, lifeNow(G.char.world, o, G.char.time).n), put = (x: number, z: number, kit: Kit, face: number, i: number) => {
      if (L.hands.length >= 14) return;
      const f = makeFigure(0xdce8ff, kit); g.add(f.g); L.hands.push({ f, x, z, face, phase: i * 0.37 });
    };
    for (let i = 0; i < w.farm; i++) { const [fx, fz] = loc(sp.fields[Math.floor(i / 3)]), x = fx - 4 + (i % 3) * 4, z = fz + (i % 2 ? 2 : -2); put(x, z, 'hoe', (i % 2) * Math.PI, i); }
    const [bx, bz] = loc(sp.house);
    for (let i = 0; i < w.dig; i++) { const a = i / Math.max(1, w.dig) * 6.283, x = bx * 0.8 + Math.cos(a) * 4, z = bz * 0.8 + Math.sin(a) * 4; put(x, z, 'hammer', Math.atan2(-x, -z), i); }
    for (let i = 0; i < w.idle; i++) { const [ux, uz] = loc(sp.bunks[0]), x = ux - 2 + i * 1.3, z = uz + 3.6; put(x, z, 'none', 0, i); }
  }
  g.add(pb.build()); g.position.set(ox, oy, oz); scene.add(g);
  return L;
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((q) => (q as THREE.Mesh).geometry?.dispose()); }
export function dropCamps() { for (const L of live.values()) drop(L); live.clear(); }

/** Main loop: the crew rule for this world; the camps within reach drawn twice a second; the people posed each frame. */
export function updateCamps(dt: number) {
  const c = G.char;
  if (ruleWorld !== c.world) { ruleWorld = c.world; setCrewRule(crewRuleFor(c.world, () => G.char.outposts)); }
  const T = OW.terrain;
  if (!T || c.loc !== 'overworld') { if (live.size) dropCamps(); return; }
  for (const L of live.values()) for (const h of L.hands) { h.phase += dt; poseRig(h.f.rig, { swing: 0, strike: (h.phase * 0.85) % 1 }); h.f.g.position.set(h.x, T.heightAt(L.ox + h.x, L.oz + h.z) - L.oy, h.z); h.f.g.rotation.y = h.face; }
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const sites = installSitesReady(c.world) ?? [], seen = new Set<string>();
  for (const s of sites) {
    const id = campId(s.k), o = c.outposts[id];
    if (!o?.ps) continue;
    const ox = nearX(o.x, G.pos.x);
    if (Math.hypot(ox - G.pos.x, o.z - G.pos.z) > NEAR) continue;
    seen.add(id);
    const L = live.get(id);
    if (L && L.sig === sigOf(id) && L.ox === ox) continue;
    if (L) drop(L);
    live.set(id, build(id, ox, o.z));
  }
  for (const [id, L] of live) if (!seen.has(id) || Math.hypot(L.ox - G.pos.x, L.oz - G.pos.z) > DROP) { drop(L); live.delete(id); }
}
/** The camps' bunkhouses and boards (G.obstacle). */
export function campHit(px: number, py: number, pz: number, r: number): boolean {
  for (const L of live.values()) {
    const x = px - L.ox, z = pz - L.oz;
    if (py > L.oy + 30) continue;
    for (const [cx, cz, cr] of L.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    for (const [x0, z0, x1, z1] of L.boxes) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  }
  return false;
}
