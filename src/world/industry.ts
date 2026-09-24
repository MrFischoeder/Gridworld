// Every village's industry site outside the fence (gen/industry.ts): tilled fields, a mine, oil wells, a refinery
// (or its building site), a sawmill, fish racks, workshops or a salvage yard, with a sign. Pumpjacks nod and the
// refinery's flare burns while it produces; E at the site shows how it works and mends it when it is damaged.
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { add } from './render';
import { textSprite } from './npc';
import { ITEMS, type ItemKey } from '../data/items';
import { count } from '../data/crafting';
import { saveChar, gainXp, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { industryOf, industrySite, production, siteBuilt, siteCondition, INDUSTRY, type Industry } from '../gen/industry';
import { profileOf } from '../gen/market';
import { findPoi } from '../gen/regions';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, METAL = 0xa8c8b8, SOIL = 0x6f8f76, CROP = 0xd8ff7a, GRAIN = 0xe8d880, ROCK = 0x8fb89a, FLAME = 0xffb347, PIPE = 0xc8e0ff;
interface Site { id: number; seed: number; kind: Industry; town: string; x0: number; z0: number; x1: number; z1: number; beams: THREE.Object3D[]; flame: THREE.Object3D | null }
const sites = new Map<number, Site>();

/** A faceted cylinder standing on (x, y, z). */
function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, c: number, n = 10) {
  const P = (i: number, yy: number) => [x + Math.cos(i / n * 6.283) * r, yy, z + Math.sin(i / n * 6.283) * r];
  for (let i = 0; i < n; i++) { pb.face(P(i, y), P(i + 1, y), P(i + 1, y + h), P(i, y + h)); pb.seg(c, P(i, y + h), P(i + 1, y + h)); pb.seg(c, P(i, y), P(i + 1, y)); if (i % 2 === 0) pb.seg(c, P(i, y), P(i, y + h)); }
  const top: number[][] = []; for (let i = 0; i < n; i++) top.push(P(i, y + h)); pb.face(...top);
}
/** Draw the site of village vm (POI id) and remember it; returns its group. */
export function drawIndustry(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const c = G.char, poi = findPoi(c.world, id)!, kind = industryOf(c.world, poi, vm.seed), site = industrySite(vm.seed, kind);
  const grp = new THREE.Group(), pb = new PropBatch(), built = siteBuilt(kind, c.towns[id]);
  const x0 = vm.ox + site.x - site.w / 2, z0 = vm.oz + site.z - site.d / 2, x1 = x0 + site.w, z1 = z0 + site.d, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const [fx, fz] = site.face, rx = -fz, rz = fx, along = site.side === 'S' ? site.w : site.d, out = site.side === 'S' ? site.d : site.w;
  const P = (u: number, v: number): [number, number] => [cx + rx * u + fx * v, cz + rz * u + fz * v];
  const H = (u: number, v: number) => { const [x, z] = P(u, v); return T.heightAt(x, z); };
  const at = (u: number, v: number, dy = 0) => { const [x, z] = P(u, v); return [x, T.heightAt(x, z) + dy, z]; };
  const box = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, col: number) => {
    const [x, z] = P(u, v), ax = Math.abs(rx) * hu + Math.abs(fx) * hv, az = Math.abs(rz) * hu + Math.abs(fz) * hv;
    pb.box(x - ax, y0, z - az, x + ax, y1, z + az, col);
  };
  const shed = (u: number, v: number, hu: number, hv: number, h: number) => {
    const g = H(u, v); box(u, v, hu, hv, g - 0.1, g + h, WOOD);
    const [a, b] = P(u - hu, v - hv), [cc, d] = P(u + hu, v + hv);
    pb.gableRoof(Math.min(a, cc), Math.min(b, d), Math.max(a, cc), Math.max(b, d), g + h, 1.2, WOOD);
  };
  const beams: THREE.Object3D[] = [];
  let flame: THREE.Object3D | null = null;
  const makes = profileOf(c.world, poi, vm.seed).makes;
  if (kind === 'farm') {
    // rows of crops across the field, a furrow under each; a barn and a scarecrow
    const crop = makes[0];
    for (let u = -along / 2 + 1.5; u < along / 2 - 5; u += 1.6) {
      pb.line(SOIL, at(u, -out / 2 + 1, 0.03), at(u, 0, 0.03), at(u, out / 2 - 1, 0.03));
      for (let v = -out / 2 + 1.4; v < out / 2 - 1; v += 0.9) {
        const [x, y, z] = at(u, v);
        if (crop === 'grain') { pb.seg(GRAIN, [x, y, z], [x + 0.05, y + 0.9, z]); pb.seg(GRAIN, [x + 0.05, y + 0.9, z], [x + 0.12, y + 1.1, z + 0.05]); }
        else if (crop === 'carrots') { pb.seg(CROP, [x, y, z], [x - 0.18, y + 0.35, z]); pb.seg(CROP, [x, y, z], [x + 0.18, y + 0.35, z + 0.05]); pb.seg(CROP, [x, y, z], [x, y + 0.4, z - 0.1]); }
        else { pb.seg(CROP, [x - 0.25, y + 0.05, z], [x, y + 0.3, z]); pb.seg(CROP, [x, y + 0.3, z], [x + 0.25, y + 0.05, z]); }
      }
    }
    shed(along / 2 - 2.5, -out / 2 + 3, 2.2, 2.8, 3.2);
    const [sx, sy, sz] = at(0, 0);
    pb.seg(WOOD, [sx, sy, sz], [sx, sy + 2.2, sz]); pb.seg(WOOD, [sx - 0.8, sy + 1.6, sz], [sx + 0.8, sy + 1.6, sz]);
    pb.box(sx - 0.18, sy + 2.2, sz - 0.18, sx + 0.18, sy + 2.55, sz + 0.18, GRAIN);
  } else if (kind === 'mine') {
    // an adit into a spoil mound with a timber frame, rails out of it with an ore cart, and a headframe
    const [mx, my, mz] = at(0, out / 2 - 2.5);
    pb.rock(mx, my - 0.5, mz, 5.2, 4.2, 9, 0.4, ROCK);
    const post = (u: number) => box(u, out / 2 - 5.6, 0.18, 0.18, H(u, out / 2 - 5.6) - 0.1, H(0, out / 2 - 5.6) + 2.6, WOOD);
    post(-1.3); post(1.3); box(0, out / 2 - 5.6, 1.6, 0.2, H(0, out / 2 - 5.6) + 2.6, H(0, out / 2 - 5.6) + 2.95, WOOD);
    const d0 = at(-1.1, out / 2 - 5.45, 0), d1 = at(1.1, out / 2 - 5.45, 0);
    pb.face(d0, d1, [d1[0], d1[1] + 2.5, d1[2]], [d0[0], d0[1] + 2.5, d0[2]]); // the dark mouth
    for (const s of [-0.5, 0.5]) pb.line(METAL, at(s, out / 2 - 5.6, 0.1), at(s, -out / 2 + 1, 0.1));
    for (let v = -out / 2 + 1.5; v < out / 2 - 5.6; v += 1) pb.line(WOOD, at(-0.8, v, 0.05), at(0.8, v, 0.05));
    const cg = H(0, -1); box(0, -1, 0.7, 1, cg + 0.35, cg + 1.2, METAL); box(0, -1, 0.5, 0.7, cg + 1.2, cg + 1.4, ROCK);
    // headframe
    const hu = -along / 2 + 4, hv = -1, hg = H(hu, hv), top = hg + 9;
    const legs = [[-1.6, -1.6], [1.6, -1.6], [1.6, 1.6], [-1.6, 1.6]].map(([a, b]) => at(hu + a, hv + b));
    const [tx, , tz] = at(hu, hv);
    for (const l of legs) pb.seg(WOOD, l, [tx + (l[0] - tx) * 0.25, top, tz + (l[2] - tz) * 0.25]);
    for (let i = 0; i < 4; i++) pb.seg(WOOD, legs[i], [tx + (legs[(i + 1) % 4][0] - tx) * 0.6, hg + 5, tz + (legs[(i + 1) % 4][2] - tz) * 0.6]);
    const wheel: number[][] = []; for (let i = 0; i <= 12; i++) { const a = i / 12 * 6.283; wheel.push([tx + rx * Math.cos(a) * 1.1, top + 0.6 + Math.sin(a) * 1.1, tz + rz * Math.cos(a) * 1.1]); }
    pb.line(METAL, ...wheel); pb.seg(METAL, [tx, top + 0.6, tz], [tx, hg + 0.5, tz]);
    const [px, py, pz] = at(along / 2 - 3, -2); pb.cone(px, py - 0.2, pz, 3, 2.6, ROCK, 8); // spoil heap
  } else if (kind === 'oil') {
    for (const [u, v] of [[-along / 2 + 4, -2], [0, 2], [along / 2 - 4, -1]]) {
      const g = H(u, v);
      box(u, v, 0.6, 2.4, g - 0.1, g + 0.4, METAL);
      const [x, , z] = at(u, v), pv = g + 3.2;
      for (const s of [-0.6, 0.6]) { pb.seg(METAL, [x + rx * s + fx * 0.6, g + 0.4, z + rz * s + fz * 0.6], [x, pv, z]); pb.seg(METAL, [x + rx * s - fx * 0.6, g + 0.4, z + rz * s - fz * 0.6], [x, pv, z]); }
      // the walking beam with the horsehead, nodding round its pivot
      const bb = new PropBatch();
      bb.box(-0.15, -0.15, -2.4, 0.15, 0.15, 2.2, METAL);
      bb.solid8([[-0.2, -0.9, 2.2], [0.2, -0.9, 2.2], [0.2, -0.9, 2.6], [-0.2, -0.9, 2.6]], [[-0.2, 0.3, 2.2], [0.2, 0.3, 2.2], [0.2, 0.3, 2.7], [-0.2, 0.3, 2.7]], METAL);
      bb.box(-0.35, -0.9, -2.4, 0.35, -0.1, -1.8, METAL);
      bb.seg(PIPE, [0, -0.9, 2.55], [0, -3.1, 2.55]);
      const beam = bb.build(); beam.position.set(x, pv, z); beam.rotation.y = Math.atan2(fx, fz);
      const pivot = new THREE.Group(); pivot.add(beam); grp.add(pivot); beams.push(beam);
    }
    for (const u of [-along / 2 + 3, along / 2 - 3]) { const [x, y, z] = at(u, out / 2 - 3); cyl(pb, x, y - 0.1, z, 2.2, 3.4, METAL); }
    pb.line(PIPE, at(-along / 2 + 4, -2, 0.3), at(-along / 2 + 3, out / 2 - 3, 0.3)); pb.line(PIPE, at(along / 2 - 4, -1, 0.3), at(along / 2 - 3, out / 2 - 3, 0.3));
  } else if (kind === 'refinery') {
    if (built) {
      const [ax, ay, az] = at(-3, 1), [bx, by, bz] = at(0.5, 2.5);
      cyl(pb, ax, ay - 0.1, az, 1.1, 12, METAL); cyl(pb, bx, by - 0.1, bz, 0.8, 9, METAL);
      for (const [x, y, z, h] of [[ax, ay, az, 12], [bx, by, bz, 9]]) for (let k = 2; k < h; k += 2.5) pb.line(PIPE, [x - 1.2, y + k, z], [x + 1.2, y + k, z]);
      for (const u of [along / 2 - 3, along / 2 - 7.5]) { const [x, y, z] = at(u, out / 2 - 3.5); cyl(pb, x, y - 0.1, z, 2.3, 3.8, METAL); }
      for (const h of [2.2, 3]) pb.line(PIPE, at(-3, 1, h), at(0.5, 2.5, h), at(along / 2 - 3, out / 2 - 3.5, h * 0.8), at(along / 2 - 7.5, out / 2 - 3.5, h * 0.8));
      const [fx0, fy0, fz0] = at(-along / 2 + 2.5, -out / 2 + 3);
      cyl(pb, fx0, fy0 - 0.1, fz0, 0.25, 14, METAL, 6);
      const fl = new PropBatch();
      for (let i = 0; i < 7; i++) { const a = i / 7 * 6.283; fl.seg(FLAME, [Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3], [Math.cos(a + 1) * 0.1, 1.4 + (i % 3) * 0.3, Math.sin(a + 1) * 0.1]); }
      flame = fl.build(); flame.position.set(fx0, fy0 + 14, fz0); grp.add(flame);
    } else {
      // the building site: a foundation outline, scaffolding and stacked materials
      pb.line(WOOD, at(-along / 2 + 1, -out / 2 + 1, 0.05), at(along / 2 - 1, -out / 2 + 1, 0.05), at(along / 2 - 1, out / 2 - 1, 0.05), at(-along / 2 + 1, out / 2 - 1, 0.05), at(-along / 2 + 1, -out / 2 + 1, 0.05));
      for (const [u, v] of [[-3, 1], [0.5, 2.5]]) for (const h of [0, 2, 4, 6]) {
        const c4 = [[-1.4, -1.4], [1.4, -1.4], [1.4, 1.4], [-1.4, 1.4]].map(([a, b]) => at(u + a, v + b, h));
        pb.line(WOOD, ...c4, c4[0]); if (h < 6) for (const q of c4) pb.seg(WOOD, q, [q[0], q[1] + 2, q[2]]);
      }
      box(along / 2 - 4, 0, 1.5, 1, H(along / 2 - 4, 0), H(along / 2 - 4, 0) + 0.8, WOOD); box(along / 2 - 4, 2.5, 1.2, 0.9, H(along / 2 - 4, 2.5), H(along / 2 - 4, 2.5) + 1, METAL);
    }
  } else if (kind === 'lumber') {
    shed(-along / 2 + 4, 0, 3, 3.5, 3.2);
    for (const [u, v] of [[2, -2], [2, 2.5], [6, 0]]) for (let k = 0; k < 3; k++) { const g = H(u, v); box(u, v + (k - 1) * 0.6, 2.2, 0.28, g + k * 0.2, g + k * 0.2 + 0.55, WOOD); }
    const [x, y, z] = at(along / 2 - 3, out / 2 - 3); pb.cone(x, y - 0.1, z, 1.8, 1.4, GRAIN, 7);
  } else if (kind === 'fishery') {
    for (const v of [-3, 0, 3]) {
      const a = at(-along / 2 + 3, v), b = at(along / 2 - 6, v);
      for (const q of [a, b]) pb.seg(WOOD, q, [q[0], q[1] + 2.2, q[2]]);
      pb.seg(WOOD, [a[0], a[1] + 2.1, a[2]], [b[0], b[1] + 2.1, b[2]]);
      for (let t = 0.1; t < 0.95; t += 0.09) { const x = a[0] + (b[0] - a[0]) * t, z = a[2] + (b[2] - a[2]) * t, y = a[1] + (b[1] - a[1]) * t + 2.1; pb.line(PIPE, [x, y, z], [x + 0.08, y - 0.3, z], [x, y - 0.6, z], [x - 0.08, y - 0.3, z], [x, y, z]); }
    }
    shed(along / 2 - 3, 0, 2, 2.5, 2.8);
    for (const u of [-2, 1]) box(u, out / 2 - 2, 1.2, 0.8, H(u, out / 2 - 2), H(u, out / 2 - 2) + 0.25, PIPE);
  } else if (kind === 'workshop') {
    shed(-3, 0, 3, 3, 3.4); shed(4, 1, 2.5, 2.5, 3);
    for (const [u, v] of [[-4, 1], [4.5, 2]]) { const g = H(u, v); box(u, v, 0.3, 0.3, g + 2.5, g + 5.2, ROCK); }
    for (const u of [0, 1.2]) box(u, -out / 2 + 2, 0.5, 0.5, H(u, -out / 2 + 2), H(u, -out / 2 + 2) + 0.9, WOOD);
  } else {
    for (const [u, v, r] of [[-4, 1, 2.6], [1, 3, 2.1], [5, -1, 2.4]]) { const [x, y, z] = at(u, v); pb.rock(x, y - 0.3, z, r, r * 0.8, 7, u, METAL); }
    const [mx, my, mz] = at(-along / 2 + 2.5, -out / 2 + 2.5);
    pb.box(mx - 0.3, my, mz - 0.3, mx + 0.3, my + 8, mz + 0.3, METAL);
    const [ex, , ez] = at(-along / 2 + 9, -out / 2 + 2.5); pb.seg(METAL, [mx, my + 7.8, mz], [ex, my + 7.4, ez]); pb.seg(PIPE, [ex, my + 7.4, ez], [ex, my + 3, ez]);
  }
  // a signpost at the front, facing the village
  const [sgx, sgy, sgz] = at(0, -out / 2 - 1.5);
  pb.box(sgx - 0.08, sgy, sgz - 0.08, sgx + 0.08, sgy + 2.6, sgz + 0.08, WOOD);
  grp.add(pb.build());
  const label = INDUSTRY[kind].site.toUpperCase() + (kind === 'refinery' && !built ? ' (PLANNED)' : ''), sign = textSprite(label, '#ffd060', 3.2);
  sign.position.set(sgx, sgy + 3, sgz); grp.add(sign);
  sites.set(id, { id, seed: vm.seed, kind, town: vm.name, x0, z0, x1, z1, beams, flame });
  return grp;
}
export function forgetIndustry(id: number) { sites.delete(id); }

