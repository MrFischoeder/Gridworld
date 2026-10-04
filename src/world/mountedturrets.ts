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
interface Gun { spec: MountedTurretSpec; g: THREE.Group; head: THREE.Group; sensor: THREE.Mesh; hp: number; charge: number; cd: number }
const live: Gun[] = [];
/** Same model works on any mounting plane; the head aims independently from its base. */
export function mountedTurretModel(spec: MountedTurretSpec, color = 0xff6a4a) {
  const g = new THREE.Group(), head = new THREE.Group();
  const solid = (geo: THREE.BufferGeometry) => { const o = new THREE.Group(); o.add(new THREE.Mesh(geo, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(color))); return o; };
  const base = solid(new THREE.CylinderGeometry(0.6, 0.6, 0.18, 8));
  const normal = new THREE.Vector3(...spec.normal);
  base.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); base.position.copy(normal).multiplyScalar(spec.mount === 'wall' ? -0.6 : -0.45); g.add(base);
  // Heavy stationary housing with armour plates; only the barrel/sensor head turns.
  const housing = solid(new THREE.BoxGeometry(0.85, 0.7, 0.85)); g.add(housing);
  const brace = solid(new THREE.CylinderGeometry(0.14, 0.14, 0.45, 8));
  brace.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal); brace.position.copy(normal).multiplyScalar(-0.25); g.add(brace);
  head.add(solid(new THREE.BoxGeometry(0.65, 0.4, 0.65)));
  const barrel = solid(new THREE.CylinderGeometry(0.07, 0.07, 0.6, 8).rotateX(Math.PI / 2)); barrel.position.z = -0.55; head.add(barrel);
  const sensor = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.12, 0.06), new THREE.MeshBasicMaterial({ color: 0xff6a4a })); sensor.position.set(0, 0.4, -0.25); head.add(sensor);
  g.position.set(spec.x, spec.y, spec.z); g.add(head); return { g, head, sensor };
}
function drop(t: Gun) { t.g.removeFromParent(); t.g.traverse(o => (o as THREE.Mesh).geometry?.dispose()); (t.sensor.material as THREE.Material).dispose(); }
export function clearMountedTurrets() { for (const t of live) drop(t); live.length = 0; }
export function loadMountedTurrets(specs: MountedTurretSpec[]) {
  clearMountedTurrets();
  for (const spec of specs) if (!progressHas('killed', S.progressBase + spec.id)) {
    const model = mountedTurretModel(spec); scene.add(model.g); live.push({ spec, ...model, hp: S.hp, charge: 0, cd: 0 });
  }
}
export function damageMountedTurret(t: Gun, damage: number) {
  if (!live.includes(t)) return;
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
export function updateMountedTurrets(dt: number) {
  const target = G.pos.clone(); target.y += 1.1;
  for (let i = live.length - 1; i >= 0; i--) {
    const t = live[i];
    if (progressHas('killed', S.progressBase + t.spec.id)) { drop(t); live.splice(i, 1); continue; }
    t.cd = Math.max(0, t.cd - dt);
    const direction = target.clone().sub(t.g.position), distance = direction.length();
    const visible = distance > 0.8 && distance < S.range && rayWorld(t.g.position, direction.normalize(), distance) >= distance - 0.05;
    t.charge = visible ? Math.min(S.warning, t.charge + dt) : 0;
    (t.sensor.material as THREE.MeshBasicMaterial).color.setHex(t.charge > 0 ? 0xffee88 : 0xff6a4a);
    if (!visible) continue;
    t.head.lookAt(target); // models face -Z; Object3D.lookAt faces +Z
    t.head.rotateY(Math.PI);
    if (t.charge < S.warning || t.cd > 0) continue;
    t.cd = S.rate;
    const muzzle = t.g.position.clone().addScaledVector(direction, 0.8);
    addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, target]), add(0xff5a3c)), 0.15);
    burst(muzzle, 0xffee88, 4, 0.2); hurtPlayer(S.damage, true, .3);
  }
}
