// (0.182, PLAN_PLACOWEK.md stage O1) The deposits in the wilds (gen/lodes.ts) in the world: drawn within reach (a
// mound of stone, giant trees, seams and ore showing in the rocks, black pools of oil), found when you come near
// (then on your maps: `char.lodes`), heard of in the towns (`askLode`, marked as heard until you see it), and swept up
// by the orbital scan. Outposts at them come in stage O2.
import * as THREE from 'three';
import { hash, rng } from '../core/rng';
import { scene } from './render';
import { PropBatch } from './props';
import { drawGiant } from './trees';
import { oilSeep, animateOil, type OilMotion } from './resource-props';
import { G } from '../game';
import { OW } from './overworld';
import { lodesNear, lodesWithin, lodeGives, LODES, type Lode } from '../gen/lodes';
import { nearX, worldDist, wrapDx } from '../gen/regions';
import { ITEMS } from '../data/items';
import { saveChar } from '../character';
import { showToast, logLine } from '../ui/hud';
import { dirWord } from '../gen/tech';
import type { Terrain } from '../gen/terrain';
import { lodeById } from '../gen/lodes';
import { countOf, digOf, finishDue, partName, stockNow, outputs, capOf, jobEnd, type OutpostState } from '../gen/outposts';
import { pwOf, settleAll, POWER_SRC, GRID } from '../gen/grid';
import { windAt } from '../gen/energy';
import { lifeNow, crews } from '../gen/outpostlife';
import { procOf } from '../gen/outpostproc';
import { makeFigure, type Figure } from './npc';
import { poseRig, type Kit } from './rig';
import { tl, TL } from '../i18n';

interface Hand { f: Figure; x: number; z: number; face: number; phase: number; work: boolean }
/** (0.186) A turret's turning head at an outpost (deposit-local base); fired by world/outpostraid.ts. */
export interface OutGun { head: THREE.Object3D; yaw: number; home: number; cd: number; look: number; target: unknown }
interface Live { l: Lode; g: THREE.Group; rings: [number, number, number][]; boxes: [number, number, number, number][]; oil?: OilMotion; sig: string; rotor?: THREE.Object3D; hands: Hand[]; H?: (x: number, z: number) => number; wall?: { R: number; gate: number; half: number; th: number }; guns: OutGun[] }
const live = new Map<string, Live>();
/** (0.216) What the shared drawings below need from the place they draw into (an outpost or a port: world/ports.ts). */
export type DrawInto = Pick<Live, 'g' | 'rings' | 'boxes' | 'rotor'>;
const STONE = [0xb2b2a3, 0x88978f], ROCK = 0x89988b;

/** What a deposit gives, in words. */
export const givesText = (l: Lode) => lodeGives(l).map((k) => ITEMS[k].name.replace(/^Crate of /, '').toLowerCase()).join(', ');

