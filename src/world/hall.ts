// The village hall (gen/hall.ts) outside the village's north wall, or a settlement's warehouse where the hero staked it out (0.197; turned to the side its doors face): a plank barn on the terrain (posts with knee
// braces, horizontal boards, a gable roof over the doors), double doors standing open (a settlement's warehouse is wide
// and tall enough to drive a vehicle in and park in the painted bay), timber racks, crates stacked by how full the hold
// is, and the terminal against the back wall. A new settlement has none until its warehouse is built. Its walls collide (`hallHit`); E at the terminal (`nearHallTerminal`) opens ui/hall.ts. The
// crates are a group of their own, redrawn when the hold changes (`refreshHall`).
import { CARGO } from '../data/cargo';
import type { Racks } from '../gen/racks';
import type { ItemKey } from '../data/items';
import * as THREE from 'three';
import { G, W } from '../game';
import { drawComputer } from './computer';
import { drawMast } from './radiomast';
import { PropBatch } from './props';
import { wallSign } from './level';
import { hallSpec, hallTerminal, holdVol, hallStands, hallPoint } from '../gen/hall';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';
import { tl } from '../i18n';

const WOOD = 0xb8b060, PLANK = 0x8a8448, FLOOR = 0x5a5a30, BAY = 0xffd060, CRATE = 0xc8a060;
interface Hall { id: number; ox: number; oz: number; y0: number; segs: [number, number, number, number][]; door: [number, number, number, number, number]; crates: THREE.Group | null; grp: THREE.Group; T: Terrain; spec: ReturnType<typeof hallSpec>; terminal: ReturnType<typeof hallTerminal> }
const halls = new Map<number, Hall>();

/** Draw the hall of village vm (id `id`); returns its group (added to the village's). A new settlement without its
 *  warehouse has nothing here: the elder keeps its stores until then, and its ground stays as it is until the hero
 *  stakes it out (world/fields.ts) and the builders come. The hall is drawn in its own frame (a across, b from the back
 *  wall to the doors) in a group turned to the side its doors face. */
export function drawHall(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const st = G.char.towns[id];
  if (!hallStands(st)) return new THREE.Group();
  const HALL = hallSpec(st), HALL_TERMINAL = hallTerminal(st), big = HALL.h >= 6;
  const pb = new PropBatch(), ox = vm.ox, oz = vm.oz, th = HALL.d * Math.PI / 2;
  const grp = new THREE.Group(); grp.position.set(ox + (HALL.x0 + HALL.x1) / 2, 0, oz + (HALL.z0 + HALL.z1) / 2); grp.rotation.y = th;
  const wx = (a: number, b: number) => { const [x, z] = hallPoint(HALL, a, b); return [ox + x, oz + z] as const; };
  const H = (a: number, b: number) => { const [x, z] = wx(a, b); return T.heightAt(x, z); };
  const hw = (HALL.x1 - HALL.x0) / 2, hd = (HALL.z1 - HALL.z0) / 2;
  const X0 = -hw, X1 = hw, Z0 = -hd, Z1 = hd, dx = 0;
  const y0 = Math.min(H(X0, Z0), H(X1, Z0), H(X0, Z1), H(X1, Z1)) - 0.3, top = y0 + HALL.h;
  const segs: Hall['segs'] = [];
  const seg = (ax: number, az: number, bx: number, bz: number) => { const [p, q] = wx(ax, az), [r, t] = wx(bx, bz); segs.push([p, q, r, t]); };
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
    seg(ax, az, bx, bz);
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
    seg(hx, Z1 + 0.1, ex, ez);
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
  { const fy = Math.max(H(X0 + 0.2, Z0 + 0.2), H(X1 - 0.2, Z1 - 0.2), H((X0 + X1) / 2, (Z0 + Z1) / 2)) + 0.06;
    pb.face([X0 + 0.1, fy, Z0 + 0.1], [X1 - 0.1, fy, Z0 + 0.1], [X1 - 0.1, fy, Z1 - 0.1], [X0 + 0.1, fy, Z1 - 0.1]);
    for (let z = Z0 + 0.5; z < Z1; z += 0.5) pb.seg(FLOOR, [X0 + 0.15, fy + 0.01, z], [X1 - 0.15, fy + 0.01, z]);
    for (let x = X0 + 2; x < X1 - 1; x += 2) for (let z = Z0 + ((x - X0) % 4 ? 0.5 : 2.5); z < Z1 - 0.5; z += 4) pb.seg(FLOOR, [x, fy + 0.01, z], [x, fy + 0.01, Math.min(Z1 - 0.15, z + 0.5)]);
  }
  for (const x of [X0 + 0.5, X1 - 0.5]) for (const h of [0.5, 1.3, 2.1]) pb.line(WOOD, [x, y0 + h, Z0 + 0.8], [x, y0 + h, Z1 - 0.8]);
  for (const x of [X0 + 0.5, X1 - 0.5]) for (let z = Z0 + 0.8; z <= Z1 - 0.79; z += 2.1) pb.seg(WOOD, [x, y0, z], [x, y0 + 2.3, z]);
  if (big) {
    const bx0 = dx - 3, bx1 = dx + 3, bz0 = Z0 + 3.5, bz1 = Z1 - 2, yy = Math.max(H(X0 + 0.2, Z0 + 0.2), H(X1 - 0.2, Z1 - 0.2), H((X0 + X1) / 2, (Z0 + Z1) / 2)) + 0.08;
    for (const x of [bx0, bx1]) for (let z = bz0; z < bz1; z += 1.2) pb.seg(BAY, [x, yy, z], [x, yy, Math.min(bz1, z + 0.7)]);
    pb.seg(BAY, [bx0, yy, bz0], [bx1, yy, bz0]);
  }
  // the terminal against the back wall: a desk, a screen with lines of text, a case
  { const tx = 0, tz = Z0 + 1.1;
    drawComputer(pb, { x0: tx - 0.7, x1: tx + 0.7, z0: tz - 0.4, z1: tz + 0.4, h: 1.05, n: [0, 1] }, y0);
    seg(tx - 0.7, tz - 0.35, tx + 0.7, tz - 0.35); seg(tx - 0.7, tz + 0.35, tx + 0.7, tz + 0.35);
  }
  if (st?.mast) drawMast(pb, rx, rh + 0.15, Z0 + 1.2); // (0.251, stage M3) the radio mast on the ridge
  grp.add(pb.build());
  grp.add(wallSign(big ? tl('WAREHOUSE') : tl('VILLAGE HALL'), '#ffd060', { x: dx, z: Z1 + 0.1 }, [0, 1], y0 + dh + 0.9));
  const [ea, eb] = wx(d0, Z1), [fa, fb] = wx(d1, Z1);
  const h: Hall = { id, ox, oz, y0, segs, door: [ea, eb, fa, fb, y0 + dh], crates: null, grp, T, spec: HALL, terminal: HALL_TERMINAL };
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
    const hw = (HALL.x1 - HALL.x0) / 2, hd = (HALL.z1 - HALL.z0) / 2; // (in the hall's own frame, like its group)
    const x = side ? hw - 1.6 : -hw + 1.6, z = -hd + 1.1 + k * 0.62, y = h.y0 + lay * 0.6;
    if (z > hd - 1.8) continue;
    pb.box(x - 0.28, y, z - 0.28, x + 0.28, y + 0.56, z + 0.28, CRATE);
  }
  rackDeco(pb, G.char.towns[h.id]?.racks, (HALL.x1 - HALL.x0) / 2, -(HALL.z1 - HALL.z0) / 2 + 0.45, h.y0);
  h.crates = pb.build();
  h.grp.add(h.crates);
}
/** (0.250) The crates and barrels on the racks along the back wall (the hall's own frame): steel ones pale, wooden ones
 *  brown, in rows of shelves either side of the terminal. */
