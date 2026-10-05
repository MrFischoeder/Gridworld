// Shared foes (multiplayer): everyone in a room fights the same creatures, machines and bandits.
// Every foe is run by one game, its owner (the one that spawned it; random spawns come only from the first player in
// a place, `spawnAuthority` in world/remote.ts). Ten times a second the owner tells the others where its foes are and
// how hurt (`foes`); the others draw copies that follow (`markRemote` / `stepRemote`). A hit on a copy goes to the
// owner (`fhit`), whose game takes it; a foe that dies of it is reported back (`kill`) and the shooter's copy dies as
// if it were their own (loot, xp, bounties). The owner's foes go for the nearest player (`withTarget`): the harm they
// do to another player is sent to them (`hurt`), and the bolts they fire are drawn by everyone (`bolt`).
import { myCarList, damageVehicle } from './vehicles';
import { hurtPlayer } from './damage';
import * as THREE from 'three';
import { G, W } from '../game';
import { net, online, relay, onRelay, type Relay } from '../net/client';
import { nearX } from '../gen/regions';
import { V } from './render';
import { myLoc } from './peers';
import { remoteTurretHit } from './mountedturrets';
import { setTurretHook, setRemoteHooks, markRemote, unmarkRemote, remoteOf, type Target } from './remote';
import { spawnRemoteCreature, fallCreature, removeCreature, type Creature } from './creatures';
import { spawnRemoteRobot, wreckRobot, removeRobot, type Robot } from './robots';
import { spawnBandit, fallBandit, removeBandit, ghostBolt, type Bandit } from './bandits';
import { damageFoe, foeRules, makeDrone, type Drone, type Boss } from './enemies';
import { raiders, spawnRemoteRaider, remoteRaiderKilled, dropRaider, hurtRaider, barricades, barricadeAlive, placeBarricadeCopy, removeBarricade, hurtBarrier, type Raider, type Barricade } from './raiders';
import { quietLoot } from './loot';
import { scene } from './render';
import { burst } from './fx';
import type { VehicleModel } from '../data/vehicles';
import type { CreatureKind } from '../data/creatures';
import type { RobotKind } from '../data/robots';

export const FOESYNC = {
  /** Seconds between word of your foes. */
  every: 0.1,
  /** Foes go for players within (m); you spawn the foes unless a player with a lower id is within `lead` m. */
  reach: 260, lead: 220,
  /** Seconds a dead foe is still reported, and without word from an owner before their foes are dropped. */
  dead: 1, quiet: 2.5,
};
type Foe = Creature | Robot | Bandit;
/** Everything shared this way: the foes, a dungeon's drones and bosses, raider vehicles and roadblock barricades. */
type Thing = Foe | Drone | Boss | Raider | Barricade;
const TYPE = { creature: 0, robot: 1, bandit: 2, drone: 3, boss: 4, raider: 5, barricade: 6 } as const;
const isBarricade = (f: Thing): f is Barricade => !('p' in f);
function typeOf(f: Thing): number {
  if (isBarricade(f)) return TYPE.barricade;
  if ('kind' in f) return f.kind === 'robot' ? TYPE.robot : f.kind === 'bandit' ? TYPE.bandit : f.kind === 'raider' ? TYPE.raider : TYPE.creature;
  return (f as Boss).boss ? TYPE.boss : TYPE.drone;
}
function alive(f: Thing, t = typeOf(f)): boolean {
  switch (t) {
    case TYPE.robot: return W.robots.includes(f as Robot);
    case TYPE.bandit: return W.bandits.includes(f as Bandit);
    case TYPE.drone: return W.drones.includes(f as Drone);
    case TYPE.boss: return W.bosses.includes(f as Boss);
    case TYPE.raider: return raiders.includes(f as Raider);
    case TYPE.barricade: return barricadeAlive(f as Barricade);
    default: return W.creatures.includes(f as Creature);
  }
}
function dropDrone(d: Drone, blast = false) {
  if (blast) burst(d.p, 0xffb347, 20, 1.2);
  scene.remove(d.g); const i = W.drones.indexOf(d); if (i >= 0) W.drones.splice(i, 1);
}
function dropBoss(b: Boss) {
  burst(b.p, 0xff6a4a, 50, 2.6);
  scene.remove(b.g); const i = W.bosses.indexOf(b); if (i >= 0) W.bosses.splice(i, 1);
}

