// Darkness and the lights you carry (0.199). Once a frame `updateLight` works out how dark it is where you are (the
// surface by the time of day and the clouds; below ground the place's own ambient light: gen/darkness.ts) and fills
// the shaders' light map (world/darkshader.ts): your own light, a vehicle's headlights, and the nearest lamps (the
// place's lamps, powered village lamps, fires, other players' lights; modules add theirs with `addLights`).
// Carried lights (`Char.light`, personal): the Flashlight (a beam along your view, runs a Battery flat every
// `LIGHT.flash.perBattery` game minutes), the Oil Lamp (light all round you, a flask of Lamp Oil every
// `LIGHT.lamp.perOil`) and (0.200) the Torch (a flickering light round you, one burns down in `LIGHT.torch.per`). L
// (away from a lockable door) or using one from the backpack switches it on and off; a flat battery, an empty flask or
// a burnt torch is replaced from the backpack, and when none is left the light goes out. Multiplayer: your light is
// personal and others see it through `PeerState.lt` (world/peers.ts), drawn as a lamp at your place.
import * as THREE from 'three';
import { G } from '../game';
import { camera, add } from './render';
import { DARK, LAMP_SLOTS } from './darkshader';
import { drawGlows, hideGlows, type Glow } from './glows';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { LIGHT, surfaceDark, nearestLamps, flickers, type Lamp } from '../gen/darkness';
import { seen as sky } from './weather';
import { takeOne, hasItem, saveChar, offHeld, bothHands, takeInOff, handsChanged } from '../character';
import { item } from '../data/items';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';
import { VectorFlame } from './vectorflame';
import { mountedFlashlight } from '../gen/weaponlight';

/** 0 off, 1 the flashlight, 2 the oil lamp, 3 a torch. */
export type LightKind = 0 | 1 | 2 | 3;
const st = () => { const s = (G.char.light ??= { on: 0, flash: 0, oil: 0 }); s.torch ??= 0; return s as { on: number; flash: number; oil: number; torch: number }; };
/** What each light burns, how long one lasts, and the tool it needs (a torch is its own fuel). */
const FUEL: Record<1 | 2 | 3, { k: 'battery' | 'lampoil' | 'firebrand'; per: number; tool: 'flashlight' | 'oillamp' | 'firebrand'; left: 'flash' | 'oil' | 'torch' }> = {
  1: { k: 'battery', per: LIGHT.flash.perBattery, tool: 'flashlight', left: 'flash' },
  2: { k: 'lampoil', per: LIGHT.lamp.perOil, tool: 'oillamp', left: 'oil' },
  3: { k: 'firebrand', per: LIGHT.torch.per, tool: 'firebrand', left: 'torch' },
};
/** The light you carry now (0 none). */
export const carriedLight = (): LightKind => (G.char.light?.on ?? 0) as LightKind;

let place: { under: boolean; amb: number; lamps: Lamp[] } = { under: false, amb: 1, lamps: [] };
/** A place loaded (world/level.ts): the surface (its darkness follows the clock), or below ground with its ambient light and lamps. */
export function setPlaceLight(under: boolean, amb = 1, lamps: Lamp[] = []) { place = { under, amb, lamps }; told = false; }
const providers: ((out: Lamp[]) => void)[] = [];
/** Another module's lights (village lamps, fires, the other players): pushed into `out` (world coordinates) every frame. */
export function addLights(f: (out: Lamp[]) => void) { providers.push(f); }
const glowers: ((out: Glow[]) => void)[] = [];
/** (0.204) Points of light seen from afar that light nothing round them (a lighthouse's flash): world/glows.ts. */
export function addGlows(f: (out: Glow[]) => void) { glowers.push(f); }
/** The colour of a light seen from afar, by its kind. */
const GLOW_C = { electric: 0xe6f4ff, torch: 0xffa850, fire: 0xffa850, oil: 0xffc878 } as Record<string, number>;
let driving: () => boolean = () => false;
/** world/vehicles.ts tells whether you sit in a vehicle (its headlights light the way). */
export function setDrivingHook(f: () => boolean) { driving = f; }

/**
 * Switch a light on (or off if it is the one burning); `k` 0 = cycle flashlight → lamp → torch → off. (0.201) A light is
 * held in your other hand: lighting one takes it there (what the hand held goes into the backpack, a two-handed weapon
 * onto your back). Returns the message.
 */
