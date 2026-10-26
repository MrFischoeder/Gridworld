// (0.260, PLAN_LOTNICTWA.md stage F6) The dangers of the air at runtime (gen/airhull.ts):
// - a machine you fly takes the hits meant for the people aboard (a Leechwing's bite, a bandit's bolt, a flak burst):
//   `hurtPlayer` in world/damage.ts hands them to `hit`, which takes percent off the hull of the airship or rotorcraft
//   you sit in; at 0 it no longer lifts and settles to the ground;
// - lightning strikes a machine in flight in a storm (`updateAirHazards`: the pilot's game rolls it);
// - some bandit camps keep an anti-air gun: it fires at a machine in the air within its range while the camp is not
//   cleared, with a tracer and a thud, and the gun is drawn at the camp;
// - the Vehicle Repair Kit mends a machine beside you or the one you sit in (`repairAircraft`, called by useItem).
// Each player's game works out the hits on its own occupant; the hull is part of the shared record (last write wins).
import * as THREE from 'three';
import { G } from '../game';
import { scene } from './render';
import { OW } from './overworld';
import { PropBatch } from './props';
import { addBolt } from './fx';
import { play } from './sound';
import { setAircraftProtection } from './damage';
import { airAboard } from './airships';
import { copAboard } from './copters';
import { takeOne } from '../character';
import { logLine, showToast } from '../ui/hud';
import { nearX, poisNear, worldDist } from '../gen/regions';
import { dangerAt } from '../gen/danger';
import { weatherAt } from '../gen/weather';
import { hullOf, hullHit, hullDamage, hullMend, strikeEvery, hasFlak, flakHit, FLAK, HULL, type CraftKind } from '../gen/airhull';
import { tl, TL } from '../i18n';

interface Craft { kind: CraftKind; rec: { hull?: number }; x: number; y: number; z: number; sp: number; pilot: boolean }
/** The machine you sit in, if any. */
function craft(): Craft | null {
  const a = airAboard();
  if (a) return { kind: 'airship', rec: a.a, x: a.x, y: a.y, z: a.z, sp: a.sp, pilot: a.pilot };
  const c = copAboard();
  return c ? { kind: 'copter', rec: c.c, x: c.x, y: c.y, z: c.z, sp: c.sp, pilot: c.pilot } : null;
}
const down = (h: number) => (h <= 0 ? tl(' The hull gives way: she can no longer fly and settles to the ground. A repair kit mends her.') : '');
/** Damage meant for the people aboard goes to the hull. */
function hit(damage: number) {
  const k = craft();
  if (!k) return;
  const was = hullOf(k.rec), lost = hullHit(k.rec, k.kind, damage);
  G.dmgFlash = Math.max(G.dmgFlash, 0.3);
  if (lost >= 1 || was > 0) showToast(TL`Hull hit: ${Math.round(hullOf(k.rec))}%`);
  if (was > 0 && hullOf(k.rec) <= 0) logLine(TL`${k.kind === 'airship' ? tl('airship') : tl('rotorcraft')}: the hull is torn open.` + down(0));
}
export function initAirHull() { setAircraftProtection(() => !!craft(), hit); }
const groundAt = (x: number, z: number) => OW.terrain!.heightAt(x, z);

