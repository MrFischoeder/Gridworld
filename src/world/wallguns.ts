// Auto turrets on a village's wall (commissioned from the elder: gen/town.ts WORKS.turret, mounted on the wall top at
// gen/village.ts `VillageMap.mounts`, in order). Each is a braced timber platform on the wall with a steel ring, an
// ammunition box and a turning head with twin barrels. It looks for the nearest hostile thing in range that it can
// see (bandits in a raid, creatures, robots), turns and fires; idle it sweeps the ground outside. Runtime only: the
// count is saved in the village's state.
import * as THREE from 'three';
import { scene, lineMat, fillMat, add } from './render';
import { G } from '../game';
import { addFx, burst } from './fx';
import { rayWorld } from './player';
import { foes, damageFoe, type Foe } from './enemies';
import { makeNoise } from './noise';
import type { Mount } from '../gen/village';
import { villageHooks } from './overworld';
import { worksOf } from '../gen/town';

export const WALL_GUN = { range: 60, rate: 0.5, dmg: 1.3, turn: 2.6, noise: 40 };
interface Gun { m: Mount; g: THREE.Group; head: THREE.Group; yaw: number; home: number; cd: number; look: number; target: Foe | null }
const guns = new Map<number, Gun[]>();
const ON = 0x7dffc8, WOOD = 0xb8b060, fill = fillMat();

function solid(geo: THREE.BufferGeometry, color: number, at?: [number, number, number]) {
  const o = new THREE.Group(); o.add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color)));
  if (at) o.position.set(...at);
  return o;
}
function build(m: Mount, y0: number): Gun {
  const g = new THREE.Group(), head = new THREE.Group(), base = y0 + m.y;
  g.position.set(m.x, base, m.z);
  // the platform: planks on two bearers, a post down into the wall, braces
  g.add(solid(new THREE.BoxGeometry(1.5, 0.12, 1.5), WOOD, [0, 0, 0]));
  g.add(solid(new THREE.BoxGeometry(0.22, 1.2, 0.22), WOOD, [0, -0.66, 0]));
  const br = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.7, -0.06, 0), new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0.7, -0.06, 0), new THREE.Vector3(0, -0.9, 0),
    new THREE.Vector3(0, -0.06, -0.7), new THREE.Vector3(0, -0.9, 0), new THREE.Vector3(0, -0.06, 0.7), new THREE.Vector3(0, -0.9, 0)]);
  g.add(new THREE.LineSegments(br, lineMat(WOOD)));
  // the steel ring and a box of ammunition beside it
  g.add(solid(new THREE.CylinderGeometry(0.42, 0.5, 0.3, 10), ON, [0, 0.21, 0]));
  const ammo = solid(new THREE.BoxGeometry(0.34, 0.26, 0.24), ON, [0.52, 0.19, 0.46]); g.add(ammo);
  // the head: a housing, twin barrels, a sensor on top
  head.position.y = 0.62;
  head.add(solid(new THREE.BoxGeometry(0.6, 0.38, 0.66), ON));
  for (const s of [-0.12, 0.12]) { const b = solid(new THREE.CylinderGeometry(0.05, 0.05, 0.85, 6).rotateX(Math.PI / 2), ON, [s, 0.02, -0.72]); head.add(b); }
  head.add(solid(new THREE.BoxGeometry(0.22, 0.12, 0.08), ON, [0, 0.26, -0.22]));
  g.add(head); scene.add(g);
  const home = Math.atan2(-m.fx, -m.fz);
  return { m, g, head, yaw: home, home, cd: 0.5, look: Math.random() * 0.3, target: null };
}
/** A village was loaded (with n turrets) / dropped. */
export function setWallGuns(id: number, mounts: Mount[], n: number, y0: number) {
  dropWallGuns(id);
  guns.set(id, mounts.slice(0, n).map((m) => build(m, y0)));
}
export function dropWallGuns(id: number) {
  for (const t of guns.get(id) ?? []) { scene.remove(t.g); t.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); }
  guns.delete(id);
}
/** Things a turret shoots at: everything hostile except calm Brambles. */
const hostile = (f: Foe) => !('kind' in f && f.kind === 'bramble' && (f as { state?: string }).state === 'roam');

export function updateWallGuns(dt: number) {
  if (!guns.size || G.char.loc !== 'overworld') return;
  const all = foes(), t0 = performance.now() / 1000;
  for (const list of guns.values()) for (const t of list) {
    t.cd -= dt; t.look -= dt;
    const o = t.head.getWorldPosition(new THREE.Vector3());
    if (t.target && (!all.includes(t.target) || t.target.g.position.distanceTo(o) > WALL_GUN.range)) t.target = null;
    if (t.look <= 0) {
      t.look = 0.35;
      let best: Foe | null = null, bd = WALL_GUN.range;
      for (const f of all) {
        if (!hostile(f)) continue;
        const to = f.g.position.clone().sub(o), d = to.length();
        if (d >= bd || d < 1) continue;
        // only what lies outside the wall's face or out in the open (not through the wall it stands on)
        if (rayWorld(o, to.normalize(), d) < d - ((f as { r?: number }).r ?? 0.6)) continue;
        best = f; bd = d;
      }
      t.target = best;
    }
    let want = t.home + Math.sin(t0 * 0.35 + t.m.x) * 0.9, pitch = -0.12;
    if (t.target) { const to = t.target.g.position.clone().sub(o); want = Math.atan2(-to.x, -to.z); pitch = Math.atan2(to.y, Math.hypot(to.x, to.z)); }
    const dy = ((want - t.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    t.yaw += Math.max(-WALL_GUN.turn * dt, Math.min(WALL_GUN.turn * dt, dy));
    t.head.rotation.set(pitch, t.yaw, 0, 'YXZ');
    if (t.target && Math.abs(dy) < 0.12 && t.cd <= 0) {
      t.cd = WALL_GUN.rate;
      const end = t.target.g.position.clone(), muzzle = new THREE.Vector3(0, 0.02, -1.15).applyEuler(t.head.rotation).add(o);
      addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), add(0x9dffe0)), 0.08);
      burst(end, 0xffb347, 6, 0.4); burst(muzzle, 0xffe0a0, 3, 0.2);
      makeNoise(o, WALL_GUN.noise);
      const flash = G.hitFlash; damageFoe(t.target, WALL_GUN.dmg); G.hitFlash = flash; // the hit marker is for your own shots
    }
  }
}

villageHooks.push({ load: (id, vm, y) => setWallGuns(id, vm.mounts, worksOf(G.char.towns[id], 'turret'), y), drop: dropWallGuns });
