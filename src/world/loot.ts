// XP crystals, pickups, chests, the hatch, and item use.
import { environmentalDamage } from './damage';
import * as THREE from 'three';
import { fitFilter } from './toxic';
import { PropBatch } from './props';
import { chestBase, chestLid } from './chestmodel';
import { scene, add, V, circlePts, edgesOf } from './render';
import { G, W } from '../game';
import { floorNear, floorAt } from '../core/voxel';
import { emptyAt, EYE } from './player';
import { burst, addFx } from './fx';
import { ITEMS, RELIC_KEYS, ATTACH_KEYS, HEAL, BULK, item, type ItemKey } from '../data/items';
import { addItem, gainXp, saveChar, takeOne, progress, progressHas, dungeonKey, depth as depthNow } from '../character';
import { putItems } from '../inventory';
import { openTransfer } from '../ui/transfer';
import type { Container, Slot } from '../save';
import { logLine } from '../ui/hud';
import { foes, damageFoe } from './enemies';
import { closePack } from '../ui/backpack';
import { onPickup } from './quests';
import { toVillage } from './level';
import { NOURISH, RAW_SICK, FOOD_COLOR, STOMACH, cantEat } from '../data/survival';
import { nourish } from './survival';
import { makeNoise } from './noise';
import { canRecall } from './level';
import { lightFire } from './cooking';
import { placeBench } from './benches';
import { startPlacing } from './claims';
import { startBridgePlacing } from './bridges';
import { startPierPlacing } from './piers';
import { BASES_OPEN, BASES_CLOSED_MSG } from '../data/building';
import { lyingModel } from './pickmodels';
import { vehicles, driving, refreshParts } from './vehicles';
import { repairWithKit, vehicleTitle } from '../data/vehicles';

export interface Crystal { m: THREE.LineSegments; p: THREE.Vector3; v: THREE.Vector3; age: number }
/** `rest`: it lies on the ground as what it is (world/pickmodels.ts) instead of floating and spinning as a token. */
/**
 * `drop`: put down by a player (world/drops.ts): it waits for E instead of being picked up by walking over it; `c` the
 * condition of a worn part, `by` who put it down, `taking` when you last asked the server for it.
 */
export interface Pickup { g: THREE.Group; k: ItemKey; p: THREE.Vector3; age: number; warned?: boolean; rest?: boolean; n?: number; drop?: string; c?: number; by?: string; taking?: number; auto?: boolean }
export interface Chest { g: THREE.Group; lidPivot: THREE.Group; beam: THREE.Line; beamMat: THREE.LineBasicMaterial; i: number; open: boolean; anim: number }
export interface Hatch { g: THREE.Group; rings: THREE.LineLoop[] }

