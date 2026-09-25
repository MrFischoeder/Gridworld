// The weather you see (gen/weather.ts gives the numbers): rain streaks falling round you, slanted by the wind; banks
// of cloud drifting overhead; fog closing in; in a thunderstorm, forked lightning out in the land with a flash that
// lights the whole sky and a tremor of thunder. The sky and the fog take the rest (world/sky.ts reads `seen`).
// Only on the surface. Everything here is looks for now; gen/weather.ts `weatherAt` is where effects will hook in.
import * as THREE from 'three';
import { G } from '../game';
import { scene, camera } from './render';
import { weatherAt, type Weather, type WeatherKind } from '../gen/weather';

/** What the weather looks like right now (eased towards the forecast), and the lightning flash (0..1). */
export const seen = { cloud: 0, rain: 0, fog: 0, storm: 0, wind: 0, windDir: 0, flash: 0, kind: 'clear' as WeatherKind };
let forced: WeatherKind | null = null;
const FORCE: Record<WeatherKind, Omit<Weather, 'kind' | 'windDir'>> = {
  clear: { cloud: 0.05, rain: 0, fog: 0, storm: 0, wind: 0.2 }, overcast: { cloud: 0.8, rain: 0, fog: 0.1, storm: 0, wind: 0.4 },
  rain: { cloud: 0.9, rain: 0.65, fog: 0.2, storm: 0, wind: 0.55 }, fog: { cloud: 0.45, rain: 0, fog: 0.95, storm: 0, wind: 0.05 },
  storm: { cloud: 1, rain: 1, fog: 0.25, storm: 1, wind: 1 },
};
/** Console: force a kind of weather (null: back to the forecast). */
export function forceWeather(k: WeatherKind | null) { forced = k; }

// ---------- rain: streaks in a box that travels with the camera ----------
const N = 1600, BOX = 34, H = 26;
const drops = new Float32Array(N * 3), rainPos = new Float32Array(N * 6);
for (let i = 0; i < N; i++) { drops[i * 3] = (Math.random() - 0.5) * BOX * 2; drops[i * 3 + 1] = Math.random() * H; drops[i * 3 + 2] = (Math.random() - 0.5) * BOX * 2; }
const rainGeo = new THREE.BufferGeometry(); rainGeo.setAttribute('position', new THREE.BufferAttribute(rainPos, 3));
const rainMat = new THREE.LineBasicMaterial({ color: 0xa8ffd8, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false });
const rain = new THREE.LineSegments(rainGeo, rainMat); rain.frustumCulled = false; rain.visible = false; scene.add(rain);

// ---------- clouds: flattened faceted puffs, dark underneath, drifting with the wind ----------
const clouds = new THREE.Group(); clouds.visible = false; scene.add(clouds);
const cloudFill = new THREE.MeshBasicMaterial({ color: 0x0a1a10, transparent: true, opacity: 0.6, fog: false, depthWrite: false, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
const cloudLine = new THREE.LineBasicMaterial({ color: 0x9dffb4, transparent: true, opacity: 0.45, fog: false, depthWrite: false });
const puffs: { o: THREE.Object3D; x: number; z: number; y: number }[] = [];
for (let i = 0; i < 16; i++) {
  const o = new THREE.Group(), n = 3 + (i % 3);
  for (let k = 0; k < n; k++) {
    const geo = new THREE.IcosahedronGeometry(9 + ((i * 7 + k * 3) % 6), 1), m = new THREE.Mesh(geo, cloudFill), l = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), cloudLine);
    for (const p of [m, l]) { p.position.set((k - n / 2) * 11, ((k * 5) % 3) * 1.5, ((k * 13) % 7) - 3); p.scale.set(1.3, 0.38, 1); }
    o.add(m, l);
  }
  const a = i / 16 * Math.PI * 2 + (i % 2) * 0.4, r = 40 + ((i * 37) % 120);
  puffs.push({ o, x: Math.cos(a) * r, z: Math.sin(a) * r, y: 62 + ((i * 11) % 18) }); clouds.add(o);
}

// ---------- lightning ----------
const bolts: { o: THREE.LineSegments; t: number }[] = [];
let nextBolt = 6, shake = 0;
/** A lightning strike out in the land (also for testing). */
export function strike() {
  // somewhere out in the land, 60-170 m off, mostly where you can see it
  const a = camera.rotation.y + Math.PI + (Math.random() - 0.5) * 2.4, d = 60 + Math.random() * 110;
  const gx = camera.position.x + Math.sin(a) * d, gz = camera.position.z + Math.cos(a) * d, gy = G.ground ? G.ground(gx, gz) : camera.position.y - 2;
  const top = camera.position.y + 70, pts: THREE.Vector3[] = [];
  const fork = (x: number, y: number, z: number, y1: number, spread: number, depth: number) => {
    let px = x, pz = z;
    for (let yy = y; yy > y1; ) {
      const ny = Math.max(y1, yy - (3 + Math.random() * 6)), nx = px + (Math.random() - 0.5) * spread, nz = pz + (Math.random() - 0.5) * spread;
      pts.push(new THREE.Vector3(px, yy, pz), new THREE.Vector3(nx, ny, nz));
      if (depth < 2 && Math.random() < 0.18) fork(nx, ny, nz, ny - 8 - Math.random() * 14, spread * 0.8, depth + 1); // a branch
      px = nx; pz = nz; yy = ny;
    }
  };
  fork(gx + (Math.random() - 0.5) * 20, top, gz + (Math.random() - 0.5) * 20, Number.isFinite(gy) ? gy : camera.position.y - 2, 7, 0);
  const o = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0xeaffff, transparent: true, blending: THREE.AdditiveBlending, fog: false, depthWrite: false }));
  o.frustumCulled = false; scene.add(o); bolts.push({ o, t: 0 });
  seen.flash = 1; shake = 0.35 * Math.max(0, 1 - d / 200);
}

