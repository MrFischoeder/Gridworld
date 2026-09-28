// The opening, drawn in the game's own lines: the hero's survey ship cruising between the stars, a meteor stream out of
// nowhere, the hit that tears off a wing, the tumble into an uncharted planet's gravity, the burning fall through its
// air, the crash, and waking up in the wreck (world/crashpod.ts). A scene of its own, rendered instead of the world
// while it runs (main.ts); Space, Enter, a click or Esc skip it. Played once per character (`char.intro`).
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from '../world/props';
import { drawLander, HULL_C, ENGINE_C, SHIP_NAME } from '../world/lander';
import { GRID, fillMat, lineMat, add } from '../world/render';

const LEN = 24.5;
/** When each part begins (s). */
const T = { alert: 4.6, hit: 9.2, fall: 10.2, entry: 15, crash: 19.4, wake: 22.6 };

let on = false, t = 0, done: (() => void) | null = null;
let root: HTMLDivElement, cap: HTMLDivElement, sub: HTMLDivElement, flash: HTMLDivElement, hint: HTMLDivElement, alt: HTMLDivElement;
const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(60, 1, 0.1, 3000);
let ship: THREE.Group, broken: THREE.Group, wing: THREE.Group, plumes: THREE.LineSegments, stars: THREE.LineSegments, planet: THREE.Group, ground: THREE.Group, plasma: THREE.LineSegments;
let starPos: Float32Array, plumePos: Float32Array, plasmaPos: Float32Array;
const rocks: { g: THREE.Group; v: THREE.Vector3; spin: THREE.Vector3; live: boolean }[] = [];
const wingV = new THREE.Vector3(), wingSpin = new THREE.Vector3();
let spawnT = 0, lastCap = '';

const shipBatch = (brokenShip: boolean) => { const pb = new PropBatch(); drawLander(pb, { broken: brokenShip, landed: false }); return pb.build(); };

function build() {
  ship = new THREE.Group(); ship.add(shipBatch(false));
  broken = new THREE.Group(); broken.add(shipBatch(true)); broken.visible = false;
  // the wing that the meteor tears off (the part of the starboard wing past the snap)
  { const pb = new PropBatch(), a = [3.4, 0.95, -6.2], b = [7.6, 0.85, -7.2], c = [7.6, 0.85, -5.6], d = [3.4, 0.95, -3.3];
    const lo = (p: number[]) => [p[0], p[1] - 0.2, p[2]];
    pb.face(a, b, c, d); pb.face(lo(a), lo(b), lo(c), lo(d));
    for (const [p, q] of [[a, b], [b, c], [c, d], [d, a]]) { pb.seg(HULL_C, p, q); pb.seg(HULL_C, lo(p), lo(q)); pb.face(p, q, lo(q), lo(p)); }
    wing = pb.build(); wing.visible = false; }
  // engine plumes: flickering lines out of both bells
  plumePos = new Float32Array(2 * 12 * 6);
  plumes = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(plumePos, 3)), add(ENGINE_C));
  ship.add(plumes);
  const holder = new THREE.Group(); holder.add(ship, broken); holder.name = 'holder'; scene.add(holder, wing);
  // stars: short streaks flowing past
  const N = 700; starPos = new Float32Array(N * 6);
  for (let i = 0; i < N; i++) { const p = starSpot(); starPos.set([p.x, p.y, p.z, p.x, p.y, p.z - 1], i * 6); }
  stars = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPos, 3)), lineMat(0xcfffe0, { transparent: true, opacity: 0.8 }));
  stars.frustumCulled = false; scene.add(stars);
  // meteors: amber faceted rocks with dark fills
  for (let i = 0; i < 34; i++) {
    const s = 0.8 + Math.random() * 2.6, geo = new THREE.IcosahedronGeometry(s, 0), pos = geo.getAttribute('position') as THREE.BufferAttribute;
    for (let k = 0; k < pos.count; k++) pos.setXYZ(k, pos.getX(k) * (0.8 + Math.random() * 0.4), pos.getY(k) * (0.7 + Math.random() * 0.4), pos.getZ(k) * (0.8 + Math.random() * 0.4));
    const g = new THREE.Group(); g.add(new THREE.Mesh(geo, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(geo), lineMat(0xffb347)));
    g.visible = false; scene.add(g); rocks.push({ g, v: new THREE.Vector3(), spin: new THREE.Vector3(), live: false });
  }
  // the planet: a globe of lines with a dark fill and a thin ring of air
  planet = new THREE.Group();
  const R = 100;
  planet.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.995, 32, 20), fillMat()));
  const glob: number[] = [];
  for (let la = -75; la <= 75; la += 15) { const y = Math.sin(la * Math.PI / 180) * R, r = Math.cos(la * Math.PI / 180) * R; for (let k = 0; k < 48; k++) { const a0 = k / 48 * 6.283, a1 = (k + 1) / 48 * 6.283; glob.push(Math.cos(a0) * r, y, Math.sin(a0) * r, Math.cos(a1) * r, y, Math.sin(a1) * r); } }
  for (let lo = 0; lo < 180; lo += 15) { const c = Math.cos(lo * Math.PI / 180), s = Math.sin(lo * Math.PI / 180); for (let k = 0; k < 48; k++) { const a0 = k / 48 * 6.283, a1 = (k + 1) / 48 * 6.283; glob.push(Math.cos(a0) * R * c, Math.sin(a0) * R, Math.cos(a0) * R * s, Math.cos(a1) * R * c, Math.sin(a1) * R, Math.cos(a1) * R * s); } }
  planet.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(glob, 3)), lineMat(GRID)));
  const halo = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(Array.from({ length: 96 }, (_, k) => new THREE.Vector3(Math.cos(k / 96 * 6.283) * R * 1.06, Math.sin(k / 96 * 6.283) * R * 1.06, 0))), add(0x9dffe0));
  halo.name = 'halo'; planet.add(halo);
  planet.rotation.z = 0.35; planet.visible = false; scene.add(planet);
  // the ground rushing up during the fall: a wide grid of lines, hills as a rough ring
  ground = new THREE.Group();
  const gl: number[] = [], S = 1600, step = 40;
  for (let x = -S; x <= S; x += step) gl.push(x, 0, -S, x, 0, S, -S, 0, x, S, 0, x);
  ground.add(new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(gl, 3)), lineMat(GRID)));
  ground.visible = false; scene.add(ground);
  // plasma streaks round the falling ship
  plasmaPos = new Float32Array(80 * 6);
  plasma = new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(plasmaPos, 3)), add(0xff9a4a));
  plasma.frustumCulled = false; plasma.visible = false; scene.add(plasma);
}
function starSpot() { const a = Math.random() * 6.283, r = 6 + Math.random() * 90; return new THREE.Vector3(Math.cos(a) * r, Math.sin(a) * r, -60 + Math.random() * 260); }

