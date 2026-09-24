// The doors of village houses: a real leaf on its hinge that swings open and shut (E), collides while it is not
// open, and stops shots and eyes while it is shut. Shops, the hall and the tavern stand open by day (06:00-21:00)
// and are shut at night; the shops and the hall are locked then, the tavern never. Folk's houses are shut and you
// may open them by day; at night they are locked. The hero's house is locked until you buy it from the elder
// (`char.houses`). Opening or shutting a door by hand holds until the next dawn or dusk. From inside a building its
// door always opens. Runtime only (nothing saved but the houses you own); villagers walk through (they have keys).
import * as THREE from 'three';
import { G } from '../game';
import { HOUSE, type Building, type VillageMap } from '../gen/village';
import { scene, lineMat, fillMat, add } from './render';

type Kind = 'inn' | 'shop' | 'house' | 'mine';
interface Door {
  vid: number; b: Building; kind: Kind; pivot: THREE.Group; y0: number;
  /** Hinge (world), the direction along the doorway from the hinge when shut, and into the room. */
  hx: number; hz: number; ax: number; az: number; ix: number; iz: number;
  ang: number; manual?: { open: boolean; key: number };
}
const DAY = [6, 21], LEAF = HOUSE.doorW - 0.05, OPEN = Math.PI / 2 * 0.95;
const doors = new Map<number, Door[]>();
const all = () => [...doors.values()].flat();

/** Which half of the day it is: a number that changes at every dawn (06:00) and dusk (21:00). */
function phase(t: number): { key: number; day: boolean } {
  const h = (t / 60) % 24, d = Math.floor(t / 1440);
  return h < DAY[0] ? { key: d * 2 - 1, day: false } : h < DAY[1] ? { key: d * 2, day: true } : { key: d * 2 + 1, day: false };
}
export const ownsHouse = (vid: number) => G.char.houses.includes(vid);

const EDGE = 0x4dff7e, PLANK = 0x1f9a44;
function leafModel(kind: Kind, vid: number): THREE.Group {
  const g = new THREE.Group(), h = HOUSE.doorH - 0.06, geo = new THREE.BoxGeometry(LEAF, h, 0.06);
  const box = new THREE.Group(); box.position.set(LEAF / 2, h / 2 + 0.03, 0);
  box.add(new THREE.Mesh(geo, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(EDGE)));
  g.add(box);
  // planks, a ledge and a brace on both faces, the handle on the far side from the hinge
  const pts: THREE.Vector3[] = [];
  for (const s of [-0.032, 0.032]) {
    for (let x = 0.22; x < LEAF - 0.1; x += 0.22) pts.push(new THREE.Vector3(x, 0.05, s), new THREE.Vector3(x, h, s));
    for (const y of [0.35, h - 0.35]) pts.push(new THREE.Vector3(0.05, y, s), new THREE.Vector3(LEAF - 0.05, y, s));
    pts.push(new THREE.Vector3(0.08, 0.38, s), new THREE.Vector3(LEAF - 0.08, h - 0.38, s));
  }
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(PLANK)));
  const hy = 1.05, hx = LEAF - 0.14, handle = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.04, 0.16, 0.14)), lineMat(0xffd060));
  handle.position.set(hx, hy, 0); g.add(handle);
  if (kind === 'mine' && !ownsHouse(vid)) { // a red padlock on the hasp until the house is yours
    const lock = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.14, 0.14, 0.2)), add(0xff5a3c));
    lock.position.set(hx, hy - 0.22, 0); lock.name = 'lock'; g.add(lock);
  }
  return g;
}

/** A village was loaded / dropped: its doors come and go with it. */
export function setDoors(vid: number, vm: VillageMap) {
  dropDoors(vid);
  const list: Door[] = [];
  for (const b of vm.buildings) {
    const kind: Kind = b.mine ? 'mine' : b.role === 'innkeeper' ? 'inn' : b.role === 'house' ? 'house' : 'shop';
    const [ox, oz] = b.out, ux = -oz, uz = ox, w = HOUSE.doorW / 2, t = HOUSE.thick;
    // hinged at the jamb on +u, on the inner face of the wall; shut it runs along -u, open it lies back into the room
    const hx = b.door.x + ux * (w - 0.02) - ox * (t / 2 + 0.03), hz = b.door.z + uz * (w - 0.02) - oz * (t / 2 + 0.03);
    const pivot = leafModel(kind, vid), d: Door = { vid, b, kind, pivot, y0: vm.y, hx, hz, ax: -ux, az: -uz, ix: -ox, iz: -oz, ang: 0 };
    d.ang = wanted(d) ? OPEN : 0;
    pivot.position.set(hx, vm.y, hz); place(d); scene.add(pivot);
    list.push(d);
  }
  doors.set(vid, list);
}
export function dropDoors(vid: number) { for (const d of doors.get(vid) ?? []) scene.remove(d.pivot); doors.delete(vid); }
/** The house became yours: the padlock comes off. */
export function unlockMine(vid: number) { for (const d of doors.get(vid) ?? []) if (d.kind === 'mine') { const l = d.pivot.getObjectByName('lock'); if (l) d.pivot.remove(l); } }

