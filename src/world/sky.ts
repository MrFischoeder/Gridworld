// Sky above open-air places: stars, a wireframe moon and sun moving with the game clock, and a ring of distant mountains.
import * as THREE from 'three';
import { scene, fog, lineMat, fillMat, V } from './render';
import { sunAngle, daylight, twilight, sunTilt, stationDir, stationAngle } from '../core/time';
import { rng, hash } from '../core/rng';
import { G } from '../game';
import { seen as weather } from './weather';
import { seaMask } from '../gen/seas';

const noFog = (m: THREE.Material) => { (m as THREE.MeshBasicMaterial).fog = false; return m; };

const starMat = new THREE.PointsMaterial({ color: 0xbfffd0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true });
/** Sun and moon travel on this circle (inside the star sphere, behind both mountain rings). */
const ORBIT = 166;
const moon = new THREE.Group(), sun = new THREE.Group(), Z = new THREE.Vector3(0, 0, 1), EYE = new THREE.Vector3(0, 20, 0);

// The sky dome: a gradient from the horizon up to the zenith, with a glow round the sun; drawn at the far plane so
// everything else stands in front of it. Its colours follow the time of day (updateSky).
const domeMat = new THREE.ShaderMaterial({
  uniforms: { zenith: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, glow: { value: new THREE.Color() }, sunDir: { value: new THREE.Vector3(0, 1, 0) }, glowK: { value: 0 } },
  vertexShader: `varying vec3 vDir;
    void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p; gl_Position.z = p.w * 0.99999; }`,
  fragmentShader: `uniform vec3 zenith; uniform vec3 horizon; uniform vec3 glow; uniform vec3 sunDir; uniform float glowK; varying vec3 vDir;
    void main() {
      float h = clamp(vDir.y, -0.2, 1.0);
      vec3 c = mix(horizon, zenith, smoothstep(-0.02, 0.55, h));
      float s = max(dot(normalize(vDir), sunDir), 0.0);
      c += glow * glowK * (pow(s, 6.0) * 0.8 + pow(s, 60.0) * 0.6) * smoothstep(-0.25, 0.1, h);
      gl_FragColor = vec4(c, 1.0);
    }`,
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false,
});
const dome = new THREE.Mesh(new THREE.SphereGeometry(120, 32, 16), domeMat);
dome.renderOrder = -10; dome.frustumCulled = false;
// The orbital station: two coaxial wheels on one axle with spokes, like the wheel stations of old films; a dark fill hides
// the stars behind it, green lines draw it. It spins slowly and crosses the sky far quicker than the sun and the moon.
const STATION_R = 10, STATION_AT = 158, SS = STATION_R / 4.2; // (0.265.1) bigger: about 7 degrees across, well over the sun's disc
const station = (() => {
  const g = new THREE.Group(), wheels = new THREE.Group(), line = lineMat(0xe8fff0, { fog: false }), fill = noFog(fillMat(0x000000));
  const ring = (z: number) => {
    const t = new THREE.TorusGeometry(STATION_R, 0.42 * SS * 1.3, 8, 48);
    const m = new THREE.Mesh(t, fill), l = new THREE.LineSegments(new THREE.WireframeGeometry(t), line);
    m.position.z = l.position.z = z; wheels.add(m, l);
  };
  ring(-1.5 * SS); ring(1.5 * SS);
  const sp: THREE.Vector3[] = [];
  for (const z of [-1.5 * SS, 1.5 * SS]) for (let i = 0; i < 6; i++) { const a = i / 6 * 6.283; sp.push(V(0, 0, z), V(Math.cos(a) * STATION_R, Math.sin(a) * STATION_R, z)); }
  wheels.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), line));
  const hub = new THREE.CylinderGeometry(0.9 * SS, 0.9 * SS, 5.6 * SS, 12); hub.rotateX(Math.PI / 2);
  wheels.add(new THREE.Mesh(hub, fill), new THREE.LineSegments(new THREE.WireframeGeometry(hub), line));
  wheels.userData.spin = true; g.add(wheels); g.userData.wheels = wheels; g.visible = false; g.renderOrder = 1;
  return g;
})();
let sunDisc: THREE.MeshBasicMaterial, moonFill: THREE.Mesh;