// ---------- storms and flak ----------
interface Gun { g: THREE.Group; barrels: THREE.Group; id: number; x: number; y: number; z: number; t: number }
const guns = new Map<number, Gun>();
let scanT = 0, camps: { id: number; x: number; z: number }[] = [];
function gunModel(): { g: THREE.Group; barrels: THREE.Group } {
  const pb = new PropBatch(), bp = new PropBatch();
  pb.box(-0.9, 0, -0.9, 0.9, 0.5, 0.9, 0xff6a4a); pb.box(-0.35, 0.5, -0.35, 0.35, 1.3, 0.35, 0xffb347);
  for (const x of [-0.18, 0.18]) bp.box(x - 0.07, -0.07, 0, x + 0.07, 0.07, 1.9, 0xff6a4a);
  const g = new THREE.Group(), barrels = new THREE.Group();
  g.add(pb.build()); barrels.add(bp.build()); barrels.position.set(0, 1.3, 0); g.add(barrels);
  return { g, barrels };
}
const dropGun = (id: number) => { const o = guns.get(id); if (o) { scene.remove(o.g); o.g.traverse((m) => (m as THREE.Mesh).geometry?.dispose?.()); guns.delete(id); } };
export function clearAirHazards() { for (const id of [...guns.keys()]) dropGun(id); camps = []; }
const cleared = (id: number) => { const t = G.char.camps[id]; return !!t && Date.now() - t < 30 * 60 * 1000; };
let strikeT = 0;
/** Every frame: lightning over the machine you pilot, flak from the camps near it, the guns drawn at camps within sight. */
export function updateAirHazards(dt: number) {
  const T = OW.terrain, c = G.char;
  if (!T || c.loc !== 'overworld') { clearAirHazards(); return; }
  if ((scanT -= dt) <= 0) {
    scanT = 1;
    camps = poisNear(c.world, G.pos.x, G.pos.z, 700).filter((p) => p.type === 'camp' && hasFlak(c.world, p.id, dangerAt(c.world, p.x, p.z)) && !cleared(p.id)).map((p) => ({ id: p.id, x: nearX(p.x, G.pos.x), z: p.z }));
    const keep = new Set(camps.map((q) => q.id));
    for (const id of [...guns.keys()]) if (!keep.has(id)) dropGun(id);
    for (const q of camps) if (!guns.has(q.id) && worldDist(q.x, q.z, G.pos.x, G.pos.z) < 600) {
      const m = gunModel(), gx = q.x + 5, gz = q.z + 5, gy = groundAt(gx, gz);
      m.g.position.set(gx, gy, gz); scene.add(m.g); guns.set(q.id, { ...m, id: q.id, x: gx, y: gy, z: gz, t: FLAK.every * (0.5 + Math.random()) });
    }
  }
  const k = craft(), up = k ? k.y - groundAt(k.x, k.z) : 0, airborne = !!k && up > FLAK.high;
  for (const o of guns.values()) { // the guns turn to the machine in the air near them and fire
    const dx = G.pos.x - o.x, dz = G.pos.z - o.z, dy = G.pos.y - o.y, d = Math.hypot(dx, dz, dy);
    if (!(k && airborne && d < FLAK.range)) { o.barrels.rotation.x *= 0.95; continue; }
    o.g.rotation.y = Math.atan2(dx, dz); o.barrels.rotation.x = -Math.atan2(dy, Math.hypot(dx, dz));
    if ((o.t -= dt) > 0) continue;
    o.t = FLAK.every * (0.8 + Math.random() * 0.5);
    const from = new THREE.Vector3(o.x, o.y + 1.3, o.z), to = new THREE.Vector3(G.pos.x, G.pos.y + 1, G.pos.z), hitIt = Math.random() < flakHit(d, k.sp);
    if (!hitIt) { to.add(new THREE.Vector3((Math.random() - 0.5) * 14, (Math.random() - 0.5) * 10, (Math.random() - 0.5) * 14)); }
    addBolt(from, to, 0xff6a4a, 3, 260, 0xffb347, 6);
    play('cannon', { at: from, vol: 1, far: 220 });
    if (hitIt && k.pilot) { hullDamage(k.rec, HULL.flak[k.kind]); G.dmgFlash = Math.max(G.dmgFlash, 0.5); showToast(TL`Flak hit! Hull ${Math.round(hullOf(k.rec))}% (${k.kind === 'airship' ? tl('airship') : tl('rotorcraft')})`); if (hullOf(k.rec) <= 0) logLine(tl('The hull gives way.') + down(0)); }
    else if (k.pilot && d < FLAK.range * 0.8) showToast(tl('Flak bursts close: a camp below keeps an anti-air gun'));
  }
  // lightning: the pilot's game rolls it
  if (k && k.pilot && up > 6) {
    const every = strikeEvery(weatherAt(c.world, k.x, k.z, c.time).storm);
    if (every > 0 && (strikeT += dt) > 3 && Math.random() < dt / every) {
      strikeT = 0; hullDamage(k.rec, HULL.strike[k.kind]);
      G.dmgFlash = Math.max(G.dmgFlash, 0.8); play('thunder', { vol: 1, far: 400 });
      showToast(TL`Lightning strike! Hull ${Math.round(hullOf(k.rec))}% (${k.kind === 'airship' ? tl('airship') : tl('rotorcraft')})`);
      if (hullOf(k.rec) <= 0) logLine(tl('The hull gives way.') + down(0));
    }
  }
}

// ---------- repair ----------
/** The Vehicle Repair Kit on the machine you sit in or the nearest within 9 m; null when none is near. */
export function repairAircraft(): boolean | null {
  const c = G.char;
  let rec: { hull?: number } | null = craft()?.rec ?? null, best = 81, name = tl('machine');
  if (!rec) {
    for (const a of c.airships ?? []) { const d = (nearX(a.x, G.pos.x) - G.pos.x) ** 2 + (a.z - G.pos.z) ** 2; if (d < best && Math.abs(a.y - G.pos.y) < 14) { best = d; rec = a; name = tl('airship'); } }
    for (const q of c.copters ?? []) { const d = (nearX(q.x, G.pos.x) - G.pos.x) ** 2 + (q.z - G.pos.z) ** 2; if (d < best && Math.abs(q.y - G.pos.y) < 6) { best = d; rec = q; name = tl('rotorcraft'); } }
  } else name = craft()!.kind === 'airship' ? tl('airship') : tl('rotorcraft');
  if (!rec) return null;
  if (hullOf(rec) >= 100) { logLine(TL`The ${name} needs no patching.`); return false; }
  if (!takeOne('repairkit')) return false;
  const did = hullMend(rec);
  logLine(TL`Patched up: ${name}, hull ${Math.round(hullOf(rec))}% (+${Math.round(did)}%).`);
  return true;
}
export const flakGuns = () => guns;
