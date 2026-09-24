// NPC caravans on the roads near the player (the timetable is gen/caravans.ts): trucks with a canvas-covered bed,
// crates showing at the back, rolling along the road one behind the other. They are only drawn near the player;
// where they are follows from the game time alone, so they are where they should be whenever you look. Solid to
// walk into; E at a wagon talks to the caravan master (ui/caravan.ts).
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { network, regionRoads, type Road, type Edge } from '../gen/roads';
import { regionOf } from '../gen/regions';
import { onRoad, caravanS, caravanOf, escortPay, CONVOY, type Caravan } from '../gen/caravans';
import { convoyModel } from './vehicles';
import { VEHICLES } from '../data/vehicles';
import { placeRoadblock, barriersNear, hurtBarrier, type Barricade } from './raiders';
import { fallBandit } from './bandits';
import { burst, addFx } from './fx';
import { add } from './render';
import { makeNoise } from './noise';
import { spawnBandit, alert, type Bandit } from './bandits';
import { danger } from './overworld';
import { mayspawn, BANDIT_COST } from './threat';
import { gainXp, saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { findPoi, worldDist } from '../gen/regions';

const DRAW_R = 420;
/** Half length and half width of each vehicle of the convoy (for bumping into it). */
const SIZE = CONVOY.map((v) => ({ hl: VEHICLES[v.model].length / 2, hw: VEHICLES[v.model].width / 2 }));
/** The jeeps' roof cannons: reach, time between shots, damage to bandits and to barricades. */
export const CONVOY_GUN = { range: 42, rate: 1.4, dmg: 1.2, barrier: 0.8 };
/**
 * What happens to a caravan while you are near it (not saved: it only matters while you watch): how long it has
 * been held up (it stands still while bandits are on it, and then rolls on that much behind its timetable), the
 * wagons' health, the bandits of a raid on it, and whether its raid roll has been made.
 */
interface Live { delay: number; hp: number; raid: Bandit[]; rolled: boolean; raids: number; raidNear: boolean }
const live = new Map<string, Live>();
const liveOf = (id: string) => { let l = live.get(id); if (!l) { l = { delay: 0, hp: 100, raid: [], rolled: false, raids: 0, raidNear: false }; live.set(id, l); } return l; };
/** A caravan the bandits have plundered stays gone (saved). */
export const plundered = (id: string) => !!G.char.caravans['lost:' + id];
/** How much the drovers knock off their prices for you after you saved them from a raid. */
export const savedBy = (id: string) => !!G.char.caravans['saved:' + id];
export const CARAVAN_RAID = { chance: 0.12, perDanger: 0.04, minDanger: 1.2, drain: 0.45, radius: 45 };
interface Wagon { c: Caravan; w: number; road: Road; g: THREE.Group; turret: THREE.Group | null; x: number; z: number; yaw: number; cool: number }
const wagons = new Map<string, Wagon>();
let scanT = 0;
const edgeByKey = new Map<string, Edge>();
let edgeWorld = -1;
/** Point and heading at arc length s along a polyline. */
function along(pts: [number, number][], s: number): [number, number, number] {
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], L = Math.hypot(bx - ax, bz - az);
    if (s <= L || i + 2 === pts.length) { const t = L ? Math.min(1, s / L) : 0; return [ax + (bx - ax) * t, az + (bz - az) * t, Math.atan2(bx - ax, bz - az)]; }
    s -= L;
  }
  return [pts[0][0], pts[0][1], 0];
}
const lengthOf = (pts: [number, number][]) => { let L = 0; for (let i = 0; i + 1 < pts.length; i++) L += Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]); return L; };

