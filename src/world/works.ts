// The processing works outside a village's fence (gen/plants.ts): drawn by kind, a building site while one is being
// put up, staked plots where there is room for more; a loading hopper and an output bay by each; a glow and smoke
// that show while it works. E at a works opens its window (ui/works.ts).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { add } from './render';
import { findPoi } from '../gen/regions';
import { industryOf } from '../gen/industry';
import { PLANTS, PLANT_SLOTS, plantSite, plantsOf, running, runPlant, type PlantKind } from '../gen/plants';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, METAL = 0xb8c4cc, BRICK = 0xd09070, GLASS = 0x9dffe0, STEELC = 0x8fb89a, HOT = 0xffb347, FLAG = 0xffd060;
export interface Works { vid: number; slot: number; town: string; x0: number; z0: number; x1: number; z1: number; glow: THREE.Object3D | null }
const placed = new Map<number, Works[]>();

/** A faceted cylinder standing on (x, y, z). */
function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, c: number, n = 10, r2 = r) {
  const P = (i: number, yy: number, rr: number) => [x + Math.cos(i / n * 6.283) * rr, yy, z + Math.sin(i / n * 6.283) * rr];
  for (let i = 0; i < n; i++) {
    pb.face(P(i, y, r), P(i + 1, y, r), P(i + 1, y + h, r2), P(i, y + h, r2));
    pb.seg(c, P(i, y + h, r2), P(i + 1, y + h, r2)); pb.seg(c, P(i, y, r), P(i + 1, y, r)); if (i % 2 === 0) pb.seg(c, P(i, y, r), P(i, y + h, r2));
  }
  const top: number[][] = []; for (let i = 0; i < n; i++) top.push(P(i, y + h, r2)); pb.face(...top);
}
/** A dome (a stack of rings) on (x, y, z). */
function dome(pb: PropBatch, x: number, y: number, z: number, r: number, c: number) {
  const n = 10, rows = 4, P = (i: number, j: number) => { const a = i / n * 6.283, b = j / rows * Math.PI / 2; return [x + Math.cos(a) * r * Math.cos(b), y + Math.sin(b) * r, z + Math.sin(a) * r * Math.cos(b)]; };
  for (let j = 0; j < rows; j++) for (let i = 0; i < n; i++) { pb.face(P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)); pb.seg(c, P(i, j), P(i + 1, j)); if (i % 2 === 0) pb.seg(c, P(i, j), P(i, j + 1)); }
}