export const sky = (() => {
  const p: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.3, r = 170;
    p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const grp = new THREE.Group();
  grp.add(new THREE.Points(g, starMat));
  // The moon: a solid dark sphere with meridians and parallels, so it hides the stars behind it.
  const R = 8, pts: THREE.Vector3[] = [], globe = new THREE.Group();
  for (let m = 0; m < 8; m++) {
    const a = m / 8 * Math.PI;
    for (let i = 0; i < 24; i++) {
      const t0 = i / 24 * 6.283, t1 = (i + 1) / 24 * 6.283;
      pts.push(V(Math.cos(t0) * Math.cos(a) * R, Math.sin(t0) * R, Math.cos(t0) * Math.sin(a) * R), V(Math.cos(t1) * Math.cos(a) * R, Math.sin(t1) * R, Math.cos(t1) * Math.sin(a) * R));
    }
  }
  for (let k = -2; k <= 2; k++) {
    const y = k * R / 3, rr = Math.sqrt(R * R - y * y);
    for (let i = 0; i < 24; i++) { const t0 = i / 24 * 6.283, t1 = (i + 1) / 24 * 6.283; pts.push(V(Math.cos(t0) * rr, y, Math.sin(t0) * rr), V(Math.cos(t1) * rr, y, Math.sin(t1) * rr)); }
  }
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.99, 16, 12), noFog(fillMat(0x000000))));
  globe.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x9dffb4, { fog: false })));
  globe.rotation.set(0.4, 0.3, 0.2); moon.add(globe);
  // The sun: a dim disc (it hides what is behind it) with bright rings and rays, always facing the viewer.
  const S = 10, disc = new THREE.Mesh(new THREE.CircleGeometry(S, 32), noFog(fillMat(0x2a2408))), sp: THREE.Vector3[] = [];
  for (const r of [S, S * 0.7, S * 0.4]) for (let i = 0; i < 32; i++) { const a = i / 32 * 6.283, b = (i + 1) / 32 * 6.283; sp.push(V(Math.cos(a) * r, Math.sin(a) * r, 0.1), V(Math.cos(b) * r, Math.sin(b) * r, 0.1)); }
  for (let i = 0; i < 16; i++) { const a = i / 16 * 6.283, l = i % 2 ? 1.35 : 1.7; sp.push(V(Math.cos(a) * S * 1.15, Math.sin(a) * S * 1.15, 0), V(Math.cos(a) * S * l, Math.sin(a) * S * l, 0)); }
  sun.add(disc, new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), lineMat(0xfff0a0, { fog: false })));
  sunDisc = disc.material as THREE.MeshBasicMaterial; moonFill = globe.children[0] as THREE.Mesh;
  grp.add(dome, moon, sun, station);
  // (0.277) the sun, the moon, the stars and the station come before the distant ranges, which are painted over them
  grp.traverse((o) => { if (o !== dome) o.renderOrder = -8; });
  grp.visible = false; scene.add(grp); return grp;
})();