/** The leaf's direction from the hinge at its current angle. */
const dirOf = (d: Door) => ({ x: d.ax * Math.cos(d.ang) + d.ix * Math.sin(d.ang), z: d.az * Math.cos(d.ang) + d.iz * Math.sin(d.ang) });
function place(d: Door) { const v = dirOf(d); d.pivot.rotation.y = Math.atan2(-v.z, v.x); }

/** Standing inside the building (its footprint). */
const inside = (b: Building) => G.pos.x > b.x && G.pos.x < b.x + b.w && G.pos.z > b.z && G.pos.z < b.z + b.d;
/** Why the door will not open for you now, or ''. */
function lockedWhy(d: Door): string {
  if (inside(d.b)) return '';
  if (d.kind === 'mine') return ownsHouse(d.vid) ? '' : 'Locked. The house is for sale: ask the elder';
  const p = phase(G.char.time);
  if (p.day || d.kind === 'inn') return '';
  return d.kind === 'shop' ? `Closed for the night: open again at ${String(DAY[0]).padStart(2, '0')}:00` : 'Locked: the family is asleep';
}
/** Whether the door should stand open now (the hour, or what you did with it this half of the day). */
function wanted(d: Door): boolean {
  const p = phase(G.char.time);
  if (d.manual && d.manual.key === p.key) return d.manual.open;
  d.manual = undefined;
  return (d.kind === 'shop' || d.kind === 'inn') && p.day;
}
/** Once a frame: every door swings towards where it should be. */
export function updateHouseDoors(dt: number) {
  for (const d of all()) {
    const want = wanted(d) ? OPEN : 0;
    if (Math.abs(want - d.ang) < 1e-3) continue;
    const step = dt * 2.4;
    d.ang = want > d.ang ? Math.min(want, d.ang + step) : Math.max(want, d.ang - step);
    place(d);
  }
}

// ---------- collision: the leaf as a thin line from the hinge ----------
const segDist = (d: Door, x: number, z: number) => {
  const v = dirOf(d), px = x - d.hx, pz = z - d.hz, k = Math.max(0, Math.min(LEAF, px * v.x + pz * v.z));
  return Math.hypot(px - v.x * k, pz - v.z * k);
};
/** Does a figure (radius r, feet at y) run into a door leaf? (Open ones lie back against the wall and are left out.) */
export function doorHit(x: number, y: number, z: number, r: number): boolean {
  for (const d of all()) {
    if (d.ang > OPEN - 0.05 || y > d.y0 + HOUSE.doorH || y + 1.7 < d.y0) continue;
    if (Math.abs(x - d.hx) > 2 || Math.abs(z - d.hz) > 2) continue;
    if (segDist(d, x, z) < r + 0.04) return true;
  }
  return false;
}
/** Distance along a ray to the first shut door, or maxT (shots and eyes stop at a shut door). */
export function doorRay(o: { x: number; y: number; z: number }, dir: { x: number; y: number; z: number }, maxT: number): number {
  let best = maxT;
  for (const d of all()) {
    if (d.ang > 0.3) continue;
    // the doorway's plane: through the hinge, normal = into the room
    const den = dir.x * d.ix + dir.z * d.iz;
    if (Math.abs(den) < 1e-6) continue;
    const t = ((d.hx - o.x) * d.ix + (d.hz - o.z) * d.iz) / den;
    if (t < 0 || t >= best) continue;
    const px = o.x + dir.x * t, py = o.y + dir.y * t, pz = o.z + dir.z * t, along = (px - d.hx) * d.ax + (pz - d.hz) * d.az;
    if (along >= 0 && along <= LEAF && py >= d.y0 && py <= d.y0 + HOUSE.doorH) best = t;
  }
  return best;
}

// ---------- using one ----------
/** The door you stand at (within reach of its middle, inside or out). */
export function nearHouseDoor(): Door | null {
  if (G.char.loc !== 'overworld') return null;
  let best: Door | null = null, bd = 1.4;
  for (const d of all()) {
    if (Math.abs(G.pos.y - d.y0) > 1.2) continue;
    const dd = Math.hypot(G.pos.x - d.b.door.x, G.pos.z - d.b.door.z);
    if (dd < bd) { bd = dd; best = d; }
  }
  return best;
}
const isOpen = (d: Door) => wanted(d);
export function houseDoorPrompt(d: Door): { text: string; locked: boolean } {
  if (isOpen(d)) return { text: 'E — close the door', locked: false };
  const why = lockedWhy(d);
  return why ? { text: why, locked: true } : { text: d.kind === 'mine' ? 'E — open the door of your house' : 'E — open the door', locked: false };
}
/** E at a door: open or shut it (if it is not locked); holds until the next dawn or dusk. */
export function toggleHouseDoor(d: Door): string {
  const open = isOpen(d);
  if (!open) { const why = lockedWhy(d); if (why) return why + '.'; }
  d.manual = { open: !open, key: phase(G.char.time).key };
  return '';
}
