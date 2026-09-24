// NPC caravans on the roads near the player (the timetable is gen/caravans.ts): trucks with a canvas-covered bed,
// crates showing at the back, rolling along the road one behind the other. They are only drawn near the player;
// where they are follows from the game time alone, so they are where they should be whenever you look. Solid to
// walk into; E at a wagon talks to the caravan master (ui/caravan.ts).
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { PropBatch } from './props';
import { OW } from './overworld';
import { network, regionRoads, type Road, type Edge } from '../gen/roads';
import { regionOf } from '../gen/regions';
import { onRoad, caravanS, caravanOf, escortPay, type Caravan } from '../gen/caravans';
import { spawnBandit, alert, type Bandit } from './bandits';
import { danger } from './overworld';
import { mayspawn, BANDIT_COST } from './threat';
import { gainXp, saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';
import { findPoi, worldDist } from '../gen/regions';

const BODY = 0xc8e0ff, CANVAS = 0x9dffb4, CRATE = 0xe8e0c0, DRAW_R = 420;
/** Half length and half width of a wagon (for bumping into it). */
const HL = 3.1, HW = 1.25;
let model: THREE.Group | null = null;
function wagonModel(): THREE.Group {
  if (model) return model;
  const pb = new PropBatch(), b = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c = BODY) => pb.box(x0, y0, z0, x1, y1, z1, c);
  b(-1.1, 0.55, -3, 1.1, 0.85, 3);                       // chassis
  b(-1.05, 0.85, 1.6, 1.05, 2.4, 3.05);                  // cab
  pb.line(CANVAS, [-0.9, 1.6, 3.06], [0.9, 1.6, 3.06], [0.9, 2.2, 3.06], [-0.9, 2.2, 3.06], [-0.9, 1.6, 3.06]); // windscreen
  // the canvas cover over the bed: hoops and a ridge
  const hoop = (z: number) => { const pts: number[][] = []; for (let i = 0; i <= 8; i++) { const a = Math.PI * i / 8; pts.push([-Math.cos(a) * 1.1, 1.0 + Math.sin(a) * 1.35 + 0.55, z]); } return pts; };
  const zs = [-2.9, -1.95, -1, 0, 1.0, 1.5];
  for (const z of zs) pb.line(CANVAS, ...hoop(z));
  for (let i = 0; i + 1 < zs.length; i++) { const a = hoop(zs[i]), c = hoop(zs[i + 1]); for (let j = 0; j + 1 < a.length; j++) pb.face(a[j], a[j + 1], c[j + 1], c[j]); }
  pb.line(CANVAS, [0, 2.9, -2.9], [0, 2.9, 1.5]);
  b(-1.1, 0.85, -3, 1.1, 1.55, 1.5);                     // bed sides
  for (const [x, y] of [[-0.55, 1.55], [0.35, 1.55], [-0.1, 2.15]]) b(x - 0.4, y, -3.25, x + 0.4, y + 0.6, -2.65, CRATE); // crates at the tail
  for (const z of [-2, 2]) for (const s of [-1, 1]) { pb.box(s * 1.0, 0.05, z - 0.45, s * 1.3, 0.95, z + 0.45, BODY); }  // wheels
  model = pb.build();
  return model;
}
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
interface Wagon { c: Caravan; w: number; road: Road; g: THREE.Group; x: number; z: number; yaw: number }
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
        if (!wagons.has(key)) { const g = new THREE.Group(); g.add(wagonModel().clone()); g.visible = false; scene.add(g); wagons.set(key, { c, w, road, g, x: 0, z: 0, yaw: 0 }); }
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
    const dx = G.pos.x - x, dz = G.pos.z - z, u = dx * fx + dz * fz, v = dx * fz - dz * fx;
    if (Math.abs(u) < HL + 0.3 && Math.abs(v) < HW + 0.3 && G.pos.y < (hf + hb) / 2 + 3) { const push = (v < 0 ? -1 : 1) * (HW + 0.35) - v; G.pos.x += fz * push; G.pos.z -= fx * push; }
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
    if (Math.abs(u) < HL + r && Math.abs(v) < HW + r && y < wg.g.position.y + 3) return true;
  }
  return false;
}
/** The caravan whose wagon you stand next to. */
export function nearCaravan(): Caravan | null {
  for (const wg of wagons.values()) {
    if (!wg.g.visible) continue;
    const dx = G.pos.x - wg.x, dz = G.pos.z - wg.z, fx = Math.sin(wg.yaw), fz = Math.cos(wg.yaw);
    if (Math.abs(dx * fx + dz * fz) < HL + 3 && Math.abs(dx * fz - dz * fx) < HW + 3.5) return wg.c;
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
    // the bandits go for you once you come close
    for (const b of alive) if (b.state === 'idle' && Math.hypot(b.p.x - G.pos.x, b.p.z - G.pos.z) < 55) alert(b);
    const c = lead?.c;
    if (l.hp <= 0 && c) { // they strip the wagons and the drovers flee
      G.char.caravans['lost:' + id] = 1; l.raid = []; saveChar();
      showToast('The caravan is lost'); logLine(`The bandits have stripped the caravan to ${c.toName}. The drovers scatter.`);
      if (G.char.escort?.id === id) failEscort('The caravan you were guarding was plundered.');
      continue;
    }
    if (!near.length && (!alive.length || !lead)) {
      const killed = l.raid.filter((b) => b.hp <= 0).length, won = killed >= Math.ceil(l.raid.length / 2) && !!c;
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
