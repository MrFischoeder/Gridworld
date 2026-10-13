// Darkness and the lights you carry (0.199). Once a frame `updateLight` works out how dark it is where you are (the
// surface by the time of day and the clouds; below ground the place's own ambient light: gen/darkness.ts) and fills
// the shaders' light map (world/darkshader.ts): your own light, a vehicle's headlights, and the nearest lamps (the
// place's lamps, powered village lamps, fires, other players' lights; modules add theirs with `addLights`).
// Carried lights (`Char.light`, personal): the Flashlight (a beam along your view, burns an Energy Cell every
// `LIGHT.flash.perCell` game minutes) and the Oil Lamp (light all round you, a flask of Lamp Oil every
// `LIGHT.lamp.perOil`). L (away from a lockable door) or using one from the backpack switches it on and off; a spent
// cell or flask is replaced from the backpack, and when none is left the light goes out. Multiplayer: your light is
// personal and others see it through `PeerState.lt` (world/peers.ts), drawn as a lamp at your place.
import * as THREE from 'three';
import { G } from '../game';
import { camera, add } from './render';
import { DARK, LAMP_SLOTS } from './darkshader';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { LIGHT, surfaceDark, nearestLamps, type Lamp } from '../gen/darkness';
import { seen as sky } from './weather';
import { takeOne, hasItem, saveChar } from '../character';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

/** 0 off, 1 the flashlight, 2 the oil lamp. */
export type LightKind = 0 | 1 | 2;
const st = () => (G.char.light ??= { on: 0, flash: 0, oil: 0 });
/** The light you carry now (0 none). */
export const carriedLight = (): LightKind => (G.char.light?.on ?? 0) as LightKind;

let place: { under: boolean; amb: number; lamps: Lamp[] } = { under: false, amb: 1, lamps: [] };
/** A place loaded (world/level.ts): the surface (its darkness follows the clock), or below ground with its ambient light and lamps. */
export function setPlaceLight(under: boolean, amb = 1, lamps: Lamp[] = []) { place = { under, amb, lamps }; told = false; }
const providers: ((out: Lamp[]) => void)[] = [];
/** Another module's lights (village lamps, fires, the other players): pushed into `out` (world coordinates) every frame. */
export function addLights(f: (out: Lamp[]) => void) { providers.push(f); }
let driving: () => boolean = () => false;
/** world/vehicles.ts tells whether you sit in a vehicle (its headlights light the way). */
export function setDrivingHook(f: () => boolean) { driving = f; }

/** Switch a light on (or off if it is the one burning); `k` 0 = cycle flashlight → lamp → off. Returns the message. */
export function toggleLight(k: LightKind = 0): string {
  const s = st(), has = (n: LightKind) => (n === 1 ? hasItem('flashlight') && (s.flash > 0 || hasItem('ammoE')) : n === 2 ? hasItem('oillamp') && (s.oil > 0 || hasItem('lampoil')) : true);
  let next: LightKind;
  if (k) next = s.on === k ? 0 : k;
  else { const order: LightKind[] = [1, 2, 0], from = order.indexOf(s.on as LightKind); next = 0; for (let i = 1; i <= 3; i++) { const n = order[(from + i) % 3]; if (has(n)) { next = n; break; } } }
  if (next && !has(next)) {
    return next === 1 ? (hasItem('flashlight') ? tl('The flashlight needs an Energy Cell.') : tl('You have no flashlight.')) : hasItem('oillamp') ? tl('The lamp needs a flask of Lamp Oil.') : tl('You have no oil lamp.');
  }
  if (next === 1 && s.flash <= 0 && takeOne('ammoE')) s.flash = LIGHT.flash.perCell;
  if (next === 2 && s.oil <= 0 && takeOne('lampoil')) s.oil = LIGHT.lamp.perOil;
  s.on = next; saveChar();
  return next === 1 ? tl('Flashlight on.') : next === 2 ? tl('Oil lamp lit.') : tl('Light out.');
}
/** L: switch the light (cycling what you carry); the message in the log. */
export function lightKey() { logLine(toggleLight(0)); }

