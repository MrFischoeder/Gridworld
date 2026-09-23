// Night sky above open-air places: stars, a wireframe moon, and a ring of distant mountains.
import * as THREE from 'three';
import { scene, lineMat, fillMat, V } from './render';
import { rng, hash } from '../core/rng';

const noFog = (m: THREE.Material) => { (m as THREE.MeshBasicMaterial).fog = false; return m; };

export const sky = (() => {
  const p: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.3, r = 170;
    p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const grp = new THREE.Group();
  grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfffd0, size: 1.6, sizeAttenuation: false, fog: false })));
  // The moon: a solid dark sphere with meridians and parallels, just inside the star sphere so it hides stars behind it.
  const R = 8, moon = new THREE.Group(), pts: THREE.Vector3[] = [];
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
  moon.add(new THREE.Mesh(new THREE.SphereGeometry(R * 0.99, 16, 12), noFog(fillMat(0x000000))));
  moon.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), lineMat(0x9dffb4, { fog: false })));
  moon.position.set(84, 95, -126).multiplyScalar(160 / 179); moon.rotation.set(0.4, 0.3, 0.2);
  grp.add(moon);
  grp.visible = false; scene.add(grp); return grp;
})();

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