let checkT = 0;
const target = { cloud: 0, rain: 0, fog: 0, storm: 0, wind: 0, windDir: 0 };
/** Every frame on the surface: ease towards the forecast, move the rain and the clouds, throw lightning. */
export function updateWeather(dt: number, outdoors: boolean) {
  const show = outdoors && G.char.loc === 'overworld';
  rain.visible = show && seen.rain > 0.02; clouds.visible = show && seen.cloud > 0.05;
  if (!show) { for (const b of bolts) scene.remove(b.o); bolts.length = 0; seen.flash = 0; return; }
  if ((checkT -= dt) <= 0) {
    checkT = 1;
    const w = forced ? { kind: forced, ...FORCE[forced], windDir: target.windDir } : weatherAt(G.char.world, G.pos.x, G.pos.z, G.char.time);
    Object.assign(target, w); seen.kind = w.kind;
  }
  const k = Math.min(1, dt * (forced ? 1.2 : 0.25)); // forced from the console: quick; the forecast changes slowly anyway
  for (const key of ['cloud', 'rain', 'fog', 'storm', 'wind'] as const) seen[key] += (target[key] - seen[key]) * k;
  seen.windDir = target.windDir;
  const cx = camera.position.x, cy = camera.position.y, cz = camera.position.z, wx = Math.cos(seen.windDir) * seen.wind, wz = Math.sin(seen.windDir) * seen.wind;
  // rain: as many streaks as it rains, falling fast and slanting with the wind, wrapped round the camera
  if (rain.visible) {
    const count = Math.floor(N * Math.min(1, seen.rain)), fall = 26, len = 0.9;
    for (let i = 0; i < count; i++) {
      let x = drops[i * 3], y = drops[i * 3 + 1], z = drops[i * 3 + 2];
      y -= fall * dt; x += wx * 7 * dt; z += wz * 7 * dt;
      if (y < 0) { y += H; x = (Math.random() - 0.5) * BOX * 2; z = (Math.random() - 0.5) * BOX * 2; }
      if (x > BOX) x -= BOX * 2; else if (x < -BOX) x += BOX * 2;
      if (z > BOX) z -= BOX * 2; else if (z < -BOX) z += BOX * 2;
      drops[i * 3] = x; drops[i * 3 + 1] = y; drops[i * 3 + 2] = z;
      const X = cx + x, Y = cy - 6 + y, Z = cz + z, j = i * 6;
      rainPos[j] = X; rainPos[j + 1] = Y; rainPos[j + 2] = Z; rainPos[j + 3] = X - wx * 0.25; rainPos[j + 4] = Y + len; rainPos[j + 5] = Z - wz * 0.25;
    }
    rainGeo.setDrawRange(0, count * 2); rainGeo.attributes.position.needsUpdate = true;
    rainMat.opacity = 0.25 + 0.35 * seen.rain;
  }
  // clouds: drift with the wind round the camera, thicker and darker the more it clouds over
  if (clouds.visible) {
    for (const p of puffs) {
      p.x += wx * 3 * dt; p.z += wz * 3 * dt;
      if (p.x > 170) p.x -= 340; else if (p.x < -170) p.x += 340;
      if (p.z > 170) p.z -= 340; else if (p.z < -170) p.z += 340;
      p.o.position.set(cx + p.x, cy + p.y - 20 * seen.cloud, cz + p.z);
    }
    const veil = 1 - seen.fog * 0.85; // fog swallows the clouds
    cloudFill.opacity = (0.25 + 0.55 * seen.cloud) * veil; cloudLine.opacity = (0.12 + 0.35 * seen.cloud * (1 - seen.storm * 0.5)) * veil + seen.flash * 0.5;
    cloudFill.color.setRGB(0.04 + 0.4 * seen.flash, 0.1 + 0.45 * seen.flash, 0.06 + 0.45 * seen.flash);
  }
  // lightning in a storm
  if (seen.storm > 0.3) {
    nextBolt -= dt;
    if (nextBolt <= 0) { strike(); nextBolt = (3 + Math.random() * 10) / seen.storm; }
  }
  seen.flash = Math.max(0, seen.flash - dt * 2.8);
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.t += dt;
    (b.o.material as THREE.LineBasicMaterial).opacity = b.t < 0.3 ? (Math.sin(b.t * 70) > -0.3 ? 1 : 0.2) : Math.max(0, 1 - (b.t - 0.3) * 4);
    if (b.t > 0.55) { scene.remove(b.o); b.o.geometry.dispose(); bolts.splice(i, 1); }
  }
  if (shake > 0) { camera.rotation.z += (Math.random() - 0.5) * shake * 0.02; shake = Math.max(0, shake - dt * 0.6); }
}
