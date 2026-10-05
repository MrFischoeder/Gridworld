// Ancient mounted defences. Model/mount data are reusable; player construction is a future feature.
import { hurtPlayer } from './damage';
import * as THREE from 'three';
import { G } from '../game';
import { scene, lineMat, fillMat, add } from './render';
import { addFx, burst } from './fx';
import { rayWorld, H } from './player';
import { progress, progressHas, saveChar } from '../character';
import { MOUNTED_TURRET as S, type MountedTurretSpec } from '../data/mountedturrets';
import { showToast } from '../ui/hud';
import { withTarget, spawnAuthority, boltOut, turretHitOut } from './remote';
interface Gun { spec: MountedTurretSpec; g: THREE.Group; head: THREE.Group; sensor: THREE.Mesh; hp: number; charge: number; cd: number; shots: number }
const live: Gun[] = [];
/** Same model works on any mounting plane; the head aims independently from its base. */
export function mountedTurretModel(spec: MountedTurretSpec, color = 0xff6a4a) {
  const g = new THREE.Group(), head = new THREE.Group();
  const solid = (geo: THREE.BufferGeometry) => { const o = new THREE.Group(); o.add(new THREE.Mesh(geo, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color))); return o; };
  const base = solid(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 8));
  const normal = new THREE.Vector3(...spec.normal);
  base.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); base.position.copy(normal).multiplyScalar(spec.mount === 'wall' ? -0.6 : -0.45); g.add(base);
  // Heavy stationary housing; only the domed head with its barrels turns.
  // a low armoured collar against the mount; the dome stands out of it
  const housing = solid(new THREE.CylinderGeometry(0.5, 0.58, 0.3, 8));
  housing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); housing.position.copy(normal).multiplyScalar(-0.3); g.add(housing);
  const brace = solid(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 8));
  brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); brace.position.copy(normal).multiplyScalar(-0.25); g.add(brace);
  // The turning head: a squat faceted ball dome with an armour belt, a visor slit and twin barrels under it.
  const dome = solid(new THREE.SphereGeometry(0.42, 10, 6).scale(1, 0.78, 1)); head.add(dome);
  const belt = solid(new THREE.CylinderGeometry(0.45, 0.45, 0.1, 10)); head.add(belt);
  for (const side of [-1, 1]) { // cheek plates either side of the slit
    const cheek = solid(new THREE.BoxGeometry(0.08, 0.26, 0.3)); cheek.position.set(side * 0.38, 0, -0.08); head.add(cheek);
  }
  for (const side of [-1, 1]) {
    const barrel = solid(new THREE.CylinderGeometry(0.045, 0.055, 0.55, 6).rotateX(Math.PI / 2)); barrel.position.set(side * 0.1, -0.1, -0.6); head.add(barrel);
  }
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 0.05), new THREE.MeshBasicMaterial({ color: 0xff6a4a })); sensor.position.set(0, 0.12, -0.39); head.add(sensor);
  g.position.set(spec.x, spec.y, spec.z); g.add(head); return { g, head, sensor };
}
function drop(t: Gun) { t.g.removeFromParent(); t.g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); (t.sensor.material as THREE.Material).dispose(); }
/** Another player hit a gun of this place (world/foesync.ts). */
export function remoteTurretHit(id: number, damage: number) { const t = live.find((g) => g.spec.id === id); if (t) { const f = G.hitFlash; damageMountedTurret(t, damage, false); G.hitFlash = f; } }
export function clearMountedTurrets() { for (const t of live) drop(t); live.length = 0; }
export function loadMountedTurrets(specs: MountedTurretSpec[]) {
  clearMountedTurrets();
  for (const spec of specs) if (!progressHas('killed', S.progressBase + spec.id)) {
    const model = mountedTurretModel(spec); scene.add(model.g); live.push({ spec, ...model, hp: S.hp, charge: 0, cd: 0, shots: 0 });
  }
}
export function damageMountedTurret(t: Gun, damage: number, tell = true) {
  if (!live.includes(t)) return;
  if (tell) turretHitOut(t.spec.id, damage); // everyone's copy of the gun takes the same hit
  t.hp -= Math.max(0, damage) * (1 - S.armour); G.hitFlash = 0.15; burst(t.g.position, 0xffb347, 8, 0.4);
  if (t.hp > 0) return;
  progress('killed').push(S.progressBase + t.spec.id); saveChar(); drop(t); live.splice(live.indexOf(t), 1); showToast('Defence turret destroyed');
}
export function mountedTurretHit(x: number, y: number, z: number, radius: number): boolean {
  return live.some(t => Math.hypot(t.spec.x - x, t.spec.z - z) < S.radius + radius && y < t.spec.y + S.radius && y + H > t.spec.y - S.radius);
}
export function rayMountedTurret(o: THREE.Vector3, d: THREE.Vector3, max: number): { gun: Gun; t: number } | null {
  let found: { gun: Gun; t: number } | null = null;
  for (const gun of live) {
    const v = o.clone().sub(gun.g.position), b = v.dot(d), disc = b * b - v.lengthSq() + S.radius ** 2;
    if (disc < 0) continue;
    const t = -b - Math.sqrt(disc);
    if (t >= 0 && t < max) { found = { gun, t }; max = t; }
  }
  return found;
}
const aimer = new THREE.Object3D(), want = new THREE.Quaternion(), fwd = new THREE.Vector3();
/**
 * The guns track you slowly (`S.turn`), wait `S.warning` s with their sensor amber, then fire short bursts along where the
 * head points: a target running across faster than the head turns, or out of sight between bursts, is not hit.
 */