function dom() {
  root = document.createElement('div'); root.id = 'intro';
  root.innerHTML = '<div class="flash"></div><div class="alt"></div><div class="cap"></div><div class="sub"></div><div class="hint">Space / click — skip</div>';
  document.body.appendChild(root);
  [flash, alt, cap, sub, hint] = ['.flash', '.alt', '.cap', '.sub', '.hint'].map((s) => root.querySelector(s) as HTMLDivElement);
  root.addEventListener('pointerdown', () => skip());
}
/** Captions typed out a letter at a time; `red` for alarms. */
function say(text: string, since: number, small = '', red = false) {
  const n = Math.max(0, Math.floor((t - since) * 38));
  const s = text.slice(0, n);
  if (s + small !== lastCap) { lastCap = s + small; cap.textContent = s; sub.textContent = n >= text.length ? small : ''; }
  cap.classList.toggle('red', red);
}
const keys = (e: KeyboardEvent) => {
  if (!on) return;
  if (e.code === 'Space' || e.code === 'Enter' || e.code === 'Escape') { e.preventDefault(); e.stopImmediatePropagation(); if (t > 0.6) skip(); }
  else if (e.code !== 'Backquote') e.stopImmediatePropagation();
};

/** Plays the opening, then calls `end` (the game starts). */
export function playIntro(end: () => void) {
  if (!root) { build(); dom(); addEventListener('keydown', keys, true); }
  on = true; G.intro = true; t = 0; done = end; lastCap = ''; spawnT = 0;
  ship.visible = true; broken.visible = false; wing.visible = false; planet.visible = false; ground.visible = false; plasma.visible = false; stars.visible = true;
  for (const r of rocks) { r.live = false; r.g.visible = false; }
  const h = scene.getObjectByName('holder')!; h.position.set(0, 0, 0); h.rotation.set(0, 0, 0);
  scene.fog = null;
  root.style.display = 'block'; root.style.background = 'transparent'; root.style.opacity = '1'; document.body.classList.add('intro');
}
export const introOn = () => on;
function skip() { if (on) t = Math.max(t, T.wake + 1.2); }
function finish() {
  on = false; G.intro = false; root.style.display = 'none'; document.body.classList.remove('intro');
  const f = done; done = null; f?.();
}

