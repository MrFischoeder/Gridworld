// Player weapons: hitscan guns (data/weapons.ts GUNS: the Blaster with its attachments, the pistol, SMG, scattergun and
// hunting rifle; magazines and reloads out of the backpack's rounds, aiming zoom) and melee swings (MELEE: the energy
// blade, machete, spear, sledgehammer). Each has its own model in your hands.
import * as THREE from 'three';
import { camera, lineMat, add, V } from './render';
import { G } from '../game';
import { addFx, burst } from './fx';
import { rayMountedTurret, damageMountedTurret } from './mountedturrets';
import { rayWorld } from './player';
import { vehicles, rayVehicle, damageVehicle, type Vehicle } from './vehicles';
import { foes, damageFoe } from './enemies';
import { rayBarrier, hurtBarrier, rayRaider, type Raider } from './raiders';
import { el } from '../ui/hud';
import { gunOf, meleeOf, type GunLook, type MeleeLook } from '../data/weapons';
import { BLADE, STAMINA, BURN } from '../data/survival';
import { spendStamina, burn } from './survival';
import { makeNoise } from './noise';
import { item, WEAPON_KIND, HAND_TOOLS, type ItemKey } from '../data/items';
import { onHandsChanged, stowHeld, saveChar, calcStats } from '../character';
import { count } from '../data/crafting';
import { logLine } from '../ui/hud';

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
const cylY = (r: number, len: number) => new THREE.CylinderGeometry(r, r, len, 6);
const attach = (o: THREE.Object3D, x: number, y: number, z: number) => { o.position.set(x, y, z); o.visible = false; gunVM.add(o); return o; };
const LOOK = {
  reflex: attach(new THREE.Group().add(part(new THREE.BoxGeometry(0.04, 0.012, 0.06), vmMat), (() => { const f = part(new THREE.BoxGeometry(0.05, 0.045, 0.006), vmMat); f.position.set(0, 0.028, -0.02); return f; })()), 0, 0.05, -0.06),
  scope: attach(new THREE.Group().add(part(cyl(0.026, 0.24), vmMat), (() => { const r = part(cyl(0.034, 0.04), vmMat); r.position.z = -0.12; return r; })()), 0, 0.085, -0.04),
  barL: attach(part(cyl(0.02, 0.2), vmMat), 0, 0, -0.5),
  barR: attach(part(cyl(0.032, 0.18), vmMat), 0, 0, -0.3),
  barS: attach(new THREE.Group().add(part(cyl(0.036, 0.26), vmMat), (() => { const r = part(cyl(0.04, 0.03), vmMat); r.position.z = -0.1; return r; })()), 0, 0, -0.52),
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
// the other guns: each its own model, shown in place of the Blaster's
const gunLooks: Record<GunLook, THREE.Group> = { blaster: gunVM } as Record<GunLook, THREE.Group>;
function gunModel(parts: [THREE.BufferGeometry, number, number, number, number?][]): THREE.Group {
  const g = new THREE.Group();
  for (const [geo, x, y, z, rx] of parts) { const o = part(geo, vmMat); o.position.set(x, y, z); if (rx) o.rotation.x = rx; g.add(o); }
  g.position.set(0.24, -0.22, -0.45); g.visible = false; vmRoot.add(g); return g;
}
gunLooks.pistol = gunModel([[new THREE.BoxGeometry(0.05, 0.07, 0.22), 0, 0.02, -0.08], [new THREE.BoxGeometry(0.045, 0.13, 0.06), 0, -0.07, 0.02, 0.25], [cyl(0.014, 0.06), 0, 0.03, -0.21]]);
gunLooks.smg = gunModel([[new THREE.BoxGeometry(0.07, 0.09, 0.34), 0, 0, -0.1], [new THREE.BoxGeometry(0.035, 0.18, 0.05), 0, -0.13, -0.12], [new THREE.BoxGeometry(0.045, 0.12, 0.05), 0, -0.1, 0.06, 0.3], [cyl(0.016, 0.14), 0, 0.01, -0.33], [new THREE.BoxGeometry(0.03, 0.05, 0.16), 0, 0.02, 0.16]]);
gunLooks.shotgun = gunModel([[new THREE.BoxGeometry(0.07, 0.08, 0.3), 0, 0, 0.02], [cyl(0.024, 0.5), -0.017, 0.03, -0.35], [cyl(0.024, 0.5), 0.017, 0.03, -0.35], [cyl(0.03, 0.2), 0, -0.03, -0.25], [new THREE.BoxGeometry(0.05, 0.1, 0.22), 0, -0.05, 0.22, 0.2]]);
gunLooks.rifle = gunModel([[new THREE.BoxGeometry(0.06, 0.07, 0.4), 0, 0, 0], [cyl(0.015, 0.45), 0, 0.02, -0.42], [cyl(0.022, 0.26), 0, 0.085, -0.05], [cyl(0.03, 0.04), 0, 0.085, -0.19], [new THREE.BoxGeometry(0.05, 0.11, 0.26), 0, -0.04, 0.3, 0.15], [new THREE.BoxGeometry(0.02, 0.02, 0.05), 0.04, 0.03, 0.08]]);
const meleeLooks = {} as Record<MeleeLook, THREE.Group>;
export const bladeVM = new THREE.Group();
const hilt = part(new THREE.BoxGeometry(0.05, 0.2, 0.05), vmMat); hilt.position.y = 0.1; bladeVM.add(hilt);
const guard = part(new THREE.BoxGeometry(0.18, 0.03, 0.06), vmMat); guard.position.y = 0.21; bladeVM.add(guard);
const blade = part(new THREE.BoxGeometry(0.03, 0.7, 0.08), bladeMat, true); blade.position.y = 0.58; bladeVM.add(blade);
bladeVM.visible = false; vmRoot.add(bladeVM); meleeLooks.blade = bladeVM;
function meleeModel(parts: [THREE.BufferGeometry, number, number, number, number?][]): THREE.Group {
  const g = new THREE.Group();
  for (const [geo, x, y, z, rz] of parts) { const o = part(geo, vmMat); o.position.set(x, y, z); if (rz) o.rotation.z = rz; g.add(o); }
  g.visible = false; vmRoot.add(g); return g;
}
meleeLooks.machete = meleeModel([[new THREE.BoxGeometry(0.04, 0.16, 0.04), 0, 0.08, 0], [new THREE.BoxGeometry(0.06, 0.02, 0.05), 0, 0.17, 0], [new THREE.BoxGeometry(0.012, 0.52, 0.07), 0, 0.44, 0.01]]);
meleeLooks.spear = meleeModel([[cylY(0.018, 1.5), 0, 0.35, 0], [new THREE.ConeGeometry(0.035, 0.22, 4), 0, 1.2, 0]]);
meleeLooks.sledge = meleeModel([[cylY(0.02, 0.7), 0, 0.02, 0], [new THREE.BoxGeometry(0.22, 0.11, 0.11), 0, 0.4, 0]]);
/** Something big held in both hands (a wheel, the cannon, a flagpole...): a crate-like bulk low in the view. */
const carryVM = new THREE.Group();
const carryMat = lineMat(0xc8ffd6, { fog: false });
const bulk = part(new THREE.BoxGeometry(0.55, 0.32, 0.4), carryMat); bulk.position.set(0, -0.58, -0.8); bulk.rotation.x = 0.25; carryVM.add(bulk);
const tyre = part((() => { const g = new THREE.CylinderGeometry(0.34, 0.34, 0.22, 14); g.rotateZ(Math.PI / 2); return g; })(), carryMat); tyre.position.set(0.05, -0.66, -0.95); tyre.rotation.y = 0.35; carryVM.add(tyre);
carryVM.visible = false; vmRoot.add(carryVM);
/** Keep the held weapon glued to the camera (call after the camera moved, before rendering vmScene). */
export function syncViewmodel() { vmRoot.position.copy(camera.position); vmRoot.quaternion.copy(camera.quaternion); }

/** The gun / melee weapon in your hands (null when it is not one), and the rounds for the gun left in the backpack. */
const curGun = () => gunOf(G.char.hands[0]?.k);
const curMelee = () => meleeOf(G.char.hands[0]?.k);
const reserve = () => { const g = curGun(); return g ? count(G.char.inv, g.ammo) : 0; };
/** Take up to n rounds of k out of the backpack; returns how many. */
function takeRounds(k: ItemKey, n: number): number {
  let got = 0;
  for (const [i, s] of G.char.inv.entries()) {
    if (!s || s.k !== k || got >= n) continue;
    const m = Math.min(s.n, n - got); s.n -= m; got += m;
    if (s.n <= 0) G.char.inv[i] = null;
  }
  return got;
}
/** What is in your hands: the weapon's name (rounds in the magazine and in the backpack for a gun), or the thing you carry. */
function hudWeapon() {
  const h = G.char.hands[0], g = curGun(), m = curMelee();
  const t = m ? m.name : g ? (G.reloadT > 0 ? g.name + ' · reloading' : `${g.name} ${G.ammo}/${G.gun.mag} · ${reserve()}`)
    : h ? 'Hands: ' + item(h.k).name : 'Hands empty';
  if (el.wname.textContent !== t) el.wname.textContent = t;
}
let heldKey: ItemKey | null = null, heldFor: object | null = null;
/** The weapon in your hands decides what you fight with: G.weapon 0 = gun, 1 = melee, -1 = none (empty or full hands). */
export function syncHeld() {
  const h = G.char.hands[0], k = h?.k ?? null, w = h ? WEAPON_KIND[h.k] ?? -1 : -1;
  if (k !== heldKey || heldFor !== G.char) { // each gun keeps its own magazine (and a loaded or new character starts from its own)
    if (heldKey && gunOf(heldKey) && heldFor === G.char) G.char.loaded[heldKey] = G.ammo;
    heldKey = k; heldFor = G.char; calcStats();
    if (k && gunOf(k)) G.ammo = Math.min(G.char.loaded[k] ?? 0, G.gun.mag);
    G.reloadT = 0;
  }
  if (w !== G.weapon) { G.weapon = w; G.reloadT = 0; G.cooldown = Math.max(G.cooldown, 0.25); }
  refreshWeaponVisibility(); hudWeapon();
}
onHandsChanged(syncHeld);
/** Keys 1 / 2: take the weapon on that side of your back into your hands (what you held goes onto your back). */
export function drawBack(i: number) {
  const c = G.char, b = c.back[i], h = c.hands[0];
  if (!b) { logLine(`Nothing on your back (slot ${i + 1}).`); return; }
  if (h && WEAPON_KIND[h.k] === undefined) { logLine(`Your hands are full: ${item(h.k).name}. Put it away first (a trunk, a chest or a vehicle; the backpack window can drop it).`); return; }
  c.hands[0] = b; c.back[i] = h; saveChar(); syncHeld();
}
/** Q / mouse wheel: swap the weapon in your hands for the (first) one on your back. */
export function swapWeapon() {
  const i = G.char.back.findIndex((s) => s && WEAPON_KIND[s.k] !== undefined);
  if (i >= 0) drawBack(i);
}
/** X: sling the weapon in your hands onto your back. */
export function holster() {
  const h = G.char.hands[0];
  if (!h) return;
  if (WEAPON_KIND[h.k] === undefined) { logLine(`You carry the ${item(h.k).name} in your hands.`); return; }
  const m = stowHeld(); if (m) logLine(m); else saveChar();
  syncHeld();
}
let dryAt = -99;
/** Start reloading the gun in your hands (R, or on its own when the magazine runs dry), if the backpack holds its rounds. */
export function reload() {
  const g = curGun();
  if (G.weapon !== 0 || !g || G.reloadT > 0 || G.ammo >= G.gun.mag || !armed()) return;
  if (reserve() <= 0) {
    const now = performance.now() / 1000;
    if (now - dryAt > 3) { dryAt = now; logLine(`No ${item(g.ammo).name} left for the ${g.name}. Search chests, stashes and the fallen, or have a blacksmith make more.`); }
    return;
  }
  G.reloadT = G.gun.reload; hudWeapon();
}
/** Reload timer, and the aiming zoom (right mouse button / AIM on touch): the camera narrows its field of view. */
export function updateGun(dt: number, onFoot: boolean) {
  if (G.reloadT > 0 && (G.reloadT -= dt) <= 0) {
    G.reloadT = 0;
    const g = curGun();
    if (g) { G.ammo += takeRounds(g.ammo, G.gun.mag - G.ammo); if (heldKey) G.char.loaded[heldKey] = G.ammo; saveChar(); }
  }
  const aim = onFoot && G.weapon === 0 && armed() && (G.aiming || G.touchAim), fov = aim ? 75 / G.gun.zoom : 75;
  if (Math.abs(camera.fov - fov) > 0.05) { camera.fov += (fov - camera.fov) * Math.min(1, dt * 12); camera.updateProjectionMatrix(); }
  aimK += ((aim ? 1 : 0) - aimK) * Math.min(1, dt * 12);
  el.scope.style.opacity = aim && G.gun.zoom >= 3 ? String(Math.max(0, aimK * 2 - 1)) : '0';
  hudWeapon();
}
let aimK = 0;
const activeGun = () => gunLooks[curGun()?.look ?? 'blaster'];
const activeMelee = () => meleeLooks[curMelee()?.look ?? 'blade'];
/** Re-apply holstered / drawn state after the armed rule may have changed. */
export function refreshWeaponVisibility() {
  const v = armed(), gv = activeGun(), mv = activeMelee();
  for (const o of Object.values(gunLooks)) o.visible = v && G.weapon === 0 && o === gv;
  for (const o of Object.values(meleeLooks)) o.visible = v && G.weapon === 1 && o === mv;
  const h = G.char.hands[0]; carryVM.visible = !!h && G.weapon < 0 && !HAND_TOOLS.has(h.k); // (hand tools are drawn by world/gather.ts) tyre.visible = h?.k === 'wheelL' || h?.k === 'wheelH'; bulk.visible = !tyre.visible;
}

export function animateVM(dt: number, moving: boolean) {
  const bob = moving ? Math.sin(performance.now() / 110) * 0.012 : 0;
  // aiming brings the gun to the middle; a long scope hides it (the scope overlay takes over); reloading dips it
  const k = aimK, dip = G.reloadT > 0 ? Math.sin(Math.min(1, 1 - G.reloadT / G.gun.reload) * Math.PI) * 0.12 : 0, gv = activeGun();
  gv.position.set(0.24 * (1 - k), -0.22 + bob * (1 - k) + k * 0.1 - dip, -0.45 + Math.max(0, G.cooldown - 0.08) * 0.4 + k * 0.05);
  gv.rotation.x = -dip * 3;
  gv.scale.setScalar(k > 0.5 && G.gun.zoom >= 3 ? 0.0001 : 1);
  if (G.swingT > 0) G.swingT = Math.max(0, G.swingT - dt);
  const sw = G.swingT > 0, s = sw ? 1 - G.swingT / swingDur : 0, e = s < 0.5 ? s * 2 : 1, mv = activeMelee(), spear = curMelee()?.look === 'spear';
  if (spear) { mv.position.set(0.3, -0.34 + bob, -0.5 - (sw ? Math.sin(s * Math.PI) * 0.7 : 0)); mv.rotation.set(-1.45, 0, -0.1); } // a thrust
  else { mv.position.set(0.34 - (sw ? e * 0.45 : 0), -0.36 + bob, -0.5); mv.rotation.set(-0.35 - (sw ? e * 0.9 : 0), 0, sw ? -0.9 + e * 2.2 : -0.5); }
}
let swingDur = 0.26;

/** One ray of a shot (a pellet of the scattergun is one too): what it hits takes dmg; a tracer to where it ends. */
function ray(d: THREE.Vector3, dmg: number) {
  const o = camera.position.clone();
  const range = G.gun.range;
  let tHit = rayWorld(o, d, range), hitT = null;
  for (const t of foes()) {
    if ('kind' in t && t.kind === 'raider') { // a vehicle: its body, or the crew through the windows
      const h = rayRaider(t as Raider, o, d, tHit);
      if (h) { tHit = h.t; hitT = t; }
      continue;
    }
    const rr = t.r || 0.6, oc = o.clone().sub(t.g.position), b = oc.dot(d), c = oc.lengthSq() - rr * rr, disc = b * b - c;
    if (disc < 0) continue; const tt = -b - Math.sqrt(disc);
    if (tt > 0 && tt < tHit) { tHit = tt; hitT = t; }
  }
  let car: Vehicle | null = null;
  for (const v of vehicles) {
    if (v.ai) continue; // raiders already use the foe damage path
    const h = rayVehicle(v, o, d, tHit);
    if (h) { tHit = h.t; car = v; hitT = null; }
  }
  let turret = rayMountedTurret(o, d, tHit);
  if (turret) { tHit = turret.t; hitT = null; car = null; }
  const bar = rayBarrier(o, d, tHit); // a roadblock in the way takes the shot
  if (bar) { tHit = bar.t; hitT = null; turret = null; car = null; hurtBarrier(bar.p, dmg); }
  const end = o.clone().addScaledVector(d, tHit);
  const gun = V(0.24 * (1 - aimK), -0.2 + aimK * 0.1, -0.75); camera.localToWorld(gun);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([gun, end]), add(hitT || turret ? 0xffd27a : 0x9dffb4)), 0.12);
  burst(end, hitT || turret ? 0xffb347 : 0x3dff6e, hitT || turret ? 10 : 6, hitT || turret ? 0.7 : 0.35);
  if (car) { damageVehicle(car, dmg); G.hitFlash = .15; }
  if (turret) damageMountedTurret(turret.gun, dmg);
  if (hitT) damageFoe(hitT, dmg);
}
function shoot() {
  const d = new THREE.Vector3(); camera.getWorldDirection(d);
  const g = curGun()!, n = g.pellets ?? 1, spread = (g.spread ?? 0) * (aimK > 0.5 ? 0.7 : 1);
  const right = new THREE.Vector3().crossVectors(d, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, d);
  for (let i = 0; i < n; i++) {
    const p = n > 1 ? d.clone().addScaledVector(right, (Math.random() - 0.5) * 2 * spread).addScaledVector(up, (Math.random() - 0.5) * 2 * spread).normalize() : d;
    ray(p, G.gun.dmg * G.S.bm);
  }
  makeNoise(camera.position, G.gun.noise);
}
/** A melee swing (a thrust with the spear): hits hard while you have the stamina for it; exhausted it is weak (and slow, see attack()). */
function slash(tired: boolean) {
  const m = curMelee()!;
  swingDur = G.swingT = tired ? Math.max(0.45, m.rate * 1.1) : Math.min(0.5, m.rate * 0.62);
  const o = camera.position.clone(), f = new THREE.Vector3(); camera.getWorldDirection(f);
  const right = new THREE.Vector3().crossVectors(f, camera.up).normalize(), up = new THREE.Vector3().crossVectors(right, f);
  const pts: THREE.Vector3[] = [], reach = G.S.range, wide = m.look === 'spear' ? 0.25 : 0.7;
  for (let i = 0; i <= 12; i++) {
    const a = -wide + 2 * wide * i / 12;
    pts.push(o.clone().addScaledVector(f, Math.cos(a) * reach * 0.62).addScaledVector(right, -Math.sin(a) * reach * 0.62).addScaledVector(up, -0.25 + Math.sin(a) * 0.25));
  }
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), add(m.look === 'blade' ? 0xc8ffd6 : 0xe8e0c0)), 0.18);
  const turret = rayMountedTurret(o, f, Math.min(reach, rayWorld(o, f, reach)));
  if (turret) damageMountedTurret(turret.gun, m.dmg * G.S.mm * (tired ? BLADE.tiredDmg : 1));
  for (const t of foes()) {
    const v = t.g.position.clone().sub(o), dist = v.length();
    if (dist > reach + (t.r || 0.5)) continue;
    if (v.normalize().dot(f) < Math.cos(wide)) continue;
    burst(t.g.position.clone(), 0xc8ffd6, tired ? 6 : 14, tired ? 0.5 : 0.9); damageFoe(t, m.dmg * G.S.mm * (tired ? BLADE.tiredDmg : 1));
  }
}
export function attack() {
  if (G.cooldown > 0 || !armed() || G.weapon < 0) return;
  if (G.weapon === 0) {
    if (G.reloadT > 0 || !curGun()) return;
    if (G.ammo <= 0) { reload(); return; }
    shoot(); G.ammo--; if (heldKey) G.char.loaded[heldKey] = G.ammo;
    if (G.ammo <= 0) reload();
    G.cooldown = G.S.rate;
  } else {
    // every swing costs stamina; exhausted, swings are slow and weak, whatever speeds them up otherwise
    const m = curMelee();
    if (!m) return;
    const tired = !spendStamina(STAMINA.swing * m.stamina);
    burn(BURN.swing * m.stamina);
    slash(tired);
    G.cooldown = tired ? BLADE.tiredRate * m.rate / BLADE.rate : m.rate;
  }
}
