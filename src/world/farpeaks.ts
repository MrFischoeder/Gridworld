// Far mountains on the horizon: the real mountains (gen/mountains.ts) within a few kilometres, seen as a silhouette.
// The terrain only streams in around the player, so for every direction the highest angle of mountain above the
// eye is found out to FAR metres and drawn on a ring just inside the sky's decorative ranges (a skybox trick: the
// ring travels with the camera). Rebuilt when you have moved far enough.
import * as THREE from 'three';
import { scene, lineMat, fillMat } from './render';
import { G } from '../game';
import { OW } from './overworld';
import { mountainMask } from '../gen/mountains';
import { nearPolarRange } from '../gen/heights';

const N = 216, NEAR = 150, FAR = 3200, RING = 145;
export const farPeaks = new THREE.Group();
farPeaks.visible = false; scene.add(farPeaks);
let at = { x: NaN, y: NaN, z: NaN, world: -1, wet: false };
const noFog = <T extends THREE.Material>(m: T) => { (m as unknown as { fog: boolean }).fog = false; return m; };
// (0.277) a backdrop like the sky's ranges (world/sky.ts): no depth test, drawn just after them, so the real land covers it, and hazed by the air
const backdrop = <T extends THREE.Material>(m: T) => { m.depthTest = false; m.depthWrite = false; return noFog(m); };
const GREEN = new THREE.Color(0x3ad866), SNOW = new THREE.Color(0xbfffe8), HAZE = 0.45;
const lineGreen = backdrop(lineMat(0x3ad866)), lineSnow = backdrop(lineMat(0xbfffe8)), fill = backdrop(fillMat(0x000000));
/** The silhouettes take a little of the air's colour (paler by day). */
export function hazeFarPeaks(fog: THREE.Color) { fill.color.copy(fog).multiplyScalar(HAZE * 1.1); lineGreen.color.copy(GREEN).lerp(fog, HAZE); lineSnow.color.copy(SNOW).lerp(fog, HAZE); }

function rebuild(x: number, y: number, z: number) {
  const T = OW.terrain!, w = T.world, eye = y + 1.6;
  // on the water (a boat, swimming) the silhouettes stand on the sea's horizon, not 30 m below it; high up (flying, a
  // summit) their foot goes down with the land so they never hang as a curtain in the air
  const wet = !!T.water(x, z);
  farPeaks.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); farPeaks.clear();
  // the steepest slope of mountain above the eye in every direction (null: no mountain that way)
  const top: (number | null)[] = [], snow: boolean[] = [], foot: number[] = [];
  for (let i = 0; i < N; i++) {
    const a = i / N * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
    let best: number | null = null, hi = 0, low = NaN, hmin = Infinity;
    for (let d = NEAR; d <= FAR; d += 200) {
      if (!nearPolarRange(z + dz * d) && !nearPolarRange(z + dz * (d + 200)) && mountainMask(w, x + dx * d, z + dz * d) <= 0.02 && mountainMask(w, x + dx * (d + 100), z + dz * (d + 100)) <= 0.02) continue; // (0.288) the polar range too
      for (let e = d; e < d + 200; e += 25) {
        const h = T.base(x + dx * e, z + dz * e), s = (h - eye) / e;
        hmin = Math.min(hmin, h);
        // (0.288) the foot: the lowest land before the summit, seen at the summit's distance, so the silhouette's
        // base sits on the land there and never hangs down as a curtain when you look from high up
        if (best === null || s > best) { best = s; hi = h; low = (hmin - 4 - eye) / e; }
      }
    }
    top.push(best !== null && best > 0.01 ? best : null); snow.push(hi > 115); // only what rises above the horizon
    foot.push(wet ? -1.2 / RING : Math.min(-0.012, Number.isNaN(low) ? -0.012 : low));
  }
  // the foot between neighbours for the foothills added below
  for (let i = 0; i < N; i++) if (top[i] === null) foot[i] = Math.max(foot[(i + N - 1) % N], foot[(i + 1) % N], -0.05);
  // (0.288, the owner's report: the far ranges looked like walls) where the mountains end the ridge runs down to the
  // horizon over a few steps (a foothill, not a sheer end), and nothing is smoothed away: the peaks stay peaks
  const FLOOR = -0.004, SLOPE = 4;
  for (let pass = 0; pass < SLOPE; pass++) {
    const was = top.slice();
    for (let i = 0; i < N; i++) {
      if (was[i] !== null) continue;
      const nb = Math.max(was[(i + N - 1) % N] ?? -Infinity, was[(i + 1) % N] ?? -Infinity);
      if (nb > -Infinity) top[i] = FLOOR + (nb - FLOOR) * 0.45;
    }
  }
  const tri: number[] = [], green: number[] = [], white: number[] = [];
  const pt = (i: number) => { const a = i / N * Math.PI * 2; return [Math.cos(a) * RING, top[i]! * RING, Math.sin(a) * RING]; };
  const base = (i: number) => { const a = i / N * Math.PI * 2; return [Math.cos(a) * RING, foot[i] * RING, Math.sin(a) * RING]; };
  const v = (i: number) => top[(i + N) % N];
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N;
    if (top[i] === null || top[j] === null) continue;
    const p = pt(i), q = pt(j), pb = base(i), qb = base(j);
    tri.push(...pb, ...qb, ...q, ...pb, ...q, ...p);
    (snow[i] && snow[j] ? white : green).push(...p, ...q);
  }
  // facets: from every summit (a local high of the ridge) a spur runs down each side to the next saddle's foot
  for (let i = 0; i < N; i++) {
    const h = v(i);
    if (h === null || h <= FLOOR || (v(i - 1) ?? -1) > h || (v(i + 1) ?? -1) >= h) continue;
    const p = pt(i);
    for (const dir of [-1, 1]) {
      let k = i;
      while (Math.abs(k - i) < 12 && (v(k + dir) ?? -Infinity) < (v(k) ?? -Infinity) && v(k + dir) !== null) k += dir;
      if (k === i) continue;
      const q = pt((k + N) % N), drop = (p[1] - q[1]) * 0.6;
      const m = [(p[0] + q[0]) / 2, q[1] - drop * 0.4, (p[2] + q[2]) / 2];
      green.push(...p, ...m);
    }
    if (h > 0.03) green.push(...p, p[0], p[1] - (p[1] - foot[i] * RING) * 0.25, p[2]); // a gully down a high face
  }
  if (!tri.length) return;
  const geo = (a: number[]) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(a, 3)); return g; };
  farPeaks.add(new THREE.Mesh(geo(tri), fill), new THREE.LineSegments(geo(green), lineGreen));
  if (white.length) farPeaks.add(new THREE.LineSegments(geo(white), lineSnow));
  farPeaks.children.forEach((o, k) => { o.renderOrder = k ? -4.9 : -5; o.frustumCulled = false; });
}
/** Every frame outdoors: follow the camera, and rebuild after moving 120 m (or climbing 12 m). */
export function updateFarPeaks(cam: THREE.Vector3) {
  if (!OW.terrain || G.char.loc !== 'overworld') { farPeaks.visible = false; return; }
  farPeaks.visible = true;
  const wet = !!OW.terrain.water(cam.x, cam.z);
  if (at.world !== OW.terrain.world || Math.hypot(cam.x - at.x, cam.z - at.z) > 120 || Math.abs(cam.y - at.y) > 12 || wet !== at.wet) {
    at = { x: cam.x, y: cam.y, z: cam.z, world: OW.terrain.world, wet };
    rebuild(cam.x, cam.y - 1.6, cam.z);
  }
  farPeaks.position.set(cam.x, at.y, cam.z);
}