function build(T: Terrain, l: Lode): Live {
  const gx = nearX(l.x, G.pos.x), H = (x: number, z: number) => T.heightAt(gx + x, l.z + z) - l.y;
  const pb = new PropBatch(), L: Live = { l, g: new THREE.Group(), rings: [], boxes: [], sig: sigOf(l), hands: [], H, guns: [] }, R = rng(hash(T.world, l.x | 0, l.z | 0, 0x10a1));
  const rock = (x: number, z: number, r: number, h: number, c: number, vein?: number) => {
    const y = H(x, z) - 0.12, sides = 6 + Math.floor(R() * 3), rot = R() * 6.283;
    pb.rock(x, y, z, r, h, sides, rot, c); if (vein) pb.vein(x, y, z, r, h, sides, rot, vein);
    if (r > 0.9) L.rings.push([x, z, r * 0.85]);
  };
  const spec = LODES[l.k];
  if (l.k === 'stone') {
    // a broken face of stone: a mound of blocks, some squared off as if cut long ago
    for (let i = 0; i < 20; i++) { const a = R() * 6.283, d = Math.sqrt(R()) * 9, r = 1.3 + R() * 2.1; rock(Math.cos(a) * d, Math.sin(a) * d, r, 2 + (1 - d / 10) * 4 + R(), STONE[i % 2]); }
    for (let i = 0; i < 4; i++) { const x = (R() - 0.5) * 14, z = (R() - 0.5) * 14, y = H(x, z); pb.box(x - 0.8, y - 0.1, z - 0.5, x + 0.8, y + 0.9, z + 0.5, 0xc8d0c0); L.rings.push([x, z, 0.9]); }
  } else if (l.k === 'grove') {
    // giant old trees round a clearing, never felled
    const n = 5 + Math.floor(R() * 3);
    for (let i = 0; i < n; i++) {
      const a = (i / n) * 6.283 + R() * 0.4, d = 9 + R() * 12, x = Math.cos(a) * d, z = Math.sin(a) * d, r = 1.5 + R() * 0.9, h = 24 + R() * 12;
      drawGiant(pb, x, H(x, z), z, r, h, hash(T.world, l.x | 0, i, 0x10a2)); L.rings.push([x, z, r * 0.8]);
    }
  } else if (l.k === 'oil') {
    const m = oilSeep(T, hash(l.x | 0, l.z | 0), gx, l.z); L.oil = m.motion;
    m.group.position.set(-gx, -l.y, -l.z); L.g.add(m.group); // oilSeep draws in world coordinates
    for (let i = 0; i < 6; i++) { const a = R() * 6.283, d = 9 + R() * 4; rock(Math.cos(a) * d, Math.sin(a) * d, 0.6 + R() * 0.8, 0.5 + R(), ROCK); }
  } else {
    // ore: a ring of broken rocks with the seam showing in them, lumps of it in the middle
    for (let i = 0; i < 11; i++) { const a = i / 11 * 6.283 + R() * 0.2, d = 6 + R() * 3; rock(Math.cos(a) * d, Math.sin(a) * d, 1.1 + R() * 0.9, 1.2 + R() * 1.6, ROCK, spec.c); }
    for (let i = 0; i < 6; i++) rock((R() - 0.5) * 6, (R() - 0.5) * 6, 0.35 + R() * 0.4, 0.25 + R() * 0.3, spec.c, spec.c);
  }
  const o = G.char.outposts[l.id];
  if (o?.k) drawOutpost(pb, H, L, o, R);
  L.g.add(pb.build());
  L.g.position.set(gx, l.y, l.z);
  scene.add(L.g);
  return L;
}
// ---------- (0.183) the outpost at a deposit ----------
const WOOD = 0xc8a060, STEEL = 0xa8c8b8, STAKE = 0xffd060;
/** Where the outpost's pieces stand, deposit-local: the post (and the E spot), the extraction, the shed. */
export function outpostSpots(l: Lode) {
  const a = l.yaw, d = digOf(l.k), far = d === 'quarry' ? l.r * 0.5 + 6 : 0;
  return {
    post: [Math.cos(a) * (l.r + 3), Math.sin(a) * (l.r + 3)] as [number, number],
    dig: [Math.cos(a + Math.PI) * far, Math.sin(a + Math.PI) * far] as [number, number],
    shed: [Math.cos(a + Math.PI / 2) * (l.r + 7), Math.sin(a + Math.PI / 2) * (l.r + 7)] as [number, number],
    power: [Math.cos(a - Math.PI / 2) * (l.r + 9), Math.sin(a - Math.PI / 2) * (l.r + 9)] as [number, number],
    /** (0.185) Three bunkhouses beyond the extraction, three fields further out on the post's side. */
    bunks: [0, 1, 2].map((i) => [Math.cos(a + Math.PI + (i - 1) * 0.5) * (l.r + 12), Math.sin(a + Math.PI + (i - 1) * 0.5) * (l.r + 12)] as [number, number]),
    fields: [0.8, -0.8, 0].map((d) => [Math.cos(a + d) * (l.r + 26), Math.sin(a + d) * (l.r + 26)] as [number, number]),
    /** (0.186) The wall's ring (its gate faces the post) and the turret towers inside it. */
    wallR: l.r + 38, gate: a,
    /** (0.188) The processing works, between the extraction and the power source. */
    proc: [Math.cos(a - Math.PI / 2 + 0.75) * (l.r + 20), Math.sin(a - Math.PI / 2 + 0.75) * (l.r + 20)] as [number, number],
    turrets: [Math.PI / 2, -Math.PI / 2].map((d) => [Math.cos(a + d) * (l.r + 35), Math.sin(a + d) * (l.r + 35)] as [number, number]),
  };
}
/** What the drawing depends on: the outpost's builds and how full its stock is (in fives). */
function sigOf(l: Lode): string {
  const o = G.char.outposts[l.id];
  if (!o?.k) return '';
  const st = stockNow(o, l, G.char.time, pwOf(G.char.world, G.char.outposts, l.id, G.char.time)), fill = outputs(l).reduce((a, [g]) => a + Math.floor(st[g] ?? 0), 0);
  const folk = o.life ? Math.floor(lifeNow(G.char.world, o, G.char.time).n) : 0;
  return JSON.stringify([o.done ?? {}, o.n ?? {}, o.rlast?.[0] ?? 0, o.job?.p ?? '', o.pk ?? '', o.job ? Math.floor((G.char.time - o.job.t) / (o.job.h * 6)) : 0, Math.floor(fill / 5), folk]);
}
function drawOutpost(pb: PropBatch, H: (x: number, z: number) => number, L: Live, o: OutpostState, R: () => number) {
  const l = L.l, sp = outpostSpots(l), cos = Math.cos(l.yaw), sin = Math.sin(l.yaw);
  // the stakes round the claim and the post with its board
  for (let i = 0; i < 8; i++) { const a = i / 8 * 6.283, x = Math.cos(a) * (l.r + 2), z = Math.sin(a) * (l.r + 2), y = H(x, z); pb.box(x - 0.06, y, z - 0.06, x + 0.06, y + 1.1, z + 0.06, WOOD); pb.seg(STAKE, [x, y + 1.1, z], [x, y + 0.9, z]); }
  { const [x, z] = sp.post, y = H(x, z); pb.box(x - 0.08, y, z - 0.08, x + 0.08, y + 2.2, z + 0.08, WOOD); const bx = -sin * 0.7, bz = cos * 0.7; pb.face([x - bx, y + 1.4, z - bz], [x + bx, y + 1.4, z + bz], [x + bx, y + 2.1, z + bz], [x - bx, y + 2.1, z - bz]); pb.line(STAKE, [x - bx, y + 1.4, z - bz], [x + bx, y + 1.4, z + bz], [x + bx, y + 2.1, z + bz], [x - bx, y + 2.1, z - bz], [x - bx, y + 1.4, z - bz]); for (let k = 0; k < 3; k++) pb.seg(STAKE, [x - bx * 0.7, y + 1.55 + k * 0.17, z - bz * 0.7], [x + bx * (0.2 + 0.5 * ((k + 1) % 2)), y + 1.55 + k * 0.17, z + bz * (0.2 + 0.5 * ((k + 1) % 2))]); L.rings.push([x, z, 0.3]); }
  const site = (cx: number, cz: number, w: number, d: number, share: number) => { // a building site: stakes, lines, a stack, a frame rising
    const y = H(cx, cz), c = [[cx - w, cz - d], [cx + w, cz - d], [cx + w, cz + d], [cx - w, cz + d]];
    for (const [x, z] of c) { pb.box(x - 0.06, H(x, z), z - 0.06, x + 0.06, H(x, z) + 1, z + 0.06, STAKE); }
    for (let i = 0; i < 4; i++) pb.seg(STAKE, [c[i][0], H(c[i][0], c[i][1]) + 0.5, c[i][1]], [c[(i + 1) % 4][0], H(c[(i + 1) % 4][0], c[(i + 1) % 4][1]) + 0.5, c[(i + 1) % 4][1]]);
    const top = y + 0.5 + 4 * share;
    for (const [x, z] of c) pb.seg(WOOD, [x, y, z], [x, top, z]);
    pb.line(WOOD, [c[0][0], top, c[0][1]], [c[1][0], top, c[1][1]], [c[2][0], top, c[2][1]], [c[3][0], top, c[3][1]], [c[0][0], top, c[0][1]]);
    pb.box(cx + w + 0.6, y, cz - 1, cx + w + 1.8, y + 0.9 * (1 - share) + 0.2, cz + 1, WOOD); // the stack of materials, used up as it rises
  };
  const share = o.job ? Math.min(1, (G.char.time - o.job.t) / (o.job.h * 60)) : 0;
  // the extraction
  { const [x, z] = sp.dig, y = H(x, z), d = digOf(l.k);
    if (o.job?.p === 'dig') site(x, z, 2.5, 2.5, share);
    else if (o.done?.dig) {
      if (d === 'mine' || d === 'shaft') { // a headframe over the shaft, a winch house, an ore cart
        const c = d === 'shaft' ? STEEL : WOOD, h = d === 'shaft' ? 12 : 9;
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(c, [x + sx * 1.6, y, z + sz * 1.6], [x + sx * 0.6, y + h, z + sz * 0.6]);
        for (let k = 1; k < 4; k++) { const t = k / 4, r = 1.6 - t, yy = y + h * t; pb.line(c, [x - r, yy, z - r], [x + r, yy, z - r], [x + r, yy, z + r], [x - r, yy, z + r], [x - r, yy, z - r]); }
        pb.box(x - 0.7, y + h, z - 0.7, x + 0.7, y + h + 0.3, z + 0.7, c);
        for (let k = 0; k < 10; k++) { const a0 = k / 10 * 6.283, a1 = (k + 1) / 10 * 6.283; pb.seg(c, [x, y + h + 1 + Math.sin(a0) * 0.9, z + Math.cos(a0) * 0.9], [x, y + h + 1 + Math.sin(a1) * 0.9, z + Math.cos(a1) * 0.9]); }
        pb.seg(c, [x, y + h + 1, z], [x + 4.5, y + 2, z]);
        pb.box(x + 3.5, H(x + 4.5, z), z - 1.3, x + 6.5, H(x + 4.5, z) + 2.4, z + 1.3, WOOD); pb.gableRoof(x + 3.5, z - 1.3, x + 6.5, z + 1.3, H(x + 4.5, z) + 2.4, 0.9, WOOD);
        L.boxes.push([x + 3.5, z - 1.3, x + 6.5, z + 1.3]);
        pb.box(x - 1.2, y, z + 2.4, x + 0.2, y + 0.8, z + 3.2, LODES[l.k].c);
        for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.rings.push([x + sx * 1.4, z + sz * 1.4, 0.3]);
      } else if (d === 'pump') { // the nodding pump over the seep, a tank
        pb.box(x - 2, y, z - 0.6, x + 2, y + 0.5, z + 0.6, STEEL);
        pb.seg(STEEL, [x - 0.6, y + 0.5, z - 0.5], [x, y + 3, z]); pb.seg(STEEL, [x + 0.6, y + 0.5, z - 0.5], [x, y + 3, z]); pb.seg(STEEL, [x - 0.6, y + 0.5, z + 0.5], [x, y + 3, z]); pb.seg(STEEL, [x + 0.6, y + 0.5, z + 0.5], [x, y + 3, z]);
        pb.box(x - 2.8, y + 2.9, z - 0.15, x + 2.2, y + 3.2, z + 0.15, STEEL);
        pb.box(x - 3.4, y + 2.2, z - 0.25, x - 2.7, y + 3.5, z + 0.25, STEEL); pb.seg(STEEL, [x - 3.1, y + 2.2, z], [x - 3.1, y + 0.3, z]);
        pb.box(x + 1.8, y + 0.5, z - 0.5, x + 2.4, y + 1.6, z + 0.5, STEEL);
        L.boxes.push([x - 2, z - 0.6, x + 2, z + 0.6]);
        const tx = x + 6, tz = z + 3, ty = H(tx, tz);
        for (let k = 0; k < 12; k++) { const a0 = k / 12 * 6.283, a1 = (k + 1) / 12 * 6.283, P = (a: number, yy: number) => [tx + Math.cos(a) * 1.6, yy, tz + Math.sin(a) * 1.6]; pb.face(P(a0, ty), P(a1, ty), P(a1, ty + 3), P(a0, ty + 3)); pb.seg(STEEL, P(a0, ty + 3), P(a1, ty + 3)); pb.seg(STEEL, P(a0, ty), P(a1, ty)); if (k % 3 === 0) pb.seg(STEEL, P(a0, ty), P(a0, ty + 3)); }
        L.rings.push([tx, tz, 1.6]);
      } else if (d === 'quarry') { // a timber derrick and a cutting floor with blocks
        pb.box(x - 0.2, y, z - 0.2, x + 0.2, y + 10, z + 0.2, WOOD);
        pb.seg(WOOD, [x, y + 1.5, z], [x + 7 * cos, y + 8, z + 7 * sin]); pb.seg(WOOD, [x + 7 * cos, y + 8, z + 7 * sin], [x, y + 10, z]);
        pb.seg(STAKE, [x + 7 * cos, y + 8, z + 7 * sin], [x + 7 * cos, y + 3, z + 7 * sin]);
        for (const a of [0.5, 2.6, 4.7]) pb.seg(WOOD, [x, y + 10, z], [x + Math.cos(a) * 6, H(x + Math.cos(a) * 6, z + Math.sin(a) * 6), z + Math.sin(a) * 6]);
        for (let k = 0; k < 5; k++) { const bx = x - 3 + (k % 3) * 1.8, bz = z + 2 + Math.floor(k / 3) * 1.3, by = H(bx, bz); pb.box(bx - 0.7, by, bz - 0.5, bx + 0.7, by + 0.9, bz + 0.5, 0xc8d0c0); }
        L.rings.push([x, z, 0.4]); L.boxes.push([x - 3.7, z + 1.5, x + 1.3, z + 4.3]);
      } else { // logging: trestles with a trunk, a log stack, a skid road
        for (const dx of [-2.5, 2.5]) { pb.seg(WOOD, [x + dx - 0.6, y, z - 0.5], [x + dx, y + 1.2, z]); pb.seg(WOOD, [x + dx + 0.6, y, z + 0.5], [x + dx, y + 1.2, z]); }
        pb.box(x - 4, y + 1.1, z - 0.45, x + 4, y + 1.9, z + 0.45, 0x9a7a50);
        for (let k = 0; k < 6; k++) { const ly = y + 0.45 * Math.floor(k / 3), lz = z + 3 + (k % 3) * 0.9; pb.box(x - 3, ly, lz - 0.4, x + 3, ly + 0.45, lz + 0.4, 0x9a7a50); }
        L.boxes.push([x - 4, z - 0.6, x + 4, z + 0.6]); L.boxes.push([x - 3, z + 2.5, x + 3, z + 5.3]);
      }
    }
  }
  // the storage shed
  { const [x, z] = sp.shed, y = H(x, z);
    if (o.job?.p === 'store') site(x, z, 3, 2, share);
    else if (o.done?.store) {
      pb.box(x - 3, y - 0.2, z - 2, x + 3, y + 2.8, z + 2, WOOD); pb.gableRoof(x - 3.3, z - 2.3, x + 3.3, z + 2.3, y + 2.8, 1.2, WOOD);
      for (let k = -2; k <= 2; k++) pb.seg(WOOD, [x + k, y, z - 2.01], [x + k, y + 2.8, z - 2.01]);
      L.boxes.push([x - 3, z - 2, x + 3, z + 2]);
    }
  }
  // the power source
  { const [x, z] = sp.power, y = H(x, z);
    if (o.job?.p === 'power') site(x, z, 3, 3, share);
    else if (o.done?.power && o.pk) drawPowerSource(pb, H, L, o, x, z, y);
  }
  // (0.185) the bunkhouses and the fields, the one going up as a building site
  const nb = o.n?.bunks ?? 0, nf = o.n?.field ?? 0;
  sp.bunks.forEach(([x, z], i) => {
    if (i < nb) drawBunks(pb, H, L, x, z);
    else if (i === nb && o.job?.p === 'bunks') site(x, z, 4, 2, share);
  });
  sp.fields.forEach(([x, z], i) => {
    if (i < nf) drawField(pb, H, x, z, i);
    else if (i === nf && o.job?.p === 'field') site(x, z, 2, 2, share);
  });
  if (o.life) drawHands(L, o, sp);
  // (0.188) the processing works
  { const [x, z] = sp.proc;
    if (o.job?.p === 'proc') site(x, z, 3, 3, share);
    else if (o.done?.proc) drawProc(pb, H, L, o, x, z);
  }
  // (0.186) the wall and the turret towers, or the building site of the next
  const tier = o.n?.wall ?? 0;
  if (tier) drawWall(pb, H, L, tier, sp.wallR, sp.gate);
  if (o.job?.p === 'wall') { const gx = Math.cos(sp.gate) * (sp.wallR - 5), gz = Math.sin(sp.gate) * (sp.wallR - 5); site(gx, gz, 2.5, 1.5, share); }
  sp.turrets.forEach(([x, z], i) => {
    if (i < (o.n?.turret ?? 0)) drawTurret(pb, H, L, x, z, Math.atan2(x, z));
    else if (i === (o.n?.turret ?? 0) && o.job?.p === 'turret') site(x, z, 1.5, 1.5, share);
  });
  // the crates on site, beside the shed or piled by the extraction
  if (o.done?.dig) {
    const st = stockNow(o, l, G.char.time, pwOf(G.char.world, G.char.outposts, l.id, G.char.time)), n = Math.min(24, Math.floor(outputs(l).reduce((a, [g]) => a + Math.floor(st[g] ?? 0), 0) / (capOf(o) > 10 ? 3 : 1)));
    const [bx, bz] = o.done.store ? [sp.shed[0] + 4, sp.shed[1]] : [sp.dig[0] - 4, sp.dig[1] - 4];
    for (let k = 0; k < n; k++) { const cx = bx + (k % 3) * 0.75, cz = bz + Math.floor(k / 9) * 0.75, cy = H(bx, bz) + Math.floor((k % 9) / 3) * 0.6; pb.box(cx - 0.32, cy, cz - 0.32, cx + 0.32, cy + 0.58, cz + 0.32, LODES[l.k].c); }
    if (n) L.boxes.push([bx - 0.4, bz - 0.4, bx + 1.9, bz + 1.9]);
  }
  void R;
}
/** (0.188) A round tower of `sides` faces from y to y + h (radius r), lines at the ends and every other edge. */
function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, c: number, sides = 10) {
  for (let k = 0; k < sides; k++) {
    const a0 = k / sides * 6.283, a1 = (k + 1) / sides * 6.283, P = (a: number, yy: number) => [x + Math.cos(a) * r, yy, z + Math.sin(a) * r];
    pb.face(P(a0, y), P(a1, y), P(a1, y + h), P(a0, y + h)); pb.seg(c, P(a0, y + h), P(a1, y + h)); pb.seg(c, P(a0, y), P(a1, y)); if (k % 2 === 0) pb.seg(c, P(a0, y), P(a0, y + h));
  }
}
/** (0.188) The processing works by its kind: a field refinery, a smelter, a saw shed, a stone saw. */
function drawProc(pb: PropBatch, H: (x: number, z: number) => number, L: Live, o: OutpostState, x: number, z: number) {
  const out = procOf(o.k)?.out, y = H(x, z);
  if (out === 'fuel') { // two columns on a skid, a tank, a flare
    pb.box(x - 3, y - 0.2, z - 1.5, x + 3, y + 0.4, z + 1.5, STEEL);
    cyl(pb, x - 1.5, y + 0.4, z, 0.7, 9, STEEL); cyl(pb, x + 0.5, y + 0.4, z, 0.5, 6.5, STEEL);
    for (let k = 1; k < 4; k++) pb.seg(STEEL, [x - 1.5, y + 0.4 + k * 2.2, z], [x + 0.5, y + 0.4 + k * 1.6, z]);
    cyl(pb, x + 4.5, H(x + 4.5, z + 2), z + 2, 1.4, 2.6, STEEL);
    pb.seg(STEEL, [x + 2.5, y, z - 2.5], [x + 2.5, y + 7, z - 2.5]); pb.seg(0xffb347, [x + 2.5, y + 7, z - 2.5], [x + 2.5, y + 7.8, z - 2.5]);
    L.boxes.push([x - 3, z - 1.5, x + 3, z + 1.5]); L.rings.push([x + 4.5, z + 2, 1.4]);
  } else if (out === 'iron' || out === 'copperbar' || out === 'leadbar') { // a brick shaft furnace, its stack and a casting shed
    const BR = 0xc8a080;
    pb.box(x - 1.6, y - 0.2, z - 1.6, x + 1.6, y + 5, z + 1.6, BR); pb.box(x - 1.1, y + 5, z - 1.1, x + 1.1, y + 6.4, z + 1.1, BR);
    cyl(pb, x + 2.6, y, z - 1.6, 0.45, 11, BR, 8);
    pb.box(x - 1.6, y - 0.2, z + 2, x + 3.2, y + 2.6, z + 5, WOOD); pb.gableRoof(x - 1.9, z + 1.7, x + 3.5, z + 5.3, y + 2.6, 1, WOOD);
    pb.seg(0xffb347, [x - 0.5, y + 1, z + 1.61], [x + 0.5, y + 1, z + 1.61]);
    for (let k = 0; k < 4; k++) pb.box(x + 3.6 + (k % 2) * 0.7, y, z + 2.2 + Math.floor(k / 2) * 0.5, x + 4.2 + (k % 2) * 0.7, y + 0.25, z + 2.6 + Math.floor(k / 2) * 0.5, LODES[L.l.k].c);
    L.boxes.push([x - 1.6, z - 1.6, x + 1.6, z + 1.6]); L.boxes.push([x - 1.6, z + 2, x + 3.2, z + 5]); L.rings.push([x + 2.6, z - 1.6, 0.5]);
  } else if (out === 'planks') { // an open saw shed, the bench and a stack of planks
    for (const [sx, sz] of [[-3, -2], [3, -2], [3, 2], [-3, 2]]) pb.box(x + sx - 0.12, H(x + sx, z + sz), z + sz - 0.12, x + sx + 0.12, y + 3, z + sz + 0.12, WOOD);
    pb.gableRoof(x - 3.3, z - 2.3, x + 3.3, z + 2.3, y + 3, 1.2, WOOD);
    pb.box(x - 2.4, y, z - 0.4, x + 2.4, y + 0.9, z + 0.4, WOOD); pb.seg(STEEL, [x, y + 0.9, z - 0.4], [x, y + 1.4, z + 0.4]);
    for (let k = 0; k < 6; k++) pb.box(x - 2, y + k * 0.12, z + 2.8, x + 2, y + 0.11 + k * 0.12, z + 3.5, 0xd8b878);
    L.boxes.push([x - 2.4, z - 0.4, x + 2.4, z + 0.4]); L.boxes.push([x - 2, z + 2.8, x + 2, z + 3.5]);
  } else if (out === 'cutstone') { // a wire saw's frame over a block, cut blocks and a heap of crushed stone
    pb.box(x - 0.15, y, z - 2, x + 0.15, y + 3.5, z - 1.7, STEEL); pb.box(x - 0.15, y, z + 1.7, x + 0.15, y + 3.5, z + 2, STEEL);
    pb.box(x - 0.2, y + 3.5, z - 2, x + 0.2, y + 3.8, z + 2, STEEL); pb.seg(STAKE, [x, y + 3.5, z], [x, y + 1.2, z]);
    pb.box(x - 1.2, y, z - 1.2, x + 1.2, y + 1.2, z + 1.2, 0xc8d0c0);
    for (let k = 0; k < 4; k++) pb.box(x + 2.5 + (k % 2) * 1.3, y + Math.floor(k / 2) * 0.7, z - 1, x + 3.6 + (k % 2) * 1.3, y + 0.65 + Math.floor(k / 2) * 0.7, z + 0.2, 0xc8d0c0);
    pb.rock(x - 3, H(x - 3, z + 2) - 0.1, z + 2, 1.4, 1, 7, 1, 0xa8b0a0);
    L.boxes.push([x - 1.2, z - 2, x + 1.2, z + 2]); L.boxes.push([x + 2.5, z - 1, x + 6.2, z + 0.2]);
  }
}
/** (0.186) The outpost's wall on a ring of radius R with an 8 m gate facing angle `gate`: stakes and rails (1), a
 *  palisade of pointed timbers (2), mortared stone with merlons and gate towers (3). Collides as a ring (`Live.wall`). */