// ---------- the players here ----------
let frame = 0, cached = -1, cache: Target[] = [];
/** The other players in your place and in the game (not in the menu), within reach, on your copy of the planet. */
function others(): Target[] {
  if (cached === frame) return cache; // once a frame (syncFoes counts them)
  cached = frame; cache = [];
  if (!online()) return cache;
  const here = myLoc();
  for (const p of net.peers.values()) {
    const s = p.st;
    if (!s || s.away || s.loc !== here) continue;
    const x = nearX(s.p[0], G.pos.x);
    if (Math.hypot(x - G.pos.x, s.p[2] - G.pos.z) < FOESYNC.reach + 60) cache.push({ id: p.id, x, y: s.p[1], z: s.p[2] });
  }
  return cache;
}
/** Alone, or no player with a lower id in the game near you: your game spawns the foes here. */
function authority(): boolean {
  if (!online()) return true;
  const here = myLoc();
  for (const p of net.peers.values()) {
    const s = p.st;
    if (!s || s.away || s.loc !== here || p.id > net.id) continue;
    if (Math.hypot(nearX(s.p[0], G.pos.x) - G.pos.x, s.p[2] - G.pos.z) < FOESYNC.lead) return false;
  }
  return true;
}
/** Anyone else in your place at all (in the game or the menu): then your foes are worth telling about. */
const company = () => { const here = myLoc(); for (const p of net.peers.values()) if (p.st?.loc === here) return true; return false; };

// ---------- your foes ----------
let seq = 1;
const ids = new WeakMap<object, number>();
const nidOf = (f: object) => { let n = ids.get(f); if (!n) { n = seq++; ids.set(f, n); } return n; };
/** Your foes by id as last told, and the dead ones still being reported (until when). */
let mine = new Map<number, Thing>();
const dying = new Map<number, number>();
const r2 = (v: number) => Math.round(v * 100) / 100;
function entry(f: Thing, n: number, t: number): unknown[] {
  if (t === TYPE.barricade) { const b = f as Barricade; return [n, t, b.big ? 'b' : '', r2(b.x), r2(b.y), r2(b.z), r2(b.ang), r2(b.hp), b.max, 0, '']; }
  if (t === TYPE.drone) { const d = f as Drone; return [n, t, '', r2(d.p.x), r2(d.p.y), r2(d.p.z), 0, r2(d.hp), r2(d.hp), 0, d.chasing ? 'c' : '']; }
  if (t === TYPE.boss) { const b = f as Boss; return [n, t, String(b.idx), r2(b.p.x), r2(b.p.y), r2(b.p.z), 0, r2(b.hp), b.maxHp, 0, b.engaged ? 'e' : '']; }
  if (t === TYPE.raider) { const r = f as Raider; return [n, t, r.v.st.model, r2(r.v.st.x), r2(r.v.y), r2(r.v.st.z), r2(r.v.st.heading), r2(r.hp), r.maxHp, r2(r.level), String(r2(r.v.turret?.rotation.y ?? 0))]; }
  const o = f as Foe, kind = t === TYPE.robot ? (o as Robot).model : t === TYPE.bandit ? (o as Bandit).role : (o as Creature).kind;
  return [n, t, kind, r2(o.p.x), r2(o.p.y), r2(o.p.z), r2(o.heading), r2(o.hp), o.maxHp, r2(o.level), o.state, o.cityPost];
}
function tell() {
  const now = performance.now() / 1000, list: unknown[] = [], next = new Map<number, Thing>();
  // a dungeon's drones and bosses are the first player's there (the others' copies of the sector give way to theirs)
  const lead = authority(), all: Thing[] = [...W.creatures, ...W.robots, ...W.bandits, ...(lead ? [...W.drones, ...W.bosses] : []), ...raiders, ...barricades()];
  for (const f of all) {
    if (remoteOf(f)) continue;
    const n = nidOf(f), t = typeOf(f);
    next.set(n, f);
    list.push(entry(f, n, t));
  }
  for (const [n, f] of mine) if (!next.has(n) && (isBarricade(f) || f.hp <= 0 || typeOf(f) === TYPE.boss || typeOf(f) === TYPE.raider)) dying.set(n, now + FOESYNC.dead);
  for (const [n, until] of dying) { if (until < now) dying.delete(n); else list.push([n, -1]); }
  mine = next;
  relay({ t: 'foes', loc: myLoc(), list });
}
/** Find one of your own foes by the id the others know it by. */
const mineOf = (n: number): Thing | undefined => { const f = mine.get(n); return f && alive(f) && !remoteOf(f) ? f : undefined; };

