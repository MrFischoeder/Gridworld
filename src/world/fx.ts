// Short-lived effects: sparks, beams, and light streaks running along the grid lines.
import * as THREE from 'three';
import { scene, add, V } from './render';
import { edgeKey, type Edge } from '../core/meshing';
import { G } from '../game';

const fx: { obj: THREE.Line | THREE.LineSegments | THREE.LineLoop; life: number; max: number }[] = [];
export function addFx(obj: THREE.Line, life: number) {
  (obj.material as THREE.Material).transparent = true; scene.add(obj); fx.push({ obj, life, max: life });
}
export function burst(at: THREE.Vector3, color: number, n: number, r: number) {
  const sp: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) {
    const v = V(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(r * (0.4 + Math.random() * 0.6));
    sp.push(at.clone(), at.clone().add(v));
  }
  addFx(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(sp), add(color)), 0.3);
}
export function updateFx(dt: number) {
  for (let i = fx.length - 1; i >= 0; i--) {
    const e = fx[i]; e.life -= dt;
    (e.obj.material as THREE.Material).opacity = Math.max(0, e.life / e.max);
    if (e.life <= 0) { scene.remove(e.obj); e.obj.geometry.dispose(); (e.obj.material as THREE.Material).dispose(); fx.splice(i, 1); }
  }
}

// ---------- light streaks ----------
/** Edge sources: every voxel mesh currently shown registers its edges here. */
export interface EdgeSource { edgeSet: Set<string>; edgeArr: Edge[] }
let sources: EdgeSource[] = [];
export function setStreakSources(list: EdgeSource[]) { sources = list; resetStreaks(); }

const STREAKS = 36, sPos = new Float32Array(STREAKS * 6), sCol = new Float32Array(STREAKS * 6);
const sGeo = new THREE.BufferGeometry();
sGeo.setAttribute('position', new THREE.BufferAttribute(sPos, 3));
sGeo.setAttribute('color', new THREE.BufferAttribute(sCol, 3));
const streakLines = new THREE.LineSegments(sGeo, new THREE.LineBasicMaterial({ vertexColors: true, blending: THREE.AdditiveBlending, transparent: true }));
streakLines.frustumCulled = false;
scene.add(streakLines);
interface Streak { wait: number; from?: number[] | null; a?: number; len?: number; dir?: number; t?: number; speed?: number; src?: EdgeSource }
const streaks: Streak[] = []; for (let i = 0; i < STREAKS; i++) streaks.push({ wait: 1 });

function newStreak(s: Streak) {
  for (let tries = 0; tries < 20 && sources.length; tries++) {
    const src = sources[(Math.random() * sources.length) | 0];
    if (!src.edgeArr.length) continue;
    const E = src.edgeArr[(Math.random() * src.edgeArr.length) | 0], a = E[3];
    if (Math.hypot(E[0] - G.pos.x, E[2] - G.pos.z) > 30) continue;
    const has = (p: number[]) => src.edgeSet.has(edgeKey(p[0], p[1], p[2], a));
    const st = E.slice(0, 3), en = E.slice(0, 3);
    let n = 0; while (n < 14) { const q = st.slice(); q[a] -= 1; if (!has(q)) break; st[a] -= 1; n++; }
    n = 0; while (n < 14) { const q = en.slice(); q[a] += 1; if (!has(q)) break; en[a] += 1; n++; }
    en[a] += 1;
    if (en[a] - st[a] < 5) continue;
    const dir = Math.random() < 0.5 ? 1 : -1;
    Object.assign(s, { a, from: dir > 0 ? st : en, len: en[a] - st[a], dir, t: -2.5, speed: 10 + Math.random() * 14, wait: Math.random() * 2 });
    return;
  }
  s.wait = 0.5;
}
export function resetStreaks() { streaks.forEach((s) => { s.from = null; s.wait = Math.random(); }); }
export function updateStreaks(dt: number) {
  streaks.forEach((s, i) => {
    const o = i * 6;
    if (s.wait > 0) { s.wait -= dt; for (let q = 0; q < 6; q++) { sPos[o + q] = 0; sCol[o + q] = 0; } if (s.wait <= 0 && !s.from) newStreak(s); return; }
    if (!s.from) { newStreak(s); return; }
    s.t! += s.speed! * dt;
    if (s.t! > s.len! + 2.5) { newStreak(s); return; }
    const head = Math.min(Math.max(s.t!, 0), s.len!), tail = Math.min(Math.max(s.t! - 2.5, 0), s.len!);
    const P = (d: number) => { const p = s.from!.slice(); p[s.a!] += d * s.dir!; return p; };
    const h = P(head), tl = P(tail);
    sPos.set([h[0], h[1], h[2], tl[0], tl[1], tl[2]], o);
    sCol.set([0.6, 1, 0.7, 0, 0.15, 0.05], o);
  });
  sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
}