export function toggleLight(k: LightKind = 0): string {
  const s = st(), mounted = mountedFlashlight(G.char.hands[0]);
  const has = (n: LightKind) => (n === 0 ? true : n === 3 ? hasItem('firebrand') : (n === 1 && mounted || hasItem(FUEL[n].tool)) && (s[FUEL[n].left] > 0 || hasItem(FUEL[n].k)));
  let next: LightKind;
  if (!k && mounted) next = s.on === 1 ? 0 : 1; // L toggles the rail light without cycling to a hand-held lamp.
  else if (k) next = s.on === k ? 0 : k;
  else { const order: LightKind[] = [1, 2, 3, 0], from = order.indexOf(s.on as LightKind); next = 0; for (let i = 1; i <= 4; i++) { const n = order[(from + i) % 4]; if (has(n)) { next = n; break; } } }
  if (next && !has(next)) {
    return next === 1 ? (mounted || hasItem('flashlight') ? tl('The flashlight needs a Battery.') : tl('You have no flashlight.')) : next === 2 ? (hasItem('oillamp') ? tl('The lamp needs a flask of Lamp Oil.') : tl('You have no oil lamp.')) : tl('You have no torch.');
  }
  let slung = '';
  if (next) {
    const f = FUEL[next], fitted = next === 1 && mounted, two = !fitted && bothHands() ? G.char.hands[0]!.k : null;
    const m = fitted ? '' : takeInOff(f.tool); if (m) return m;
    if (two) slung = ' ' + TL`The ${item(two).name} goes on your back: it needs both hands.`;
    if (s[f.left] <= 0 && (next === 3 || takeOne(f.k))) s[f.left] = f.per; // a fresh torch (it is the one in your hand)
  }
  s.on = next; saveChar();
  return (next === 1 ? tl('Flashlight on.') : next === 2 ? tl('Oil lamp lit.') : next === 3 ? tl('Torch lit.') : tl('Light out.')) + slung;
}
/** Whether you carry anything to light (a flashlight, a lamp, a torch). */
const carriesLight = () => mountedFlashlight(G.char.hands[0]) || hasItem('flashlight') || hasItem('oillamp') || hasItem('firebrand');
/** L: switch the light (cycling what you carry); the message in the log. */
export function lightKey() { logLine(toggleLight(0)); }

