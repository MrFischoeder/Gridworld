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

interface Live { l: Lode; g: THREE.Group; rings: [number, number, number][]; oil?: OilMotion }
const live = new Map<string, Live>();
const STONE = [0xb2b2a3, 0x88978f], ROCK = 0x89988b;

/** What a deposit gives, in words. */
export const givesText = (l: Lode) => lodeGives(l).map((k) => ITEMS[k].name.replace(/^Crate of /, '').toLowerCase()).join(', ');

function build(T: Terrain, l: Lode): Live {
  const gx = nearX(l.x, G.pos.x), H = (x: number, z: number) => T.heightAt(gx + x, l.z + z) - l.y;
  const pb = new PropBatch(), L: Live = { l, g: new THREE.Group(), rings: [] }, R = rng(hash(T.world, l.x | 0, l.z | 0, 0x10a1));
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
  L.g.add(pb.build());
  L.g.position.set(gx, l.y, l.z);
  scene.add(L.g);
  return L;
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
  for (const L of live.values()) if (L.oil) animateOil(L.oil, time);
  if ((tick -= dt) > 0) return;
  tick = 0.5;
  const near = lodesNear(T.world, G.pos.x, G.pos.z, 520);
  for (const [id, L] of live) if (!near.some((l) => l.id === id) || Math.abs(L.g.position.x - G.pos.x) > 700) { drop(L); live.delete(id); }
  for (const l of near) if (!live.has(l.id)) live.set(l.id, build(T, l));
  for (const l of near) if (worldDist(l.x, l.z, G.pos.x, G.pos.z) < l.r + 70 && mark(l, 1)) {
    saveChar(); showToast('Deposit found: ' + LODES[l.k].name);
    logLine(`You found ${l.name}: ${LODES[l.k].blurb}. It gives ${givesText(l)} (richness ${Math.round(l.rich * 100)}%). Marked on your map.`);
  }
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
    if (Math.abs(x) > 40 || Math.abs(z) > 40 || py > L.l.y + 30) continue;
    for (const [cx, cz, cr] of L.rings) if (Math.hypot(x - cx, z - cz) < cr + r) return true;
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
  const d = worldDist(vx, vz, l.x, l.z), km = d < 1000 ? `${Math.round(d / 100) * 100} metres` : `${(d / 1000).toFixed(1)} km`;
  logLine(`Heard of: ${l.name} (marked on your map).`);
  const how = ['A trader told me of', 'The hunters speak of', 'My cousin came back from the wilds with news of', 'Folk say there is'][hash(c.world, l.x | 0, 0x10a3) % 4];
  return `${how} ${LODES[l.k].blurb}, about ${km} ${dirWord(wrapDx(l.x - vx), l.z - vz)} of here. ${l.name}, they call the place. It gives ${givesText(l)}. Nobody works it: nobody here has the people for it.`;
}