const prodOf = (s: Site) => { const poi = findPoi(G.char.world, s.id); return poi ? production(G.char.world, poi, s.seed, G.char.towns[s.id], G.char.time) : 1; };
let prodT = 0;
const prodNow = new Map<number, number>();
/** Once a frame: pumpjacks nod and the flare burns, as fast as the site works. */
export function updateIndustry(dt: number) {
  if ((prodT -= dt) <= 0) { prodT = 2; for (const s of sites.values()) prodNow.set(s.id, prodOf(s)); }
  const t = performance.now() / 1000;
  for (const s of sites.values()) {
    const p = prodNow.get(s.id) ?? 1;
    s.beams.forEach((b, i) => { b.rotation.x = p > 0.2 ? Math.sin(t * 1.4 * p + i * 1.7) * 0.32 : 0; });
    if (s.flame) { s.flame.visible = p > 0.2; s.flame.scale.set(1, 0.8 + Math.sin(t * 9) * 0.2 + Math.sin(t * 13.7) * 0.1, 1); }
  }
}
/** The site you stand at (within a few metres of it). */
export function nearSite(): Site | null {
  if (G.char.loc !== 'overworld') return null;
  for (const s of sites.values()) if (Math.hypot(Math.max(s.x0 - G.pos.x, 0, G.pos.x - s.x1), Math.max(s.z0 - G.pos.z, 0, G.pos.z - s.z1)) < 2.5) return s;
  return null;
}
const need = (k: Industry) => INDUSTRY[k].fix.map(([i, n]) => `${n} ${ITEMS[i].name}`).join(', ');
const hasAll = (k: Industry) => INDUSTRY[k].fix.every(([i, n]) => count(G.char.inv, i) >= n);
export function sitePrompt(s: Site): string {
  const spec = INDUSTRY[s.kind];
  if (!siteBuilt(s.kind, G.char.towns[s.id])) return `${s.town}'s ${spec.site} is still to be built: ask the elder about it`;
  const poi = findPoi(G.char.world, s.id), c = poi ? Math.round(siteCondition(G.char.world, poi, G.char.towns[s.id], G.char.time)) : 100;
  if (c >= 90) return `${s.town}'s ${spec.site}: working (${c}%)`;
  return hasAll(s.kind) ? `E — mend the ${spec.site} (${c}%): uses ${need(s.kind)}` : `The ${spec.site} is damaged (${c}%): bring ${need(s.kind)} to mend it`;
}
/** Mend the site with the parts from your backpack; the village pays you. */
export function repairSite(s: Site) {
  const poi = findPoi(G.char.world, s.id);
  if (!poi || !siteBuilt(s.kind, G.char.towns[s.id])) return;
  const c = siteCondition(G.char.world, poi, G.char.towns[s.id], G.char.time), spec = INDUSTRY[s.kind];
  if (c >= 90) { logLine(`The ${spec.site} works well.`); return; }
  if (!hasAll(s.kind)) { logLine(`To mend the ${spec.site} you need ${need(s.kind)}.`); return; }
  for (const [k, n] of spec.fix) take(k, n);
  const st = (G.char.towns[s.id] ??= {});
  st.siteFixed = G.char.time; st.siteHurt = 0;
  const pay = Math.round(40 + (100 - c) * 0.8);
  G.char.gold += pay; calcStats(); gainXp(25); saveChar(); prodT = 0;
  showToast(`${spec.site} mended`); logLine(`${s.town}'s ${spec.site} is back at work. The villagers pay you ${pay} gold.`);
}
function take(k: ItemKey, n: number) {
  const inv = G.char.inv;
  for (let i = 0; i < inv.length && n > 0; i++) { const x = inv[i]; if (x?.k === k) { const m = Math.min(n, x.n); x.n -= m; n -= m; if (x.n <= 0) inv[i] = null; } }
}
/** The site's middle (for the raids). */
export const siteCentre = (id: number) => { const s = sites.get(id); return s ? { x: (s.x0 + s.x1) / 2, z: (s.z0 + s.z1) / 2 } : null; };
void add;