// ---------- the others' foes ----------
interface Copy { o: Thing; t: number }
/** Owner id → their foes here (by their id) and when they last spoke. */
const theirs = new Map<number, { at: number; foes: Map<number, Copy> }>();
/** Foes taken over from a player who left or went elsewhere ('owner:nid'): picked up again if they come back. */
const adopted = new Map<string, Copy>();
function drop(c: Copy) {
  unmarkRemote(c.o);
  if (!alive(c.o, c.t)) return;
  switch (c.t) {
    case TYPE.robot: removeRobot(c.o as Robot); break;
    case TYPE.bandit: removeBandit(c.o as Bandit); break;
    case TYPE.drone: dropDrone(c.o as Drone); break;
    case TYPE.boss: break; // the boss of this sector stays, now yours to fight
    case TYPE.raider: dropRaider(c.o as Raider); break;
    case TYPE.barricade: removeBarricade(c.o as Barricade); break;
    default: removeCreature(c.o as Creature);
  }
}
/**
 * A player's foes when they stop speaking for them. `adopt`: they left or went elsewhere, so the foes stay and your game
 * runs them from now on (a roadblock is taken down instead); otherwise (you moved away) they go.
 */
function dropOwner(id: number, adopt = false) {
  const o = theirs.get(id); if (!o) return;
  for (const [n, c] of o.foes) {
    if (!adopt || c.t === TYPE.barricade || !alive(c.o, c.t)) { drop(c); continue; }
    unmarkRemote(c.o); adopted.set(id + ':' + n, c);
  }
  theirs.delete(id);
}
/** Drop every copy (offline, another place). */
export function dropCopies() { for (const id of [...theirs.keys()]) dropOwner(id); adopted.clear(); }
function make(t: number, kind: string, x: number, y: number, z: number, h: number, hp: number, max: number, lv: number): Thing | null {
  switch (t) {
    case TYPE.robot: return spawnRemoteRobot(kind as RobotKind, x, y, z, lv);
    case TYPE.bandit: return spawnBandit(kind as Bandit['role'], V(x, y, z), lv, []);
    case TYPE.drone: { const d = makeDrone(); d.p.set(x, y, z); d.hp = hp; W.drones.push(d); return d; }
    case TYPE.boss: return authority() ? null : W.bosses.find((b) => b.idx === +kind && !remoteOf(b)) ?? null; // the same boss in your copy of the sector
    case TYPE.raider: return spawnRemoteRaider(kind as VehicleModel, x, z, h, lv);
    case TYPE.barricade: return placeBarricadeCopy(x, y, z, h, kind === 'b', hp, max);
    default: return spawnRemoteCreature(kind as CreatureKind, V(x, y, z), lv);
  }
}
/** It died in its owner's game: it dies here too (no reward: that went to whoever killed it). */
function fall(c: Copy) {
  unmarkRemote(c.o);
  if (!alive(c.o, c.t)) return;
  switch (c.t) {
    case TYPE.robot: (c.o as Robot).hp = 0; wreckRobot(c.o as Robot); break;
    case TYPE.bandit: (c.o as Bandit).hp = 0; fallBandit(c.o as Bandit); break;
    case TYPE.drone: dropDrone(c.o as Drone, true); break;
    case TYPE.boss: dropBoss(c.o as Boss); break;
    case TYPE.raider: burst((c.o as Raider).p, 0xffb347, 50, 2.5); dropRaider(c.o as Raider); break;
    case TYPE.barricade: removeBarricade(c.o as Barricade); break;
    default: (c.o as Creature).hp = 0; fallCreature(c.o as Creature);
  }
}
function heard(from: number, loc: string, list: unknown[]) {
  if (loc !== myLoc()) { dropOwner(from, true); return; } // they went elsewhere: their foes here are yours now
  const now = performance.now() / 1000;
  let o = theirs.get(from);
  if (!o) { o = { at: now, foes: new Map() }; theirs.set(from, o); }
  o.at = now;
  const seen = new Set<number>();
  for (const e of list) {
    if (!Array.isArray(e)) continue;
    const n = +e[0];
    seen.add(n);
    let c = o.foes.get(n);
    if (e[1] === -1) { // dead in its owner's game: it falls here too
      if (!c) continue;
      o.foes.delete(n); fall(c);
      continue;
    }
    const [, t, kind, x0, y, z, h, hp, maxHp, lv, state] = e as [number, number, string, number, number, number, number, number, number, number, string];
    const x = nearX(x0, G.pos.x);
    if (!c || !alive(c.o, c.t)) { // new to you, or one you took over while its owner was away
      const back = adopted.get(from + ':' + n);
      adopted.delete(from + ':' + n);
      const f = back && alive(back.o, back.t) ? back.o : make(t, kind, x, y, z, h, hp, maxHp, lv);
      if (!f) continue;
      c = { o: f, t }; o.foes.set(n, c);
      if ('heading' in f) f.heading = h;
      markRemote(f, { owner: from, nid: n, x, y, z, h, hp, maxHp });
    }
    const f = c.o, r = remoteOf(f);
    if (r) { r.x = x; r.y = y; r.z = z; r.h = h; r.hp = hp; r.maxHp = maxHp; if (t === TYPE.raider) r.aux = parseFloat(state) || 0; }
    if (t === TYPE.barricade) { (f as Barricade).hp = hp; continue; }
    if (t === TYPE.drone) { (f as Drone).chasing = state === 'c'; continue; }
    if (t === TYPE.boss) { (f as Boss).engaged = state === 'e'; (f as Boss).maxHp = maxHp; continue; }
    if (t === TYPE.raider) continue;
    if (typeof e[11] === 'string') (f as Foe).cityPost = e[11];
    if (typeof state === 'string') (f as { state: string }).state = state;
  }
  for (const [n, c] of [...o.foes]) if (!seen.has(n)) { o.foes.delete(n); drop(c); } // gone from its owner's game
}
/** One of the others' foes, by owner and id. */
const copyOf = (from: number, n: number) => theirs.get(from)?.foes.get(n);