/** Draw the works (built, being built, empty plots) of village vm, and remember where they stand. */
export function drawWorks(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), c = G.char, st = c.towns[id], poi = findPoi(c.world, id);
  const list: Works[] = [];
  if (!poi) return grp;
  const ind = industryOf(c.world, poi, vm.seed), plants = plantsOf(st);
  for (let slot = 0; slot < PLANT_SLOTS; slot++) {
    const s = plantSite(vm.seed, ind, slot), cx = vm.ox + s.x, cz = vm.oz + s.z, [fx, fz] = s.face, rx = -fz, rz = fx;
    const along = s.side === 'S' ? s.w : s.d, out = s.side === 'S' ? s.d : s.w;
    const P = (u: number, v: number): [number, number] => [cx + rx * u + fx * v, cz + rz * u + fz * v];
    const H = (u: number, v: number) => { const [x, z] = P(u, v); return T.heightAt(x, z); };
    const box = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, col: number) => {
      const [x, z] = P(u, v), ax = Math.abs(rx) * hu + Math.abs(fx) * hv, az = Math.abs(rz) * hu + Math.abs(fz) * hv;
      pb.box(x - ax, y0, z - az, x + ax, y1, z + az, col);
    };
    const shed = (u: number, v: number, hu: number, hv: number, h: number, col = WOOD) => {
      const g = H(u, v); box(u, v, hu, hv, g - 0.1, g + h, col);
      const [a, b] = P(u - hu, v - hv), [cc, d] = P(u + hu, v + hv);
      pb.gableRoof(Math.min(a, cc), Math.min(b, d), Math.max(a, cc), Math.max(b, d), g + h, 1.3, col);
    };
    const cylAt = (u: number, v: number, r: number, h: number, col: number, lift = 0, r2 = r) => { const [x, z] = P(u, v); cyl(pb, x, H(u, v) + lift, z, r, h, col, 10, r2); };
    const [x0a, z0a] = P(-along / 2, -out / 2), [x1a, z1a] = P(along / 2, out / 2);
    const w: Works = { vid: id, slot, town: vm.name, x0: Math.min(x0a, x1a), z0: Math.min(z0a, z1a), x1: Math.max(x0a, x1a), z1: Math.max(z0a, z1a), glow: null };
    const p = plants[slot], k: PlantKind | undefined = p?.k;
    if (!p) {
      // a staked plot (and, if the elder has one going up here, the building site)
      const building = slot === plants.length && st?.pbuild;
      for (const [u, v] of [[-along / 2 + 1, -out / 2 + 1], [along / 2 - 1, -out / 2 + 1], [along / 2 - 1, out / 2 - 1], [-along / 2 + 1, out / 2 - 1]]) {
        const [x, z] = P(u, v), g = T.heightAt(x, z); pb.box(x - 0.06, g, z - 0.06, x + 0.06, g + 1.1, z + 0.06, WOOD);
        pb.seg(FLAG, [x, g + 1.1, z], [x + 0.3, g + 0.95, z]);
      }
      if (building) {
        const g = H(0, 0);
        for (let u = -along / 2 + 2; u <= along / 2 - 2; u += 3) for (const v of [-out / 2 + 2, out / 2 - 2]) { const [x, z] = P(u, v); pb.box(x - 0.08, g, z - 0.08, x + 0.08, g + 6, z + 0.08, WOOD); }
        for (let y = 2; y <= 6; y += 2) box(0, -out / 2 + 2, along / 2 - 2, 0.05, g + y, g + y + 0.12, WOOD), box(0, out / 2 - 2, along / 2 - 2, 0.05, g + y, g + y + 0.12, WOOD);
        for (let i = 0; i < 4; i++) box(-along / 2 + 3 + i * 1.3, 0, 0.5, 0.8, g, g + 0.6 + (i % 2) * 0.4, i % 2 ? BRICK : WOOD);
      }
      list.push(w); continue;
    }
    // the hopper (a funnel on legs) and the output bay (a pallet) at the side facing the village
    { const [hx, hz] = P(-along / 2 + 2, -out / 2 + 1.5), g = T.heightAt(hx, hz);
      for (const [a, b] of [[-0.6, -0.6], [0.6, -0.6], [0.6, 0.6], [-0.6, 0.6]]) pb.seg(METAL, [hx + a, g, hz + b], [hx + a * 0.9, g + 1.6, hz + b * 0.9]);
      pb.solid8([[hx - 0.3, g + 1.6, hz - 0.3], [hx + 0.3, g + 1.6, hz - 0.3], [hx + 0.3, g + 1.6, hz + 0.3], [hx - 0.3, g + 1.6, hz + 0.3]], [[hx - 0.9, g + 2.6, hz - 0.9], [hx + 0.9, g + 2.6, hz - 0.9], [hx + 0.9, g + 2.6, hz + 0.9], [hx - 0.9, g + 2.6, hz + 0.9]], METAL); }
    box(along / 2 - 2.5, -out / 2 + 1.5, 1.2, 1, H(along / 2 - 2.5, -out / 2 + 1.5), H(along / 2 - 2.5, -out / 2 + 1.5) + 0.2, WOOD);
    let glowAt: [number, number, number] = [cx, H(0, 0) + 3, cz];
    const g0 = H(0, 1);
    switch (k) {
      case 'smelter': { // a blast furnace, its stack, a skip incline, the casting shed
        cylAt(2, 2, 2.4, 9, BRICK, 0, 1.7); cylAt(2, 2, 0.7, 7, BRICK, 9);
        const [a, b] = P(-5, 2), [d, e] = P(1, 2); pb.line(METAL, [a, H(-5, 2), b], [d, g0 + 9, e]); pb.line(METAL, [a, H(-5, 2) + 0.4, b], [d, g0 + 9.4, e]);
        shed(-3, -2.5, 3.5, 2.2, 3.2, BRICK); glowAt = [P(2, -0.4)[0], g0 + 1, P(2, -0.4)[1]];
        break;
      }
      case 'refinery': {
        cylAt(-3, 2, 1.1, 12, METAL); cylAt(0, 3, 0.9, 9, METAL);
        for (const [u, v] of [[4, 3], [6.5, 3], [5, -1]]) cylAt(u, v, 1.4, 3, METAL);
        box(0, -1, 5, 0.15, g0 + 2.5, g0 + 2.8, METAL);
        cylAt(-7, -3, 0.25, 10, METAL); glowAt = [P(-7, -3)[0], H(-7, -3) + 10.6, P(-7, -3)[1]];
        break;
      }
      case 'glassworks': {
        const [x, z] = P(-2, 2); dome(pb, x, H(-2, 2), z, 3.2, BRICK); cylAt(-2, 2, 0.5, 5, BRICK, 3);
        shed(4, 1, 3, 2.5, 3.2);
        for (let i = 0; i < 4; i++) { const [a, b] = P(-6 + i * 0.8, -3), g = H(-6, -3); pb.line(GLASS, [a, g, b], [a, g + 1.6, b], [a + fx * 1.2, g + 1.6, b + fz * 1.2], [a + fx * 1.2, g, b + fz * 1.2]); }
        glowAt = [P(-2, -1.3)[0], H(-2, 2) + 1, P(-2, -1.3)[1]];
        break;
      }
      case 'wiremill': {
        shed(0, 1.5, 6, 3, 3.6);
        for (let i = 0; i < 4; i++) { const [x, z] = P(-5 + i * 2.6, -3.5), g = H(-5 + i * 2.6, -3.5); cyl(pb, x, g, z, 0.8, 0.6, HOT, 10); cyl(pb, x, g + 0.6, z, 0.35, 0.3, METAL, 8); }
        glowAt = [P(0, -1.6)[0], g0 + 2, P(0, -1.6)[1]];
        break;
      }
      case 'electronics': {
        box(0, 1.5, 5.5, 3, g0 - 0.1, g0 + 4, STEELC);
        for (let u = -4.5; u <= 4.5; u += 1.5) { const [a, b] = P(u, -1.52), [d, e] = P(u + 1, -1.52); pb.line(GLASS, [a, g0 + 1.4, b], [d, g0 + 1.4, e], [d, g0 + 2.6, e], [a, g0 + 2.6, b], [a, g0 + 1.4, b]); }
        { const [x, z] = P(3.5, 2.5); pb.box(x - 0.08, g0 + 4, z - 0.08, x + 0.08, g0 + 9, z + 0.08, METAL); pb.seg(METAL, [x - 1, g0 + 8, z], [x + 1, g0 + 8, z]); }
        { const [x, z] = P(-3.5, 2.5); cyl(pb, x, g0 + 4, z, 0.9, 0.2, METAL, 10); }
        glowAt = [P(0, -1.6)[0], g0 + 3.2, P(0, -1.6)[1]];
        break;
      }
      case 'machineshop': {
        box(0, 1.5, 6, 3, g0 - 0.1, g0 + 4, WOOD);
        for (let u = -6; u < 6; u += 2) { const [a, b] = P(u, -1.5), [d, e] = P(u, 4.5), [a2, b2] = P(u + 2, -1.5), [d2, e2] = P(u + 2, 4.5); pb.face([a, g0 + 4, b], [d, g0 + 4, e], [d, g0 + 5.4, e], [a, g0 + 5.4, b]); pb.line(WOOD, [a, g0 + 5.4, b], [d, g0 + 5.4, e], [d2, g0 + 4, e2], [a2, g0 + 4, b2], [a, g0 + 5.4, b]); }
        for (const u of [-7.5, 7.5]) { const [x, z] = P(u, -3); pb.box(x - 0.15, g0, z - 0.15, x + 0.15, g0 + 5, z + 0.15, FLAG); }
        box(0, -3, 7.7, 0.15, g0 + 5, g0 + 5.3, FLAG);
        glowAt = [P(0, -1.6)[0], g0 + 2, P(0, -1.6)[1]];
        break;
      }
      case 'foundry': {
        cylAt(-2, 2, 2.2, 7, BRICK, 0, 1.6); cylAt(-2, 2, 0.6, 9, BRICK, 7);
        for (const u of [1, 6]) { const [x, z] = P(u, -1); pb.box(x - 0.2, g0, z - 0.2, x + 0.2, g0 + 6, z + 0.2, METAL); }
        box(3.5, -1, 2.7, 0.2, g0 + 6, g0 + 6.4, METAL);
        cylAt(3.5, -1, 0.7, 0.9, HOT, 3.5, 0.9);
        for (let i = 0; i < 5; i++) box(-6 + i * 1.3, -3.5, 0.5, 0.35, H(-6, -3.5), H(-6, -3.5) + 0.25, STEELC);
        glowAt = [P(3.5, -1)[0], g0 + 4.2, P(3.5, -1)[1]];
        break;
      }
      case 'chemworks': {
        for (const [u, v] of [[-4, 2], [0, 2.5]]) { const [x, z] = P(u, v), g = H(u, v); cyl(pb, x, g, z, 0.3, 1.2, METAL, 6); dome(pb, x, g + 1.2, z, 1.8, METAL); }
        cylAt(4, 2, 0.8, 8, METAL); shed(4, -2, 2.5, 1.5, 2.8);
        for (let u = -4; u <= 4; u += 2) { const [a, b] = P(u, 0), [d, e] = P(u + 2, 0); pb.seg(HOT, [a, g0 + 1.5, b], [d, g0 + 1.5, e]); }
        glowAt = [P(4, 2)[0], g0 + 8.6, P(4, 2)[1]];
        break;
      }
    }
    // the glow of the furnace (or the lit windows) while it works
    const fl = new PropBatch();
    fl.seg(HOT, [0, 0, 0], [0, 0.9, 0]); fl.seg(HOT, [-0.3, 0.2, 0], [0.3, 0.2, 0]); fl.seg(HOT, [0, 0.2, -0.3], [0, 0.2, 0.3]);
    const glow = fl.build(); glow.position.set(...glowAt); glow.traverse((o) => { if ((o as THREE.LineSegments).material) (o as THREE.LineSegments).material = add(HOT); }); grp.add(glow);
    w.glow = glow;
    list.push(w);
  }
  placed.set(id, list);
  grp.add(pb.build());
  return grp;
}
export function forgetWorks(id: number) { placed.delete(id); }