let told = false, sum = 0;
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
/** Once a frame, just before drawing: the light map. */
export function updateLight(dt: number) {
  const c = G.char, s = st();
  // the carried light burns while on (game minutes: a real second is a game minute)
  if (s.on && G.playing && !G.intro) {
    if (s.on === 1) { s.flash -= dt; if (s.flash <= 0) { if (takeOne('ammoE')) s.flash += LIGHT.flash.perCell; else { s.flash = 0; s.on = 0; showToast(tl('Flashlight dead')); logLine(tl('The flashlight\'s cell is spent and you carry no other.')); } } }
    else if (s.on === 2) { s.oil -= dt; if (s.oil <= 0) { if (takeOne('lampoil')) s.oil += LIGHT.lamp.perOil; else { s.oil = 0; s.on = 0; showToast(tl('Lamp out')); logLine(tl('The lamp has burnt its last oil.')); } } }
    if (s.on === 1 && !hasItem('flashlight') || s.on === 2 && !hasItem('oillamp')) s.on = 0; // put down or sold
  }
  // how dark it is
  let dark = 0, amb = 1;
  if (place.under) { dark = 1; amb = place.amb; }
  else if (c.loc === 'overworld') { const r = surfaceDark(daylight(c.time, sunTilt(latitude(G.pos.z))), sky.cloud); dark = r.dark; amb = r.amb; }
  if (G.fly) dark = 0; // dev flight sees everything
  DARK.uDark.value = dark; DARK.uAmb.value = amb;
  camera.updateMatrixWorld(); DARK.uViewInv.value.copy(camera.matrixWorld);
  camera.getWorldDirection(fwd);
  const car = driving(), on = G.playing ? s.on : 0;
  DARK.uEye.value.set(0, 0, 0, on === 2 ? LIGHT.lamp.r : on === 1 ? LIGHT.flash.spill : car ? LIGHT.headSpill : 0);
  DARK.uCone.value.set(fwd.x, fwd.y, fwd.z, on === 1 ? LIGHT.flash.range : car ? LIGHT.head : 0);
  // the lamps nearest the camera
  const all: Lamp[] = [...place.lamps];
  if (dark > 0) for (const f of providers) f(all);
  const p = camera.position, near = dark > 0 ? nearestLamps(all, p.x, p.y, p.z) : [];
  for (let i = 0; i < LAMP_SLOTS; i++) { const l = near[i]; if (l) DARK.uLamps.value[i].set(l.x - p.x, l.y - p.y, l.z - p.z, l.r); else DARK.uLamps.value[i].set(0, 0, 0, 0); }
  // a word when it is too dark to see and you carry nothing to light it (once a place, or once a night)
  sum += dt;
  if (sum > 1) {
    sum = 0;
    const black = dark > 0.6 && amb < 0.1 && !on && !car && !near.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < l.r);
    if (black && !told && G.playing) { told = true; logLine(hasItem('flashlight') || hasItem('oillamp') ? tl('It is pitch dark here. Press L to light your way.') : tl('It is pitch dark here. Without a flashlight or an oil lamp you will not find your way.')); }
    if (!place.under && dark < 0.2) told = false;
  }
  showLight(dark, on as LightKind);
}

// the HUD line under the bars: what burns and how long it lasts, shown once it is dark or while a light is on
let box: HTMLDivElement | null = null, last = '';
function showLight(dark: number, on: LightKind) {
  const s = st(), want = G.playing && !document.body.classList.contains('intro') && (on > 0 || dark > 0.5 && (hasItem('flashlight') || hasItem('oillamp')));
  if (!box) { if (!want) return; box = document.createElement('div'); box.id = 'lightbar'; document.body.appendChild(box); }
  box.style.display = want ? 'block' : 'none';
  if (!want) return;
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const spare = (k: 'ammoE' | 'lampoil') => G.char.inv.reduce((a, x) => a + (x && x.k === k ? x.n : 0), 0);
  const t = on === 1 ? TL`FLASHLIGHT ${hm(s.flash)} · cells ${spare('ammoE')}` : on === 2 ? TL`OIL LAMP ${hm(s.oil)} · oil ${spare('lampoil')}` : tl('DARK · L: light');
  if (t !== last) { box.textContent = t; last = t; }
  box.className = on === 1 && s.flash < 20 || on === 2 && s.oil < 30 ? 'low' : on ? '' : 'off';
}

/** A hanging lantern (a lamp of the place, drawn bright: it shows from afar in the dark) at world (x, y, z), its chain up `up` m. */
export function lanternModel(x: number, y: number, z: number, up = 0.8, color = 0xffd28a): THREE.Group {
  const g = new THREE.Group(), m = add(color); m.fog = false;
  const body = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.16, 0.2, 0.42, 6)), m);
  const cap = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.ConeGeometry(0.24, 0.16, 6)), m); cap.position.y = 0.29;
  const chain = new THREE.Line(new THREE.BufferGeometry().setFromPoints([tmp.set(0, 0.37, 0).clone(), tmp.set(0, 0.37 + up, 0).clone()]), m);
  g.add(body, cap, chain); g.position.set(x, y, z);
  return g;
}
