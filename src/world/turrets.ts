// Auto turrets on your bases (runtime, unsaved state): each turret part (gen/base.ts, drawn plinth in
// world/building.ts) gets a turning head with a twin barrel. A switched-on turret looks for the nearest hostile thing
// in range (TURRET.range) it can see (rayWorld: walls, floors and the land block it), turns towards it and fires
// hitscan bolts; idle it sweeps slowly. It shoots creatures, robots, drones, bandits and raiders, not calm Brambles.
// Kills count like yours (loot, bounties). E at a turret switches it on or off.
import * as THREE from 'three';
import { scene, lineMat, add } from './render';
import { G } from '../game';
import { addFx, burst } from './fx';
import { rayWorld } from './player';
import { foes, damageFoe, type Foe } from './enemies';
import { makeNoise } from './noise';
import { saveChar } from '../character';
import { logLine } from '../ui/hud';
import { BUILD, TURRET } from '../data/building';
import { shapeOf, lvOf, floorH, type Part } from '../gen/base';
import { nearX, wrapDx } from '../gen/regions';
import type { Char } from '../save';

type Claim = Char['claims'][number];
interface Turret { c: Claim; p: Part; g: THREE.Group; head: THREE.Group; yaw: number; cd: number; look: number; target: Foe | null; muzzle: THREE.Vector3 }
const live = new Map<Part, Turret>();
const C = BUILD.cell, ON = 0x7dffc8, OFF = 0x3a5a44;
const fill = new THREE.MeshBasicMaterial({ color: 0x010d04, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

function solid(geo: THREE.BufferGeometry, mat: THREE.LineBasicMaterial) {
  const o = new THREE.Group(); o.add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo), mat)); return o;
}
function build(c: Claim, p: Part): Turret {
  const mat = lineMat(p.off ? OFF : ON), g = new THREE.Group(), head = new THREE.Group();
  const x = nearX(c.x, G.pos.x) + p.gx * C + C / 2, z = c.z + p.gz * C + C / 2, y = c.y + floorH(lvOf(p));
  g.position.set(x, y + TURRET.head, z);
  head.add(solid(new THREE.BoxGeometry(0.55, 0.36, 0.6), mat));
  for (const s of [-0.1, 0.1]) { const b = solid(new THREE.CylinderGeometry(0.045, 0.045, 0.7, 6).rotateX(Math.PI / 2), mat); b.position.set(s, 0.02, -0.6); head.add(b); }
  const eye = solid(new THREE.BoxGeometry(0.2, 0.1, 0.06), mat); eye.position.set(0, 0.24, -0.2); head.add(eye);
  g.add(head); scene.add(g);
  return { c, p, g, head, yaw: Math.random() * 6.28, cd: 0.5, look: 0, target: null, muzzle: new THREE.Vector3() };
}
function drop(t: Turret) { scene.remove(t.g); t.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); live.delete(t.p); }

/** Keep a head on every turret within reach, drop the far or gone ones (now and then, and after a change). */
export function syncTurrets() {
  const want = new Set<Part>(), p = G.pos;
  if (G.char.loc === 'overworld') for (const c of G.char.claims) {
    if (Math.hypot(nearX(c.x, p.x) - p.x, c.z - p.z) > 260) continue;
    for (const q of c.parts ?? []) if (shapeOf(q) === 'turret') {
      want.add(q);
      const t = live.get(q);
      if (t && Math.abs(t.g.position.x - (nearX(c.x, p.x) + q.gx * C + C / 2)) > 1) drop(t);
      if (!live.has(q)) live.set(q, build(c, q));
    }
  }
  for (const t of [...live.values()]) if (!want.has(t.p)) drop(t);
}
export function clearTurrets() { for (const t of [...live.values()]) drop(t); }

/** Things a turret shoots at: everything hostile except calm Brambles. */
const hostile = (f: Foe) => !('kind' in f && f.kind === 'bramble' && (f as { state?: string }).state === 'roam');
/** Aim point of a foe: the centre of its body. */
const centre = (f: Foe) => f.g.position;

export function updateTurrets(dt: number) {
  if (!live.size) return;
  const all = foes();
  for (const t of live.values()) {
    const on = !t.p.off;
    t.cd -= dt; t.look -= dt;
    const o = t.g.position;
    // keep the target while it lives, is in range and in sight; look for a new one now and then
    if (t.target && (!all.includes(t.target) || centre(t.target).distanceTo(o) > TURRET.range)) t.target = null;
    if (on && t.look <= 0) {
      t.look = 0.3;
      let best: Foe | null = null, bd = TURRET.range;
      for (const f of all) {
        if (!hostile(f)) continue;
        const to = centre(f).clone().sub(o), d = to.length();
        if (d >= bd || d < 0.5) continue;
        if (rayWorld(o, to.normalize(), d) < d - ((f as { r?: number }).r ?? 0.6)) continue;
        best = f; bd = d;
      }
      t.target = best;
    }
    if (!on) t.target = null;
    // turn the head: at the target, or a slow sweep
    let want = t.yaw + dt * 0.4, pitch = 0;
    if (t.target) {
      const to = centre(t.target).clone().sub(o);
      want = Math.atan2(-to.x, -to.z); pitch = Math.atan2(to.y, Math.hypot(to.x, to.z));
    }
    const dy = ((want - t.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (on) t.yaw += Math.max(-TURRET.turn * dt, Math.min(TURRET.turn * dt, dy));
    t.head.rotation.set(on ? pitch : -0.35, t.yaw, 0, 'YXZ');
    // fire once lined up
    if (on && t.target && Math.abs(dy) < 0.12 && t.cd <= 0) {
      t.cd = TURRET.rate;
      const target = t.target, end = centre(target).clone();
      t.muzzle.set(0, 0.02, -0.95).applyEuler(t.head.rotation).add(o);
      addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([t.muzzle.clone(), end]), add(0x9dffe0)), 0.08);
      burst(end, 0xffb347, 6, 0.4);
      makeNoise(o, TURRET.noise);
      const hitFlash = G.hitFlash;
      damageFoe(target, TURRET.dmg);
      G.hitFlash = hitFlash; // the hit marker is for your own shots
    }
  }
}

/** A turret of yours within reach (for E). */
export function nearTurret(): { c: Claim; p: Part } | null {
  if (G.char.loc !== 'overworld') return null;
  for (const t of live.values()) {
    const u = wrapDx(G.pos.x - t.c.x) - (t.p.gx * C + C / 2), v = G.pos.z - t.c.z - (t.p.gz * C + C / 2);
    if (Math.hypot(u, v) < 1.4 && Math.abs(G.pos.y - (t.c.y + floorH(lvOf(t.p)))) < 1.5) return { c: t.c, p: t.p };
  }
  return null;
}
export function toggleTurret(d: { c: Claim; p: Part }) {
  d.p.off = !d.p.off; saveChar();
  const t = live.get(d.p); if (t) drop(t);
  syncTurrets();
  logLine(d.p.off ? 'Turret switched off.' : 'Turret on: it will fire at anything hostile it sees.');
}
