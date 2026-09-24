// XP crystals, pickups, chests, the hatch, and item use.
import * as THREE from 'three';
import { scene, lineMat, add, V, circlePts, edgesOf, fillMat } from './render';
import { G, W } from '../game';
import { floorNear, floorAt } from '../core/voxel';
import { emptyAt, EYE } from './player';
import { burst, addFx } from './fx';
import { ITEMS, RELIC_KEYS, ATTACH_KEYS, HEAL, item, type ItemKey } from '../data/items';
import { addItem, gainXp, saveChar, takeOne, progress, progressHas, dungeonKey, depth as depthNow } from '../character';
import { putItems } from '../inventory';
import { openTransfer } from '../ui/transfer';
import type { Container, Slot } from '../save';
import { logLine } from '../ui/hud';
import { foes, damageFoe } from './enemies';
import { closePack } from '../ui/backpack';
import { onPickup } from './quests';
import { toVillage } from './level';
import { NOURISH, RAW_SICK, FOOD_COLOR } from '../data/survival';
import { nourish } from './survival';
import { makeNoise } from './noise';
import { canRecall } from './level';
import { lightFire } from './cooking';

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
  if (k === 'key' || item(k).type === 'relic' || item(k).type === 'quest') {
    const c = k === 'key' ? 0xff7a5c : 0xffd060;
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(0.15, 10)), add(c));
    const bar = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(0.15, 0, 0), V(0.5, 0, 0), V(0.4, 0, 0), V(0.4, -0.1, 0), V(0.5, 0, 0), V(0.5, -0.12, 0)]), add(c));
    if (k === 'key') g.add(ring, bar); else g.add(edgesOf(new THREE.OctahedronGeometry(0.22), add(c)));
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.3, 0), V(0, 3, 0)]), add(c)); g.add(beam);
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0 }); return;
  }
  if (NOURISH[k] || item(k).type === 'mat') { // food (lime) and materials (bone): a small faceted lump
    g.add(edgesOf(new THREE.DodecahedronGeometry(0.18), add(NOURISH[k] ? FOOD_COLOR : 0xe8e0c0)));
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0 }); return;
  }
  g.add(edgesOf(new THREE.BoxGeometry(0.3, 0.3, 0.3), add(k === 'medkit' ? 0x9dffe0 : 0x5cc8ff)));
  if (k === 'medkit') { const c = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-0.1, 0, 0.16), V(0.1, 0, 0.16), V(0, -0.1, 0.16), V(0, 0.1, 0.16)]), add(0x9dffe0)); g.add(c); }
  scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0 });
}
/** XP per crystal; scales with danger (dungeon depth). */
export let crystalXp = () => 5 * depthNow();
export function setCrystalXp(f: () => number) { crystalXp = f; }

export function updateLoot(dt: number, time: number) {
  const body = V(G.pos.x, G.pos.y + 0.9, G.pos.z);
  for (let i = W.crystals.length - 1; i >= 0; i--) {
    const c = W.crystals[i]; c.age += dt;
    const to = body.clone().sub(c.p), d = to.length();
    if (d < 4.5 && c.age > 0.4) c.v.lerp(to.normalize().multiplyScalar(11), Math.min(1, 8 * dt));
    else c.v.multiplyScalar(Math.max(0, 1 - 3 * dt));
    // fall until hovering just above the floor (crystals from flyers would otherwise hang in the air)
    if (!(d < 4.5 && c.age > 0.4) && emptyAt(V(c.p.x, c.p.y - 0.6, c.p.z))) c.v.y -= 14 * dt;
    else if (c.v.y < 0 && !(d < 4.5 && c.age > 0.4)) c.v.y = 0;
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
      if (where) { scene.remove(p.g); W.pickups.splice(i, 1); logLine(ITEMS[p.k].name + ' → backpack'); saveChar(); if (item(p.k).type === 'quest') onPickup(p.k); }
      else if (!p.warned) { p.warned = true; logLine('Backpack full'); }
    }
  }
}

