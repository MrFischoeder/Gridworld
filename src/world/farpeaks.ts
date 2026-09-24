// Far mountains on the horizon: the real mountains (gen/mountains.ts) within a few kilometres, seen as a silhouette.
// The terrain only streams in around the player, so for every direction the highest angle of mountain above the
// eye is found out to FAR metres and drawn on a ring just inside the sky's decorative ranges (a skybox trick: the
// ring travels with the camera). Rebuilt when you have moved far enough.
import * as THREE from 'three';
import { scene, lineMat, fillMat } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { mountainMask } from '../gen/mountains';

const N = 144, NEAR = 150, FAR = 3200, RING = 145;
export const farPeaks = new THREE.Group();
farPeaks.visible = false; scene.add(farPeaks);
let at = { x: NaN, y: NaN, z: NaN, world: -1 };
const noFog = <T extends THREE.Material>(m: T) => { (m as unknown as { fog: boolean }).fog = false; return m; };
const lineGreen = noFog(lineMat(0x3ad866)), lineSnow = noFog(lineMat(0xbfffe8)), fill = noFog(fillMat(0x000000));

function rebuild(x: number, y: number, z: number) {
  const T = OW.terrain!, w = T.world, eye = y + 1.6;
  farPeaks.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); farPeaks.clear();
  // the steepest slope of mountain above the eye in every direction (null: no mountain that way)
  const top: (number | null)[] = [], snow: boolean[] = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let best: number | null = null, hi = 0;
    for (let d = NEAR; d <= FAR; d += 200) {
      if (mountainMask(w, x + dx * d, z + dz * d) <= 0.02 && mountainMask(w, x + dx * (d + 100), z + dz * (d + 100)) <= 0.02) continue;
      for (let e = d; e < d + 200; e += 25) {
        const h = T.base(x + dx * e, z + dz * e), s = (h - eye) / e;
        if (best === null || s > best) { best = s; hi = h; }
      }
    }
    top.push(best !== null && best > 0.01 ? best : null); snow.push(hi > 115); // only what rises above the horizon
  }
  const tri: number[] = [], green: number[] = [], white: number[] = [];
  const pt = (i: number) => { const a = i / N * Math.PI * 2; return [Math.cos(a) * RING, top[i]! * RING, Math.sin(a) * RING]; };
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (top[i] === null || top[j] === null) continue;
    const p = pt(i), q = pt(j), pb = [p[0], -30, p[2]], qb = [q[0], -30, q[2]];
    tri.push(...pb, ...qb, ...q, ...pb, ...q, ...p);
    (snow[i] && snow[j] ? white : green).push(...p, ...q);
    if (i % 3 === 0) green.push(...p, p[0], p[1] - Math.max(1.5, (p[1] + 30) * 0.12), p[2]); // a few facets down the slope
  }
  if (!tri.length) return;
  const geo = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
  farPeaks.add(new THREE.Mesh(geo(tri), fill), new THREE.LineSegments(geo(green), lineGreen));
  if (white.length) farPeaks.add(new THREE.LineSegments(geo(white), lineSnow));
}
/** Every frame outdoors: follow the camera, and rebuild after moving 120 m (or climbing 12 m). */
export function updateFarPeaks(cam: THREE.Vector3) {
  if (!OW.terrain || G.char.loc !== 'overworld') { farPeaks.visible = false; return; }
  farPeaks.visible = true;
  if (at.world !== OW.terrain.world || Math.hypot(cam.x - at.x, cam.z - at.z) > 120 || Math.abs(cam.y - at.y) > 12) {
    at = { x: cam.x, y: cam.y, z: cam.z, world: OW.terrain.world };
    rebuild(cam.x, cam.y - 1.6, cam.z);
  }
  farPeaks.position.set(cam.x, at.y, cam.z);
}
