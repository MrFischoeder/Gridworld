// The village hall (gen/hall.ts) outside every village's north wall: a timber-framed storage hall on the terrain with
// a doorway facing the wall, shelving along the walls, crates stacked by how full the hold is, and the terminal
// against the back wall. Its walls collide (`hallHit`); E at the terminal (`nearHallTerminal`) opens ui/hall.ts. The
// crates are a group of their own, redrawn when the hold changes (`refreshHall`).
import * as THREE from 'three';
import { G, W } from '../game';
import { PropBatch } from './props';
import { wallSign } from './level';
import { HALL, HALL_TERMINAL, holdVol } from '../gen/hall';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, METAL = 0xb8c4cc, SCREEN = 0x9dffe0, CRATE = 0xc8a060;
interface Hall { id: number; ox: number; oz: number; y0: number; segs: [number, number, number, number][]; crates: THREE.Group | null; grp: THREE.Group; T: Terrain }
const halls = new Map<number, Hall>();

/** Draw the hall of village vm (id `id`); returns its group (added to the village's). */
export function drawHall(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), ox = vm.ox, oz = vm.oz;
  const X0 = ox + HALL.x0, X1 = ox + HALL.x1, Z0 = oz + HALL.z0, Z1 = oz + HALL.z1, dx = ox + (HALL.x0 + HALL.x1) / 2;
  const y0 = Math.min(T.heightAt(X0, Z0), T.heightAt(X1, Z0), T.heightAt(X0, Z1), T.heightAt(X1, Z1)) - 0.3, top = y0 + HALL.h;
  const segs: Hall['segs'] = [];
  // plank walls: fill, posts every 2 m, a sill and a top plate; the doorway in the south wall (towards the village)
  const wall = (ax: number, az: number, bx: number, bz: number) => {
    pb.face([ax, y0, az], [bx, y0, bz], [bx, top, bz], [ax, top, az]);
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / 2));
    for (let i = 0; i <= n; i++) { const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n; pb.seg(WOOD, [x, y0, z], [x, top, z]); }
    pb.seg(WOOD, [ax, y0 + 0.4, az], [bx, y0 + 0.4, bz]); pb.seg(WOOD, [ax, top, az], [bx, top, bz]);
    segs.push([ax, az, bx, bz]);
  };
  const d0 = dx - HALL.door / 2, d1 = dx + HALL.door / 2, dh = 2.6;
  wall(X0, Z0, X1, Z0); wall(X1, Z0, X1, Z1); wall(X0, Z1, X0, Z0);
  wall(X1, Z1, d1, Z1); wall(d0, Z1, X0, Z1);
  pb.face([d1, y0 + dh, Z1], [d0, y0 + dh, Z1], [d0, top, Z1], [d1, top, Z1]); pb.line(WOOD, [d0, y0, Z1], [d0, y0 + dh, Z1], [d1, y0 + dh, Z1], [d1, y0, Z1]);
  pb.gableRoof(X0 - 0.4, Z0 - 0.4, X1 + 0.4, Z1 + 0.4, top, 1.6, WOOD);
  // shelving along the side walls
  for (const x of [X0 + 0.5, X1 - 0.5]) for (const h of [0.5, 1.3, 2.1]) pb.line(METAL, [x, y0 + h, Z0 + 0.8], [x, y0 + h, Z1 - 0.8]);
  for (const x of [X0 + 0.5, X1 - 0.5]) for (let z = Z0 + 0.8; z <= Z1 - 0.79; z += 2.1) pb.seg(METAL, [x, y0, z], [x, y0 + 2.3, z]);
  // the terminal against the back wall: a desk, a screen with lines of text, a case
  { const tx = ox + HALL_TERMINAL.x, tz = oz + HALL_TERMINAL.z;
    pb.box(tx - 0.7, y0, tz - 0.35, tx + 0.7, y0 + 1.05, tz + 0.35, METAL);
    pb.box(tx - 0.45, y0 + 1.05, tz - 0.25, tx + 0.45, y0 + 1.7, tz - 0.15, METAL);
    for (let i = 0; i < 4; i++) pb.seg(SCREEN, [tx - 0.35, y0 + 1.58 - i * 0.12, tz - 0.14], [tx - 0.35 + 0.25 + (i % 3) * 0.15, y0 + 1.58 - i * 0.12, tz - 0.14]);
    segs.push([tx - 0.7, tz - 0.35, tx + 0.7, tz - 0.35], [tx - 0.7, tz + 0.35, tx + 0.7, tz + 0.35]);
  }
  grp.add(pb.build());
  grp.add(wallSign('VILLAGE HALL', '#ffd060', { x: dx, z: Z1 }, [0, 1], top - 0.6));
  const h: Hall = { id, ox, oz, y0, segs, crates: null, grp, T };
  halls.set(id, h);
  drawCrates(h);
  return grp;
}
/** Crates stacked along the walls, one for every 250 litres in the hold (at most 40). */
function drawCrates(h: Hall) {
  if (h.crates) { h.grp.remove(h.crates); h.crates.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  const pb = new PropBatch(), n = Math.min(40, Math.ceil(holdVol(G.char.towns[h.id]) / 250));
  for (let i = 0; i < n; i++) {
    const row = i % 20, lay = Math.floor(i / 20), side = row % 2, k = Math.floor(row / 2);
    const x = h.ox + (side ? HALL.x1 - 1.6 : HALL.x0 + 1.6), z = h.oz + HALL.z0 + 1.1 + k * 0.62, y = h.y0 + lay * 0.6;
    if (z > h.oz + HALL.z1 - 1.8) continue;
    pb.box(x - 0.28, y, z - 0.28, x + 0.28, y + 0.56, z + 0.28, CRATE);
  }
  h.crates = pb.build();
  // the village's group may have been moved to its own origin (render.ts localize): undo that for the new geometry
  const p = h.grp.parent; if (p) h.crates.position.set(-p.position.x, 0, -p.position.z);
  h.grp.add(h.crates);
}
export function refreshHall(id: number) { const h = halls.get(id); if (h) drawCrates(h); }
export function forgetHall(id: number) { halls.delete(id); }

/** The hall's walls, the doorway left open (for G.obstacle). */
export function hallHit(px: number, py: number, pz: number, r: number): boolean {
  for (const h of halls.values()) {
    if (px < h.ox + HALL.x0 - 2 || px > h.ox + HALL.x1 + 2 || pz < h.oz + HALL.z0 - 2 || pz > h.oz + HALL.z1 + 2 || py > h.y0 + HALL.h + 2) continue;
    for (const [ax, az, bx, bz] of h.segs) {
      const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = L ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L)) : 0;
      if (Math.hypot(px - ax - ex * t, pz - az - ez * t) < r + 0.15) return true;
    }
  }
  return false;
}
/** Standing at a hall's terminal: the village's id. */
export function nearHallTerminal(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const h of halls.values()) if (Math.hypot(G.pos.x - (h.ox + HALL_TERMINAL.stand.x), G.pos.z - (h.oz + HALL_TERMINAL.stand.z)) < 1.2) return h.id;
  return null;
}
/** The hall's rect in world coordinates (for what lies on its floor). */
export function hallRect(id: number) { const h = halls.get(id); return h ? { x0: h.ox + HALL.x0, x1: h.ox + HALL.x1, z0: h.oz + HALL.z0, z1: h.oz + HALL.z1, ox: h.ox, oz: h.oz } : null; }
/** The pickups lying on the hall's floor. */
export function floorPickups(id: number) {
  const r = hallRect(id);
  return r ? W.pickups.filter((p) => p.p.x > r.x0 && p.p.x < r.x1 && p.p.z > r.z0 && p.p.z < r.z1) : [];
}