export function updateMountedTurrets(dt: number) {
  for (let i = live.length - 1; i >= 0; i--) {
    const t = live[i];
    if (progressHas('killed', S.progressBase + t.spec.id)) { drop(t); live.splice(i, 1); continue; }
    // shared (multiplayer): the first player's game works the guns, at whoever is nearest; the others see them turn
    withTarget(t.g.position.x, t.g.position.z, () => gunTurn(t, dt));
  }
}
function gunTurn(t: Gun, dt: number) {
  const target = G.pos.clone(); target.y += 1.1;
  {
    t.cd = Math.max(0, t.cd - dt);
    const direction = target.clone().sub(t.g.position), distance = direction.length();
    const visible = distance > 0.8 && distance < S.range && rayWorld(t.g.position, direction.normalize(), distance) >= distance - 0.05;
    t.charge = visible ? Math.min(S.warning, t.charge + dt) : 0;
    (t.sensor.material as THREE.MeshBasicMaterial).color.setHex(t.charge > 0 ? 0xffee88 : 0xff6a4a);
    if (!visible) { t.shots = 0; return; }
    aimer.position.copy(t.g.position); aimer.lookAt(target); aimer.rotateY(Math.PI); // models face -Z; lookAt faces +Z
    want.copy(aimer.quaternion);
    t.head.quaternion.rotateTowards(want, S.turn * dt);
    fwd.set(0, 0, -1).applyQuaternion(t.head.quaternion);
    const off = fwd.angleTo(direction);
    if (t.cd > 0 || !spawnAuthority()) return; // only the first player's game fires (the shots reach everyone)
    if (!t.shots) { if (t.charge < S.warning || off > S.aim) return; t.shots = S.burst; }
    t.shots--; t.cd = t.shots ? S.gap : S.pause;
    // the shot leaves along the barrels with a little scatter; it hits if it passes within the body's reach
    const shot = fwd.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 2).multiplyScalar(S.spread)).normalize();
    const muzzle = t.g.position.clone().addScaledVector(shot, 0.85), along = Math.max(0, target.clone().sub(muzzle).dot(shot));
    const miss = muzzle.clone().addScaledVector(shot, along).distanceTo(target);
    const end = muzzle.clone().addScaledVector(shot, Math.min(S.range, rayWorld(muzzle, shot, S.range)));
    addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, miss < 0.45 ? target : end]), add(0xff5a3c)), 0.12);
    burst(muzzle, 0xffee88, 4, 0.2); boltOut(muzzle, shot.clone().multiplyScalar(60), 0xff5a3c);
    if (miss < 0.45) hurtPlayer(S.damage, true, .3);
  }
}
