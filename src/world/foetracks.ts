// (0.237, PLAN_SPAWNOW.md stage L4) Prints on the ground: whatever walks the wilds near you leaves them (paws,
// hooves, boots, a machine's three-toed feet), pointing the way it went and fading over two game minutes, so fresh
// ones tell you something passed here a moment ago. Drawn only (one line batch), never saved; each game lays them
// for the foes it has (its own and the others' copies), so nothing is sent.
import * as THREE from 'three';
import { G, W } from '../game';
import { scene } from './render';
import { OW, groundAt } from './overworld';
import { PRINTS, TRACKS, printFade, printSegs, type PrintSpec } from '../gen/warnings';
import { FLYERS, SWIMMERS } from '../data/creatures';

interface Walker { x: number; z: number; acc: number; side: number }
interface Print { x: number; y: number; z: number; t: number; c: THREE.Color }
const walkers = new WeakMap<object, Walker>();
const prints: (Print | null)[] = new Array(TRACKS.max).fill(null);
let next = 0, live = 0, fadeT = 0, lastX = NaN, lastZ = NaN;
const V2 = TRACKS.segs * 2;
const pos = new Float32Array(TRACKS.max * V2 * 3), col = new Float32Array(TRACKS.max * V2 * 3);
const geo = new THREE.BufferGeometry();
geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
const lines = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false }));
lines.frustumCulled = false; lines.renderOrder = 1;
let shown = false;
const colours = new Map<number, THREE.Color>();
const colourOf = (c: number) => { let k = colours.get(c); if (!k) colours.set(c, (k = new THREE.Color(c).multiplyScalar(TRACKS.dim))); return k; };

function lay(spec: PrintSpec, x: number, z: number, heading: number, side: number) {
  if (!OW.terrain || OW.terrain.water(x, z)) return; // nothing shows in the water
  const y = groundAt(x, z);
  if (!isFinite(y)) return; // on a place's floor
  const i = next; next = (next + 1) % TRACKS.max;
  if (!prints[i]) live++;
  const p: Print = { x, y: y + 0.07, z, t: G.char.time, c: colourOf(spec.c) };
  prints[i] = p;
  const segs = printSegs(spec.k, spec.size, heading, side);
  for (let s = 0; s < TRACKS.segs; s++) {
    const g = segs[s], o = (i * V2 + s * 2) * 3;
    if (!g) { pos.fill(0, o, o + 6); continue; }
    pos[o] = x + g[0]; pos[o + 1] = p.y; pos[o + 2] = z + g[1];
    pos[o + 3] = x + g[2]; pos[o + 4] = p.y; pos[o + 5] = z + g[3];
  }
  geo.attributes.position.needsUpdate = true;
  tint(i, p); geo.attributes.color.needsUpdate = true;
}
function tint(i: number, p: Print | null) {
  const f = p ? printFade(G.char.time - p.t) : 0, c = p?.c;
  for (let v = 0; v < V2; v++) { const o = (i * V2 + v) * 3; col[o] = c ? c.r * f : 0; col[o + 1] = c ? c.g * f : 0; col[o + 2] = c ? c.b * f : 0; }
}
function step(o: object, spec: PrintSpec | undefined, x: number, z: number) {
  if (!spec) return;
  let w = walkers.get(o);
  if (!w) { walkers.set(o, { x, z, acc: 0, side: 1 }); return; }
  const dx = x - w.x, dz = z - w.z, d = Math.hypot(dx, dz);
  w.x = x; w.z = z;
  if (d > 4 || d < 1e-4) return; // a jump (a copy put right) is no walk
  if (Math.abs(x - G.pos.x) > TRACKS.reach || Math.abs(z - G.pos.z) > TRACKS.reach) return;
  if ((w.acc += d) < spec.step) return;
  w.acc = 0; w.side = -w.side;
  lay(spec, x, z, Math.atan2(dx, dz), w.side);
}
/** Forget every print (another place, the seam, a teleport). */
export function clearFoeTracks() {
  prints.fill(null); live = 0; col.fill(0);
  geo.attributes.color.needsUpdate = true;
}
/** How many prints lie about now (tests, the console). */
export const printCount = () => live;
/** Every frame on the surface (main loop, after the foes moved). */
export function updateFoeTracks(dt: number) {
  const on = G.char.loc === 'overworld' && !!OW.terrain;
  if (on !== shown) { shown = on; if (on) scene.add(lines); else { scene.remove(lines); clearFoeTracks(); } }
  if (!on) return;
  if (Number.isFinite(lastX) && Math.hypot(G.pos.x - lastX, G.pos.z - lastZ) > 300) clearFoeTracks();
  lastX = G.pos.x; lastZ = G.pos.z;
  for (const c of W.creatures) if (!FLYERS.includes(c.kind) && !SWIMMERS.includes(c.kind)) step(c, PRINTS[c.kind], c.p.x, c.p.z);
  for (const r of W.robots) step(r, PRINTS[r.model], r.p.x, r.p.z);
  for (const b of W.bandits) step(b, PRINTS.bandit, b.p.x, b.p.z);
  if ((fadeT -= dt) > 0) return;
  fadeT = 0.5;
  for (let i = 0; i < TRACKS.max; i++) {
    const p = prints[i];
    if (!p) continue;
    if (G.char.time - p.t >= TRACKS.life) { prints[i] = null; live--; tint(i, null); } else tint(i, p);
  }
  geo.attributes.color.needsUpdate = true;
}