/** Once a frame in the open world: find the caravans on the roads nearby (twice a second) and move their wagons. */
export function updateCaravans(dt: number) {
  const T = OW.terrain;
  if (!T || G.char.loc !== 'overworld') { clearCaravans(); return; }
  const world = T.world, now = G.char.time;
  if (edgeWorld !== world) { edgeByKey.clear(); for (const e of network(world)) edgeByKey.set('road:' + e.key, e); edgeWorld = world; }
  if ((scanT -= dt) <= 0) {
    scanT = 0.5;
    const [rx, rz] = regionOf(G.pos.x, G.pos.z), seen = new Set<string>();
    for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) for (const road of regionRoads(world, rx + i, rz + j)) {
      const e = edgeByKey.get(road.id);
      if (!e) continue;
      for (const c of onRoad(world, e, now)) if (!plundered(c.id)) for (let w = 0; w < c.wagons; w++) {
        const key = c.id + ':' + w;
        if (seen.has(key)) continue;
        seen.add(key);
        if (!wagons.has(key)) {
          const spec = CONVOY[w], m = convoyModel(spec.model, spec.gun), g = new THREE.Group();
          g.add(m.g); g.visible = false; scene.add(g);
          wagons.set(key, { c, w, road, g, turret: m.turret, x: 0, z: 0, yaw: 0, cool: Math.random() });
        }
      }
    }
    for (const [k, wg] of wagons) if (!seen.has(k)) { scene.remove(wg.g); wagons.delete(k); }
    const ids = new Set([...wagons.values()].map((w) => w.c.id));
    for (const id of [...live.keys()]) if (!ids.has(id) && !live.get(id)!.raid.length) live.delete(id);
    raids(0.5);
  }
  escortTick(dt);
  for (const wg of wagons.values()) {
    const lv = live.get(wg.c.id), pts = wg.road.pts, L = lengthOf(pts), s = Math.min(L, caravanS(wg.c, now - (lv?.delay ?? 0), wg.w));
    let [x, z, yaw] = along(pts, wg.c.back ? L - s : s);
    if (wg.c.back) yaw += Math.PI;
    // keep to the right of the road
    x += Math.cos(yaw) * -1.2; z += -Math.sin(yaw) * -1.2;
    wg.x = x; wg.z = z; wg.yaw = yaw;
    const near = Math.hypot(x - G.pos.x, z - G.pos.z) < DRAW_R;
    wg.g.visible = near;
    if (!near) continue;
    const fx = Math.sin(yaw), fz = Math.cos(yaw), hf = T.heightAt(x + fx * 2.5, z + fz * 2.5), hb = T.heightAt(x - fx * 2.5, z - fz * 2.5);
    // a wagon rolling into you shoves you aside
    const dx = G.pos.x - x, dz = G.pos.z - z, u = dx * fx + dz * fz, v = dx * fz - dz * fx, { hl, hw } = SIZE[wg.w];
    if (Math.abs(u) < hl + 0.3 && Math.abs(v) < hw + 0.3 && G.pos.y < (hf + hb) / 2 + 3.5) { const push = (v < 0 ? -1 : 1) * (hw + 0.35) - v; G.pos.x += fz * push; G.pos.z -= fx * push; }
    if (wg.turret) aimGun(wg, dt);
    wg.g.position.set(x, (hf + hb) / 2, z); wg.g.rotation.set(0, 0, 0); wg.g.rotateY(yaw); wg.g.rotateX(-Math.atan2(hf - hb, 5));
  }
}
export function clearCaravans() { for (const wg of wagons.values()) scene.remove(wg.g); wagons.clear(); }
/** Solid: the wagons (an oriented box each). */
export function caravanHit(x: number, y: number, z: number, r: number): boolean {
  for (const wg of wagons.values()) {
    if (!wg.g.visible || Math.abs(x - wg.x) > 6 || Math.abs(z - wg.z) > 6) continue;
    const dx = x - wg.x, dz = z - wg.z, fx = Math.sin(wg.yaw), fz = Math.cos(wg.yaw);
    const u = dx * fx + dz * fz, v = dx * fz - dz * fx;
    if (Math.abs(u) < SIZE[wg.w].hl + r && Math.abs(v) < SIZE[wg.w].hw + r && y < wg.g.position.y + 3.5) return true;
  }
  return false;
}
/** The caravan whose wagon you stand next to. */
export function nearCaravan(): Caravan | null {
  for (const wg of wagons.values()) {
    if (!wg.g.visible) continue;
    const dx = G.pos.x - wg.x, dz = G.pos.z - wg.z, fx = Math.sin(wg.yaw), fz = Math.cos(wg.yaw);
    if (Math.abs(dx * fx + dz * fz) < SIZE[wg.w].hl + 3 && Math.abs(dx * fz - dz * fx) < SIZE[wg.w].hw + 3.5) return wg.c;
  }
  return null;
}
/** Where the wagons near the player are (for debugging and the maps). */
export const wagonSpots = () => [...wagons.values()].filter((w) => w.g.visible).map((w) => ({ x: w.x, z: w.z, c: w.c }));

