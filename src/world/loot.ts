// XP crystals, pickups, chests, the hatch, and item use.
import * as THREE from 'three';
import { scene, lineMat, add, V, circlePts, edgesOf } from './render';
import { G, W } from '../game';
import { floorNear, floorAt } from '../core/voxel';
import { emptyAt, EYE } from './player';
import { burst, addFx } from './fx';
import { ITEMS, RELIC_KEYS, HEAL, item, type ItemKey } from '../data/items';
import { addItem, gainXp, giveLoot, saveChar, takeOne, progress, progressHas } from '../character';
import { logLine } from '../ui/hud';
import { foes, damageFoe } from './enemies';
import { closePack } from '../ui/backpack';
import { toVillage } from './level';
import { canRecall } from './level';

export interface Crystal { m: THREE.LineSegments; p: THREE.Vector3; v: THREE.Vector3; age: number }
export interface Pickup { g: THREE.Group; k: ItemKey; p: THREE.Vector3; age: number; warned?: boolean }
export interface Chest { g: THREE.Group; lidPivot: THREE.Group; beam: THREE.Line; beamMat: THREE.LineBasicMaterial; i: number; open: boolean; anim: number }
export interface Hatch { g: THREE.Group; rings: THREE.LineLoop[] }

// ---------- XP crystals and drone loot ----------
const crystalGeo = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.14));
const crystalMat = add(0x9dffe0);
export function dropCrystal(at: THREE.Vector3) {
  const m = new THREE.LineSegments(crystalGeo, crystalMat); m.scale.y = 1.6; scene.add(m);
  const v = V(Math.random() - 0.5, 0.3 + Math.random() * 0.4, Math.random() - 0.5).multiplyScalar(4);
  W.crystals.push({ m, p: at.clone(), v, age: 0 });
}
export function dropPickup(at: THREE.Vector3, kind: ItemKey | 'relic') {
  const k: ItemKey = kind === 'relic' ? RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0] : kind;
  const g = new THREE.Group();
  if (k === 'key' || item(k).type === 'relic') {
    const c = k === 'key' ? 0xff7a5c : 0xffd060;
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(0.15, 10)), add(c));
    const bar = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(0.15, 0, 0), V(0.5, 0, 0), V(0.4, 0, 0), V(0.4, -0.1, 0), V(0.5, 0, 0), V(0.5, -0.12, 0)]), add(c));
    if (k === 'key') g.add(ring, bar); else g.add(edgesOf(new THREE.OctahedronGeometry(0.22), add(c)));
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.3, 0), V(0, 3, 0)]), add(c)); g.add(beam);
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0 }); return;
  }
  g.add(edgesOf(new THREE.BoxGeometry(0.3, 0.3, 0.3), add(k === 'medkit' ? 0x9dffe0 : 0x5cc8ff)));
  if (k === 'medkit') { const c = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-0.1, 0, 0.16), V(0.1, 0, 0.16), V(0, -0.1, 0.16), V(0, 0.1, 0.16)]), add(0x9dffe0)); g.add(c); }
  scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0 });
}
/** XP per crystal; scales with danger (dungeon depth). */
export let crystalXp = () => 5 * G.char.depth;
export function setCrystalXp(f: () => number) { crystalXp = f; }

export function updateLoot(dt: number, time: number) {
  const body = V(G.pos.x, G.pos.y + 0.9, G.pos.z);
  for (let i = W.crystals.length - 1; i >= 0; i--) {
    const c = W.crystals[i]; c.age += dt;
    const to = body.clone().sub(c.p), d = to.length();
    if (d < 4.5 && c.age > 0.4) c.v.lerp(to.normalize().multiplyScalar(11), Math.min(1, 8 * dt));
    else c.v.multiplyScalar(Math.max(0, 1 - 3 * dt));
    const np = c.p.clone().addScaledVector(c.v, dt); if (emptyAt(np)) c.p.copy(np); else c.v.set(0, 0, 0);
    c.m.position.copy(c.p); c.m.position.y += Math.sin(time * 4 + i) * 0.06; c.m.rotation.y = time * 3 + i;
    if (d < 0.9) { scene.remove(c.m); W.crystals.splice(i, 1); gainXp(crystalXp()); burst(c.p, 0x9dffe0, 5, 0.3); }
  }
  for (let i = W.pickups.length - 1; i >= 0; i--) {
    const p = W.pickups[i]; p.age += dt;
    { const np = p.p.clone(); np.y -= dt * 4; if (emptyAt(V(np.x, np.y - 0.45, np.z))) p.p.copy(np); } // settles onto the floor
    p.g.position.copy(p.p); p.g.position.y += Math.sin(time * 3 + i) * 0.08; p.g.rotation.y = time * 1.5;
    if (Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z) < 1.3 && Math.abs(p.p.y - body.y) < 2.5 && p.age > 0.4) {
      const where = addItem(p.k);
      if (where) { scene.remove(p.g); W.pickups.splice(i, 1); logLine(ITEMS[p.k].name + ' → backpack'); saveChar(); }
      else if (!p.warned) { p.warned = true; logLine('Backpack full'); }
    }
  }
}

