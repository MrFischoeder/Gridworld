// Sky above open-air places: stars, a wireframe moon and sun moving with the game clock, and a ring of distant mountains.
import * as THREE from 'three';
import { scene, fog, lineMat, fillMat, V } from './render';
import { sunAngle, daylight, twilight } from '../core/time';
import { rng, hash } from '../core/rng';

const noFog = (m: THREE.Material) => { (m as THREE.MeshBasicMaterial).fog = false; return m; };

const starMat = new THREE.PointsMaterial({ color: 0xbfffd0, size: 1.6, sizeAttenuation: false, fog: false, transparent: true });
/** Sun and moon travel on this circle (inside the star sphere, behind both mountain rings). */
const ORBIT = 166, TILT = 0.45;
const moon = new THREE.Group(), sun = new THREE.Group(), Z = new THREE.Vector3(0, 0, 1);

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
  grp.add(moon, sun);
  grp.visible = false; scene.add(grp); return grp;
})();

/** Point on the sky circle: east (+x) at angle 0, overhead at PI/2, west at PI; the path leans south (+z). */
function onOrbit(o: THREE.Object3D, a: number) {
  o.position.set(Math.cos(a) * ORBIT, Math.sin(a) * Math.cos(TILT) * ORBIT, Math.sin(a) * Math.sin(TILT) * ORBIT);
  o.visible = o.position.y > -12;
}
const NIGHT = new THREE.Color(0x000000), DAY_SKY = new THREE.Color(0x061c0d), DUSK = new THREE.Color(0x2a1406), tmp = new THREE.Color();
/**
 * Move the sun and the moon for game time t (core/time), fade the stars, and colour the sky: black at night,
 * a dark green by day, an amber glow at dawn and dusk. The fog takes the sky colour so the land fades into it.
 */
export function updateSky(t: number) {
  const a = sunAngle(t), day = daylight(t), glow = twilight(t);
  onOrbit(sun, a); onOrbit(moon, a + Math.PI);
  sun.quaternion.setFromUnitVectors(Z, sun.position.clone().negate().normalize()); // face the viewer
  starMat.opacity = Math.max(0, 1 - day * 1.4);
  sky.children[0].visible = starMat.opacity > 0.01;
  tmp.copy(NIGHT).lerp(DAY_SKY, day).lerp(DUSK, glow * 0.55);
  (scene.background as THREE.Color).copy(tmp); fog.color.copy(tmp);
  fog.near = 14 + 6 * day; fog.far = 112 + 28 * day;
}
/** Underground: always black. */
export function darkSky() { (scene.background as THREE.Color).set(0x000000); fog.color.set(0x000000); }

/**
 * Distant mountains: two jagged rings that travel with the player, so they always sit on the horizon.
 * Their shape comes from the world seed. Dark fill hides the stars behind them; lines are dimmed by distance.
 */
export const horizon = new THREE.Group();
horizon.visible = false; scene.add(horizon);
let horizonWorld = -1;
export function buildHorizon(world: number) {
  if (horizonWorld === world) return;
  horizonWorld = world;
  horizon.traverse((o) => (o as THREE.Mesh).geometry?.dispose());
  horizon.clear();
  const R = rng(hash(world, 0x4a1b));
  const ring = (radius: number, hMin: number, hMax: number, n: number, color: number) => {
    const tri: number[] = [], lines: number[] = [], ridge: number[][] = [], base = -6;
    for (let i = 0; i < n; i++) {
      const a = i / n * 6.283, peak = i % 2 === 0, h = peak ? hMin + R() * (hMax - hMin) : hMin * (0.3 + R() * 0.4);
      ridge.push([Math.cos(a) * radius, h, Math.sin(a) * radius]);
    }
    for (let i = 0; i < n; i++) {
      const p = ridge[i], q = ridge[(i + 1) % n], pb = [p[0], base, p[2]], qb = [q[0], base, q[2]];
      tri.push(...pb, ...qb, ...q, ...pb, ...q, ...p);
      lines.push(...p, ...q);
      // facets: from every peak down to the valley on either side, stopping halfway down
      if (i % 2 === 0) {
        for (const o of [-1, 1]) {
          const v = ridge[(i + o + n) % n], m = [(p[0] + v[0]) / 2 * 1.01, v[1] * 0.4, (p[2] + v[2]) / 2 * 1.01];
          lines.push(...p, ...m);
        }
      }
    }
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(tri, 3));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(lines, 3));
    horizon.add(new THREE.Mesh(fg, noFog(fillMat(0x000000))), new THREE.LineSegments(lg, lineMat(color, { fog: false })));
  };
  ring(162, 26, 48, 48, 0x1a8a3c); // far range, dimmer
  ring(150, 12, 26, 64, 0x26b050); // nearer foothills
}