const STONE_C = 0xc8d0c0;
function drawWall(pb: PropBatch, H: (x: number, z: number) => number, L: Live, tier: number, R: number, gate: number) {
  const half = 4 / R, step = tier === 1 ? 1.6 : tier === 2 ? 1.2 : 2, n = Math.ceil(2 * Math.PI * R / step), th = tier === 3 ? 0.7 : tier === 2 ? 0.35 : 0.2;
  L.wall = { R, gate, half, th };
  const P = (i: number, r = R): [number, number] => { const a = gate + half + (i / n) * (2 * Math.PI - 2 * half); return [Math.cos(a) * r, Math.sin(a) * r]; };
  const h = tier === 1 ? 2.2 : tier === 2 ? 4 : 5;
  for (let i = 0; i < n; i++) {
    const [x0, z0] = P(i), [x1, z1] = P(i + 1), y0 = H(x0, z0), y1 = H(x1, z1);
    if (tier === 1) { // a leaning stake and two rails
      const ox = x0 / R * 0.5, oz = z0 / R * 0.5;
      pb.seg(WOOD, [x0, y0, z0], [x0 + ox, y0 + h, z0 + oz]);
      if (i < n - 1) for (const ry of [0.7, 1.5]) pb.seg(WOOD, [x0, y0 + ry, z0], [x1, y1 + ry, z1]);
    } else if (tier === 2) { // timbers side by side with pointed tops
      if (i === n - 1) break;
      const tp = (i % 2 ? 0.4 : 0);
      pb.face([x0, y0 - 0.3, z0], [x1, y1 - 0.3, z1], [x1, y1 + h, z1], [x0, y0 + h, z0]);
      pb.seg(WOOD, [x0, y0, z0], [x0, y0 + h + tp, z0]); pb.seg(WOOD, [x0, y0 + h + tp, z0], [x1, y1 + h + 0.4 - tp, z1]);
      pb.seg(WOOD, [x0, y0 + 1.2, z0], [x1, y1 + 1.2, z1]);
    } else { // stone: both faces, the top, courses and merlons
      if (i === n - 1) break;
      const [a0, b0] = P(i, R - th), [a1, b1] = P(i + 1, R - th), [c0, d0] = P(i, R + th), [c1, d1] = P(i + 1, R + th);
      pb.face([c0, y0 - 0.3, d0], [c1, y1 - 0.3, d1], [c1, y1 + h, d1], [c0, y0 + h, d0]);
      pb.face([a0, y0 - 0.3, b0], [a1, y1 - 0.3, b1], [a1, y1 + h, b1], [a0, y0 + h, b0]);
      pb.face([a0, y0 + h, b0], [a1, y1 + h, b1], [c1, y1 + h, d1], [c0, y0 + h, d0]);
      pb.seg(STONE_C, [c0, y0 + h, d0], [c1, y1 + h, d1]); pb.seg(STONE_C, [a0, y0 + h, b0], [a1, y1 + h, b1]);
      for (const cy of [1.5, 3.2]) pb.seg(STONE_C, [c0, y0 + cy, d0], [c1, y1 + cy, d1]);
      if (i % 2 === 0) pb.box(Math.min(c0, c1) - 0.01, y0 + h, Math.min(d0, d1) - 0.01, Math.max(c0, c1) + 0.01, y0 + h + 0.8, Math.max(d0, d1) + 0.01, STONE_C);
    }
  }
  // the gate: two posts (towers for stone) and a beam over it
  const gh = h + (tier === 3 ? 2.5 : 1.2), cg = Math.cos(gate), sg = Math.sin(gate);
  for (const sd of [-1, 1]) {
    const a = gate + sd * half, x = Math.cos(a) * R, z = Math.sin(a) * R, y = H(x, z), w = tier === 3 ? 1.6 : 0.25;
    pb.box(x - w, y - 0.3, z - w, x + w, y + gh, z + w, tier === 3 ? STONE_C : WOOD); L.rings.push([x, z, w + 0.2]);
  }
  const ax = Math.cos(gate - half) * R, az = Math.sin(gate - half) * R, bx = Math.cos(gate + half) * R, bz = Math.sin(gate + half) * R, gy = H(R * cg, R * sg);
  pb.seg(tier === 3 ? STONE_C : STAKE, [ax, gy + gh - 0.3, az], [bx, gy + gh - 0.3, bz]);
}
/** (0.186) A timber tower with an auto turret on top; the head is its own object so it can turn. */
function drawTurret(pb: PropBatch, H: (x: number, z: number) => number, L: Live, x: number, z: number, home: number) {
  const y = H(x, z), top = y + 3.6;
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(WOOD, [x + sx * 1.2, y, z + sz * 1.2], [x + sx * 0.8, top, z + sz * 0.8]);
  for (const yy of [y + 1.2, y + 2.4]) { const r = 1.2 - 0.4 * (yy - y) / 3.6; pb.line(WOOD, [x - r, yy, z - r], [x + r, yy, z - r], [x + r, yy, z + r], [x - r, yy, z + r], [x - r, yy, z - r]); }
  pb.box(x - 1, top, z - 1, x + 1, top + 0.15, z + 1, WOOD);
  pb.box(x - 0.45, top + 0.15, z - 0.45, x + 0.45, top + 0.45, z + 0.45, 0x7dffc8);
  const hp = new PropBatch(), ON = 0x7dffc8;
  hp.box(-0.3, 0, -0.33, 0.3, 0.38, 0.33, ON);
  for (const sx of [-0.12, 0.12]) hp.box(sx - 0.05, 0.14, -1.1, sx + 0.05, 0.24, -0.33, ON);
  hp.box(-0.11, 0.38, -0.26, 0.11, 0.5, -0.18, ON);
  const head = hp.build(); head.position.set(x, top + 0.45, z); head.rotation.y = home; L.g.add(head);
  L.guns.push({ head, yaw: home, home, cd: 0.5, look: 0, target: null });
  for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.rings.push([x + sx * 1.15, z + sz * 1.15, 0.2]);
}
/** (0.185) A plank bunkhouse with a stove pipe, a door on the long side and a bench. */
export function drawBunks(pb: PropBatch, H: (x: number, z: number) => number, L: DrawInto, x: number, z: number) {
  const y = Math.min(H(x - 4, z), H(x + 4, z), H(x, z));
  pb.box(x - 4, y - 0.3, z - 2, x + 4, y + 2.6, z + 2, WOOD); pb.gableRoof(x - 4.3, z - 2.3, x + 4.3, z + 2.3, y + 2.6, 1.3, WOOD);
  for (let k = -3; k <= 3; k++) if (k) pb.seg(WOOD, [x + k, y, z + 2.01], [x + k, y + 2.6, z + 2.01]);
  pb.line(STAKE, [x - 0.5, y, z + 2.02], [x - 0.5, y + 2, z + 2.02], [x + 0.5, y + 2, z + 2.02], [x + 0.5, y, z + 2.02]);
  for (const wx of [-2.5, 2.5]) pb.line(STAKE, [x + wx - 0.4, y + 1.2, z + 2.02], [x + wx + 0.4, y + 1.2, z + 2.02], [x + wx + 0.4, y + 1.8, z + 2.02], [x + wx - 0.4, y + 1.8, z + 2.02], [x + wx - 0.4, y + 1.2, z + 2.02]);
  pb.box(x + 2.6, y + 3, z - 0.9, x + 2.9, y + 4.6, z - 0.6, STEEL);
  pb.box(x - 3, y, z + 2.6, x - 1.6, y + 0.45, z + 3, WOOD);
  L.boxes.push([x - 4, z - 2, x + 4, z + 2]);
}
/** (0.185) A fenced field, 12 m square: posts and rails, crop rows over the furrows (grain, roots or greens by index). */
export function drawField(pb: PropBatch, H: (x: number, z: number) => number, x: number, z: number, i: number) {
  const s = 6, CROP = [0xd8c860, 0x6fd24a, 0x9adf5a][i % 3];
  for (let k = 0; k < 4; k++) {
    const P = (t: number): [number, number] => k === 0 ? [x - s + t * 2 * s, z - s] : k === 1 ? [x + s, z - s + t * 2 * s] : k === 2 ? [x + s - t * 2 * s, z + s] : [x - s, z + s - t * 2 * s];
    for (let j = 0; j < 4; j++) {
      const [ax, az] = P(j / 4), [bx, bz] = P((j + 1) / 4), ay = H(ax, az), by = H(bx, bz);
      if (!(k === 0 && j === 1)) { pb.seg(WOOD, [ax, ay + 0.9, az], [bx, by + 0.9, bz]); pb.seg(WOOD, [ax, ay + 0.5, az], [bx, by + 0.5, bz]); } // a gap for the gate
      pb.seg(WOOD, [ax, ay, az], [ax, ay + 1.1, az]);
    }
  }
  for (let r = -5; r <= 5; r++) {
    const xx = x + r, pts: number[][] = [], top: number[][] = [];
    for (let t = -5; t <= 5; t += 2.5) { pts.push([xx, H(xx, z + t) + 0.05, z + t]); top.push([xx, H(xx, z + t) + (i % 3 === 0 ? 0.7 : 0.35), z + t]); }
    pb.line(0x8a7a50, ...pts); pb.line(CROP, ...top);
  }
}
/** (0.185) The settlers: on the fields with hoes, at the extraction with picks, idle ones by the bunkhouse (at most 12 drawn). */
function drawHands(L: Live, o: OutpostState, sp: ReturnType<typeof outpostSpots>) {
  const w = crews(o, lifeNow(G.char.world, o, G.char.time).n), put = (x: number, z: number, kit: Kit, work: boolean, face: number, i: number) => {
    if (L.hands.length >= 12) return;
    const f = makeFigure(0xdce8ff, kit); L.g.add(f.g);
    L.hands.push({ f, x, z, face, phase: i * 0.37, work });
  };
  for (let i = 0; i < w.farm; i++) { const [fx, fz] = sp.fields[Math.floor(i / 3)], x = fx - 4 + (i % 3) * 4, z = fz + (i % 2 ? 2 : -2); put(x, z, 'hoe', true, (i % 2) * Math.PI, i); }
  const d = digOf(L.l.k) === 'quarry' || digOf(L.l.k) === 'mine' || digOf(L.l.k) === 'shaft' ? 'pick' : 'hammer';
  for (let i = 0; i < w.dig; i++) { const a = i / w.dig * 6.283, [dx, dz] = sp.dig, x = dx + Math.cos(a) * 3.2, z = dz + Math.sin(a) * 3.2; put(x, z, d, true, Math.atan2(dx - x, dz - z), i); }
  for (let i = 0; i < w.idle; i++) { const [bx, bz] = sp.bunks[0], x = bx - 2 + i * 1.3, z = bz + 3.6; put(x, z, 'none', false, 0, i); }
}
/** (0.184) A power source at an outpost: a generator box, a wind turbine (its rotor turns with the wind), panels, a coal boiler. */
export function drawPowerSource(pb: PropBatch, H: (x: number, z: number) => number, L: DrawInto, o: OutpostState, x: number, z: number, y: number) {
  if (o.pk === 'generator') {
    pb.box(x - 2, y, z - 1.1, x + 2, y + 2.4, z + 1.1, STEEL);
    for (let k = -1; k <= 1; k++) pb.seg(STEEL, [x + k * 1.2, y + 0.3, z + 1.11], [x + k * 1.2, y + 2.1, z + 1.11]);
    pb.box(x + 1.2, y + 2.4, z - 0.15, x + 1.5, y + 3.6, z + 0.15, STEEL);
    for (let k = 0; k < 3; k++) { const dx = x - 3 - k * 0.7, dy = H(dx, z + 1.5); pb.box(dx - 0.3, dy, z + 1.2, dx + 0.3, dy + 0.9, z + 1.8, 0xb8a040); }
    L.boxes.push([x - 2, z - 1.1, x + 2, z + 1.1]);
  } else if (o.pk === 'wind') {
    const h = 18;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) pb.seg(STEEL, [x + sx * 1.4, y, z + sz * 1.4], [x + sx * 0.3, y + h, z + sz * 0.3]);
    for (let k = 1; k < 6; k++) { const t = k / 6, r = 1.4 - 1.1 * t, yy = y + h * t; pb.line(STEEL, [x - r, yy, z - r], [x + r, yy, z - r], [x + r, yy, z + r], [x - r, yy, z + r], [x - r, yy, z - r]); pb.seg(STEEL, [x - r, yy, z - r], [x + r, yy + h / 6, z + r]); }
    pb.box(x - 0.5, y + h, z - 1.2, x + 0.5, y + h + 1, z + 0.6, STEEL);
    const rp = new PropBatch();
    for (let b = 0; b < 3; b++) { const a = b / 3 * 6.283, c = Math.cos(a), s = Math.sin(a); rp.face([0, 0, 0], [c * 7 - s * 0.35, s * 7 + c * 0.35, 0], [c * 7, s * 7, 0]); rp.line(STEEL, [0, 0, 0], [c * 7 - s * 0.35, s * 7 + c * 0.35, 0], [c * 7, s * 7, 0], [0, 0, 0]); }
    const rotor = rp.build(); rotor.position.set(x, y + h + 0.5, z - 1.3); L.g.add(rotor); L.rotor = rotor;
    for (const [sx, sz] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) L.rings.push([x + sx * 1.3, z + sz * 1.3, 0.25]);
  } else if (o.pk === 'solar') {
    for (let row = 0; row < 3; row++) {
      const zz = z - 3 + row * 3;
      for (let k = 0; k < 3; k++) {
        const x0 = x - 4.5 + k * 3, yy = H(x0 + 1.4, zz);
        const p00 = [x0, yy + 0.5, zz - 0.9], p10 = [x0 + 2.8, yy + 0.5, zz - 0.9], p11 = [x0 + 2.8, yy + 1.5, zz + 0.9], p01 = [x0, yy + 1.5, zz + 0.9];
        pb.face(p00, p10, p11, p01); pb.line(0x5cc8ff, p00, p10, p11, p01, p00); pb.seg(0x5cc8ff, [x0 + 1.4, yy + 0.5, zz - 0.9], [x0 + 1.4, yy + 1.5, zz + 0.9]); pb.seg(0x5cc8ff, [x0, yy + 1, zz], [x0 + 2.8, yy + 1, zz]);
        pb.seg(STEEL, [x0 + 0.2, yy, zz], [x0 + 0.2, yy + 1, zz]); pb.seg(STEEL, [x0 + 2.6, yy, zz], [x0 + 2.6, yy + 1, zz]);
      }
    }
    L.boxes.push([x - 4.6, z - 4, x + 4.4, z + 4]);
  } else if (o.pk === 'coal') {
    pb.box(x - 3, y - 0.2, z - 2.2, x + 3, y + 4, z + 2.2, 0xc8a080); pb.gableRoof(x - 3.2, z - 2.4, x + 3.2, z + 2.4, y + 4, 1.4, 0xc8a080);
    for (let k = 0; k < 8; k++) { const a0 = k / 8 * 6.283, a1 = (k + 1) / 8 * 6.283, P = (a: number, yy: number) => [x + 4.5 + Math.cos(a) * 0.7, yy, z + Math.sin(a) * 0.7]; pb.face(P(a0, y), P(a1, y), P(a1, y + 14), P(a0, y + 14)); pb.seg(0xc8a080, P(a0, y + 14), P(a1, y + 14)); if (k % 2 === 0) pb.seg(0xc8a080, P(a0, y), P(a0, y + 14)); }
    for (let k = 0; k < 5; k++) { const cx = x - 5 + (k % 3) * 0.9, cz = z + 3 + Math.floor(k / 3) * 0.8; pb.rock(cx, H(cx, cz) - 0.1, cz, 0.7, 0.6, 6, k, 0x687e98); }
    L.boxes.push([x - 3, z - 2.2, x + 3, z + 2.2]); L.rings.push([x + 4.5, z, 0.8]);
  }
}
function drop(L: Live) { scene.remove(L.g); L.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
export function dropLodes() { for (const L of live.values()) drop(L); live.clear(); }

/** Put a deposit on your map: seen (1) or only heard of (0); true when it is new news. */
function mark(l: Lode, seen: 0 | 1): boolean {
  const c = G.char, old = c.lodes[l.id];
  if (old && (old[4] >= seen)) return false;
  c.lodes[l.id] = [Math.round(l.x), Math.round(l.z), l.k, l.name, seen];
  return true;
}
let tick = 0, time = 0;
export function updateLodes(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { if (live.size) dropLodes(); return; }
  time += dt;
  for (const L of live.values()) {
    if (L.oil) animateOil(L.oil, time);
    for (const h of L.hands) {
      h.phase += dt;
      poseRig(h.f.rig, { swing: 0, strike: h.work ? (h.phase * 0.85) % 1 : 0 });
      h.f.g.position.set(h.x, L.H!(h.x, h.z), h.z); h.f.g.rotation.y = h.face;
    }
    if (L.rotor) { const o = G.char.outposts[L.l.id]; L.rotor.rotation.z += dt * 2.4 * windAt(hash(G.char.world, L.l.id.length, (o?.x ?? 0) | 0, (o?.z ?? 0) | 0), G.char.time); }
  }
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const near = lodesNear(T.world, G.pos.x, G.pos.z, 520);
  for (const [id, L] of live) if (!near.some((l) => l.id === id) || Math.abs(L.g.position.x - G.pos.x) > 700) { drop(L); live.delete(id); }
  for (const [id, L] of live) if (L.sig !== sigOf(L.l)) { drop(L); live.delete(id); } // an outpost changed: redraw it
  for (const l of near) if (!live.has(l.id)) live.set(l.id, build(T, l));
  finishOutposts();
  for (const l of near) if (worldDist(l.x, l.z, G.pos.x, G.pos.z) < l.r + 70 && mark(l, 1)) {
    saveChar(); showToast(tl('Deposit found: ') + LODES[l.k].name);
    logLine(TL`You found ${l.name}: ${LODES[l.k].blurb}. It gives ${givesText(l)} (richness ${Math.round(l.rich * 100)}%). Marked on your map.`);
  }
}
/** (0.183) Builds at the outposts whose time has come stand now (whoever sees it first; the same on every game). */
let bucket = -1;
function finishOutposts() {
  const c = G.char, byId = (id: string) => lodeById(c.world, id), b = Math.floor(c.time / GRID.step);
  if (b !== bucket) { if (bucket >= 0 && Object.keys(c.outposts).length) { tellRaids(settleAll(c.world, c.outposts, byId, c.time, c.towns)); saveChar(); } bucket = b; } // the grid's share moves on every two hours: count up to here
  for (const [id, o] of Object.entries(c.outposts)) {
    if (!o?.job || c.time < jobEnd(o)) continue;
    const l = lodeById(c.world, id);
    if (!l) continue;
    tellRaids(settleAll(c.world, c.outposts, byId, jobEnd(o), c.towns)); // a new source, beds or field change the grid and the people: count up to it first
    const p = finishDue(o, l, c.time, pwOf(c.world, c.outposts, id, c.time));
    if (p) {
      saveChar(); const what = partName(o.k, p, o.pk, countOf(o, p) - 1).toLowerCase();
      showToast(`${o.name}: ${what} built`);
      logLine(TL`The builders finished the ${what} at ${o.name}.${p === 'dig' ? tl(' It is being worked now.') : p === 'power' && o.pk ? TL` It powers every outpost within ${POWER_SRC[o.pk].r} m.${POWER_SRC[o.pk].fuel ? tl(' Load its bunker with fuel.') : ''}` : ''}`);
    }
  }
}
/** (0.186) Say how the raids just settled went (the ones far from you were rolled; yours were fought). */
export function tellRaids(list: { id: string; k: number; won: boolean; road?: string }[]) {
  for (const r of list) {
    const o = G.char.outposts[r.id];
    if (!o) continue;
    if (r.road) { // (0.187) a convoy robbed on its way
      showToast(r.road === 'wrecked' ? tl('A convoy truck was wrecked') : tl('A convoy was robbed'));
      logLine(r.road === 'wrecked' ? TL`Bandits wrecked the convoy truck from ${o.name} on the road to ${o.route?.vname}. The route stands still until the truck is recalled and mended.` : TL`Bandits robbed the convoy from ${o.name} to ${o.route?.vname}: the cargo is gone and the truck is battered.`);
      continue;
    }
    if (r.won) logLine(TL`Bandits came to ${o.name} and were driven off.`);
    else { showToast(TL`${o.name} was raided`); logLine(TL`Bandits raided ${o.name}: they carried off most of the crates and half the pantry, and some of the people left.`); }
  }
}
/** The deposit whose outpost window E opens: within its ground and a little more. */
export function nearOutpostLode(): Lode | null {
  if (G.char.loc !== 'overworld' || G.fly) return null;
  for (const L of live.values()) if (worldDist(L.l.x, L.l.z, G.pos.x, G.pos.z) < L.l.r + 6) return L.l;
  return null;
}
/** The deposit you stand on, for the HUD's place name. */
export function lodeName(x: number, z: number): string | null {
  for (const L of live.values()) if (worldDist(L.l.x, L.l.z, x, z) < L.l.r + 12) return L.l.name;
  return null;
}
/** Rocks and trees of the deposits (for G.obstacle). */
export function lodeHit(px: number, py: number, pz: number, r: number): boolean {
  for (const L of live.values()) {
    const x = px - L.g.position.x, z = pz - L.l.z;
    if (Math.abs(x) > L.l.r + 44 || Math.abs(z) > L.l.r + 44 || py > L.l.y + 30) continue;
    for (const [cx, cz, cr] of L.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
    if (L.wall) { // (0.186) the wall's ring, open at the gate
      const d = Math.hypot(x, z), w = L.wall;
      if (Math.abs(d - w.R) < w.th + r && Math.abs(((Math.atan2(z, x) - w.gate + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > w.half) return true;
    }
    for (const [x0, z0, x1, z1] of L.boxes) if (x > x0 - r && x < x1 + r && z > z0 - r && z < z1 + r) return true;
  }
  return false;
}
/** The orbital scan finds every deposit within r of (x, z); how many were new. */
export function scanLodes(x: number, z: number, r: number): number {
  let n = 0;
  for (const l of lodesWithin(G.char.world, x, z, r)) if (mark(l, 1)) n++;
  return n;
}
/** Asked in a town for news of the land (the 'rumour' option): the nearest deposit within `LODE_RUMOUR` not yet on your map. */
export const LODE_RUMOUR = 9000;
export function askLode(vx: number, vz: number): string | null {
  const c = G.char, l = lodesWithin(c.world, vx, vz, LODE_RUMOUR).find((o) => !c.lodes[o.id]);
  if (!l) return null;
  mark(l, 0); saveChar();
  const d = worldDist(vx, vz, l.x, l.z), km = d < 1000 ? `${Math.round(d / 100) * 100} m` : `${(d / 1000).toFixed(1)} km`;
  logLine(TL`Heard of: ${l.name} (marked on your map).`);
  const how = [tl('A trader told me of'), tl('The hunters speak of'), tl('My cousin came back from the wilds with news of'), tl('Folk say there is')][hash(c.world, l.x | 0, 0x10a3) % 4];
  return TL`${how} ${LODES[l.k].blurb}, about ${km} ${dirWord(wrapDx(l.x - vx), l.z - vz)} of here. ${l.name}, they call the place. It gives ${givesText(l)}. Nobody works it: nobody here has the people for it.`;
}
/** (0.186) The turret heads of the outposts drawn now, with their outpost's id (world/outpostraid.ts fires them). */
export function outpostGuns(): { id: string; gun: OutGun }[] {
  const out: { id: string; gun: OutGun }[] = [];
  for (const L of live.values()) for (const gun of L.guns) out.push({ id: L.l.id, gun });
  return out;
}
/** (0.186) Where an outpost's wall stands (world coordinates of its middle on your copy, the ring's radius), or null. */
export function outpostRing(id: string): { x: number; z: number; y: number; R: number } | null {
  const L = live.get(id);
  return L ? { x: L.g.position.x, z: L.l.z, y: L.l.y, R: outpostSpots(L.l).wallR } : null;
}