let tick = 0;
/** Twice a second: the glow shows while a works has something to do. */
export function updateWorks(dt: number) {
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const t = performance.now() / 1000;
  for (const list of placed.values()) for (const w of list) {
    if (!w.glow) continue;
    const p = plantsOf(G.char.towns[w.vid])[w.slot];
    if (!p) continue;
    runPlant(p, G.char.time);
    w.glow.visible = running(p);
    w.glow.scale.setScalar(0.8 + Math.sin(t * 7 + w.slot) * 0.2);
  }
}
/** The works (or plot) you stand at. */
export function nearWorks(): Works | null {
  if (G.char.loc !== 'overworld') return null;
  for (const list of placed.values()) for (const w of list) if (Math.hypot(Math.max(w.x0 - G.pos.x, 0, G.pos.x - w.x1), Math.max(w.z0 - G.pos.z, 0, G.pos.z - w.z1)) < 2.5) return w;
  return null;
}
export function worksPrompt(w: Works): string {
  const st = G.char.towns[w.vid], p = plantsOf(st)[w.slot];
  if (!p) return st?.pbuild && w.slot === plantsOf(st).length ? `${/^[AEIOU]/.test(PLANTS[st.pbuild.k].name) ? 'An' : 'A'} ${PLANTS[st.pbuild.k].name} is going up here: the elder keeps count of the materials` : 'An empty plot for a works: ask the elder';
  runPlant(p, G.char.time);
  const ready = Object.values(p.out).reduce((a, n) => a + (n ?? 0), 0);
  return `E — the ${PLANTS[p.k].name} (${running(p) ? 'working' : 'idle'}${ready ? ` · ${ready} crate${ready > 1 ? 's' : ''} ready` : ''})`;
}
