// (0.252, PLAN_MAGAZYNOW.md stage M4) The convoy lines (and since 0.254 the air lines, gen/airlines.ts) between
// warehouses at runtime: settling them under the right warehouse's lock (the home's for its trips, the other's for
// taking the cargo in), every 15 s for the lines whose trips are due or whose cargo waits, and on opening a
// warehouse's window; and the trucks drawn where their timetable puts them on the straight way between the two. Every game draws the same from the shared state.
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { convoyModel } from './vehicles';
import { saveChar } from '../character';
import { withOutpost, withTownStock } from '../ui/stock';
import { logLine } from '../ui/hud';
import { nearX, worldDist } from '../gen/regions';
import { deposit, withdraw } from '../gen/hall';
import { portPut, portTake } from '../gen/ports';
import { hubs, hubWorks, type Hub } from '../gen/warehouses';
import { linkedHubs } from '../gen/radio';
import { airLinesOf, ownAirLines, alDue, alWaiting, alDrain, airLoad, settleAirLine, padWhy, allAirLines } from '../gen/airlines';
import { allHubLines, hubLineOf, hlDue, hlWaiting, hlDrain, settleHubLine, lineLoad, hlAt, hlWrecked, type HubLine } from '../gen/hublines';
import { ITEMS, type ItemKey } from '../data/items';
import { TL } from '../i18n';

const hubOf = (id: string): Hub | undefined => hubs(G.char.world, G.char.towns, G.char.outposts).find((h) => h.id === id);
/** Settle warehouse `id`'s own line and take in what other lines brought it (call under its lock). The words for the log. */
export function runHub(id: string): string[] {
  const c = G.char, h = hubOf(id), words: string[] = [];
  if (!h) return words;
  const l = hubLineOf(id, c.towns, c.outposts), vs = id.startsWith('v:') ? (c.towns[id.slice(2)] ??= {}) : null, o = vs ? null : c.outposts[id];
  if (l?.truck && hlDue(l, c.time)) {
    const linked = linkedHubs(c.world, c.towns, c.outposts, id, c.time).some((q) => q.id === l.to), works = hubWorks(c.world, h, c.towns, c.outposts, c.time);
    const take = (cap: number, only?: ItemKey[]) => (vs ? lineLoad(vs, vs.hold, cap, only, (k, n) => withdraw(vs, k, n)) : o ? lineLoad(o, o.hold, cap, only, (k, n) => portTake(o, k, n)) : []);
    const before = l.trips ?? 0, out = settleHubLine(c.world, h, l, linked, works, take, c.time);
    if ((l.trips ?? 0) > before) words.push(TL`A convoy left for ${l.toName}.`);
    if (out.includes('robbed')) words.push(TL`Bandits robbed the convoy to ${l.toName}.`);
    if (out.includes('wrecked')) words.push(TL`The convoy truck to ${l.toName} lies wrecked on the road.`);
  }
  const st = vs ?? o; // (0.254, stage F1; 0.255 several) its air lines
  if (st?.aline) ownAirLines(st); // a 0.254 save's single line moves into the list (under this lock)
  if (st && airLinesOf(st).some((l) => l.drone && alDue(l, c.time))) {
    const mine = linkedHubs(c.world, c.towns, c.outposts, id, c.time), charge = !padWhy(c.world, h, c.towns, c.outposts, c.time);
    for (const al of ownAirLines(st)) {
      if (!al.drone || !alDue(al, c.time)) continue;
      const there = hubOf(al.to), linked = mine.some((q) => q.id === al.to);
      const take = (cap: number) => (vs ? airLoad(vs, al, vs.hold, cap, (k, n) => withdraw(vs, k, n)) : o ? airLoad(o, al, o.hold, cap, (k, n) => portTake(o, k, n)) : []);
      const out = settleAirLine(c.world, h, al, linked, !!there && !padWhy(c.world, there, c.towns, c.outposts, c.time), charge, take, c.time);
      const n = out.filter((q) => q === 'ok').length;
      if (n) words.push(n > 1 ? TL`Drones flew ${n} loads to ${al.toName}.` : TL`A drone flew a load to ${al.toName}.`);
      if (out.includes('lost')) words.push(TL`The cargo drone to ${al.toName} came down in the wilds, its load with it.`);
    }
  }
  if (!padWhy(c.world, h, c.towns, c.outposts, c.time)) {
    const got = vs ? alDrain(id, c.towns, c.outposts, vs, (k, n) => deposit(vs, k, n)) : o?.done?.port ? alDrain(id, c.towns, c.outposts, o, (k, n) => portPut(o, k, n)) : [];
    if (got.length) words.push(TL`A drone landed with ${got.map(([g, m]) => `${m} × ${ITEMS[g].name}`).join(', ')}.`);
  }
  if (hubWorks(c.world, h, c.towns, c.outposts, c.time)) {
    const got = vs ? hlDrain(id, c.towns, c.outposts, vs, (k, n) => deposit(vs, k, n)) : o?.done?.port ? hlDrain(id, c.towns, c.outposts, o, (k, n) => portPut(o, k, n)) : [];
    if (got.length) words.push(TL`A convoy unloaded ${got.map(([g, m]) => `${m} × ${ITEMS[g].name}`).join(', ')}.`);
  }
  for (const w of words) logLine(`${h.name}: ${w}`);
  return words;
}
let tickT = 0;
/** Every 15 s: the warehouses with a trip due or cargo waiting settle under their own lock (quietly). */
export function tickHubLines(dt: number) {
  if ((tickT -= dt) > 0) return;
  tickT = 15;
  const c = G.char, todo = new Set<string>();
  for (const [home, l] of allHubLines(c.towns, c.outposts)) {
    if (hlDue(l, c.time)) todo.add(home);
    if (!todo.has(l.to)) { const r = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv; if (hlWaiting(l.to, c.towns, c.outposts, r).length) todo.add(l.to); }
  }
  for (const [home, l] of allAirLines(c.towns, c.outposts)) { // (0.254) the air lines likewise
    if (alDue(l, c.time)) todo.add(home);
    if (!todo.has(l.to)) { const r = l.to.startsWith('v:') ? c.towns[l.to.slice(2)]?.rcv : c.outposts[l.to]?.rcv; if (alWaiting(l.to, c.towns, c.outposts, r).length) todo.add(l.to); }
  }
  for (const id of todo) {
    const done = (ok: boolean) => { if (ok) saveChar(); };
    if (id.startsWith('v:')) void withTownStock(+id.slice(2), () => { runHub(id); }, true).then(done);
    else void withOutpost(id, () => { runHub(id); }, true).then(done);
  }
}

