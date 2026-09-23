// Player weapons: the hitscan Blaster (stats and attachments from data/weapons, magazine and reload, aiming zoom) and a melee blade arc.
import * as THREE from 'three';
import { camera, lineMat, add, V } from './render';
import { G } from '../game';
import { addFx, burst } from './fx';
import { rayWorld } from './player';
import { foes, damageFoe } from './enemies';
import { el } from '../ui/hud';
import { BLASTER } from '../data/weapons';

export const WEAPONS = [{ name: BLASTER.name, dmg: 1, rate: 0 }, { name: 'Blade', rate: 0.42, dmg: 2 }];
/** Weapons are holstered in safe places (the village). */
export let armed = () => true;
export function setArmedRule(f: () => boolean) { armed = f; }

// Held weapons live in their own little scene, drawn after the world with a cleared depth buffer:
// they are solid (dark fill under the lines) yet never poke into walls.
export const vmScene = new THREE.Scene();
const vmRoot = new THREE.Group(); vmScene.add(vmRoot);
const vmMat = lineMat(0x7dffa0, { fog: false });
const bladeMat = lineMat(0xc8ffd6, { fog: false, transparent: true, blending: THREE.AdditiveBlending });
const vmFill = new THREE.MeshBasicMaterial({ color: 0x021208, fog: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
/** Solid part: dark body with its edges drawn on top. `glow` parts (the energy blade) stay translucent. */
const part = (g: THREE.BufferGeometry, m: THREE.Material, glow = false) => {
  const o = new THREE.Group();
  if (!glow) o.add(new THREE.Mesh(g, vmFill));
  o.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), m));
  return o;
};
export const gunVM = new THREE.Group();
gunVM.add(part(new THREE.BoxGeometry(0.07, 0.08, 0.42), vmMat));
const barrel = part(new THREE.CylinderGeometry(0.02, 0.02, 0.2, 6), vmMat); barrel.rotation.x = Math.PI / 2; barrel.position.z = -0.3; gunVM.add(barrel);
const grip = part(new THREE.BoxGeometry(0.05, 0.14, 0.06), vmMat); grip.position.set(0, -0.1, 0.1); grip.rotation.x = 0.3; gunVM.add(grip);
const sight = part(new THREE.BoxGeometry(0.03, 0.03, 0.1), vmMat); sight.position.set(0, 0.055, -0.05); gunVM.add(sight);
const cell = part(new THREE.BoxGeometry(0.075, 0.05, 0.12), vmMat); cell.position.set(0, -0.06, -0.08); gunVM.add(cell);
gunVM.position.set(0.24, -0.22, -0.45); vmRoot.add(gunVM);
// attachments: shown on the held gun when fitted
const cyl = (r: number, len: number) => { const g = new THREE.CylinderGeometry(r, r, len, 8); g.rotateX(Math.PI / 2); return g; };
const attach = (o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(x, y, z); o.visible = false; gunVM.add(o); return o; };
const LOOK = {
  reflex: attach(new THREE.Group().add(part(new THREE.BoxGeometry(0.04, 0.012, 0.06), vmMat), (() => { const f = part(new THREE.BoxGeometry(0.05, 0.045, 0.006), vmMat); f.position.set(0, 0.028, -0.02); return f; })()), 0, 0.05, -0.06),
  scope: attach(new THREE.Group().add(part(cyl(0.026, 0.24), vmMat), (() => { const r = part(cyl(0.034, 0.04), vmMat); r.position.z = -0.12; return r; })()), 0, 0.085, -0.04),
  barL: attach(part(cyl(0.02, 0.2), vmMat), 0, 0, -0.5),
  barR: attach(part(cyl(0.032, 0.18), vmMat), 0, 0, -0.3),
  magX: attach(part(new THREE.BoxGeometry(0.07, 0.13, 0.1), vmMat), 0, -0.1, -0.08),
  magD: attach(part((() => { const g = new THREE.CylinderGeometry(0.075, 0.075, 0.07, 12); g.rotateZ(Math.PI / 2); return g; })(), vmMat), 0, -0.12, -0.08),
};
/** Show the fitted attachments on the held gun (the plain sight and power cell give way to them). */
export function refreshGunLook() {
  const m = G.char.gunMods;
  for (const [k, o] of Object.entries(LOOK)) o.visible = m.includes(k as keyof typeof LOOK);
  sight.visible = !m[0]; cell.visible = !m[2];
  hudWeapon();
}
export const bladeVM = new THREE.Group();
const hilt = part(new THREE.BoxGeometry(0.05, 0.2, 0.05), vmMat); hilt.position.y = 0.1; bladeVM.add(hilt);
const guard = part(new THREE.BoxGeometry(0.18, 0.03, 0.06), vmMat); guard.position.y = 0.21; bladeVM.add(guard);
const blade = part(new THREE.BoxGeometry(0.03, 0.7, 0.08), bladeMat, true); blade.position.y = 0.58; bladeVM.add(blade);
bladeVM.visible = false; vmRoot.add(bladeVM);
/** Keep the held weapon glued to the camera (call after the camera moved, before rendering vmScene). */
export function syncViewmodel() { vmRoot.position.copy(camera.position); vmRoot.quaternion.copy(camera.quaternion); }

