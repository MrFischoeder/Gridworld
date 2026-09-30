// The hero's crash site (gen/landing.ts): the Kestrel lying broken a few hundred metres out of Gridholm at the end
// of the furrow it ploughed, smoke rising from the gash in its roof and the crumpled engine, an emergency lamp
// blinking inside. You can walk in through the open hatch (the hull collides, `podHit`), search the locker (the
// survival kit, container 'ship:locker') and read the flight recorder at the console (ui/logbook.ts). Every new
// character wakes up inside it (level.ts `loadOverworld` with a 'new' arrival).
import * as THREE from 'three';
import { scene, add, lineMat } from './render';
import { PropBatch } from './props';
import { drawLander, landerWalls, HULL_C, SCORCH_C, WARN_C, LOCKER, CONSOLE } from './lander';
import { landingSite, LANDING, type Landing } from '../gen/landing';
import { rng, hash } from '../core/rng';
import type { Terrain } from '../gen/terrain';
import { G } from '../game';
import { putItems } from '../inventory';
import type { Slot } from '../save';

let site: Landing | null = null, grp: THREE.Group | null = null, lamp: THREE.Object3D | null = null, walls: [number, number, number, number][] = [];
let cos = 1, sin = 0, gy = 0;
interface Puff { o: THREE.LineLoop; t: number; life: number; v: number }
const puffs: Puff[] = [];
let puffT = 0;

/** World -> ship-local (x to starboard, z to the nose). */
function toLocal(x: number, z: number): [number, number] {
  const dx = x - site!.x, dz = z - site!.z;
  return [dx * cos - dz * sin, dx * sin + dz * cos];
}
/** Ship-local -> world. */
export function crashWorld(lx: number, lz: number): [number, number] {
  return [site!.x + lx * cos + lz * sin, site!.z - lx * sin + lz * cos];
}

/** Builds the crash site for the world's terrain (on opening the world). */
export function setCrash(t: Terrain) {
  dropCrash();
  site = landingSite(t); cos = Math.cos(site.yaw); sin = Math.sin(site.yaw); gy = site.y - 0.3;
  walls = landerWalls(true);
  const pb = new PropBatch(), R = rng(hash(t.world, 0xc4a5));
  drawLander(pb, { broken: true });
  const h = (lx: number, lz: number) => { const [x, z] = crashWorld(lx, lz); return t.heightAt(x, z) - gy; };
  // the furrow ploughed behind the ship: two berms of thrown-up earth, lower and narrower towards where it touched down
  for (const s of [1, -1]) {
    let prev: number[][] | null = null;
    for (let z = -10; z >= -10 - LANDING.furrow + 0.1; z -= 2) {
      const k = (z + 10) / -LANDING.furrow, wd = 2.8 - k * 1.4, ht = 0.9 * (1 - k) + 0.12;
      const toe = [s * (wd + 1.2), h(s * (wd + 1.2), z) + 0.02, z], top = [s * wd, h(s * wd, z) + ht, z], inn = [s * (wd - 0.8), h(s * (wd - 0.8), z) - 0.05, z];
      const cur = [toe, top, inn];
      if (prev) { pb.face(prev[0], prev[1], top, toe); pb.face(prev[1], prev[2], inn, top); pb.seg(SCORCH_C + 0x1a2010, prev[1], top); pb.seg(SCORCH_C, prev[0], toe); }
      prev = cur;
    }
  }
  // scorch marks round the ship, and debris strewn along the furrow
  for (let i = 0; i < 26; i++) {
    const a = R() * 6.283, r0 = 3.2 + R() * 3, r1 = r0 + 1 + R() * 3, lx = Math.cos(a), lz = Math.sin(a) * 1.8;
    pb.seg(SCORCH_C, [lx * r0, h(lx * r0, lz * r0) + 0.04, lz * r0], [lx * r1, h(lx * r1, lz * r1) + 0.04, lz * r1]);
  }
  for (let i = 0; i < 14; i++) {
    const z = -12 - R() * (LANDING.furrow - 4), x = (R() - 0.5) * 9, s = 0.3 + R() * 0.7, rot = R() * 6.283, y = h(x, z) + 0.03;
    const q = [[-s, 0, -s * 0.6], [s, 0.12, -s * 0.5], [s * 0.8, 0.05, s * 0.6], [-s * 0.9, 0.2, s * 0.4]].map(([u, yy, v]) => [x + u * Math.cos(rot) - v * Math.sin(rot), y + yy, z + u * Math.sin(rot) + v * Math.cos(rot)]);
    pb.face(...q); for (let n = 0; n < 4; n++) pb.seg(HULL_C, q[n], q[(n + 1) % 4]);
  }
  // the starboard wing, torn off, lying on its back beside the furrow
  { const ox = 9, oz = -17, y = h(ox, oz) + 0.15, w = [[0, 0, 0], [4.2, 0.3, -1.1], [4.2, 0.3, 0.5], [0, 0, 3.4]].map(([u, yy, v]) => [ox + u * 0.8 - v * 0.6, y + yy, oz + u * 0.6 + v * 0.8]);
    pb.face(...w); for (let n = 0; n < 4; n++) pb.seg(HULL_C, w[n], w[(n + 1) % 4]); pb.seg(WARN_C, w[1], w[2]); }
  grp = pb.build();
  // the emergency lamp inside, blinking
  lamp = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.16)), add(WARN_C)); lamp.position.set(0, 2.85, -0.8);
  grp.add(lamp);
  // the locker's handle glows so it can be found
  const handle = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(LOCKER.x - 0.33, 1.0, LOCKER.z - 0.1), new THREE.Vector3(LOCKER.x - 0.33, 1.3, LOCKER.z - 0.1)]), add(0xffd060));
  grp.add(handle);
  grp.position.set(site.x, gy, site.z); grp.rotation.y = site.yaw;
  scene.add(grp);
}
export function dropCrash() {
  if (grp) { scene.remove(grp); grp.traverse((o) => { const m = o as THREE.Mesh; m.geometry?.dispose(); }); }
  for (const p of puffs) p.o.geometry.dispose();
  grp = null; lamp = null; puffs.length = 0; site = null;
}