// ---------- XP crystals and drone loot ----------
const crystalGeo = new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.14));
const crystalMat = add(0x9dffe0);
// In multiplayer what falls to the ground is everyone's: `setGroundHook` (world/drops.ts) hands it to the server, which
// shows it to all and gives it to whoever reaches it first. `quietLoot` drops nothing (another player's kill of your foe:
// their game drops the loot and the crystals).
let ground: ((at: THREE.Vector3, k: ItemKey, n: number) => boolean) | null = null, quiet = 0;
let autoTake: (p: Pickup) => void = () => {};
export function setGroundHook(f: typeof ground, take: (p: Pickup) => void) { ground = f; autoTake = take; }
export function quietLoot(fn: () => void) { quiet++; try { fn(); } finally { quiet--; } }
/** True while a kill's rewards belong to another player (see `quietLoot`). */
export const lootQuiet = () => quiet > 0;
export function dropCrystal(at: THREE.Vector3) {
  if (quiet) return;
  const m = new THREE.LineSegments(crystalGeo, crystalMat); m.scale.y = 1.6; scene.add(m);
  const v = V(Math.random() - 0.5, 0.3 + Math.random() * 0.4, Math.random() - 0.5).multiplyScalar(4);
  W.crystals.push({ m, p: at.clone(), v, age: 0 });
}
export function dropPickup(at: THREE.Vector3, kind: ItemKey | 'relic', n = 1): Pickup {
  const k: ItemKey = kind === 'relic' ? RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0] : kind;
  // nothing (quiet), or the server's (online): not drawn here, the server's copy comes back for everyone
  if (quiet || (item(k).type !== 'quest' && ground?.(at, k, n))) return { g: new THREE.Group(), k, p: at.clone(), age: 0, n };
  return drawPickup(at, k, n);
}
/** Draw a pickup lying here (also the server's: world/drops.ts). */
export function drawPickup(at: THREE.Vector3, k: ItemKey, n = 1): Pickup {
  const g = new THREE.Group();
  if (k === 'key' || item(k).type === 'relic' || item(k).type === 'quest') {
    const c = k === 'key' ? 0xff7a5c : 0xffd060;
    const ring = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(0.15, 10)), add(c));
    const bar = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(0.15, 0, 0), V(0.5, 0, 0), V(0.4, 0, 0), V(0.4, -0.1, 0), V(0.5, 0, 0), V(0.5, -0.12, 0)]), add(c));
    if (k === 'key') g.add(ring, bar); else g.add(edgesOf(new THREE.OctahedronGeometry(0.22), add(c)));
    const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.3, 0), V(0, 3, 0)]), add(c)); g.add(beam);
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0, n }); return W.pickups[W.pickups.length - 1];
  }
  const lying = lyingModel(k, item(k).type);
  if (lying) { // logs, teeth, hides, scrap...: lying on the ground, turned any which way
    g.add(lying); g.rotation.y = Math.random() * 6.283;
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0, rest: true, n }); return W.pickups[W.pickups.length - 1];
  }
  if (NOURISH[k] || item(k).type === 'mat') { // food (lime) and materials (bone): a small faceted lump
    g.add(edgesOf(new THREE.DodecahedronGeometry(0.18), add(NOURISH[k] ? FOOD_COLOR : 0xe8e0c0)));
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0, n }); return W.pickups[W.pickups.length - 1];
  }
  if (item(k).type === 'ammo') { // a box of rounds: a small brass-coloured case
    g.add(edgesOf(new THREE.BoxGeometry(0.28, 0.14, 0.18), add(0xffd060)), edgesOf(new THREE.BoxGeometry(0.24, 0.02, 0.14).translate(0, 0.08, 0), add(0xffd060)));
    scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0, n }); return W.pickups[W.pickups.length - 1];
  }
  g.add(edgesOf(new THREE.BoxGeometry(0.3, 0.3, 0.3), add(k === 'medkit' ? 0x9dffe0 : 0x5cc8ff)));
  if (k === 'medkit') { const c = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints([V(-0.1, 0, 0.16), V(0.1, 0, 0.16), V(0, -0.1, 0.16), V(0, 0.1, 0.16)]), add(0x9dffe0)); g.add(c); }
  scene.add(g); W.pickups.push({ g, k, p: at.clone(), age: 0, n }); return W.pickups[W.pickups.length - 1];
}
/** Where a lying pickup meets the ground: the terrain under it, or the voxel floor it settled over (tokens hover ~0.47 m up). */
function restY(p: THREE.Vector3): number {
  const g = G.ground ? G.ground(p.x, p.z) : -Infinity;
  return Number.isFinite(g) && g <= p.y + 0.1 && g > p.y - 1.5 ? g : p.y - 0.47;
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
    if (p.rest) p.g.position.set(p.p.x, restY(p.p), p.p.z);
    else { p.g.position.copy(p.p); p.g.position.y += Math.sin(time * 3 + i) * 0.08; p.g.rotation.y = time * 1.5; }
    if (p.drop && p.auto && Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z) < 1.3 && Math.abs(p.p.y - body.y) < 2.5 && p.age > 0.4) autoTake(p); // the server's loot
    else if (!p.drop && Math.hypot(p.p.x - G.pos.x, p.p.z - G.pos.z) < 1.3 && Math.abs(p.p.y - body.y) < 2.5 && p.age > 0.4) {
      if (!grabPickup(p) && !p.warned) { p.warned = true; logLine('No room in your backpack'); }
    }
  }
}
/** Takes a pickup that is not a shared drop (loot, relics, keys) into your kit. False if there is no room. */
export function grabPickup(p: Pickup): boolean {
  const where = addItem(p.k, p.n ?? 1), i = W.pickups.indexOf(p);
  if (!where) return false;
  scene.remove(p.g); if (i >= 0) W.pickups.splice(i, 1);
  logLine(ITEMS[p.k].name + ((p.n ?? 1) > 1 ? ' ×' + p.n : '') + (where === 'hands' ? ' (in your hands)' : where === 'back' ? ' (on your back)' : ' → backpack')); saveChar();
  if (item(p.k).type === 'quest') onPickup(p.k);
  return true;
}