// ---------- raids ----------
/** The lead wagon of a caravan near you. */
const leadOf = (id: string) => [...wagons.values()].find((w) => w.c.id === id && w.w === 0);
function startRaid(c: Caravan, l: Live, lv: number) {
  const lead = leadOf(c.id);
  if (!lead || !OW.terrain) return;
  const n = 3 + Math.floor(Math.min(lv, 6) / 2), group: Bandit[] = [], side = Math.random() < 0.5 ? 1 : -1;
  for (let i = 0; i < n; i++) {
    const a = lead.yaw + side * (Math.PI / 2) + (Math.random() - 0.5) * 1.2, d = 14 + Math.random() * 12;
    const x = lead.x + Math.sin(a) * d, z = lead.z + Math.cos(a) * d;
    const role = i === 0 && lv > 4 ? 'leader' : Math.random() < 0.35 ? 'bruiser' : 'gunner';
    const b = spawnBandit(role, new THREE.Vector3(x, OW.terrain.heightAt(x, z) + 0.9, z), lv, group);
    b.sight = 60; l.raid.push(b);
  }
  // they have blocked the road ahead of the convoy
  const fx = Math.sin(lead.yaw), fz = Math.cos(lead.yaw);
  placeRoadblock(OW.terrain, lead.x + fx * 16, lead.z + fz * 16, new THREE.Vector3(fx, 0, fz));
  l.raids++; l.raidNear = true;
  showToast('Bandits on the road!');
  logLine(`Bandits fall on the caravan to ${c.toName}. Drive them off before they strip the wagons.`);
}
/** Twice a second: roll raids on caravans that come near, drain wagons under attack, settle finished raids. */
function raids(dt: number) {
  const now = G.char.time, esc = G.char.escort;
  const leads = [...wagons.values()].filter((w) => w.w === 0 && w.g.visible);
  for (const wg of leads) {
    const c = wg.c, l = liveOf(c.id), d = Math.hypot(wg.x - G.pos.x, wg.z - G.pos.z), lv = danger(wg.x, wg.z);
    const mine = esc?.id === c.id, prog = caravanS(c, now - l.delay) / (c.T * 7);
    // the caravan you escort is set upon on the way (once past a third of the road, maybe again near the end)
    if (mine && !l.raid.length && d < 250 && ((l.raids === 0 && prog > 0.3 && (esc!.raids ?? 0) === 0) || ((esc!.raids ?? 0) === 1 && prog > 0.72 && esc!.second))) {
      startRaid(c, l, Math.max(1.5, lv)); esc!.raids = (esc!.raids ?? 0) + 1; saveChar(); continue;
    }
    if (!l.rolled && d < 160) {
      l.rolled = true;
      if (!mine && lv >= CARAVAN_RAID.minDanger && Math.random() < CARAVAN_RAID.chance + CARAVAN_RAID.perDanger * lv && mayspawn(3 * BANDIT_COST, lv)) startRaid(c, l, lv);
    }
  }
  for (const [id, l] of live) {
    if (!l.raid.length) continue;
    const lead = leadOf(id), alive = l.raid.filter((b) => W_has(b) && b.hp > 0);
    const near = lead ? alive.filter((b) => Math.hypot(b.p.x - lead.x, b.p.z - lead.z) < CARAVAN_RAID.radius) : [];
    if (near.length) { l.delay += dt; l.hp -= CARAVAN_RAID.drain * near.length * dt; }
    else if (lead && barriersNear(lead.x + Math.sin(lead.yaw) * 8, lead.z + Math.cos(lead.yaw) * 8, 9).length) l.delay += dt; // the road is blocked
    // the bandits go for you once you come close
    for (const b of alive) if (b.state === 'idle' && Math.hypot(b.p.x - G.pos.x, b.p.z - G.pos.z) < 55) alert(b);
    const c = lead?.c;
    if (l.hp <= 0 && c) { // they strip the wagons and the drovers flee
      G.char.caravans['lost:' + id] = 1; l.raid = []; saveChar();
      showToast('The caravan is lost'); logLine(`The bandits have stripped the caravan to ${c.toName}. The drovers scatter.`);
      if (G.char.escort?.id === id) failEscort('The caravan you were guarding was plundered.');
      continue;
    }
    const blocked = lead ? barriersNear(lead.x + Math.sin(lead.yaw) * 8, lead.z + Math.cos(lead.yaw) * 8, 9).length > 0 : false;
    if (!near.length && !blocked && (!alive.length || !lead)) {
      const killed = l.raid.filter((b) => b.hp <= 0).length, there = !!lead && Math.hypot(lead.x - G.pos.x, lead.z - G.pos.z) < 150;
      const won = killed >= Math.ceil(l.raid.length / 2) && !!c && there;
      l.raid = [];
      if (won && c) {
        const gold = 20 * killed;
        G.char.gold += gold; G.char.caravans['saved:' + id] = 1; calcStats(); gainXp(15 * killed); saveChar();
        showToast('Caravan saved'); logLine(`The drovers of the caravan to ${c.toName} thank you: ${gold} gold, and their goods are yours cheaper.`);
      }
    }
  }
}
const W_has = (b: Bandit) => b.hp > 0 && !!b.g.parent;

