// Short-lived effects: sparks, beams, and light streaks running along the grid lines.
import * as THREE from 'three';
import { play } from './sound';
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
// (0.193) A shot's bolt: a short streak flying from the muzzle to where the shot ends, sparks when it gets there.
const bolts: { line: THREE.Line; from: THREE.Vector3; dir: THREE.Vector3; dist: number; len: number; speed: number; t: number; c: number; hit: number }[] = [];
export function addBolt(from: THREE.Vector3, to: THREE.Vector3, color: number, len: number, speed: number, hitColor: number, hit: number) {
  const dir = to.clone().sub(from), dist = dir.length(); dir.normalize();
  const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from.clone(), from.clone()]), add(color));
  scene.add(line); bolts.push({ line, from: from.clone(), dir, dist, len, speed, t: 0, c: hitColor, hit });
}
// (0.194) A machine's blast: a see-through ball of fire that swells out from the wreck and fades, a wire shell over
// it and a ring running out along the ground.
const blasts: { g: THREE.Group; fill: THREE.MeshBasicMaterial; wire: THREE.LineBasicMaterial; ring: THREE.LineLoop; r: number; t: number }[] = [];
const BLAST_GROW = 0.32, BLAST_FADE = 0.55;
const ballGeo = new THREE.SphereGeometry(1, 20, 14), shellGeo = new THREE.WireframeGeometry(new THREE.IcosahedronGeometry(1, 2));
const ringGeo = (() => { const p: THREE.Vector3[] = []; for (let i = 0; i < 40; i++) { const a = i / 40 * 6.2832; p.push(V(Math.cos(a), 0, Math.sin(a))); } return new THREE.BufferGeometry().setFromPoints(p); })();
export function addBlast(at: THREE.Vector3, r: number, color: number, groundY = at.y) {
  play('explosion', { at, vol: Math.min(1, 0.5 + r / 8), rate: r > 4 ? 0.8 : 1, far: 160 });
  const g = new THREE.Group(); g.position.copy(at);
  const fill = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
  const wire = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false });
  g.add(new THREE.Mesh(ballGeo, fill), new THREE.LineSegments(shellGeo, wire));
  const ring = new THREE.LineLoop(ringGeo, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.8, depthWrite: false }));
  ring.position.set(at.x, groundY + 0.08, at.z);
  g.scale.setScalar(0.15); scene.add(g, ring);
  blasts.push({ g, fill, wire, ring, r, t: 0 });
  burst(at, color, 30, r * 0.9); burst(at, 0xffffff, 12, r * 0.5);
}
export function updateFx(dt: number) {
  for (let i = blasts.length - 1; i >= 0; i--) {
    const b = blasts[i]; b.t += dt;
    const grow = Math.min(1, b.t / BLAST_GROW), k = 1 - (1 - grow) * (1 - grow), fade = Math.max(0, (b.t - BLAST_GROW * 0.6) / BLAST_FADE);
    b.g.scale.setScalar(Math.max(0.15, b.r * k)); b.g.rotation.y += dt * 1.5;
    b.fill.opacity = 0.32 * (1 - fade); b.wire.opacity = 0.6 * (1 - fade);
    b.ring.scale.setScalar(b.r * (0.3 + 1.1 * Math.min(1, b.t / (BLAST_GROW + BLAST_FADE)))); (b.ring.material as THREE.LineBasicMaterial).opacity = 0.8 * (1 - fade);
    if (fade >= 1) { scene.remove(b.g, b.ring); b.fill.dispose(); b.wire.dispose(); (b.ring.material as THREE.Material).dispose(); blasts.splice(i, 1); }
  }
  for (let i = bolts.length - 1; i >= 0; i--) {
    const b = bolts[i]; b.t += dt;
    const head = Math.min(b.dist, b.t * b.speed), tail = Math.max(0, head - b.len), pos = b.line.geometry.getAttribute('position') as THREE.BufferAttribute;
    const h = b.from.clone().addScaledVector(b.dir, head), tl = b.from.clone().addScaledVector(b.dir, tail);
    pos.setXYZ(0, tl.x, tl.y, tl.z); pos.setXYZ(1, h.x, h.y, h.z); pos.needsUpdate = true; b.line.geometry.computeBoundingSphere();
    if (head >= b.dist) {
      if (b.hit > 0) burst(h, b.c, Math.round(4 + 6 * b.hit), 0.35 * b.hit);
      scene.remove(b.line); b.line.geometry.dispose(); (b.line.material as THREE.Material).dispose(); bolts.splice(i, 1);
    }
  }
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
    const h = P(head), tq = P(tail);
    sPos.set([h[0], h[1], h[2], tq[0], tq[1], tq[2]], o);
    sCol.set([0.6, 1, 0.7, 0, 0.15, 0.05], o);
  });
  sGeo.attributes.position.needsUpdate = true; sGeo.attributes.color.needsUpdate = true;
}
