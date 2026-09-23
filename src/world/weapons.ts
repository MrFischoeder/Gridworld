// Player weapons: hitscan blaster and a melee blade arc.
import * as THREE from 'three';
import { camera, lineMat, add, V } from './render';
import { G } from '../game';
import { addFx, burst } from './fx';
import { rayWorld } from './player';
import { foes, damageFoe } from './enemies';
import { el } from '../ui/hud';

export const WEAPONS = [{ name: 'Blaster', dmg: 1, rate: 0 }, { name: 'Blade', rate: 0.42, dmg: 2 }];
/** Weapons are holstered in safe places (the village). */
export let armed = () => true;
export function setArmedRule(f: () => boolean) { armed = f; }

const vmMat = lineMat(0x7dffa0, { fog: false, depthTest: false, transparent: true });
const bladeMat = lineMat(0xc8ffd6, { fog: false, depthTest: false, transparent: true, blending: THREE.AdditiveBlending });
const edges = (g: THREE.BufferGeometry, m: THREE.Material) => { const l = new THREE.LineSegments(new THREE.EdgesGeometry(g), m); l.renderOrder = 10; return l; };
export const gunVM = new THREE.Group();
gunVM.add(edges(new THREE.BoxGeometry(0.07, 0.08, 0.42), vmMat));
const barrel = edges(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), vmMat); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.3; gunVM.add(barrel);
const grip = edges(new THREE.BoxGeometry(0.05, 0.14, 0.06), vmMat); grip.position.set(0, -0.1, 0.1); grip.rotation.x = 0.3; gunVM.add(grip);
gunVM.position.set(0.24, -0.22, -0.45); camera.add(gunVM);
export const bladeVM = new THREE.Group();
const hilt = edges(new THREE.BoxGeometry(0.05, 0.2, 0.05), vmMat); hilt.position.y = 0.1; bladeVM.add(hilt);
const guard = edges(new THREE.BoxGeometry(0.18, 0.03, 0.06), vmMat); guard.position.y = 0.21; bladeVM.add(guard);
const blade = edges(new THREE.BoxGeometry(0.03, 0.7, 0.08), bladeMat); blade.position.y = 0.58; bladeVM.add(blade);
bladeVM.visible = false; camera.add(bladeVM);

export function setWeapon(w: number) {
  G.weapon = w; const v = armed(); gunVM.visible = v && w === 0; bladeVM.visible = v && w === 1;
  el.wname.textContent = WEAPONS[w].name; G.cooldown = Math.max(G.cooldown, 0.15);
}
/** Re-apply holstered / drawn state after the armed rule may have changed. */
export function refreshWeaponVisibility() { const v = armed(); gunVM.visible = v && G.weapon === 0; bladeVM.visible = v && G.weapon === 1; }

export function animateVM(dt: number, moving: boolean) {
  const bob = moving ? Math.sin(performance.now() / 110) * 0.012 : 0;
  gunVM.position.set(0.24, -0.22 + bob, -0.45 + Math.max(0, G.cooldown - 0.08) * 0.4);
  if (G.swingT > 0) G.swingT = Math.max(0, G.swingT - dt);
  const sw = G.swingT > 0, s = sw ? 1 - G.swingT / 0.26 : 0, e = s < 0.5 ? s * 2 : 1;
  bladeVM.position.set(0.34 - (sw ? e * 0.45 : 0), -0.36 + bob, -0.5);
  bladeVM.rotation.set(-0.35 - (sw ? e * 0.9 : 0), 0, sw ? -0.9 + e * 2.2 : -0.5);
}

function shoot() {
  const o = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d);
  let tHit = rayWorld(o, d, 80), hitT = null;
  for (const t of foes()) {
    const rr = t.r || 0.6, oc = o.clone().sub(t.g.position), b = oc.dot(d), c = oc.lengthSq() - rr * rr, disc = b * b - c;
    if (disc < 0) continue; const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < tHit) { tHit = tt; hitT = t; }
  }
  const end = o.clone().addScaledVector(d, tHit);
  const gun = V(0.24, -0.2, -0.75); camera.localToWorld(gun);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([gun, end]), add(hitT ? 0xffd27a : 0x9dffb4)), 0.12);
  burst(end, hitT ? 0xffb347 : 0x3dff6e, hitT ? 10 : 6, hitT ? 0.7 : 0.35);
  if (hitT) damageFoe(hitT, WEAPONS[0].dmg * G.S.bm);
}
function slash() {
  G.swingT = 0.26;
  const o = camera.position.clone(), f = new THREE.Vector3(); camera.getWorldDirection(f);
  const right = new THREE.Vector3().crossVectors(f, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, f);
  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= 12; i++) {
    const a = -0.7 + 1.4 * i / 12;
    pts.push(o.clone().addScaledVector(f, Math.cos(a) * 1.6).addScaledVector(right, -Math.sin(a) * 1.6).addScaledVector(up, -0.25 + Math.sin(a) * 0.25));
  }
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), add(0xc8ffd6)), 0.18);
  for (const t of foes()) {
    const v = t.g.position.clone().sub(o), dist = v.length();
    if (dist > G.S.range + (t.r || 0.5)) continue;
    if (v.normalize().dot(f) < Math.cos(0.7)) continue;
    burst(t.g.position.clone(), 0xc8ffd6, 14, 0.9); damageFoe(t, WEAPONS[1].dmg * G.S.mm);
  }
}
export function attack() {
  if (G.cooldown > 0 || !armed()) return;
  if (G.weapon === 0) shoot(); else slash();
  G.cooldown = G.weapon === 0 ? G.S.rate : WEAPONS[1].rate;
}
