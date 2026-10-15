// (0.225, PLAN_WALKI.md stage W4: decoys and distractions) Hold Z and let go to throw: a stone, a flare or a piece of
// meat (gen/throwing.ts). It flies in an arc, stops at the first solid thing (rayWorld: walls, trunks, stones, the
// ground) or the water, and there:
//  - a stone clatters (a noise the foes hear and come to look at) and lies to be picked up again;
//  - a flare burns red for most of a minute, hissing (a noise again every few seconds) and lighting a little;
//  - meat lies as a bait (world/baits.ts) that the hungry beasts go to and feed on, their backs to you.
// A foe looking at the spot shows you its back, and a hit from behind counts more (gen/tactics.ts).
//
// Multiplayer: the thrower's game sends {t:'throw', loc, k, p, v} (relay); every game in the same place flies the
// same throw over the same ground and, where it lands, makes the noise for the foes it runs itself, lights the flare
// and lays the bait, so each owner's foes react. Only the thrower's game lays the stone back down as a pickup
// (a shared drop). An older server drops 'throw': the others then see nothing.
import * as THREE from 'three';
import { G } from '../game';
import { scene, camera, V, lineMat, fillMat } from './render';
import { rayWorld } from './player';
import { OW } from './overworld';
import { makeNoise } from './noise';
import { play } from './sound';
import { takeOne, hasItem } from '../character';
import { dropPickup } from './loot';
import { burst } from './fx';
import { lyingModel } from './pickmodels';
import { relay, onRelay, type Relay } from '../net/client';
import { myLoc } from './peers';
import { addLights, addGlows } from './light';
import { addBait, updateBaits, clearBaits } from './baits';
import { THROW, THROWABLES, throwKind, throwSpeed, throwShare, throwVelocity, stepFlight, type Flight, type ThrowKind } from '../gen/throwing';
import { ITEMS, type ItemKey } from '../data/items';
import { logLine } from '../ui/hud';
import { TL, tl } from '../i18n';
import { driving } from './vehicles';
import { riding } from './ride';
import { inBoat } from './boats';
import { climbing } from './ladders';
import { working } from './gather';

interface Thrown { k: ItemKey; kind: ThrowKind; f: Flight; m: THREE.Object3D; t: number; mine: boolean; spin: THREE.Vector3 }
interface Flare { p: THREE.Vector3; t: number; next: number; m: THREE.Object3D; core: THREE.Mesh }
const flying: Thrown[] = [];
const flares: Flare[] = [];
let pick: ItemKey | null = null, held = -1;
const FLARE_C = 0xff4a3a;

/** The thing the throw key picks: the one chosen, if you still carry it, else the first throwable you carry. */
export function throwPick(): ItemKey | null {
  if (pick && hasItem(pick)) return pick;
  return THROWABLES.find((k) => hasItem(k)) ?? null;
}
/** Choose what Z throws (the backpack's 'Ready to throw'). */
export function readyThrow(k: ItemKey) { pick = k; logLine(TL`Ready to throw: ${ITEMS[k].name} (hold Z, let go)`); }
/** When you cannot throw: at the wheel, riding, in a boat, swimming, climbing, flying or working. */
const blocked = () => !!driving.v || riding() || inBoat() || G.swimming || climbing() || G.fly || working();

/** Z pressed: start the swing (the longer you hold, the further it goes). */
export function startThrow() {
  if (!G.playing || blocked() || held >= 0) return;
  if (!throwPick()) { logLine(tl('Nothing to throw: carry a stone, a flare or some meat.')); return; }
  held = 0;
}
/** Z let go: throw. */
export function releaseThrow() {
  if (held < 0) return;
  const h = held; held = -1;
  const k = throwPick();
  if (!k || !G.playing || blocked() || !takeOne(k)) return;
  const fw = new THREE.Vector3(); camera.getWorldDirection(fw);
  const yaw = Math.atan2(-fw.x, -fw.z), pitch = Math.asin(Math.max(-1, Math.min(1, fw.y)));
  const p: [number, number, number] = [camera.position.x + fw.x * 0.4, camera.position.y - 0.15 + fw.y * 0.4, camera.position.z + fw.z * 0.4];
  const v = throwVelocity(yaw, pitch, throwSpeed(h));
  v[0] += G.vel.x * 0.5; v[2] += G.vel.z * 0.5;
  launch(k, p, v, true);
  play('throw', { at: G.pos, vol: 0.6, far: 30 });
  relay({ t: 'throw', loc: myLoc(), k, p: p.map((x) => +x.toFixed(2)), v: v.map((x) => +x.toFixed(2)) });
}
/** The prompt line while the swing is held. */
export function throwHint(): string | null {
  if (held < 0) return null;
  const k = throwPick();
  return k ? TL`Throwing ${ITEMS[k].name}: ${Math.round(throwShare(held) * 100)}%` : null;
}

function modelOf(k: ItemKey, kind: ThrowKind): THREE.Object3D {
  if (kind === 'flare') {
    const g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6), fillMat(0x3a0a06)); stick.rotation.z = Math.PI / 2; g.add(stick);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.03, 0.03, 0.3, 6)), lineMat(FLARE_C)); edge.rotation.z = Math.PI / 2; g.add(edge);
    return g;
  }
  return lyingModel(k, ITEMS[k].type) ?? new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), fillMat(0x555555));
}
function launch(k: ItemKey, p: [number, number, number], v: [number, number, number], mine: boolean) {
  const kind = throwKind(k), m = modelOf(k, kind);
  m.position.set(p[0], p[1], p[2]); scene.add(m);
  flying.push({ k, kind, f: { p: [...p], v: [...v] }, m, t: 0, mine, spin: V(Math.random() * 9, Math.random() * 9, Math.random() * 9) });
}
onRelay((m: Relay) => {
  if (m.t !== 'throw' || m.loc !== myLoc() || typeof m.k !== 'string' || !(m.k in ITEMS)) return;
  const p = m.p as number[], v = m.v as number[];
  if (!Array.isArray(p) || !Array.isArray(v) || p.length !== 3 || v.length !== 3 || ![...p, ...v].every(Number.isFinite)) return;
  launch(m.k as ItemKey, p as [number, number, number], v as [number, number, number], false);
});