// ---------- escort ----------
/** Take on guarding caravan c to its destination (from the drover's panel). */
export function takeEscort(c: Caravan): string {
  if (G.char.escort) return 'You are already guarding a caravan.';
  const lead = leadOf(c.id), lv = lead ? danger(lead.x, lead.z) : 1;
  G.char.escort = { id: c.id, road: c.road, k: c.k, to: c.to, toName: c.toName, pay: escortPay(c, lv), away: 0, raids: 0, second: Math.random() < 0.5 };
  saveChar();
  return `You fall in beside the wagons. ${G.char.escort.pay} gold when they reach ${c.toName}.`;
}
export function failEscort(why: string) { if (!G.char.escort) return; G.char.escort = null; saveChar(); showToast('Escort failed'); logLine(why); }
function escortTick(dt: number) {
  const esc = G.char.escort;
  if (!esc || !OW.terrain) return;
  const world = OW.terrain.world, e = edgeByKey.get(esc.road), c = e && caravanOf(world, e, esc.k);
  if (!c) { G.char.escort = null; return; }
  const l = live.get(c.id), now = G.char.time, arrive = c.t0 + c.T + (l?.delay ?? 0);
  if (plundered(c.id)) { failEscort('The caravan you were guarding was plundered.'); return; }
  if (now >= arrive) {
    const dest = findPoi(world, esc.to), d = dest ? worldDist(G.pos.x, G.pos.z, dest.x, dest.z) : 0;
    if (d < 400) {
      G.char.gold += esc.pay; calcStats(); gainXp(30 + esc.pay / 4); G.char.escort = null; saveChar();
      showToast('Caravan delivered'); logLine(`The caravan rolls into ${esc.toName}. The drovers pay you ${esc.pay} gold.`);
    } else failEscort(`The caravan reached ${esc.toName} without you. No pay.`);
    return;
  }
  const lead = leadOf(c.id);
  const far = !lead || Math.hypot(lead.x - G.pos.x, lead.z - G.pos.z) > 350;
  esc.away = far ? esc.away + dt : Math.max(0, esc.away - dt * 2);
  if (esc.away > 60) failEscort('You left the caravan behind. The drovers will not pay a guard who wanders off.');
}
/** The escort job as a line for the quest tracker. */
export function escortLine(): string {
  const esc = G.char.escort;
  if (!esc) return '';
  const lead = leadOf(esc.id), d = lead ? Math.hypot(lead.x - G.pos.x, lead.z - G.pos.z) : Infinity;
  return `▸ Escort the caravan to ${esc.toName} (${esc.pay} g)` + (d === Infinity ? ' · find the wagons on the road' : d > 250 ? ` · the wagons are ${Math.round(d)} m away!` : ' · stay with the wagons');
}
/** Wagons near you for the maps: position, heading, and whether it is your escort or under attack. */
export const mapWagons = () => [...wagons.values()].filter((w) => w.g.visible).map((w) => ({ x: w.x, z: w.z, yaw: w.yaw, mine: G.char.escort?.id === w.c.id, raided: !!live.get(w.c.id)?.raid.length }));