/** Point on the sky circle: east (+x) at angle 0, highest at PI/2, west at PI; the path leans towards the equator. */
function onOrbit(o: THREE.Object3D, a: number, tilt: number) {
  o.position.set(Math.cos(a) * ORBIT, Math.sin(a) * Math.cos(tilt) * ORBIT, Math.sin(a) * Math.sin(tilt) * ORBIT);
  o.visible = o.position.y > -12;
}
// Sky colours: [zenith, horizon] at night, by day, and the amber of dawn and dusk.
const NIGHT_Z = new THREE.Color(0x000000), NIGHT_H = new THREE.Color(0x020a05), DAY_Z = new THREE.Color(0x14603f), DAY_H = new THREE.Color(0x4fae7c);
const DUSK_Z = new THREE.Color(0x10160c), DUSK_H = new THREE.Color(0xa0561a), SUN_GLOW = new THREE.Color(0xfff2b0), DUSK_GLOW = new THREE.Color(0xff9a40);
const OVER_Z = new THREE.Color(), OVER_H = new THREE.Color(), FOG_C = new THREE.Color(), FLASH = new THREE.Color(0xd8fff0);
const tmp = new THREE.Color(), tmpZ = new THREE.Color(), SUN_DIM = new THREE.Color(0x2a2408), SUN_LIT = new THREE.Color(0xfff4c8);
/**
 * Move the sun and the moon for game time t (core/time), fade the stars, and colour the sky: black at night, a bright
 * hazy green by day (lighter towards the horizon, a glow round the sun), amber at dawn and dusk. The fog takes the
 * horizon's colour so the land fades into it; by day it lies further off.
 */
export function updateSky(t: number, lat = 0) {
  const tilt = sunTilt(lat), a = sunAngle(t), day = daylight(t, tilt), glow = twilight(t, tilt);
  onOrbit(sun, a, tilt); onOrbit(moon, a + Math.PI, tilt);
  sun.quaternion.setFromUnitVectors(Z, EYE.clone().sub(sun.position).normalize()); // face the viewer (the sky sits 20 m below the eye)
  const wc = weather.cloud, wf = weather.fog, fl = weather.flash;
  { // the orbital station: seen while above the horizon, hidden by thick cloud
    const d = stationDir(t);
    station.position.set(d[0] * STATION_AT, d[1] * STATION_AT, d[2] * STATION_AT);
    station.rotation.set(1.05, 0.6, 0); // the axle leans, so the wheels show as ellipses and their edge-on view changes along the pass
    (station.userData.wheels as THREE.Group).rotation.z = stationAngle(t) * 9;
    station.visible = d[1] > -0.06 && wc < 0.85;
  }
  starMat.opacity = Math.max(0, 1 - day * 1.6) * (1 - wc * 0.95);
  sky.children[0].visible = starMat.opacity > 0.01;
  tmpZ.copy(NIGHT_Z).lerp(DAY_Z, day).lerp(DUSK_Z, glow * 0.5);
  tmp.copy(NIGHT_H).lerp(DAY_H, day).lerp(DUSK_H, glow * 0.7);
  // the weather: clouds grey and darken the sky, fog pales it, lightning lights it up
  OVER_Z.setRGB(0.1, 0.16, 0.13).multiplyScalar(0.25 + 0.75 * day); OVER_H.setRGB(0.24, 0.32, 0.27).multiplyScalar(0.2 + 0.8 * day);
  FOG_C.setRGB(0.36, 0.44, 0.39).multiplyScalar(0.12 + 0.88 * day);
  tmpZ.lerp(OVER_Z, wc * 0.85); tmp.lerp(OVER_H, wc * 0.75).lerp(FOG_C, wf * 0.85);
  tmpZ.lerp(FLASH, fl * 0.8); tmp.lerp(FLASH, fl * 0.7);
  const u = domeMat.uniforms;
  (u.zenith.value as THREE.Color).copy(tmpZ); (u.horizon.value as THREE.Color).copy(tmp);
  (u.glow.value as THREE.Color).copy(SUN_GLOW).lerp(DUSK_GLOW, glow);
  (u.sunDir.value as THREE.Vector3).copy(sun.position).normalize();
  u.glowK.value = Math.min(1, day * 0.6 + glow * 0.9) * (sun.position.y > -30 ? 1 : 0) * (1 - wc * 0.85);
  (scene.background as THREE.Color).copy(tmp); fog.color.copy(tmp);
  // the sun's disc brightens by day; the moon's dark globe takes the sky's colour so it does not punch a hole in it
  sunDisc.color.copy(SUN_DIM).lerp(SUN_LIT, day * (1 - wc * 0.7));
  sun.visible &&= wc < 0.92; moon.visible &&= wc < 0.8;
  (moonFill.material as THREE.MeshBasicMaterial).color.copy(tmpZ);
  fog.near = (14 + 12 * day) * (1 - wf * 0.8) * (1 - weather.rain * 0.3); fog.far = (112 + 55 * day) * (1 - wf * 0.62) * (1 - weather.rain * 0.25);
  if (G.fly) { fog.near *= 2.5; fog.far *= 2.6; } // flying (dev): see the land further out
}
/** Something local thickens the air (the toxic fog, world/toxic.ts): the dome goes towards c by k, the stars, sun and moon fade. */
export function tintSky(c: THREE.Color, k: number) {
  const u = domeMat.uniforms;
  (u.zenith.value as THREE.Color).lerp(c, k); (u.horizon.value as THREE.Color).lerp(c, k); u.glowK.value *= 1 - k;
  starMat.opacity *= 1 - k; sun.visible &&= k < 0.6; moon.visible &&= k < 0.6; station.visible &&= k < 0.6;
}
/** Underground: always black. */
export function darkSky() { (scene.background as THREE.Color).set(0x000000); fog.color.set(0x000000); }