let told = false, sum = 0, clock = 0;
/** A flame's reach breathing: 0.86–1 of it, each flame on its own beat. */
const flicker = (t: number, x: number, z: number) => 0.93 + 0.035 * Math.sin(t * 9.1 + x * 1.7) + 0.035 * Math.sin(t * 13.7 + z * 2.3 + Math.sin(t * 3.1));
const fwd = new THREE.Vector3(), tmp = new THREE.Vector3();
/** Once a frame, just before drawing: the light map. */
export function updateLight(dt: number) {
  const c = G.char, s = st();
  // the carried light burns while on (game minutes: a real second is a game minute)
  if (s.on && G.playing && !G.intro) {
    const f = FUEL[s.on as 1 | 2 | 3], o = offHeld();
    s[f.left] -= dt;
    if (s[f.left] <= 0) {
      // a torch burns down in your hand: the next of the bunch (or one from the backpack) is lit from it
      const next = s.on === 3 ? (o?.k === 'firebrand' && --o.n > 0) || (o?.k === 'firebrand' && (G.char.off[0] = null, !takeInOff('firebrand'))) : takeOne(f.k);
      if (s.on === 3) handsChanged();
      if (next) s[f.left] += f.per;
      else {
        s[f.left] = 0; const was = s.on; s.on = 0;
        if (was === 1) { showToast(tl('Flashlight dead')); logLine(tl('The flashlight\'s battery is flat and you carry no other.')); }
        else if (was === 2) { showToast(tl('Lamp out')); logLine(tl('The lamp has burnt its last oil.')); }
        else { showToast(tl('Torch out')); logLine(tl('Your last torch has burnt down.')); }
      }
    }
    // (0.201) the light is held in the other hand: put down, or both hands taken by a long gun, it goes out
    if (s.on) {
      const tool = FUEL[s.on as 1 | 2 | 3].tool, o2 = offHeld();
      if (s.on === 1 && mountedFlashlight(c.hands[0])) { /* The weapon carries the lamp; both hands stay on the gun. */ }
      else if (o2?.k !== tool) { s.on = 0; logLine(tl('Your light is out of your hand: it goes out.')); }
      else if (bothHands()) { s.on = 0; logLine(TL`Both hands on the ${item(G.char.hands[0]!.k).name}: your light goes out.`); }
    }
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
  clock += dt;
  DARK.uEye.value.set(0, 0, 0, on === 2 ? LIGHT.lamp.r : on === 3 ? LIGHT.torch.r * flicker(clock, 0, 0) : on === 1 ? LIGHT.flash.spill : car ? LIGHT.headSpill : 0);
  DARK.uCone.value.set(fwd.x, fwd.y, fwd.z, on === 1 ? LIGHT.flash.range : car ? LIGHT.head : 0);
  // the lamps nearest the camera
  const all: Lamp[] = [...place.lamps];
  if (dark > 0) { for (const f of providers) f(all); if (!place.under) townLanterns(all); }
  const p = camera.position, near = dark > 0 ? nearestLamps(all, p.x, p.y, p.z) : [];
  // (0.204) every light shows from afar as a point, though it lights only its small reach
  const show = place.under ? 1 : Math.max(0, Math.min(1, (dark - 0.2) / 0.4));
  if (show > 0) {
    const gl: Glow[] = all.map((l) => ({ x: l.x, y: l.y, z: l.z, c: GLOW_C[l.k ?? ''] ?? 0xfff0c8, s: 0.06, a: 1 }));
    for (const f of glowers) f(gl);
    drawGlows(gl, show);
  } else hideGlows();
  for (let i = 0; i < LAMP_SLOTS; i++) { const l = near[i]; if (l) DARK.uLamps.value[i].set(l.x - p.x, l.y - p.y, l.z - p.z, flickers(l.k) ? l.r * flicker(clock, l.x, l.z) : l.r); else DARK.uLamps.value[i].set(0, 0, 0, 0); }
  // a word when it is too dark to see and you carry nothing to light it (once a place, or once a night)
  sum += dt;
  if (sum > 1) {
    sum = 0;
    const black = dark > 0.6 && amb < 0.1 && !on && !car && !near.some((l) => Math.hypot(l.x - p.x, l.z - p.z) < l.r);
    if (black && !told && G.playing) { told = true; logLine(carriesLight() ? tl('It is pitch dark here. Press L to light your way.') : tl('It is pitch dark here. Without a flashlight, a lamp or a torch you will not find your way.')); }
    if (!place.under && dark < 0.2) told = false;
  }
  showLight(dark, on as LightKind);
  if (dark > 0) animateFlames(clock);
}

// the HUD line under the bars: what burns and how long it lasts, shown once it is dark or while a light is on
let box: HTMLDivElement | null = null, last = '';
function showLight(dark: number, on: LightKind) {
  const s = st(), want = G.playing && !document.body.classList.contains('intro') && (on > 0 || dark > 0.5 && carriesLight());
  if (!box) { if (!want) return; box = document.createElement('div'); box.id = 'lightbar'; document.body.appendChild(box); }
  box.style.display = want ? 'block' : 'none';
  if (!want) return;
  const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
  const spare = (k: 'battery' | 'lampoil' | 'firebrand') => G.char.inv.reduce((a, x) => a + (x && x.k === k ? x.n : 0), 0) + (k === 'firebrand' && offHeld()?.k === k ? offHeld()!.n - 1 : 0); // the rest of the bunch in your hand
  const t = on === 1 ? mountedFlashlight(G.char.hands[0]) ? TL`WEAPON LIGHT ${hm(s.flash)} · batteries ${spare('battery')}` : TL`FLASHLIGHT ${hm(s.flash)} · batteries ${spare('battery')}` : on === 2 ? TL`OIL LAMP ${hm(s.oil)} · oil ${spare('lampoil')}` : on === 3 ? TL`TORCH ${hm(s.torch)} · torches ${spare('firebrand')}` : tl('DARK · L: light');
  if (t !== last) { box.textContent = t; last = t; }
  box.className = on === 1 && s.flash < 20 || on === 2 && s.oil < 30 || on === 3 && s.torch < 8 && !spare('firebrand') ? 'low' : on ? '' : 'off';
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
const seg = (m: THREE.Material, pts: number[][]) => new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(([a, b, c]) => new THREE.Vector3(a, b, c))), m);
/** (0.200) An old electric fixture: a caged bulb under a shade on a short rod, cold white (`color`). */
export function fixtureModel(x: number, y: number, z: number, up = 0.6, color = 0xdff2ff, n?: [number, number]): THREE.Group {
  const g = new THREE.Group(), m = add(color); m.fog = false;
  const shade = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.12, 0.42, 0.22, 8, 1, true)), m); shade.position.y = 0.14;
  const bulb = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.IcosahedronGeometry(0.11, 0)), m);
  const cage: number[][] = [];
  for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, c = Math.cos(a) * 0.2, s2 = Math.sin(a) * 0.2; cage.push([c, 0.03, s2], [c * 0.4, -0.2, s2 * 0.4]); }
  const support = n ? [[0, .25, 0], [-n[0] * .25, .25, -n[1] * .25], [-n[0] * .25, .05, -n[1] * .25], [-n[0] * .25, .45, -n[1] * .25]] : [[0, .25, 0], [0, .25 + up, 0]];
  g.add(shade, bulb, seg(m, [...cage, ...support])); g.position.set(x, y, z);
  return g;
}
/** (0.200) A torch in an iron bracket on a wall, leaning out along `n` (into the room); its flame flickers (`flames`). */
export function torchModel(x: number, y: number, z: number, n: [number, number] = [0, 1]): THREE.Group {
  const g = new THREE.Group(), iron = add(0x9a8a6a);
  const [nx, nz] = n;
  g.add(seg(iron, [[-nx * 0.2, -0.35, -nz * 0.2], [nx * 0.05, -0.05, nz * 0.05], [-nx * 0.2, -0.1, -nz * 0.2], [nx * 0.05, -0.05, nz * 0.05], [-nx * 0.05, -0.55, -nz * 0.05], [nx * 0.18, 0.12, nz * 0.18]]));
  const flame = new VectorFlame(.4, x * 1.7 + z * 2.3);
  flame.position.set(nx * 0.2, .13, nz * 0.2); flames.set(flame, 0);
  g.add(flame); g.position.set(x, y, z);
  return g;
}
/** (0.200) A town's oil lantern on a post with an arm (village-local x, z on the ground `y0`). */
export function postLantern(x: number, y0: number, z: number): THREE.Group {
  const g = new THREE.Group(), wood = add(0x8a6a3a);
  g.add(seg(wood, [[0, 0, 0], [0, 2.7, 0], [0, 2.5, 0], [0.55, 2.7, 0], [0.55, 2.7, 0], [0.55, 2.55, 0], [0, 2.2, 0], [0.3, 2.62, 0]]));
  const l = lanternModel(0.55, 2.3, 0, 0.05, 0xffc070); g.add(l); l.name = 'oillantern'; lanterns.set(l, 0);
  g.position.set(x, y0, z);
  return g;
}
/** The towns' oil lanterns drawn now: each lights `LIGHT.lantern` m round it at night (forgotten once off the scene). */
const lanterns = new Map<THREE.Object3D, number>(), wp = new THREE.Vector3();
function townLanterns(out: Lamp[]) {
  for (const [l, miss] of lanterns) {
    let o: THREE.Object3D = l; while (o.parent) o = o.parent;
    if (!(o as THREE.Scene).isScene) { if (miss > 300) lanterns.delete(l); else lanterns.set(l, miss + 1); continue; }
    if (miss) lanterns.set(l, 0);
    l.getWorldPosition(wp); out.push({ x: wp.x, y: wp.y, z: wp.z, r: LIGHT.lantern, k: 'oil' });
  }
}
/** The flames drawn now (torches): flickered by `animateFlames`, forgotten once off the scene. */
const flames = new Map<VectorFlame, number>();
export function animateFlames(t: number) {
  for (const [f, miss] of flames) {
    let o: THREE.Object3D = f; while (o.parent) o = o.parent;
    if (!(o as THREE.Scene).isScene) { if (miss > 300) flames.delete(f); else flames.set(f, miss + 1); continue; }
    if (miss) flames.set(f, 0);
    f.animate(t);
  }
}
