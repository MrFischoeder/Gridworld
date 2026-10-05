// The village hall (gen/hall.ts) outside every village's north wall: a plank barn on the terrain (posts with knee
// braces, horizontal boards, a gable roof over the doors), double doors standing open (a settlement's warehouse is wide
// and tall enough to drive a vehicle in and park in the painted bay), timber racks, crates stacked by how full the hold
// is, and the terminal against the back wall. A new settlement has only the staked plot until the warehouse is built. Its walls collide (`hallHit`); E at the terminal (`nearHallTerminal`) opens ui/hall.ts. The
// crates are a group of their own, redrawn when the hold changes (`refreshHall`).
import * as THREE from 'three';
import { G, W } from '../game';
import { drawComputer } from './computer';
import { PropBatch } from './props';
import { wallSign } from './level';
import { hallSpec, hallTerminal, holdVol, hallStands, VEHICLE_HALL } from '../gen/hall';
import { progressive } from '../gen/settlement';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const WOOD = 0xb8b060, PLANK = 0x8a8448, FLOOR = 0x5a5a30, BAY = 0xffd060, CRATE = 0xc8a060;
interface Hall { id: number; ox: number; oz: number; y0: number; segs: [number, number, number, number][]; crates: THREE.Group | null; grp: THREE.Group; T: Terrain; spec: ReturnType<typeof hallSpec>; terminal: ReturnType<typeof hallTerminal> }
const halls = new Map<number, Hall>();

/** A new settlement's flattened warehouse plot before it is built: corner stakes, string lines and a sign. */
function drawSite(vm: VillageMap, T: Terrain): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), R = VEHICLE_HALL, ox = vm.ox, oz = vm.oz, STAKE = 0xffd060;
  const cs: [number, number][] = [[R.x0, R.z0], [R.x1, R.z0], [R.x1, R.z1], [R.x0, R.z1]].map(([x, z]) => [ox + x, oz + z]);
  cs.forEach(([x, z], i) => {
    const y = T.heightAt(x, z), [nx, nz] = cs[(i + 1) % 4], ny = T.heightAt(nx, nz);
    pb.seg(STAKE, [x, y, z], [x, y + 1.1, z]); pb.seg(STAKE, [x, y + 0.6, z], [nx, ny + 0.6, nz]);
  });
  grp.add(pb.build());
  const dx = ox + (R.x0 + R.x1) / 2, dz = oz + R.z1 + 1;
  grp.add(wallSign('WAREHOUSE SITE', '#ffd060', { x: dx, z: dz }, [0, 1], T.heightAt(dx, dz) + 1.4));
  return grp;
}

/** Draw the hall of village vm (id `id`); returns its group (added to the village's). A new settlement without its
 *  warehouse gets only the staked plot: the elder keeps its stores until then. */