/**
 * Distant mountains: two jagged rings that travel with the player, so they always sit on the horizon.
 * Their shape comes from the world seed. (0.277, the owner's report: they stood out unnaturally and in front of the
 * land) They are a backdrop now: drawn right after the sky without the depth test, so every real hill, tree and
 * building covers them; set below the eye wherever you stand (not at the world's height 0); their ridges rise and
 * fall in long irregular swells; and they fade into the haze by distance (`hazeHorizon`).
 */
export const horizon = new THREE.Group();
horizon.visible = false; scene.add(horizon);
let horizonWorld = -1;
interface Ring { radius: number; h: number[]; fill: THREE.BufferGeometry; lines: THREE.BufferGeometry; fm: THREE.MeshBasicMaterial; lm: THREE.LineBasicMaterial; line: THREE.Color; haze: number }
let rings: Ring[] = [], shapedAt: [number, number] | null = null;
const BASE_LAND = -6, BASE_SEA = 0.5;
/** How far below the eye the ranges' ground lies: on land, and out on the water. */
const DROP_LAND = 12, DROP_SEA = 2;
let shapedLow = false;
const backdrop = <T extends THREE.Material>(m: T) => { m.depthTest = false; m.depthWrite = false; (m as unknown as { fog: boolean }).fog = false; return m; };
export function buildHorizon(world: number) {
  if (horizonWorld === world) return;
  horizonWorld = world; shapedAt = null;
  horizon.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  horizon.clear(); rings = [];
  const R = rng(hash(world, 0x4a1b));
  const ring = (radius: number, hMin: number, hMax: number, n: number, color: number, haze: number, order: number) => {
    // long swells (a few ranges round the horizon), peaks and saddles on them, and a little roughness
    const p1 = R() * 6.283, p2 = R() * 6.283, p3 = R() * 6.283, h: number[] = [];
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283, swell = 0.5 + 0.3 * Math.sin(a * 2 + p1) + 0.2 * Math.sin(a * 5 + p2) + 0.1 * Math.sin(a * 11 + p3);
      const peak = (i % 2 === 0 ? 1 : 0.55 + R() * 0.3) * (0.75 + R() * 0.25);
      h.push(hMin + (hMax - hMin) * Math.max(0, Math.min(1, swell)) * peak);
    }
    const fm = backdrop(fillMat(0x000000)), lm = backdrop(lineMat(color));
    const r: Ring = { radius, h, fill: new THREE.BufferGeometry(), lines: new THREE.BufferGeometry(), fm, lm, line: new THREE.Color(color), haze };
    rings.push(r); shapeRing(r, h.map(() => 1));
    const mesh = new THREE.Mesh(r.fill, fm), ls = new THREE.LineSegments(r.lines, lm);
    mesh.renderOrder = order; ls.renderOrder = order + 0.1; mesh.frustumCulled = ls.frustumCulled = false;
    horizon.add(mesh, ls);
  };
  ring(162, 10, 40, 72, 0x1a8a3c, 0.62, -7); // far range, the hazier
  ring(150, 4, 20, 96, 0x26b050, 0.42, -6); // nearer foothills
}
/** (0.277) The ranges take the air's colour: the further, the paler by day (at night the fog is black, so are they). */
export function hazeHorizon() {
  for (const r of rings) { r.fm.color.copy(fog.color).multiplyScalar(r.haze); r.lm.color.copy(r.line).lerp(fog.color, r.haze); }
}
/** Lay out a ring's geometry with each ridge point's height scaled by f (0 = sunk below the horizon). */
function shapeRing(r: Ring, f: number[], BASE = BASE_LAND) {
  const n = r.h.length, tri: number[] = [], lines: number[] = [], ridge: number[][] = [];
  for (let i = 0; i < n; i++) { const a = i / n * 6.283; ridge.push([Math.cos(a) * r.radius, BASE + (r.h[i] - BASE) * f[i], Math.sin(a) * r.radius]); }
  for (let i = 0; i < n; i++) {
    // over the sea (both ends sunk) nothing is drawn: seen from a boat, the sunk fill would stand dark above the water
    if (f[i] + f[(i + 1) % n] < 0.08) continue;
    const p = ridge[i], q = ridge[(i + 1) % n], pb = [p[0], BASE - 30, p[2]], qb = [q[0], BASE - 30, q[2]];
    tri.push(...pb, ...qb, ...q, ...pb, ...q, ...p);
    lines.push(...p, ...q);
    // facets: from every peak down towards the saddle on either side, stopping partway
    if (i % 2 === 0 && f[i] > 0.5) {
      for (const o of [-1, 1]) {
        const v = ridge[(i + o + n) % n], m = [(p[0] + v[0]) / 2, p[1] + (v[1] - p[1]) * 0.5 - (p[1] - BASE) * 0.25, (p[2] + v[2]) / 2];
        lines.push(...p, ...m);
      }
    }
  }
  r.fill.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3)); r.fill.computeBoundingSphere();
  r.lines.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3)); r.lines.computeBoundingSphere();
}
/**
 * Over the sea there are no distant ranges: the rings sink smoothly where the land a few kilometres off is sea
 * (reshaped every 250 m), and they sit below the eye wherever you are (every frame: `cam`).
 */