const V = new THREE.Vector3();
/** One frame of the opening: moves everything and renders it. True once the screen is black and the world may be drawn behind it. */
export function renderIntro(renderer: THREE.WebGLRenderer, dt: number): boolean {
  t += dt;
  const holder = scene.getObjectByName('holder')!;
  const w = renderer.domElement.clientWidth || innerWidth, h = renderer.domElement.clientHeight || innerHeight;
  if (Math.abs(cam.aspect - w / h) > 1e-3) { cam.aspect = w / h; cam.updateProjectionMatrix(); }
  const hit = t >= T.hit, space = t < T.entry;
  ship.visible = !hit; broken.visible = hit;
  // ---- the stars stream past (faster in the fall's first moments)
  const speed = t < T.fall ? 70 : 40;
  if (space) {
    for (let i = 0; i < starPos.length; i += 6) {
      let z = starPos[i + 2] - speed * dt;
      if (z < -60) { const p = starSpot(); starPos[i] = starPos[i + 3] = p.x; starPos[i + 1] = starPos[i + 4] = p.y; z = 200; }
      starPos[i + 2] = z; starPos[i + 5] = z - speed * 0.03;
    }
    stars.geometry.attributes.position.needsUpdate = true;
  }
  stars.visible = space;
  // ---- the engines: both burn until the hit, then only the port one, sputtering
  let n = 0;
  for (const s of [1, -1]) for (let k = 0; k < 12; k++) {
    const lit = !hit || (s === -1 && Math.random() > 0.3), a = k / 12 * 6.283, r = 0.55 * Math.random();
    const x = 1.5 * s + Math.cos(a) * r, y = 2.5 + Math.sin(a) * r, z0 = -10.5, len = lit ? 2 + Math.random() * (t < T.alert ? 4 : 6) : 0;
    plumePos.set([x, y, z0, x * 0.98, y, z0 - len], n); n += 6;
  }
  plumes.geometry.attributes.position.needsUpdate = true;
  (hit ? broken : ship).add(plumes);
  // ---- meteors: a few at first, a storm after the alert
  if (t > T.alert - 1.2 && t < T.fall + 2) {
    spawnT -= dt;
    if (spawnT <= 0) {
      spawnT = t < T.alert ? 0.5 : 0.09;
      const r = rocks.find((q) => !q.live);
      if (r) {
        r.live = true; r.g.visible = true;
        const a = Math.random() * 6.283, d = 5 + Math.random() * (t < T.alert ? 40 : 28);
        r.g.position.set(Math.cos(a) * d, Math.sin(a) * d * 0.7, 240);
        r.v.set((Math.random() - 0.5) * 6, (Math.random() - 0.5) * 6, -(90 + Math.random() * 70));
        r.spin.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
      }
    }
  }
  for (const r of rocks) if (r.live) {
    r.g.position.addScaledVector(r.v, dt); r.g.rotation.x += r.spin.x * dt; r.g.rotation.y += r.spin.y * dt;
    if (r.g.position.z < -80 || !space) { r.live = false; r.g.visible = false; }
  }
  // ---- the hit: a big one comes for the starboard wing
  if (t >= T.hit - 0.9 && t < T.hit) {
    const k = rocks[0]; k.live = true; k.g.visible = true; k.g.scale.setScalar(1.6);
    const f = (T.hit - t) / 0.9; k.g.position.set(5.5 + f * 4, 1 + f * 3, -4 + f * 120); k.v.set(0, 0, 0);
  } else rocks[0].g.scale.setScalar(1);
  if (hit && !wing.visible && t < T.hit + 0.1) { wing.visible = true; wing.position.set(0, 0, 0); wing.rotation.set(0, 0, 0); wingV.set(9, 5, -30); wingSpin.set(3, 5, 2); rocks[0].live = false; rocks[0].g.visible = false; }
  if (wing.visible) { wing.position.addScaledVector(wingV, dt); wing.rotation.x += wingSpin.x * dt; wing.rotation.y += wingSpin.y * dt; wing.rotation.z += wingSpin.z * dt; if (t > T.entry) wing.visible = false; }
  // ---- the ship's motion and the camera
  let shake = 0;
  if (t < T.alert) {
    holder.rotation.set(0, 0, Math.sin(t * 0.6) * 0.05);
    const a = 2.3 - t * 0.28; // swing round from the front-quarter to behind
    cam.position.set(Math.sin(a) * 17, 3.5 + t * 0.2, Math.cos(a) * 17); cam.lookAt(0, 1.6, 0);
  } else if (t < T.hit) {
    const k = t - T.alert; // evasive rolls
    holder.rotation.set(Math.sin(k * 1.7) * 0.08, Math.sin(k * 1.1) * 0.12, Math.sin(k * 2.2) * 0.5);
    holder.position.set(Math.sin(k * 1.3) * 1.5, Math.sin(k * 0.9) * 1, 0);
    cam.position.set(7, 5, -25); cam.lookAt(0, 1.5, 14); shake = 0.08 + k * 0.03;
  } else if (t < T.entry) {
    const k = t - T.hit; // tumbling towards the planet
    holder.rotation.set(k * 0.9, k * 0.45, k * 1.6);
    holder.position.set(0, 0, 0);
    const back = 20 + k * 3; cam.position.set(6, 5 + k * 0.4, -back); cam.lookAt(0, 0, 10); shake = Math.max(0, 0.6 - k * 0.25);
  }
  planet.visible = t >= T.hit + 0.4 && space;
  if (planet.visible) {
    const k = (t - T.hit - 0.4) / (T.entry - T.hit - 0.4); // 0..1: it fills the view
    planet.position.set(-20 + k * 10, -60 + k * 30, 900 - k * 760);
    planet.rotation.y += dt * 0.05;
  }
  // ---- the fall through the air: nose down, burning, the ground rushing up
  const falling = t >= T.entry && t < T.crash;
  ground.visible = falling; plasma.visible = falling;
  if (falling) {
    const k = (t - T.entry) / (T.crash - T.entry);
    if (!scene.fog) scene.fog = new THREE.Fog(0x000000, 60, 900);
    holder.position.set(0, 0, 0);
    holder.rotation.set(Math.PI / 2 - 0.25 + Math.sin(t * 3) * 0.08, Math.sin(t * 1.3) * 0.2, t * 0.8);
    ground.position.y = -(1400 * Math.pow(1 - k, 1.6) + 12);
    cam.position.set(9, 16, -9); cam.lookAt(0, -12, 0); shake = 0.35 + k * 0.9;
    for (let i = 0; i < plasmaPos.length; i += 6) {
      const a = Math.random() * 6.283, r = 2.8 + Math.random() * 3, y = -10 + Math.random() * 14;
      plasmaPos.set([Math.cos(a) * r, y, Math.sin(a) * r, Math.cos(a) * r * 1.15, y + 4 + Math.random() * 9, Math.sin(a) * r * 1.15], i);
    }
    plasma.geometry.attributes.position.needsUpdate = true;
    alt.textContent = `ALT ${Math.max(0, Math.round((1 - k) * 12400)).toLocaleString('en')} m`;
  } else alt.textContent = '';
  if (shake) cam.position.add(V.set((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake));
  // ---- captions and the flashes
  const who = (G.char.name || 'Pilot').toUpperCase();
  if (t < 2.3) say(`${SHIP_NAME.toUpperCase()} · DEEP SURVEY`, 0.4, 'Day 214 · the outer belt of an uncharted system');
  else if (t < T.alert) say(`PILOT: ${who}`, 2.3, 'All systems nominal');
  else if (t < T.hit) say('PROXIMITY ALERT', T.alert, 'Meteor stream, not on any chart · evasive manoeuvres', Math.floor(t * 3) % 2 === 0);
  else if (t < T.fall + 1.5) say('HULL BREACH', T.hit, 'Starboard wing lost · main drive offline', true);
  else if (t < T.entry) say('CAPTURED BY GRAVITY', T.fall + 1.5, 'Uncharted planet · no control of the descent', true);
  else if (t < T.crash) say('ATMOSPHERIC ENTRY', T.entry, 'Brace · brace · brace', Math.floor(t * 4) % 2 === 0);
  else if (t < T.wake) say('SYSTEMS OFFLINE', T.crash + 0.8, '');
  else say(`${who}. WAKE UP.`, T.wake, 'The ship is gone. You are not.');
  let fl = 0;
  if (t >= T.hit && t < T.hit + 0.6) fl = 1 - (t - T.hit) / 0.6;
  if (t >= T.crash) fl = t < T.crash + 0.25 ? 1 : 0;
  flash.style.opacity = String(fl);
  // after the crash: black, then the world fades in
  const black = t >= T.crash + 0.25;
  root.style.background = black ? '#000' : 'transparent';
  if (t > LEN - 1.4) root.style.opacity = String(Math.max(0, (LEN - t) / 1.4));
  hint.style.opacity = t > 1 && t < T.wake ? '0.6' : '0';
  if (!black) renderer.render(scene, cam);
  if (t >= LEN) finish();
  return black;
}
// screenshots of the opening in development: jump to a moment
if (import.meta.env.DEV) Object.assign(window, { __introJump: (s: number) => { if (on) t = s; } });