// ---------- the jeeps' guns ----------
/** Turn a jeep's cannon towards the nearest raider (or, with none about, a barricade blocking the road) and fire. */
function aimGun(wg: Wagon, dt: number) {
  const l = live.get(wg.c.id), t = wg.turret!;
  wg.cool -= dt;
  let target: { x: number; y: number; z: number; hit: () => void } | null = null, best = CONVOY_GUN.range;
  for (const b of l?.raid ?? []) {
    if (b.hp <= 0 || !b.g.parent) continue;
    const d = Math.hypot(b.p.x - wg.x, b.p.z - wg.z);
    if (d < best) { best = d; target = { x: b.p.x, y: b.p.y + 0.3, z: b.p.z, hit: () => shootBandit(b) }; }
  }
  if (!target) for (const p of barriersNear(wg.x, wg.z, 30)) {
    const d = Math.hypot(p.x - wg.x, p.z - wg.z);
    if (d < best) { best = d; target = { x: p.x, y: p.y + 0.8, z: p.z, hit: () => hurtBarrier(p as Barricade, CONVOY_GUN.barrier) }; }
  }
  const want = target ? Math.atan2(target.x - wg.x, target.z - wg.z) - wg.yaw : 0;
  let da = want - t.rotation.y; da = Math.atan2(Math.sin(da), Math.cos(da));
  t.rotation.y += Math.sign(da) * Math.min(Math.abs(da), dt * 2.2);
  if (!target || Math.abs(da) > 0.15 || wg.cool > 0) return;
  wg.cool = CONVOY_GUN.rate * (0.8 + Math.random() * 0.4);
  const muzzle = new THREE.Vector3(0, 0.18, 1.3); t.localToWorld(muzzle);
  const end = new THREE.Vector3(target.x, target.y, target.z);
  addFx(new THREE.Line(new THREE.BufferGeometry().setFromPoints([muzzle, end]), add(0xc8e0ff)), 0.12);
  burst(end, 0xc8e0ff, 8, 0.6);
  makeNoise(muzzle, 70);
  target.hit();
}
/** A convoy gunner's hit on a raider (no bounty for you: they shot it). */
function shootBandit(b: Bandit) {
  b.hp -= CONVOY_GUN.dmg; b.flash = 0.12;
  if (b.state === 'idle') alert(b);
  if (b.hp <= 0) { burst(b.p.clone(), 0xffb347, 12, 1); fallBandit(b); }
}