// ---------- chests and the hatch ----------
export function makeChest(c: { x: number; z: number }, i: number): Chest | null {
  const gr = G.grid, f = floorNear(G.space, c.x, c.z, 0, gr.oy + 1, gr.oy + gr.ny - 1); if (!f) return null;
  const g = new THREE.Group(); g.position.set(f[0] + 0.5, f[1], f[2] + 0.5);
  const base = new PropBatch(); chestBase(base); g.add(base.build());
  const lidPivot = new THREE.Group(); lidPivot.position.set(0, 0.5, -0.3); g.add(lidPivot);
  const lid = new PropBatch(); chestLid(lid); lidPivot.add(lid.build());
  const beamMat = add(0xffd060);
  const beam = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0.6, 0), V(0, 5, 0)]), beamMat);
  g.add(beam); g.rotation.y = (i * 1.7) % 6.28; scene.add(g);
  return { g, lidPivot, beam, beamMat, i, open: progressHas('opened', i), anim: 0 };
}
/** Save key of a chest's contents in the current dungeon sector. */
export const chestKey = (c: Chest) => 'chest:' + dungeonKey() + ':' + c.i;
export const chestContents = (c: Chest): Container | undefined => G.char.containers[chestKey(c)];

/** A handful of rounds of some kind (loot): energy cells most often, then pistol rounds, shells, rifle rounds. */
export function rollAmmo(scale = 1): [ItemKey, number] {
  const r = Math.random(), f = (lo: number, hi: number) => Math.max(1, Math.round((lo + Math.random() * (hi - lo)) * scale));
  return r < 0.4 ? ['ammoE', f(15, 40)] : r < 0.7 ? ['ammo9', f(12, 30)] : r < 0.85 ? ['ammoS', f(5, 12)] : ['ammoR', f(4, 10)];
}
/** Guns and melee weapons that turn up as loot (the Blaster and the energy blade are the ship's own). */
export const LOOT_GUNS: ItemKey[] = ['pistol', 'smg', 'shotgun', 'rifle'], LOOT_MELEE: ItemKey[] = ['machete', 'spear', 'sledge'];
const pick = <T,>(a: T[]) => a[(Math.random() * a.length) | 0];
/** What a chest holds, rolled once when it is first opened and saved from then on. */
function rollChest(): Container {
  const depth = depthNow(), items: (Slot | null)[] = Array(8).fill(null);
  const add = (k: ItemKey) => putItems(items, k, 1);
  if (Math.random() < 0.65) add(RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0]);
  if (Math.random() < 0.5) add('medkit');
  if (Math.random() < 0.25) add('emp');
  if (Math.random() < 0.2) add('key');
  if (Math.random() < 0.15) add(ATTACH_KEYS[(Math.random() * ATTACH_KEYS.length) | 0]);
  if (Math.random() < 0.5) { const [k, n] = rollAmmo(0.7 + depth * 0.3); putItems(items, k, n); }
  if (Math.random() < 0.07) add(pick(LOOT_GUNS)); else if (Math.random() < 0.07) add(pick(LOOT_MELEE));
  if (G.map?.style === 'ship') { // a freighter's lockers: salvage and ship's stores
    putItems(items, 'scrap', 1 + Math.floor(Math.random() * 3));
    if (Math.random() < 0.6) putItems(items, 'circuit', 1 + Math.floor(Math.random() * 2));
    if (Math.random() < 0.12) putItems(items, 'pcore', 1);
    if (Math.random() < 0.4) putItems(items, 'bread', 1 + Math.floor(Math.random() * 2));
    if (Math.random() < 0.25) putItems(items, Math.random() < 0.5 ? 'engine' : 'plating', 1);
    if (Math.random() < 0.5) putItems(items, 'ammoE', 10 + Math.floor(Math.random() * 30)); // the crew's cell lockers
    if (Math.random() < 0.15) putItems(items, 'repairkit', 1);
  }
  return { items, gold: (15 + Math.floor(Math.random() * 26)) * depth };
}
export function openChest(c: Chest) {
  if (!c.open) {
    c.open = true; c.anim = 0.001; progress('opened').push(c.i);
    G.char.containers[chestKey(c)] = rollChest();
    burst(c.g.position.clone().add(V(0, 0.7, 0)), 0xffd060, 30, 1.3);
    gainXp(20 * depthNow()); saveChar();
  }
  // a chest opened before chests kept their contents is empty, but it still holds whatever you put in
  const box = chestContents(c) ?? (G.char.containers[chestKey(c)] = { items: Array(8).fill(null), gold: 0 });
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
    const kcal = food.kcal ?? 0, kg = kcal ? BULK[k][0] : 0; // food fills the stomach by its weight; drinks do not
    if (kcal) {
      const no = cantEat(kg, c.kcal, c.stomach);
      if (no === 'sated') { logLine('You are not hungry.'); return false; }
      if (no === 'full') { logLine(`Your stomach is full. Wait until you have digested a little (${(STOMACH.cap - c.stomach).toFixed(1)} of ${STOMACH.cap} kg free, this weighs ${kg} kg).`); return false; }
    }
    if ((food.water ?? 0) > 0 && !kcal && c.water >= 99) { logLine('You are not thirsty.'); return false; }
    if (!takeOne(k)) { logLine('None left: ' + ITEMS[k].name); return false; }
    nourish(kcal, food.water ?? 0, food.hp ?? 0, kg);
    if (k === 'waterF' || k === 'waterM') {
      addItem('flask'); // the flask is kept
      if (k === 'waterM' && Math.random() < 0.35) { environmentalDamage(8); G.dmgFlash = 0.4; logLine('The murky water turns your stomach. -8 HP'); }
    }
    if (k === 'meatR' && Math.random() < RAW_SICK.chance) { environmentalDamage(RAW_SICK.hp); G.dmgFlash = 0.4; logLine(`The raw meat makes you sick. -${RAW_SICK.hp} HP`); }
    return true;
  }
  if (k === 'filter') return fitFilter('');
  if (k === 'repairkit') return useRepairKit();
  if (k === 'firekit') return lightFire();
  if (k === 'pierkit') { if (startPierPlacing()) closePack(); return false; } // used up when the pier is staked out
  if (k === 'bridgekit') { if (startBridgePlacing()) closePack(); return false; } // used up when the site is staked out
  if (k === 'flagpole' && !BASES_OPEN) { logLine(BASES_CLOSED_MSG); return false; }
  if (k === 'flagpole') { if (startPlacing()) { closePack(); } return false; } // the flag is used up once raised
  if (k === 'benchkit' && !BASES_OPEN) { logLine('Setting up a workbench in the wilds is closed for now: use a village blacksmith\'s forge.'); return false; }
  if (k === 'benchkit') { if (placeBench()) { closePack(); return true; } return false; }
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
    for (let i = 0; i < 2; i++) if (Math.random() < 0.6) { const [k, n] = rollAmmo(); add(k, n); } // the bandits' own rounds
    if (Math.random() < 0.18) add(pick(LOOT_GUNS)); else if (Math.random() < 0.12) add(pick(LOOT_MELEE));
    c.containers[key] = { items, gold: 40 + Math.floor(Math.random() * 90) };
    saveChar();
  }
  openTransfer({ title: 'Bandit stash', subtitle: name, boxLabel: 'Inside', box: c.containers[key] });
}

/** The Vehicle Repair Kit on the vehicle you drive or the nearest of yours within 7 m. */
function useRepairKit(): boolean {
  let v = driving.v, best = 49;
  if (!v) for (const u of vehicles) {
    if (!u.claimed || u.ai) continue;
    const d = (u.st.x - G.pos.x) ** 2 + (u.st.z - G.pos.z) ** 2;
    if (d < best) { best = d; v = u; }
  }
  if (!v) { logLine('Stand by one of your vehicles to use the repair kit.'); return false; }
  const name = vehicleTitle(v.st.model);
  const probe = structuredClone(v.st.parts);
  if (!repairWithKit(v.st.model, probe)) { logLine(`The ${name} needs no patching.`); return false; }
  if (!takeOne('repairkit')) return false;
  const did = repairWithKit(v.st.model, v.st.parts);
  refreshParts(v); saveChar();
  logLine(`Patched up the ${name}: ${did}.`);
  return true;
}