export function drawHall(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const st = G.char.towns[id];
  if (!hallStands(st)) return progressive(st) ? drawSite(vm, T) : new THREE.Group();
  const HALL = hallSpec(st), HALL_TERMINAL = hallTerminal(st), big = HALL.h >= 6;
  const grp = new THREE.Group(), pb = new PropBatch(), ox = vm.ox, oz = vm.oz;
  const X0 = ox + HALL.x0, X1 = ox + HALL.x1, Z0 = oz + HALL.z0, Z1 = oz + HALL.z1, dx = ox + (HALL.x0 + HALL.x1) / 2;
  const y0 = Math.min(T.heightAt(X0, Z0), T.heightAt(X1, Z0), T.heightAt(X0, Z1), T.heightAt(X1, Z1)) - 0.3, top = y0 + HALL.h;
  const segs: Hall['segs'] = [];
  const d0 = dx - HALL.door / 2, d1 = dx + HALL.door / 2, dh = big ? 4.8 : 2.6;
  // a timber barn: posts every ~3 m with knee braces under the top plate, horizontal boards every 0.45 m, corner boards
  const POST = 3, BOARD = 0.45;
  // (drawn a hair off both faces of the wall, so they show from inside as well as out)
  const boards = (ax: number, az: number, bx: number, bz: number, ya: number, yb: number) => {
    const L = Math.hypot(bx - ax, bz - az) || 1, nx = -(bz - az) / L * 0.04, nz = (bx - ax) / L * 0.04;
    for (let y = ya + 0.25; y < yb - 0.05; y += BOARD) for (const sg of [1, -1]) pb.seg(PLANK, [ax + nx * sg, y, az + nz * sg], [bx + nx * sg, y, bz + nz * sg]);
  };
  const wall = (ax: number, az: number, bx: number, bz: number, posts = true) => {
    pb.face([ax, y0, az], [bx, y0, bz], [bx, top, bz], [ax, top, az]);
    boards(ax, az, bx, bz, y0, top);
    pb.seg(WOOD, [ax, y0 + 0.15, az], [bx, y0 + 0.15, bz]); pb.seg(WOOD, [ax, top, az], [bx, top, bz]); pb.seg(WOOD, [ax, top - 0.25, az], [bx, top - 0.25, bz]);
    const L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(L / POST)), ux = (bx - ax) / L, uz = (bz - az) / L;
    if (posts) for (let i = 0; i <= n; i++) {
      const x = ax + (bx - ax) * i / n, z = az + (bz - az) * i / n;
      pb.seg(WOOD, [x, y0, z], [x, top, z]);
      if (i > 0) pb.seg(WOOD, [x, top - 0.9, z], [x - ux * 0.9, top - 0.25, z - uz * 0.9]);
      if (i < n) pb.seg(WOOD, [x, top - 0.9, z], [x + ux * 0.9, top - 0.25, z + uz * 0.9]);
    }
    segs.push([ax, az, bx, bz]);
  };
  wall(X0, Z0, X1, Z0); wall(X1, Z0, X1, Z1); wall(X0, Z1, X0, Z0);
  wall(X1, Z1, d1, Z1); wall(d0, Z1, X0, Z1);
  // over the doorway: boards from the header up; a doubled header beam and jambs
  pb.face([d1, y0 + dh, Z1], [d0, y0 + dh, Z1], [d0, top, Z1], [d1, top, Z1]); boards(d0, Z1, d1, Z1, y0 + dh, top);
  for (const e of [0, 0.22]) pb.seg(WOOD, [d0 - 0.2, y0 + dh + e, Z1 + 0.05], [d1 + 0.2, y0 + dh + e, Z1 + 0.05]);
  for (const x of [d0, d1]) { pb.seg(WOOD, [x, y0, Z1 + 0.05], [x, y0 + dh, Z1 + 0.05]); pb.seg(WOOD, [x + (x === d0 ? -0.2 : 0.2), y0, Z1 + 0.05], [x + (x === d0 ? -0.2 : 0.2), y0 + dh + 0.22, Z1 + 0.05]); }
  // the two door leaves, swung wide open against the front wall: boards, a frame and a Z brace each
  const leaf = (hx: number, sgn: number) => {
    const w = HALL.door / 2, a = 1.75, ex = hx + sgn * Math.cos(a) * w, ez = Z1 + Math.sin(a) * w, lx = (t: number) => hx + (ex - hx) * t, lz = (t: number) => Z1 + 0.1 + (ez - Z1) * t;
    pb.face([hx, y0 + 0.1, Z1 + 0.1], [ex, y0 + 0.1, ez], [ex, y0 + dh - 0.1, ez], [hx, y0 + dh - 0.1, Z1 + 0.1]);
    pb.line(WOOD, [hx, y0 + 0.1, Z1 + 0.1], [ex, y0 + 0.1, ez], [ex, y0 + dh - 0.1, ez], [hx, y0 + dh - 0.1, Z1 + 0.1], [hx, y0 + 0.1, Z1 + 0.1]);
    const n = Math.max(3, Math.round(w / 0.35));
    for (let i = 1; i < n; i++) pb.seg(PLANK, [lx(i / n), y0 + 0.1, lz(i / n)], [lx(i / n), y0 + dh - 0.1, lz(i / n)]);
    for (const y of [0.5, dh - 0.5]) pb.seg(WOOD, [lx(0), y0 + y, lz(0)], [lx(1), y0 + y, lz(1)]);
    pb.seg(WOOD, [lx(0), y0 + 0.5, lz(0)], [lx(1), y0 + dh - 0.5, lz(1)]);
    segs.push([hx, Z1 + 0.1, ex, ez]);
  };
  leaf(d0, 1); leaf(d1, -1);
  // the roof: its ridge runs from the doors to the back, so the doors stand in the gable end; boards on the gables, rafters
  const o = 0.5, rise = (X1 - X0) * 0.3, rh = top + rise, rx = (X0 + X1) / 2;
  for (const z of [Z0, Z1]) {
    pb.face([X0, top, z], [X1, top, z], [rx, rh, z]);
    for (let x = X0 + 0.6; x < X1; x += 0.6) { const y = top + rise * (1 - Math.abs(x - rx) / (rx - X0)); pb.seg(PLANK, [x, top, z], [x, y, z]); }
  }
  pb.face([X0 - o, top - 0.1, Z0 - o], [X0 - o, top - 0.1, Z1 + o], [rx, rh + 0.15, Z1 + o], [rx, rh + 0.15, Z0 - o]);
  pb.face([X1 + o, top - 0.1, Z0 - o], [X1 + o, top - 0.1, Z1 + o], [rx, rh + 0.15, Z1 + o], [rx, rh + 0.15, Z0 - o]);
  pb.seg(WOOD, [rx, rh + 0.15, Z0 - o], [rx, rh + 0.15, Z1 + o]);
  for (const sx of [X0 - o, X1 + o]) {
    pb.seg(WOOD, [sx, top - 0.1, Z0 - o], [sx, top - 0.1, Z1 + o]);
    for (const z of [Z0 - o, Z1 + o]) pb.seg(WOOD, [sx, top - 0.1, z], [rx, rh + 0.15, z]);
    for (let z = Z0 - o + 1.2; z < Z1 + o - 0.1; z += 1.2) pb.seg(PLANK, [sx, top - 0.1, z], [rx, rh + 0.15, z]);
  }
  // inside: plank floor lines, timber racks along the side walls, a painted parking bay before the terminal
  { const fy = Math.max(T.heightAt(X0 + 0.2, Z0 + 0.2), T.heightAt(X1 - 0.2, Z1 - 0.2), T.heightAt((X0 + X1) / 2, (Z0 + Z1) / 2)) + 0.06;
    pb.face([X0 + 0.1, fy, Z0 + 0.1], [X1 - 0.1, fy, Z0 + 0.1], [X1 - 0.1, fy, Z1 - 0.1], [X0 + 0.1, fy, Z1 - 0.1]);
    for (let z = Z0 + 0.5; z < Z1; z += 0.5) pb.seg(FLOOR, [X0 + 0.15, fy + 0.01, z], [X1 - 0.15, fy + 0.01, z]);
    for (let x = X0 + 2; x < X1 - 1; x += 2) for (let z = Z0 + ((x - X0) % 4 ? 0.5 : 2.5); z < Z1 - 0.5; z += 4) pb.seg(FLOOR, [x, fy + 0.01, z], [x, fy + 0.01, Math.min(Z1 - 0.15, z + 0.5)]);
  }
  for (const x of [X0 + 0.5, X1 - 0.5]) for (const h of [0.5, 1.3, 2.1]) pb.line(WOOD, [x, y0 + h, Z0 + 0.8], [x, y0 + h, Z1 - 0.8]);
  for (const x of [X0 + 0.5, X1 - 0.5]) for (let z = Z0 + 0.8; z <= Z1 - 0.79; z += 2.1) pb.seg(WOOD, [x, y0, z], [x, y0 + 2.3, z]);
  if (big) {
    const bx0 = dx - 3, bx1 = dx + 3, bz0 = Z0 + 3.5, bz1 = Z1 - 2, yy = Math.max(T.heightAt(X0 + 0.2, Z0 + 0.2), T.heightAt(X1 - 0.2, Z1 - 0.2), T.heightAt((X0 + X1) / 2, (Z0 + Z1) / 2)) + 0.08;
    for (const x of [bx0, bx1]) for (let z = bz0; z < bz1; z += 1.2) pb.seg(BAY, [x, yy, z], [x, yy, Math.min(bz1, z + 0.7)]);
    pb.seg(BAY, [bx0, yy, bz0], [bx1, yy, bz0]);
  }
  // the terminal against the back wall: a desk, a screen with lines of text, a case
  { const tx = ox + HALL_TERMINAL.x, tz = oz + HALL_TERMINAL.z;
    drawComputer(pb, { x0: tx - 0.7, x1: tx + 0.7, z0: tz - 0.4, z1: tz + 0.4, h: 1.05, n: [0, 1] }, y0);
    segs.push([tx - 0.7, tz - 0.35, tx + 0.7, tz - 0.35], [tx - 0.7, tz + 0.35, tx + 0.7, tz + 0.35]);
  }
  grp.add(pb.build());
  grp.add(wallSign(big ? 'WAREHOUSE' : 'VILLAGE HALL', '#ffd060', { x: dx, z: Z1 + 0.1 }, [0, 1], y0 + dh + 0.9));
  const h: Hall = { id, ox, oz, y0, segs, crates: null, grp, T, spec: HALL, terminal: HALL_TERMINAL };
  halls.set(id, h);
  drawCrates(h);
  return grp;
}
/** Crates stacked along the walls, one for every 250 litres in the hold (at most 40). */
function drawCrates(h: Hall) {
  if (h.crates) { h.grp.remove(h.crates); h.crates.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  const HALL = h.spec;
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
    const HALL = h.spec;
    if (px < h.ox + HALL.x0 - 2 || px > h.ox + HALL.x1 + 2 || pz < h.oz + HALL.z0 - 2 || pz > h.oz + HALL.z1 + 2 || py > h.y0 + HALL.h + 2) continue;
    const dx = h.ox + (HALL.x0 + HALL.x1) / 2;
    if (Math.abs(pz - (h.oz + HALL.z1)) < r + .15 && Math.abs(px - dx) < HALL.door / 2 + r && py + 1.7 > h.y0 + (HALL.h >= 6 ? 4.8 : 2.6)) return true;
    for (const [ax, az, bx, bz] of h.segs) {
      const ex = bx - ax, ez = bz - az, L = ex * ex + ez * ez, t = L ? Math.max(0, Math.min(1, ((px - ax) * ex + (pz - az) * ez) / L)) : 0;
      if (Math.hypot(px - ax - ex * t, pz - az - ez * t) < r + 0.15) return true;
    }
  }
  return false;
}
/** Under a hall's roof: the height just below its eaves (for the vehicles' chase camera). */
export function hallCeiling(x: number, z: number): number | undefined {
  const m = 0.8; // (a little inside the walls, so a camera there never looks through one)
  for (const h of halls.values()) if (x > h.ox + h.spec.x0 + m && x < h.ox + h.spec.x1 - m && z > h.oz + h.spec.z0 + m && z < h.oz + h.spec.z1 - m) return h.y0 + h.spec.h - 0.6;
  return undefined;
}
/** Standing at a hall's terminal: the village's id. */
export function nearHallTerminal(): number | null {
  if (G.char.loc !== 'overworld') return null;
  for (const h of halls.values()) if (Math.hypot(G.pos.x - (h.ox + h.terminal.stand.x), G.pos.z - (h.oz + h.terminal.stand.z)) < 1.2) return h.id;
  return null;
}
/** The hall's rect in world coordinates (for what lies on its floor). */
export function hallRect(id: number) { const h = halls.get(id), HALL = h?.spec; return h && HALL ? { x0: h.ox + HALL.x0, x1: h.ox + HALL.x1, z0: h.oz + HALL.z0, z1: h.oz + HALL.z1, ox: h.ox, oz: h.oz } : null; }
/** The pickups lying on the hall's floor. */
export function floorPickups(id: number) {
  const r = hallRect(id);
  return r ? W.pickups.filter((p) => p.p.x > r.x0 && p.p.x < r.x1 && p.p.z > r.z0 && p.p.z < r.z1) : [];
}