onRelay((m: Relay) => {
  if (m.t === 'foes') heard(m.from, String(m.loc), Array.isArray(m.list) ? m.list : []);
  else if (m.t === 'fhit') { // you are the owner: take the hit (a player's kill is rewarded in their game, not yours)
    const f = mineOf(+(m.nid as number));
    if (!f) return;
    const t = typeOf(f), dmg = Math.max(0, Math.min(1e4, +(m.dmg as number) || 0)), flash = G.hitFlash;
    if (t === TYPE.barricade) { hurtBarrier(f as Barricade, dmg); return; }
    const before = (f as Drone).hp;
    const hit = () => { if (t === TYPE.raider) hurtRaider(f as Raider, dmg); else damageFoe(f as Foe | Drone | Boss, dmg, false); };
    if (m.npc) hit(); else quietLoot(hit);
    G.hitFlash = flash; // not your shot
    const died = t === TYPE.drone ? before - dmg <= 0 : !alive(f, t) || (f as Foe).hp <= 0;
    if (died && !m.npc) relay({ t: 'kill', nid: m.nid }, m.from);
  } else if (m.t === 'kill') { // your shot killed their foe: it dies here as yours (loot, xp, bounties)
    const c = copyOf(m.from, +(m.nid as number));
    if (!c) return;
    theirs.get(m.from)!.foes.delete(+(m.nid as number));
    unmarkRemote(c.o);
    if (!alive(c.o, c.t)) return;
    if (c.t === TYPE.raider) remoteRaiderKilled(c.o as Raider);
    else if (c.t === TYPE.drone) { damageFoe(c.o as Drone, 1e9); dropDrone(c.o as Drone); } // its owner's drone flies on elsewhere
    else if (c.t !== TYPE.barricade) damageFoe(c.o as Foe | Boss, 1e9);
  } else if (m.t === 'hurt') { // their foe hurt you
    if (m.loc !== undefined && m.loc !== myLoc()) return;
    const dmg = Math.max(0, Math.min(500, +(m.dmg as number) || 0));
    if (!dmg) return;
    if (m.car !== undefined || m.carIndex !== undefined) {
      const v = myCarList().find(v => v.st.id === m.car) ?? (m.car === undefined && Number.isInteger(m.carIndex) ? myCarList()[Number(m.carIndex)] : undefined);
      if (v && v.riders.some(r => r?.who === 'peer:' + m.from)) damageVehicle(v, dmg);
      return;
    }
    if (foeRules.playerSafe()) return;
    hurtPlayer(dmg, !!m.a);
  } else if (m.t === 'thit') { // a gun of this place was hit by another player
    if (m.loc === myLoc()) remoteTurretHit(+(m.id as number), Math.max(0, Math.min(1e4, +(m.dmg as number) || 0)));
  } else if (m.t === 'bolt') {
    if (m.loc !== myLoc() || !Array.isArray(m.p) || !Array.isArray(m.v)) return;
    const [x, y, z] = m.p as number[], [vx, vy, vz] = m.v as number[];
    ghostBolt(V(nearX(x, G.pos.x), y, z), V(vx, vy, vz), +(m.c as number) || 0xffb347);
  }
});