/** Weapon name, and rounds left for the Blaster. */
function hudWeapon() {
  const t = G.weapon === 1 ? WEAPONS[1].name : G.reloadT > 0 ? BLASTER.name + ' · reloading' : `${BLASTER.name} ${G.ammo}/${G.gun.mag}`;
  if (el.wname.textContent !== t) el.wname.textContent = t;
}
export function setWeapon(w: number) {
  G.weapon = w; const v = armed(); gunVM.visible = v && w === 0; bladeVM.visible = v && w === 1;
  G.cooldown = Math.max(G.cooldown, 0.15); hudWeapon();
}
/** Start reloading the Blaster (R, or on its own when the magazine runs dry). Reserve ammo is unlimited for now. */
export function reload() {
  if (G.weapon !== 0 || G.reloadT > 0 || G.ammo >= G.gun.mag || !armed()) return;
  G.reloadT = G.gun.reload; hudWeapon();
}
/** Reload timer, and the aiming zoom (right mouse button / AIM on touch): the camera narrows its field of view. */
export function updateGun(dt: number, onFoot: boolean) {
  if (G.reloadT > 0 && (G.reloadT -= dt) <= 0) { G.reloadT = 0; G.ammo = G.gun.mag; }
  const aim = onFoot && G.weapon === 0 && armed() && (G.aiming || G.touchAim), fov = aim ? 75 / G.gun.zoom : 75;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
  aimK += ((aim ? 1 : 0) - aimK) * Math.min(1, dt * 12);
  el.scope.style.opacity = aim && G.gun.zoom >= 3 ? String(Math.max(0, aimK * 2 - 1)) : '0';
  hudWeapon();
}
let aimK = 0;
/** Re-apply holstered / drawn state after the armed rule may have changed. */
export function refreshWeaponVisibility() { const v = armed(); gunVM.visible = v && G.weapon === 0; bladeVM.visible = v && G.weapon === 1; }

export function animateVM(dt: number, moving: boolean) {
  const bob = moving ? Math.sin(performance.now() / 110) * 0.012 : 0;
  // aiming brings the gun to the middle; a long scope hides it (the scope overlay takes over); reloading dips it
  const k = aimK, dip = G.reloadT > 0 ? Math.sin(Math.min(1, 1 - G.reloadT / G.gun.reload) * Math.PI) * 0.12 : 0;
  gunVM.position.set(0.24 * (1 - k), -0.22 + bob * (1 - k) + k * 0.1 - dip, -0.45 + Math.max(0, G.cooldown - 0.08) * 0.4 + k * 0.05);
  gunVM.rotation.x = -dip * 3;
  gunVM.scale.setScalar(k > 0.5 && G.gun.zoom >= 3 ? 0.0001 : 1);
  if (G.swingT > 0) G.swingT = Math.max(0, G.swingT - dt);
  const sw = G.swingT > 0, s = sw ? 1 - G.swingT / 0.26 : 0, e = s < 0.5 ? s * 2 : 1;
  bladeVM.position.set(0.34 - (sw ? e * 0.45 : 0), -0.36 + bob, -0.5);
  bladeVM.rotation.set(-0.35 - (sw ? e * 0.9 : 0), 0, sw ? -0.9 + e * 2.2 : -0.5);
}

function shoot() {
  const o = camera.position.clone(), d = new THREE.Vector3(); camera.getWorldDirection(d);
  const range = G.gun.range;
  let tHit = rayWorld(o, d, range), hitT = null;
  for (const t of foes()) {
    const rr = t.r || 0.6, oc = o.clone().sub(t.g.position), b = oc.dot(d), c = oc.lengthSq() - rr * rr, disc = b * b - c;
    if (disc < 0) continue; const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < tHit) { tHit = tt; hitT = t; }
  }
  const end = o.clone().addScaledVector(d, tHit);
  const gun = V(0.24 * (1 - aimK), -0.2 + aimK * 0.1, -0.75); camera.localToWorld(gun);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([gun, end]), add(hitT ? 0xffd27a : 0x9dffb4)), 0.12);
  burst(end, hitT ? 0xffb347 : 0x3dff6e, hitT ? 10 : 6, hitT ? 0.7 : 0.35);
  if (hitT) damageFoe(hitT, G.gun.dmg * G.S.bm);
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
  if (G.weapon === 0) {
    if (G.reloadT > 0) return;
    if (G.ammo <= 0) { reload(); return; }
    shoot(); G.ammo--;
    if (G.ammo <= 0) reload();
  } else slash();
  G.cooldown = G.weapon === 0 ? G.S.rate : WEAPONS[1].rate;
}