/** Hull, wings and engines as walls (the hatch is open). */
export function podHit(px: number, py: number, pz: number, r: number): boolean {
  if (!site || Math.abs(px - site.x) > 16 || Math.abs(pz - site.z) > 16 || py > gy + 3.2) return false;
  const [x, z] = toLocal(px, pz);
  for (const [ax, az, bx, bz] of walls) {
    const dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz, t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    if (Math.hypot(x - ax - dx * t, z - az - dz * t) < r) return true;
  }
  return false;
}

/** The crash site of the loaded world (null before `setCrash`). */
export const crashLanding = () => site;
/** Where a new character wakes: inside by the locker, facing the open hatch. */
export function crashSpawn(): { x: number; z: number; yaw: number } | null {
  if (!site) return null;
  const [x, z] = crashWorld(-0.9, -0.9), [hx, hz] = crashWorld(2.2, 0.15); // looking out of the open hatch
  return { x, z, yaw: Math.atan2(-(hx - x), -(hz - z)) };
}
const localNear = (lx: number, lz: number, d: number) => { if (!site || G.char.loc !== 'overworld') return false; if (Math.abs(G.pos.x - site.x) > 20 || Math.abs(G.pos.z - site.z) > 20) return false; const [x, z] = toLocal(G.pos.x, G.pos.z); return Math.hypot(x - lx, z - lz) < d; };
export const nearLocker = () => localNear(LOCKER.x + 0.5, LOCKER.z, 1.4);
export const nearConsole = () => localNear(CONSOLE.x, CONSOLE.z - 0.5, 1.5);

/** The survival kit in the locker, filled once (what you leave stays there). */
export function lockerBox() {
  const c = G.char, key = 'ship:locker';
  if (!c.containers[key]) {
    const items: (Slot | null)[] = Array(8).fill(null);
    putItems(items, 'medkit', 2); putItems(items, 'waterF', 2); putItems(items, 'bread', 3); putItems(items, 'firekit', 1); putItems(items, 'compass', 1); putItems(items, 'ammoE', 40); // the ship's own cells: all the rounds you have until you find more
    c.containers[key] = { items, gold: 0 };
  }
  return c.containers[key];
}

/** Smoke from the gash and the crumpled engine, and the lamp's blink (only when you are near enough to see it). */
export function updateCrash(dt: number, time: number) {
  if (!grp || !site) return;
  const near = Math.hypot(G.pos.x - site.x, G.pos.z - site.z) < 260;
  grp.visible = G.char.loc === 'overworld';
  if (lamp) lamp.visible = Math.sin(time * 5) > 0;
  if (near && (puffT -= dt) <= 0) {
    puffT = 0.35;
    for (const [x, y, z] of [[0.9, 3, -1.5], [1.5, 2.6, -10.6]]) {
      if (puffs.length > 36) break;
      const pts = Array.from({ length: 8 }, (_, k) => new THREE.Vector3(Math.cos(k / 8 * 6.283) * 0.4, 0, Math.sin(k / 8 * 6.283) * 0.4));
      const o = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x7a9a86, { transparent: true, opacity: 0.6 }));
      o.position.set(x + (Math.random() - 0.5) * 0.4, y, z + (Math.random() - 0.5) * 0.4); o.rotation.y = Math.random() * 3;
      grp.add(o); puffs.push({ o, t: 0, life: 4 + Math.random() * 2, v: 1 + Math.random() * 0.6 });
    }
  }
  for (let i = puffs.length - 1; i >= 0; i--) {
    const p = puffs[i]; p.t += dt;
    p.o.position.y += p.v * dt; p.o.position.x += dt * 0.3; // drifting a little to starboard
    p.o.scale.setScalar(1 + p.t * 0.9);
    (p.o.material as THREE.LineBasicMaterial).opacity = 0.6 * (1 - p.t / p.life);
    if (p.t >= p.life) { grp.remove(p.o); p.o.geometry.dispose(); (p.o.material as THREE.Material).dispose(); puffs.splice(i, 1); }
  }
}