// ---------- the trucks ----------
const DRAW_R = 600;
interface Truck { g: THREE.Group; key: string }
const trucks = new Map<string, Truck>();
function drop(id: string) { const t = trucks.get(id); if (t) { scene.remove(t.g); t.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose?.()); trucks.delete(id); } }
/** Where line l's truck from warehouse `home` is now: x, z, heading. */
export function hubTruckAt(home: Hub, l: HubLine, now: number, px: number): [number, number, number] | null {
  if (!l.truck) return null;
  const hx = nearX(home.x, px), tx = nearX(l.tx, hx), dx = tx - hx, dz = l.tz - home.z, d = Math.hypot(dx, dz) || 1, ux = dx / d, uz = dz / d;
  const ax = hx + ux * 22, az = home.z + uz * 22, bx = tx - ux * 22, bz = l.tz - uz * 22, yaw = Math.atan2(bx - ax, bz - az), cv = hlAt(l, now);
  if (cv.at === 'parked' || cv.at === 'home') return [ax, az, yaw];
  if (cv.at === 'there') return [bx, bz, yaw + Math.PI];
  const p = cv.at === 'out' ? cv.p : 1 - cv.p, side = cv.at === 'out' ? -1.5 : 1.5;
  return [ax + (bx - ax) * p + Math.cos(yaw) * side, az + (bz - az) * p - Math.sin(yaw) * side, cv.at === 'out' ? yaw : yaw + Math.PI];
}
export function updateHubTrucks(dt: number) {
  tickHubLines(dt);
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { for (const id of [...trucks.keys()]) drop(id); return; }
  const seen = new Set<string>(), list = hubs(c.world, c.towns, c.outposts);
  for (const [home, l] of allHubLines(c.towns, c.outposts)) {
    const h = list.find((q) => q.id === home), at = h ? hubTruckAt(h, l, c.time, G.pos.x) : null;
    if (!l.truck || !at || worldDist(at[0], at[1], G.pos.x, G.pos.z) > DRAW_R) continue;
    seen.add(home);
    const key = l.truck.model + (l.truck.parts.gun ? 'g' : '') + (hlWrecked(l) ? 'w' : '');
    let t = trucks.get(home);
    if (t && t.key !== key) { drop(home); t = undefined; }
    if (!t) { const m = convoyModel(l.truck.model, l.truck.parts.gun, hlWrecked(l) ? undefined : 0xdce8ff), g = new THREE.Group(); g.add(m.g); scene.add(g); t = { g, key }; trucks.set(home, t); }
    const [x, z, yaw] = at, fx = Math.sin(yaw), fz = Math.cos(yaw), hf = T.heightAt(x + fx * 2.5, z + fz * 2.5), hb = T.heightAt(x - fx * 2.5, z - fz * 2.5);
    t.g.position.set(x, (hf + hb) / 2, z); t.g.rotation.set(0, 0, 0); t.g.rotateY(yaw); t.g.rotateX(-Math.atan2(hf - hb, 5));
    if (hlWrecked(l)) t.g.rotateZ(0.25);
  }
  for (const id of [...trucks.keys()]) if (!seen.has(id)) drop(id);
}
export function clearHubTrucks() { for (const id of [...trucks.keys()]) drop(id); }