// ---------- chests and the hatch ----------
const goldMat = lineMat(0xffd060), chestFill = fillMat(0x0d0a02);
const chestBase = new THREE.BoxGeometry(0.9, 0.5, 0.6), chestLid = new THREE.BoxGeometry(0.9, 0.18, 0.6);
/** Chest part: a dark solid box with gold edges. */
const chestPart = (g: THREE.BoxGeometry) => { const o = new THREE.Group(); o.add(new THREE.Mesh(g, chestFill), edgesOf(g, goldMat)); return o; };
export function makeChest(c: { x: number; z: number }, i: number): Chest | null {
  const gr = G.grid, f = floorNear(G.space, c.x, c.z, 0, gr.oy + 1, gr.oy + gr.ny - 1); if (!f) return null;
  const g = new THREE.Group(); g.position.set(f[0] + 0.5, f[1], f[2] + 0.5);
  const base = chestPart(chestBase); base.position.y = 0.25; g.add(base);
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
  const lid = chestPart(chestLid); lid.position.set(0, 0.09, 0.3); lidPivot.add(lid);
  const beamMat = add(0xffd060);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.6, 0), V(0, 5, 0)]), beamMat);
  g.add(beam); g.rotation.y = (i * 1.7) % 6.28; scene.add(g);
  return { g, lidPivot, beam, beamMat, i, open: progressHas('opened', i), anim: 0 };
}
/** Save key of a chest's contents in the current dungeon sector. */
export const chestKey = (c: Chest) => 'chest:' + dungeonKey() + ':' + c.i;
export const chestContents = (c: Chest): Container | undefined => G.char.containers[chestKey(c)];
/** Items still inside (a chest can be left half-emptied and searched again later). */
export const chestHasLoot = (c: Chest) => { const b = chestContents(c); return !!b && (b.gold > 0 || b.items.some(Boolean)); };

/** What a chest holds, rolled once when it is first opened and saved from then on. */
function rollChest(): Container {
  const depth = depthNow(), items: (Slot | null)[] = Array(8).fill(null);
  const add = (k: ItemKey) => putItems(items, k, 1);
  if (Math.random() < 0.65) add(RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0]);
  if (Math.random() < 0.5) add('medkit');
  if (Math.random() < 0.25) add('emp');
  if (Math.random() < 0.2) add('key');
  if (Math.random() < 0.15) add(ATTACH_KEYS[(Math.random() * ATTACH_KEYS.length) | 0]);
  return { items, gold: (15 + Math.floor(Math.random() * 26)) * depth };
}
export function openChest(c: Chest) {
  if (!c.open) {
    c.open = true; c.anim = 0.001; progress('opened').push(c.i);
    G.char.containers[chestKey(c)] = rollChest();
    burst(c.g.position.clone().add(V(0, 0.7, 0)), 0xffd060, 30, 1.3);
    gainXp(20 * depthNow()); saveChar();
  }
  const box = chestContents(c);
  if (!box) return; // opened before chests kept their contents: it is empty
  openTransfer({ title: 'Chest', subtitle: 'Depth ' + depthNow(), boxLabel: 'Inside', box });
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
    G.hp = Math.min(G.S.maxHp, G.hp + heal); logLine('+' + heal + ' HP');
    return true;
  }
  const food = NOURISH[k];
  if (food) {
    const c = G.char;
    if ((food.food ?? 0) > 0 && !(food.water ?? 0) && c.food >= 99) { logLine('You are not hungry.'); return false; }
    if ((food.water ?? 0) > 0 && !(food.food ?? 0) && c.water >= 99) { logLine('You are not thirsty.'); return false; }
    if (!takeOne(k)) { logLine('None left: ' + ITEMS[k].name); return false; }
    nourish(food.food ?? 0, food.water ?? 0, food.hp ?? 0);
    if (k === 'waterF' || k === 'waterM') {
      addItem('flask'); // the flask is kept
      if (k === 'waterM' && Math.random() < 0.35) { G.hp -= 8; G.dmgFlash = 0.4; logLine('The murky water turns your stomach. -8 HP'); }
    }
    if (k === 'meatR' && Math.random() < RAW_SICK.chance) { G.hp -= RAW_SICK.hp; G.dmgFlash = 0.4; logLine(`The raw meat makes you sick. -${RAW_SICK.hp} HP`); }
    return true;
  }
  if (k === 'firekit') return lightFire();
  if (k === 'flask') { logLine('It is empty. Fill it at a well or a lake (E at the water).'); return false; }
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
    makeNoise(c, 35);
    logLine('EMP hit drones: ' + n); return true;
  }
  return false;
}

/** A bandit stash: rolled once (saved as a container) and then keeps whatever you leave. */
export function openStash(id: number, name: string) {
  const key = 'camp:' + id, c = G.char;
  if (!c.containers[key]) {
    const items: (Slot | null)[] = Array(8).fill(null), add = (k: ItemKey, n = 1) => putItems(items, k, n);
    add('medkit', 1 + Math.floor(Math.random() * 2));
    if (Math.random() < 0.5) add('emp');
    if (Math.random() < 0.3) add('key');
    if (Math.random() < 0.25) add(RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0]);
    if (Math.random() < 0.25) add('wheelL');
    if (Math.random() < 0.2) add('engine');
    if (Math.random() < 0.2) add(ATTACH_KEYS[(Math.random() * ATTACH_KEYS.length) | 0]);
    c.containers[key] = { items, gold: 40 + Math.floor(Math.random() * 90) };
    saveChar();
  }
  openTransfer({ title: 'Bandit stash', subtitle: name, boxLabel: 'Inside', box: c.containers[key] });
}