export function shapeHorizon(cam: { x: number; y: number; z: number }) {
  const x = cam.x, z = cam.z;
  // out on the sea (a boat) the ranges stand on the water's horizon, just under the eye
  const low = seaMask(horizonWorld, x, z) > 0.2;
  horizon.position.set(x, cam.y - (low ? DROP_SEA : DROP_LAND), z);
  if (shapedAt && Math.hypot(x - shapedAt[0], z - shapedAt[1]) < 250 && low === shapedLow) return;
  shapedAt = [x, z]; shapedLow = low;
  for (const r of rings) {
    let f = r.h.map((_, i) => {
      const a = i / r.h.length * 6.283; // ring point (cos a, sin a) lies towards +x/+z in world space
      const ds = [700, 1400, 2200, 3000, 3800];
      return 1 - ds.filter((d) => seaMask(horizonWorld, x + Math.cos(a) * d, z + Math.sin(a) * d) > 0.3).length / ds.length;
    });
    for (let pass = 0; pass < 3; pass++) f = f.map((v, i) => 0.25 * f[(i + f.length - 1) % f.length] + 0.5 * v + 0.25 * f[(i + 1) % f.length]); // no cliffs at the coast
    shapeRing(r, f, low ? BASE_SEA : BASE_LAND);
  }
}
