// (0.216, PLAN_PRAD_I_LUDZIE.md stage Z2) The ports in the world: drawn behind their docks within reach (the port's
// board, the warehouse with its yard and crates, the crane by the dock's root, the power source, bunkhouses and
// fields, the settlers at work), finished when their builders' time is up (whoever sees it first, the same on every
// game), and the board where E opens the port window (ui/port.ts). Everything is drawn from the shared `outposts`.
// (0.249, PLAN_MAGAZYNOW.md stage M1) The warehouses built in the wilds are drawn the same way in their own frame
// (`OutpostState.fr`), without the dock's crane, and take in what the carriers bring from their hex's deposits.
import { rackDeco } from './hall';
import { drawMast } from './radiomast';
import * as THREE from 'three';
import { scene } from './render';
import { PropBatch } from './props';
import { textSprite, makeFigure, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { G } from '../game';
import { OW } from './overworld';
import { nearX, worldDist } from '../gen/regions';
import { windAt } from '../gen/energy';
import { hash } from '../core/rng';
import { PORT, countOf, finishDue, jobEnd, partName, type OutpostState } from '../gen/outposts';
import { lodeById } from '../gen/lodes';
import { settleAll, pwOf, POWER_SRC } from '../gen/grid';
import { crews, lifeNow } from '../gen/outpostlife';
import { portSpots, portWorks, portVol, isStore, portPoint, portClaims, frameOf, type Frame } from '../gen/ports';
import { drainStore, waitingAt } from '../gen/warehouses';
import { ITEMS } from '../data/items';
import { padsChanged } from './claims';
import { settleLine, unloadLines, dueVoyages, arriving, voyageSails, shipAt, periodOf } from '../gen/shiplines';
import { showcaseBoat } from './boats';
import { SEA } from '../gen/seas';
import { PIER } from '../gen/piers';
import { BOATS } from '../gen/boats';
import { withOutpost } from '../ui/stock';
import { drawBunks, drawField, drawPowerSource, tellRaids, type DrawInto } from './lodes';
import { saveChar } from '../character';
import { showToast, logLine } from '../ui/hud';
import { tl, TL } from '../i18n';
import { runHub } from './hublines';

const NEAR = 520, DROP = 640;
const WOOD = 0xc8a060, STEEL = 0xa8c8b8, STAKE = 0xffd060, GOLD = 0xffd060;
interface Hand { f: Figure; x: number; z: number; face: number; phase: number; work: boolean; carry: boolean }
interface Live extends DrawInto { id: string; p: Frame; sig: string; ox: number; oy: number; oz: number; hands: Hand[]; jib?: THREE.Object3D; board: [number, number]; works: boolean }
const live = new Map<string, Live>();
let tick = 0;

/** The frame of a port (its dock, the saved one) or of a wild warehouse, and the same on your copy of the planet. */
const pierOf = (o: OutpostState) => frameOf(o, G.char.piers);
const onMyCopy = (p: Frame): Frame => ({ ...p, x: nearX(p.x, G.pos.x) });
/** Dry ground (no water over it) for the port's pieces. */
export const dryAt = (x: number, z: number) => { const w = OW.terrain?.water(x, z); return !w || w.depth < 0.05; };

function sigOf(id: string, o: OutpostState): string {
  const L = o.life ? Math.floor(lifeNow(G.char.world, o, G.char.time).n) : 0, w = portWorks(G.char.world, G.char.outposts, id, G.char.time).why;
  return JSON.stringify([o.done ?? {}, o.n ?? {}, o.job?.p ?? '', o.pk ?? '', o.job ? Math.floor((G.char.time - o.job.t) / (o.job.h * 6)) : 0, Math.floor(portVol(o) / 300), L, w, JSON.stringify(o.racks ?? {})]);
}
function build(id: string, o: OutpostState, p: Frame): Live {
  const T = OW.terrain!, saved = pierOf(o), sh = saved ? p.x - saved.x : 0, raw = o.ps ?? portSpots(saved ?? p, dryAt), mv = (q: [number, number]): [number, number] => [q[0] + sh, q[1]];
  const sp = { house: mv(raw.house), crane: mv(raw.crane), power: mv(raw.power), bunks: raw.bunks.map(mv), fields: raw.fields.map(mv) }, [hx, hz] = sp.house, oy = T.heightAt(hx, hz);
  const H = (x: number, z: number) => T.heightAt(hx + x, hz + z) - oy, loc = (x: number, z: number): [number, number] => [x - hx, z - hz];
  const g = new THREE.Group(), pb = new PropBatch(), L: Live = { id, p, g, rings: [], boxes: [], sig: sigOf(id, o), ox: hx, oy, oz: hz, hands: [], board: loc(...portPoint(p, -PORT.back + 9, -8)), works: !portWorks(G.char.world, G.char.outposts, id, G.char.time).why };
  const share = o.job ? Math.min(1, (G.char.time - o.job.t) / (o.job.h * 60)) : 0;
  const site = (cx: number, cz: number, w: number, d: number, sh: number) => { // a building site: stakes, lines, a frame rising, a shrinking stack
    const y = H(cx, cz), c = [[cx - w, cz - d], [cx + w, cz - d], [cx + w, cz + d], [cx - w, cz + d]];
    for (const [x, z] of c) pb.box(x - 0.06, H(x, z), z - 0.06, x + 0.06, H(x, z) + 1, z + 0.06, STAKE);
    for (let i = 0; i < 4; i++) pb.seg(STAKE, [c[i][0], H(c[i][0], c[i][1]) + 0.5, c[i][1]], [c[(i + 1) % 4][0], H(c[(i + 1) % 4][0], c[(i + 1) % 4][1]) + 0.5, c[(i + 1) % 4][1]]);
    const top = y + 0.5 + 4 * sh;
    for (const [x, z] of c) pb.seg(WOOD, [x, y, z], [x, top, z]);
    pb.line(WOOD, [c[0][0], top, c[0][1]], [c[1][0], top, c[1][1]], [c[2][0], top, c[2][1]], [c[3][0], top, c[3][1]], [c[0][0], top, c[0][1]]);
    pb.box(cx + w + 0.6, y, cz - 1, cx + w + 1.8, y + 0.9 * (1 - sh) + 0.2, cz + 1, WOOD);
  };
  // the port's board
  { const [x, z] = L.board, y = H(x, z);
    pb.box(x - 0.08, y, z - 0.08, x + 0.08, y + 2.2, z + 0.08, WOOD); pb.box(x - 0.7, y + 1.4, z - 0.05, x + 0.7, y + 2.1, z + 0.05, WOOD);
    const s = textSprite(o.name.toUpperCase(), '#2ac8b0', 2.4); s.position.set(x, y + 2.6, z); g.add(s); L.rings.push([x, z, 0.3]); }
  // the warehouse, its yard and the crane
  const P = (a: number, b: number) => loc(...portPoint(p, a, b)), B = PORT.back;
  if (o.job?.p === 'port') { const [x, z] = P(-B, 0); site(x, z, 6, 6, share); }
  else if (o.done?.port) {
    const ys = [[-B - 6, -8], [-B - 6, 8], [-B + 6, -8], [-B + 6, 8]].map(([a, b]) => { const [x, z] = P(a, b); return H(x, z); });
    const y0 = Math.min(...ys) - 0.4, yF = Math.max(...ys), eave = yF + 4.5, ridge = eave + 2.4;
    const V = (a: number, b: number, y: number) => { const [x, z] = P(a, b); return [x, y, z]; };
    const wall = (a0: number, b0: number, a1: number, b1: number) => { pb.face(V(a0, b0, y0), V(a1, b1, y0), V(a1, b1, eave), V(a0, b0, eave)); pb.line(WOOD, V(a0, b0, eave), V(a1, b1, eave)); pb.seg(WOOD, V(a0, b0, y0), V(a0, b0, eave)); };
    wall(-B - 6, -8, -B - 6, 8); wall(-B - 6, 8, -B + 6, 8); wall(-B + 6, -8, -B - 6, -8);
    wall(-B + 6, 8, -B + 6, 2.6); wall(-B + 6, -2.6, -B + 6, -8);
    pb.face(V(-B + 6, 2.6, yF + 4), V(-B + 6, -2.6, yF + 4), V(-B + 6, -2.6, eave), V(-B + 6, 2.6, eave)); // over the doorway
    pb.line(STAKE, V(-B + 6.01, 2.6, y0 + 0.4), V(-B + 6.01, 2.6, yF + 4), V(-B + 6.01, -2.6, yF + 4), V(-B + 6.01, -2.6, y0 + 0.4));
    for (const a of [-B - 6, -B + 6]) { pb.face(V(a, -8, eave), V(a, 8, eave), V(a, 0, ridge)); pb.line(WOOD, V(a, -8, eave), V(a, 0, ridge), V(a, 8, eave)); } // gables
    for (const sg of [-1, 1]) { pb.face(V(-B - 6.4, sg * 8.4, eave - 0.2), V(-B + 6.4, sg * 8.4, eave - 0.2), V(-B + 6.4, 0, ridge), V(-B - 6.4, 0, ridge)); pb.line(WOOD, V(-B - 6.4, sg * 8.4, eave - 0.2), V(-B + 6.4, sg * 8.4, eave - 0.2)); }
    pb.line(WOOD, V(-B - 6.4, 0, ridge), V(-B + 6.4, 0, ridge));
    if (o.done?.radio) { const [mx, my, mz] = V(-B + 4, 0, ridge); drawMast(pb, mx, my, mz); } // (0.251, stage M3)
    for (let b = -6; b <= 6; b += 3) pb.seg(WOOD, V(-B - 5.9, b, yF + 0.1), V(-B - 5.9, b, yF + 3)); // racks along the back wall
    { // (0.250) the crates and barrels on the racks: drawn in the shed's own frame (a group turned like it)
      const rg = new PropBatch(); rackDeco(rg, o.racks, 8, -5.5, yF);
      const [cx, , cz] = V(-B, 0, 0), rack = rg.build(); rack.position.set(cx, 0, cz); rack.rotation.y = Math.atan2(p.dx, p.dz); g.add(rack); }
    const sign = textSprite(o.k === 'store' ? o.name.toUpperCase() : tl('PORT WAREHOUSE'), '#ffd060', 2.2), [sx, , sz] = V(-B + 6.3, 0, 0); sign.position.set(sx, eave + 0.6, sz); g.add(sign);
    // the yard: a fence from the shed's front corners to the shore, open towards the dock
    for (const sg of [-1, 1]) for (let a = -B + 6; a < -4; a += 2.5) {
      const [x0, , z0] = V(a, sg * 10, 0), [x1, , z1] = V(Math.min(-4, a + 2.5), sg * 10, 0), y0f = H(x0, z0), y1f = H(x1, z1);
      pb.seg(WOOD, [x0, y0f, z0], [x0, y0f + 1.2, z0]); pb.seg(WOOD, [x0, y0f + 1, z0], [x1, y1f + 1, z1]); pb.seg(WOOD, [x0, y0f + 0.5, z0], [x1, y1f + 0.5, z1]);
    }
    // crates in the yard by how full the hold is
    const n = Math.min(36, Math.ceil(portVol(o) / 160));
    for (let k = 0; k < n; k++) { const a = -B + 8 + (k % 6) * 0.9, b = -8 + Math.floor(k / 12) * 1.1, [x, , z] = V(a, b, 0), y = H(x, z) + Math.floor((k % 12) / 6) * 0.65; pb.box(x - 0.34, y, z - 0.34, x + 0.34, y + 0.62, z + 0.34, GOLD); }
    if (n) { const [x0, , z0] = V(-B + 8, -8, 0), [x1, , z1] = V(-B + 13.4, -5.8, 0); L.boxes.push([Math.min(x0, x1) - 0.4, Math.min(z0, z1) - 0.4, Math.max(x0, x1) + 0.4, Math.max(z0, z1) + 0.4]); }
    // the crane: a lattice mast by the dock's root, the jib turning over the dock while it works (a port's only)
    if (o.k === 'port') { const [cx, cz] = loc(...sp.crane), cy = H(cx, cz), h = 9;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(STEEL, [cx + sx * 0.9, cy, cz + sz * 0.9], [cx + sx * 0.5, cy + h, cz + sz * 0.5]);
    for (let k = 1; k < 5; k++) { const r = 0.9 - 0.4 * k / 5, yy = cy + h * k / 5; pb.line(STEEL, [cx - r, yy, cz - r], [cx + r, yy, cz - r], [cx + r, yy, cz + r], [cx - r, yy, cz + r], [cx - r, yy, cz - r]); }
    pb.box(cx - 1.4, cy, cz - 1.4, cx + 1.4, cy + 0.5, cz + 1.4, STEEL);
    L.rings.push([cx, cz, 1.4]);
    const jp = new PropBatch(), len = 11;
    jp.line(STEEL, [0, 0, -3], [0, 0, len], [0, 1.4, 0], [0, 0, -3]); jp.seg(STEEL, [0, 1.4, 0], [0, 0, len * 0.6]);
    for (let s = 0; s < len; s += 1.5) jp.seg(STEEL, [-0.3, 0, s], [0.3, 0, s + 1.5]);
    jp.box(-0.6, -0.9, -3.2, 0.6, 0, -2.2, STEEL); // the counterweight
    jp.seg(GOLD, [0, 0, len - 1], [0, -5, len - 1]); jp.box(-0.3, -5.6, len - 1.3, 0.3, -5, len - 0.7, GOLD); // the hook and a crate on it
    const jib = jp.build(); jib.position.set(cx, cy + h + 0.3, cz); jib.rotation.y = Math.atan2(p.dx, p.dz); g.add(jib); L.jib = jib; }
  }
  // the power source
  { const [x, z] = loc(...sp.power), y = H(x, z);
    if (o.job?.p === 'power') site(x, z, 3, 3, share);
    else if (o.done?.power && o.pk) drawPowerSource(pb, H, L, o, x, z, y); }
  // the bunkhouses and the fields, the one going up as a building site
  const nb = o.n?.bunks ?? 0, nf = o.n?.field ?? 0;
  sp.bunks.forEach((q, i) => { const [x, z] = loc(...q); if (i < nb) drawBunks(pb, H, L, x, z); else if (i === nb && o.job?.p === 'bunks') site(x, z, 4, 2, share); });
  sp.fields.forEach((q, i) => { const [x, z] = loc(...q); if (i < nf) drawField(pb, H, x, z, i); else if (i === nf && o.job?.p === 'field') site(x, z, 2, 2, share); });
  // the settlers: on the fields with hoes, the warehouse crew carrying crates in the yard, idle ones by a bunkhouse
  if (o.life) {
    const w = crews(o, lifeNow(G.char.world, o, G.char.time).n), put = (x: number, z: number, kit: Kit, work: boolean, face: number, i: number) => {
      if (L.hands.length >= 12) return;
      const f = makeFigure(0xdce8ff, kit); g.add(f.g); L.hands.push({ f, x, z, face, phase: i * 0.37, work, carry: kit === 'carry' });
    };
    for (let i = 0; i < w.farm; i++) { const [fx, fz] = loc(...sp.fields[Math.floor(i / 3)]), x = fx - 4 + (i % 3) * 4, z = fz + (i % 2 ? 2 : -2); put(x, z, 'hoe', true, (i % 2) * Math.PI, i); }
    for (let i = 0; i < w.dig; i++) { const [x, z] = P(-B + 8 + i * 1.6, 2 + (i % 2) * 1.5); put(x, z, 'carry', L.works, Math.atan2(p.dx, p.dz) + (i % 2) * Math.PI, i); }
    for (let i = 0; i < w.idle; i++) { const [bx, bz] = loc(...sp.bunks[0]), x = bx - 2 + i * 1.3, z = bz + 3.6; put(x, z, 'none', false, 0, i); }
  }
  g.add(pb.build());
  g.position.set(hx, oy, hz);
  scene.add(g);
  return L;
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
export function dropPorts() { for (const L of live.values()) drop(L); live.clear(); for (const L of lineShips.values()) scene.remove(L.g); lineShips.clear(); }

// ---------- (0.217, stage Z3) the ships on the cargo lines ----------
interface LineShipLive { g: THREE.Group; key: string; yaw: number }
const lineShips = new Map<string, LineShipLive>();
/** Where a ship lies by a dock's head (on your copy of the planet), and the way out. */
function berth(pierId: string): [number, number] | null {
  const p = G.char.piers.find((q) => q.id === pierId);
  if (!p) return null;
  const s = p.len - PIER.head / 2, b = PIER.headW / 2 + 4;
  return [nearX(p.x + p.dx * s - p.dz * b, G.pos.x), p.z + p.dz * s + p.dx * b];
}
/** Every frame: each line's ship where its timetable puts it, within 700 m of you (not solid). */
function drawLineShips() {
  const c = G.char, T = OW.terrain, seen = new Set<string>();
  if (T) for (const [id, o] of Object.entries(c.outposts)) {
    const l = o?.line, sh = l?.ship;
    if (!l || !sh || l.t0 === undefined || !o.pier) continue;
    const to = c.outposts[l.to], a = berth(o.pier), b = to?.pier ? berth(to.pier) : null;
    if (!a || !b) continue;
    const bx = nearX(b[0], a[0]), k = Math.floor((c.time - l.t0) / periodOf(l, sh.k));
    const at = shipAt(l, c.time), p = !voyageSails(c.world, c.outposts, id, k) ? 0 : at.at === 'home' ? 0 : at.at === 'out' ? at.p : at.at === 'there' ? 1 : 1 - at.p;
    const x = a[0] + (bx - a[0]) * p, z = a[1] + (b[1] - a[1]) * p;
    if (Math.hypot(x - G.pos.x, z - G.pos.z) > 700) continue;
    const w = T.water(x, z);
    if (w?.kind !== 'sea' && p > 0.02 && p < 0.98) continue; // over land on the straight way: not drawn
    seen.add(id);
    let L = lineShips.get(id);
    if (!L || L.key !== sh.id) { if (L) scene.remove(L.g); L = { g: showcaseBoat(sh.k), key: sh.id, yaw: 0 }; scene.add(L.g); lineShips.set(id, L); }
    const back = at.at === 'back' || at.at === 'there';
    L.yaw = Math.atan2((bx - a[0]) * (back ? -1 : 1), (b[1] - a[1]) * (back ? -1 : 1));
    L.g.position.set(x, SEA.level + Math.sin(time * 0.9 + x) * 0.08, z); L.g.rotation.y = L.yaw;
  }
  for (const [id, L] of lineShips) if (!seen.has(id)) { scene.remove(L.g); lineShips.delete(id); }
}
let time = 0;
/** Twice a second: draw the ports within reach, redraw changed ones, finish due builds; every frame the settlers and the crane. */
export function updatePorts(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { if (live.size) dropPorts(); return; }
  time += dt;
  for (const L of live.values()) {
    for (const h of L.hands) { h.phase += dt; poseRig(h.f.rig, { swing: h.work ? Math.sin(h.phase * 2.2) * 0.5 : 0, strike: h.work && !h.carry ? (h.phase * 0.85) % 1 : 0 }); h.f.g.position.set(h.x, T.heightAt(L.ox + h.x, L.oz + h.z) - L.oy, h.z); h.f.g.rotation.y = h.face; }
    if (L.jib && L.works) L.jib.rotation.y = Math.atan2(L.p.dx, L.p.dz) + Math.sin(time * 0.25) * 0.9;
    if (L.rotor) L.rotor.rotation.z += dt * 2.4 * windAt(hash(G.char.world, L.id.length, L.ox | 0, L.oz | 0), G.char.time);
  }
  drawLineShips();
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  finishPorts();
  levelPads();
  tickLines(0.5);
  const seen = new Set<string>();
  for (const [id, o] of Object.entries(G.char.outposts)) {
    if (!isStore(o)) continue;
    const saved = pierOf(o);
    if (!saved || (o.k === 'port' && !G.char.piers.find((q) => q.id === o.pier)?.done)) continue;
    const p = onMyCopy(saved);
    if (Math.hypot(p.x - G.pos.x, p.z - G.pos.z) > NEAR) continue;
    seen.add(id);
    const L = live.get(id);
    if (L && L.sig === sigOf(id, o) && L.p.x === p.x) continue;
    if (L) drop(L);
    live.set(id, build(id, o, p));
  }
  for (const [id, L] of live) if (!seen.has(id) || Math.hypot(L.ox - G.pos.x, L.oz - G.pos.z) > DROP) { drop(L); live.delete(id); }
}
/** (0.217, stage Z3) Settle this port's line and take what the lines brought off into the hold (under the port's lock);
 *  a few words about it for the window. */
export function tickPort(id: string): string {
  const c = G.char, o = c.outposts[id];
  if (!o) return '';
  const words: string[] = [];
  for (const v of settleLine(c.world, c.outposts, id, c.time)) if (v.fate === 'ok' && v.n) words.push(TL`The ${BOATS[o.line!.ship!.k].name.toLowerCase()} carried ${v.n} crates to ${o.line!.toName}.`);
  const got = unloadLines(c.world, c.outposts, id, c.time), n = got.reduce((a, [, m]) => a + m, 0);
  if (n) words.push(TL`The crane took ${n} crates off the ships into the hold.`);
  const carried = drainStore(id, c.outposts); // (0.249) what the carriers brought from the deposits of its hex
  if (carried.length) words.push(TL`The storekeepers took in ${carried.map(([g, m]) => `${m} × ${ITEMS[g].name}`).join(', ')} from the deposits round about.`);
  for (const w of words) logLine(`${o.name}: ${w}`);
  return [...words, ...runHub(id)].join(' '); // (0.252) its convoy line, and the lines that brought it cargo
}
/** Every 15 s: the lines whose voyages have come in are settled, and the ports whose crane can take cargo off unload
 *  (each under its port's lock; whoever gets there first, the same result on every game). */
let lineT = 0;
function tickLines(dt: number) {
  if ((lineT -= dt) > 0) return;
  lineT = 15;
  const c = G.char;
  for (const [id, o] of Object.entries(c.outposts)) {
    if (!isStore(o)) continue;
    const due = o.line ? dueVoyages(o.line, c.time) > 0 : false, wait = (arriving(c.outposts, id).some((a) => a.n > 0) || waitingAt(id, c.outposts, o.rcv).length > 0) && !portWorks(c.world, c.outposts, id, c.time).why;
    if (due || wait) void withOutpost(id, () => { tickPort(id); }, true).then((ok) => { if (ok) saveChar(); });
  }
}
/** The ground under the ports' pieces follows what is built or going up (on every game alike, from the shared state). */
let padSig: string | null = null, pads: { x: number; z: number; y: number }[] = [];
function levelPads() {
  const now = portClaims(G.char.world, G.char.outposts), sig = JSON.stringify(now);
  if (padSig !== null && sig !== padSig) { const was = new Set(pads.map((q) => JSON.stringify(q))), is = new Set(now.map((q) => JSON.stringify(q))); padsChanged([...pads.filter((q) => !is.has(JSON.stringify(q))), ...now.filter((q) => !was.has(JSON.stringify(q)))]); redrawPorts(); }
  padSig = sig; pads = now;
}
/** Builds at the ports whose time has come stand now (whoever sees it first; the same on every game). */
function finishPorts() {
  const c = G.char, byId = (id: string) => lodeById(c.world, id);
  for (const [id, o] of Object.entries(c.outposts)) {
    if ((!isStore(o) && o?.k !== 'camp') || !o.job || c.time < jobEnd(o)) continue; // (0.218) and the crew camps at the old plants
    tellRaids(settleAll(c.world, c.outposts, byId, jobEnd(o), c.towns)); // a new source, beds or field change the grid and the people: count up to it first
    const p = finishDue(o, null, c.time, pwOf(c.world, c.outposts, id, c.time));
    if (!p) continue;
    saveChar(); const what = partName(o.k, p, o.pk, countOf(o, p) - 1).toLowerCase();
    showToast(`${o.name}: ${what} built`);
    logLine(TL`The builders finished the ${what} at ${o.name}.${o.k === 'camp' ? tl(' Settlers come when there are beds and food to spare.') : p === 'pline' && o.pl ? TL` Power flows along it to and from ${o.pl.name} now.` : p === 'port' && o.k === 'store' ? TL` Its storekeepers need ${PORT.crew} people and power to take in what the deposits round about dig; storing by hand works now.` : p === 'port' ? TL` Its crane needs ${PORT.crew} people and power to work; storing by hand works now.` : p === 'power' && o.pk ? TL` It powers every outpost and port within ${POWER_SRC[o.pk].r} m.${POWER_SRC[o.pk].fuel ? tl(' Load its bunker with fuel.') : ''}` : ''}`);
  }
}
/** The port (or wild warehouse) whose board you stand by (its id and frame). */
export function nearPortBoard(): { id: string; p: Frame } | null {
  if (G.char.loc !== 'overworld' || G.fly) return null;
  for (const L of live.values()) if (Math.hypot(L.ox + L.board[0] - G.pos.x, L.oz + L.board[1] - G.pos.z) < 2) return { id: L.id, p: L.p };
  return null;
}
/** The port warehouse's walls, the crane's foot, the power source, the bunkhouses and the crates (G.obstacle). */
export function portHit(px: number, py: number, pz: number, r: number): boolean {
  for (const L of live.values()) {
    const x = px - L.ox, z = pz - L.oz;
    if (Math.abs(x) > 140 || Math.abs(z) > 140 || py > L.oy + 30) continue;
    for (const [cx, cz, cr] of L.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    for (const [x0, z0, x1, z1] of L.boxes) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
    const o = G.char.outposts[L.id];
    if (o?.done?.port) { // the shed: back and side walls, the front open at the doorway
      const dx = px - L.p.x, dz = pz - L.p.z, a = dx * L.p.dx + dz * L.p.dz + PORT.back, b = -dx * L.p.dz + dz * L.p.dx, t = 0.2 + r;
      if (a > -6 - t && a < 6 + t && Math.abs(b) < 8 + t) {
        if (Math.abs(a + 6) < t || Math.abs(Math.abs(b) - 8) < t) return true;
        if (Math.abs(a - 6) < t && Math.abs(b) > 2.6 - r) return true;
      }
    }
  }
  return false;
}
/** The port you stand at (for the HUD's place name). */
export function portNameAt(x: number, z: number): string | null {
  for (const L of live.values()) if (worldDist(L.ox, L.oz, x, z) < 40) return G.char.outposts[L.id]?.name ?? null;
  return null;
}
export const redrawPorts = () => { tick = 0; for (const L of live.values()) L.sig = ''; };