// ---------- chests and the hatch ----------
const goldMat = lineMat(0xffd060);
export function makeChest(c: { x: number; z: number }, i: number): Chest | null {
  const gr = G.grid, f = floorNear(G.space, c.x, c.z, 0, gr.oy + 1, gr.oy + gr.ny - 1); if (!f) return null;
  const g = new THREE.Group(); g.position.set(f[0] + 0.5, f[1], f[2] + 0.5);
  const base = edgesOf(new THREE.BoxGeometry(0.9, 0.5, 0.6), goldMat); base.position.y = 0.25; g.add(base);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
  const lid = edgesOf(new THREE.BoxGeometry(0.9, 0.18, 0.6), goldMat); lid.position.set(0, 0.09, 0.3); lidPivot.add(lid);
  const beamMat = add(0xffd060);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.6, 0), V(0, 5, 0)]), beamMat);
  g.add(beam); g.rotation.y = (i * 1.7) % 6.28; scene.add(g);
  return { g, lidPivot, beam, beamMat, i, open: progressHas('opened', i), anim: 0 };
}
export function openChest(c: Chest) {
  const depth = G.char.depth;
  c.open = true; c.anim = 0.001; progress('opened').push(c.i);
  const gold = (15 + Math.floor(Math.random() * 26)) * depth;
  G.char.gold += gold; logLine('+' + gold + ' gold');
  if (Math.random() < 0.65) giveLoot(RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0]);
  if (Math.random() < 0.5) giveLoot('medkit');
  if (Math.random() < 0.25) giveLoot('emp');
  if (Math.random() < 0.2) giveLoot('key');
  burst(c.g.position.clone().add(V(0, 0.7, 0)), 0xffd060, 30, 1.3);
  gainXp(20 * depth); saveChar();
}
export function makeHatch(h: { x: number; z: number }): Hatch | null {
  const gr = G.grid, f = floorAt(G.space, h.x, h.z, gr.oy + 1, gr.oy + gr.ny - 1); if (!f) return null;
  const g = new THREE.Group(); g.position.set(f[0] + 0.5, f[1] + 0.02, f[2] + 0.5);
  const rings: THREE.LineLoop[] = [];
  for (let i = 0; i < 4; i++) {
    const s = 1.8 - i * 0.35;
    const sq = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(-s / 2, 0, -s / 2), V(s / 2, 0, -s / 2), V(s / 2, 0, s / 2), V(-s / 2, 0, s / 2)]), add(0xe8fff0));
    g.add(sq); rings.push(sq);
  }
  scene.add(g); return { g, rings };
}

// ---------- item use ----------
export function useItem(k: ItemKey): boolean {
  const heal = HEAL[k];
  if (heal) {
    if (G.hp >= G.S.maxHp) { logLine('HP already full'); return false; }
    if (!takeOne(k)) { logLine('None left: ' + ITEMS[k].name); return false; }
    G.hp = Math.min(G.S.maxHp, G.hp + heal); logLine('+' + heal + ' HP'); return true;
  }
  if (k === 'recall') {
    if (!canRecall()) { logLine('You are already in the village'); return false; }
    if (G.trans || !takeOne(k)) return false;
    closePack();
    const here = V(G.pos.x, G.pos.y + EYE, G.pos.z);
    G.trans = { phase: 'out', t: 0, dur: 1.2, st: {}, pts: [here, here.clone().add(V(0, 0.8, 0))], yaw0: G.yaw, yaw1: G.yaw, p0: G.pitch, p1: G.pitch + 0.8, go: () => toVillage('recall') };
    logLine('The beacon hums...'); return true;
  }
  if (k === 'emp') {
    if (!takeOne(k)) { logLine('No EMP charges'); return false; }
    const c = V(G.pos.x, G.pos.y + 1, G.pos.z);
    for (let i = 0; i < 3; i++) {
      const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(2 + i * 2, 40)), add(0x5cc8ff));
      ring.rotation.x = Math.PI / 2; ring.position.copy(c); addFx(ring, 0.4 + i * 0.15);
    }
    let n = 0; for (const t of foes()) if (t.p.distanceTo(c) < 6 + (t.boss ? 1 : 0)) { damageFoe(t, (t.boss ? 6 : 3) * G.S.bm); n++; }
    logLine('EMP hit drones: ' + n); return true;
  }
  return false;
}