const A = new THREE.Vector3(), D = new THREE.Vector3();
/** Where water stops the flight (the surface level), or -Infinity. */
function waterAt(x: number, z: number): number {
  if (G.char.loc !== 'overworld' || !OW.terrain) return -Infinity;
  const w = OW.terrain.water(x, z);
  return w ? w.level : -Infinity;
}
function land(o: Thrown, at: THREE.Vector3, wet: boolean) {
  scene.remove(o.m);
  if (wet) { play('splash', { at, vol: 0.5, far: 40 }); burst(at, 0x2ac8b0, 8, 0.5); if (o.kind === 'stone') makeNoise(at, THROW.noise.stone * 0.6, true); return; } // a flare goes out, meat sinks
  if (o.kind === 'stone') {
    play('thud', { at, vol: 0.8, far: 45 }); burst(at, 0xd8e0c8, 6, 0.4);
    makeNoise(at, THROW.noise.stone, true);
    if (o.mine) dropPickup(at.clone(), 'stone'); // lies there to be picked up again (a shared drop online)
    return;
  }
  if (o.kind === 'flare') {
    play('hiss', { at, vol: 0.8, far: 50 });
    makeNoise(at, THROW.noise.flare, true);
    const g = new THREE.Group(); g.position.copy(at); g.position.y += 0.05; g.add(o.m); o.m.position.set(0, 0, 0); o.m.rotation.set(0, Math.random() * 6, 0);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), new THREE.MeshBasicMaterial({ color: FLARE_C, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.x = 0.15; g.add(core); scene.add(g);
    flares.push({ p: at.clone(), t: THROW.flare.burn, next: THROW.flare.every, m: g, core });
    return;
  }
  // meat: a bait where it lies
  o.m.position.copy(at); scene.add(o.m);
  addBait(at, o.m);
}

/** Main loop: the swing, the throws in the air, the burning flares, the baits. */
export function updateThrowing(dt: number, time: number) {
  if (held >= 0) { held += dt; if (blocked()) held = -1; }
  for (let i = flying.length - 1; i >= 0; i--) {
    const o = flying[i];
    o.t += dt;
    const a = stepFlight(o.f, dt);
    A.set(a[0], a[1], a[2]); D.set(o.f.p[0] - a[0], o.f.p[1] - a[1], o.f.p[2] - a[2]);
    const len = D.length();
    if (len > 1e-6) D.divideScalar(len);
    const hit = len > 1e-6 ? rayWorld(A, D, len) : len;
    const lvl = waterAt(o.f.p[0], o.f.p[2]), wet = o.f.p[1] < lvl;
    const gy = G.ground ? G.ground(o.f.p[0], o.f.p[2]) : -Infinity, under = o.f.p[1] < gy; // (rayWorld marches the ground only every half metre)
    if (hit < len || wet || under || o.t > THROW.life) {
      const at = wet ? V(o.f.p[0], lvl, o.f.p[2]) : hit < len ? A.clone().addScaledVector(D, Math.max(0, hit - 0.08)) : under ? V(o.f.p[0], gy + 0.05, o.f.p[2]) : A.clone();
      flying.splice(i, 1); land(o, at, wet); continue;
    }
    o.m.position.set(o.f.p[0], o.f.p[1], o.f.p[2]);
    o.m.rotation.x += o.spin.x * dt; o.m.rotation.y += o.spin.y * dt; o.m.rotation.z += o.spin.z * dt;
    if (o.kind === 'flare' && Math.random() < dt * 20) burst(o.m.position, FLARE_C, 1, 0.2);
  }
  for (let i = flares.length - 1; i >= 0; i--) {
    const f = flares[i];
    f.t -= dt;
    const k = 0.75 + 0.25 * Math.sin(time * 23 + i) * Math.sin(time * 7);
    f.core.scale.setScalar(k * Math.min(1, f.t / 3 + 0.2));
    if (Math.random() < dt * 14) burst(f.p.clone().setY(f.p.y + 0.15), FLARE_C, 1, 0.35);
    if ((f.next -= dt) <= 0 && f.t > 1) { f.next = THROW.flare.every; makeNoise(f.p, THROW.noise.flare, true); }
    if (f.t > 0) continue;
    scene.remove(f.m); flares.splice(i, 1);
  }
  updateBaits(dt);
}
/** Leaving a place: nothing thrown stays. */
export function clearThrowing() {
  for (const o of flying) scene.remove(o.m);
  for (const f of flares) scene.remove(f.m);
  flying.length = 0; flares.length = 0; held = -1;
  clearBaits();
}
addLights((out) => { for (const f of flares) out.push({ x: f.p.x, y: f.p.y + 0.3, z: f.p.z, r: THROW.flare.r * Math.min(1, f.t / 3 + 0.2), k: 'fire' }); });
addGlows((out) => { for (const f of flares) out.push({ x: f.p.x, y: f.p.y + 0.2, z: f.p.z, c: FLARE_C, s: 0.07, a: 0.9, far: 1200 }); });
