// (0.232, PLAN_BIOMOW.md stage B2) The air over a biome: by day the sky's haze and the fog lean towards the biome's own
// colour (warm over the desert, pale over the tundra, murky and thicker over a swamp, violet over the crystal wastes),
// eased as you walk from one into another. After updateSky, before the toxic fog's tint (main.ts). Looks only.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { tintSky } from './sky';
import { daylight, sunTilt } from '../core/time';
import { latitude } from '../gen/regions';
import { biomeOfCell, BIOME_LOOK } from '../gen/biomes';

const want = new THREE.Color(), now = new THREE.Color(0x4fae7c), tmp = new THREE.Color();
let k = 0, thick = 0, last = 0, wantK = 0, wantThick = 0, checkT = 0;
/** How strongly the haze leans (by day). */
const HAZE = 0.42;
export function tintBiome() {
  const t = performance.now(), dt = Math.min(0.2, (t - last) / 1000); last = t;
  if (G.char.loc !== 'overworld') return;
  if ((checkT -= dt) <= 0) {
    checkT = 0.5;
    const L = BIOME_LOOK[biomeOfCell(G.char.world, G.pos.x, G.pos.z)];
    wantK = L.haze ? HAZE : 0; wantThick = L.thick ?? 0;
    if (L.haze) want.setHex(L.haze);
  }
  const e = 1 - Math.exp(-dt / 2.5); // a few seconds to change
  k += (wantK - k) * e; thick += (wantThick - thick) * e; now.lerp(want, e);
  if (k < 0.005 && thick < 0.005) return;
  const day = daylight(G.char.time, sunTilt(latitude(G.pos.z))), f = scene.fog as THREE.Fog, bg = scene.background as THREE.Color;
  tmp.copy(now).multiplyScalar(0.12 + 0.88 * day);
  f.color.lerp(tmp, k * day); bg.lerp(tmp, k * day);
  f.near *= 1 - 0.4 * thick; f.far *= 1 - 0.35 * thick;
  tintSky(tmp, k * day * 0.8);
}