setTurretHook((id, dmg) => { if (online() && company()) relay({ t: 'thit', id, dmg, loc: myLoc() }); });
setRemoteHooks({
  others,
  authority,
  hurt: (id, dmg, a) => { relay({ t: 'hurt', dmg: Math.round(dmg * 100) / 100, a, loc: myLoc() }, id); },
  hit: (o, dmg, npc) => { const r = remoteOf(o); if (r) relay({ t: 'fhit', nid: r.nid, dmg, npc }, r.owner); },
  bolt: (p: THREE.Vector3, v: THREE.Vector3, c: number) => { if (online() && company()) relay({ t: 'bolt', loc: myLoc(), p: [r2(p.x), r2(p.y), r2(p.z)], v: [r2(v.x), r2(v.y), r2(v.z)], c }); },
});

let clock = 0, lastLoc = '';
/** Main loop (also in the menu): tell the others about your foes, drop the copies of foes nobody speaks for. */
export function syncFoes(dt: number) {
  frame++;
  if (!online()) { if (theirs.size) dropCopies(); mine.clear(); dying.clear(); return; }
  const here = myLoc();
  if (here !== lastLoc) { lastLoc = here; dropCopies(); } // another place: its foes are other ones
  const now = performance.now() / 1000;
  for (const [id, o] of [...theirs]) if (now - o.at > FOESYNC.quiet || !net.peers.has(id)) dropOwner(id, true); // left or silent: yours now
  // in a dungeon the first player there keeps its drones; yours give way to theirs
  if (here.startsWith('d:') && !authority()) for (const d of [...W.drones]) if (!remoteOf(d)) dropDrone(d);
  if ((clock -= dt) > 0) return;
  clock = FOESYNC.every;
  if (company()) tell(); else { mine.clear(); dying.clear(); }
}