export function rackDeco(pb: PropBatch, racks: Racks | undefined, hw: number, zBack: number, y0: number) {
  const list: ItemKey[] = [];
  for (const [k, n] of Object.entries(racks ?? {}) as [ItemKey, number][]) for (let i = 0; i < n; i++) list.push(k);
  const per = Math.max(1, Math.floor((hw - 1.6) / 0.72)) * 2;
  list.forEach((k, i) => {
    const lay = Math.floor(i / per), j = i % per, side = j % 2 ? 1 : -1, x = side * (1.6 + Math.floor(j / 2) * 0.72), y = y0 + 0.05 + lay * 0.75, z = zBack;
    const c = k === 'crateM' || k === 'barrelM' ? 0x9fd8b0 : 0xb8b060;
    if (CARGO[k]?.kind === 'barrel') { pb.box(x - 0.25, y, z - 0.25, x + 0.25, y + 0.62, z + 0.25, c); for (const yy of [0.12, 0.31, 0.5]) pb.line(c, [x - 0.26, y + yy, z + 0.26], [x + 0.26, y + yy, z + 0.26]); }
    else { pb.box(x - 0.3, y, z - 0.28, x + 0.3, y + 0.56, z + 0.28, c); pb.line(c, [x - 0.3, y, z + 0.29], [x + 0.3, y + 0.56, z + 0.29]); }
  });
}
export function refreshHall(id: number) { const h = halls.get(id); if (h) drawCrates(h); }
export function forgetHall(id: number) { halls.delete(id); }

/** The hall's walls, the doorway left open (for G.obstacle). */
export function hallHit(px: number, py: number, pz: number, r: number): boolean {
  for (const h of halls.values()) {
    const HALL = h.spec;
    if (px < h.ox + HALL.x0 - 2 || px > h.ox + HALL.x1 + 2 || pz < h.oz + HALL.z0 - 2 || pz > h.oz + HALL.z1 + 2 || py > h.y0 + HALL.h + 2) continue;
    for (const [ax, az, bx, bz] of [...h.segs, ...(py + 1.7 > h.door[4] ? [h.door] : [])]) { // the beam over the doorway stops you only up there
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
