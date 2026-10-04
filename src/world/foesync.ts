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
import { setRemoteHooks, markRemote, unmarkRemote, remoteOf, type Target } from './remote';
import { spawnRemoteCreature, fallCreature, removeCreature, type Creature } from './creatures';
import { spawnRemoteRobot, wreckRobot, removeRobot, type Robot } from './robots';
import { spawnBandit, fallBandit, removeBandit, ghostBolt, type Bandit } from './bandits';
import { damageFoe, foeRules } from './enemies';
import type { CreatureKind } from '../data/creatures';
import type { RobotKind } from '../data/robots';

export const FOESYNC = {
  /** Seconds between word of your foes. */
  every: 0.1,
  /** Foes go for players within (m); you spawn the foes unless a player with a lower id is within `lead` m. */
  reach: 150, lead: 220,
  /** Seconds a dead foe is still reported, and without word from an owner before their foes are dropped. */
  dead: 1, quiet: 2.5,
};
type Foe = Creature | Robot | Bandit;
const TYPE = { creature: 0, robot: 1, bandit: 2 } as const;
const typeOf = (f: Foe) => (f.kind === 'robot' ? TYPE.robot : f.kind === 'bandit' ? TYPE.bandit : TYPE.creature);
const alive = (f: Foe) => (f.kind === 'robot' ? W.robots.includes(f as Robot) : f.kind === 'bandit' ? W.bandits.includes(f as Bandit) : W.creatures.includes(f as Creature));

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
let mine = new Map<number, Foe>();
const dying = new Map<number, number>();
const r2 = (v: number) => Math.round(v * 100) / 100;
function tell() {
  const now = performance.now() / 1000, list: unknown[] = [], next = new Map<number, Foe>();
  for (const f of [...W.creatures, ...W.robots, ...W.bandits] as Foe[]) {
    if (remoteOf(f)) continue;
    const n = nidOf(f), t = typeOf(f);
    next.set(n, f);
    const kind = t === TYPE.robot ? (f as Robot).model : t === TYPE.bandit ? (f as Bandit).role : (f as Creature).kind;
    list.push([n, t, kind, r2(f.p.x), r2(f.p.y), r2(f.p.z), r2(f.heading), r2(f.hp), f.maxHp, r2(f.level), f.state, f.cityPost]);
  }
  for (const [n, f] of mine) if (!next.has(n) && f.hp <= 0) dying.set(n, now + FOESYNC.dead);
  for (const [n, until] of dying) { if (until < now) dying.delete(n); else list.push([n, -1]); }
  mine = next;
  relay({ t: 'foes', loc: myLoc(), list });
}
/** Find one of your own foes by the id the others know it by. */
const mineOf = (n: number): Foe | undefined => { const f = mine.get(n); return f && alive(f) && !remoteOf(f) ? f : undefined; };

// ---------- the others' foes ----------
interface Copy { o: Foe; t: number }
/** Owner id → their foes here (by their id) and when they last spoke. */
const theirs = new Map<number, { at: number; foes: Map<number, Copy> }>();
function drop(c: Copy) {
  unmarkRemote(c.o);
  if (!alive(c.o)) return;
  if (c.t === TYPE.robot) removeRobot(c.o as Robot); else if (c.t === TYPE.bandit) removeBandit(c.o as Bandit); else removeCreature(c.o as Creature);
}
function dropOwner(id: number) { const o = theirs.get(id); if (!o) return; for (const c of o.foes.values()) drop(c); theirs.delete(id); }
/** Drop every copy (offline, another place). */
export function dropCopies() { for (const id of [...theirs.keys()]) dropOwner(id); }
function make(t: number, kind: string, x: number, y: number, z: number, lv: number): Foe | null {
  if (t === TYPE.robot) return spawnRemoteRobot(kind as RobotKind, x, y, z, lv);
  if (t === TYPE.bandit) return spawnBandit(kind as Bandit['role'], V(x, y, z), lv, []);
  return spawnRemoteCreature(kind as CreatureKind, V(x, y, z), lv);
}
function heard(from: number, loc: string, list: unknown[]) {
  if (loc !== myLoc()) { dropOwner(from); return; }
  const now = performance.now() / 1000;
  let o = theirs.get(from);
  if (!o) { o = { at: now, foes: new Map() }; theirs.set(from, o); }
  o.at = now;
  const seen = new Set<number>();
  for (const e of list) {
    if (!Array.isArray(e)) continue;
    const n = +e[0];
    seen.add(n);
    const c = o.foes.get(n);
    if (e[1] === -1) { // dead in its owner's game: it falls here too
      if (!c) continue;
      o.foes.delete(n); unmarkRemote(c.o);
      if (alive(c.o)) { c.o.hp = 0; if (c.t === TYPE.robot) wreckRobot(c.o as Robot); else if (c.t === TYPE.bandit) fallBandit(c.o as Bandit); else fallCreature(c.o as Creature); }
      continue;
    }
    const [, t, kind, x0, y, z, h, hp, maxHp, lv, state] = e as [number, number, string, number, number, number, number, number, number, number, string];
    const x = nearX(x0, G.pos.x);
    let f = c && alive(c.o) ? c.o : null;
    if (!f) {
      f = make(t, kind, x, y, z, lv);
      if (!f) continue;
      o.foes.set(n, { o: f, t });
      f.heading = h;
      markRemote(f, { owner: from, nid: n, x, y, z, h, hp, maxHp });
    }
    const r = remoteOf(f);
    if (r) { r.x = x; r.y = y; r.z = z; r.h = h; r.hp = hp; r.maxHp = maxHp; }
    if (typeof e[11] === 'string') f.cityPost = e[11];
    if (typeof state === 'string') (f as { state: string }).state = state;
  }
  for (const [n, c] of [...o.foes]) if (!seen.has(n)) { o.foes.delete(n); drop(c); } // gone from its owner's game
}
/** One of the others' foes, by owner and id. */
const copyOf = (from: number, n: number) => theirs.get(from)?.foes.get(n);

onRelay((m: Relay) => {
  if (m.t === 'foes') heard(m.from, String(m.loc), Array.isArray(m.list) ? m.list : []);
  else if (m.t === 'fhit') { // you are the owner: take the hit
    const f = mineOf(+(m.nid as number));
    if (!f) return;
    const flash = G.hitFlash;
    damageFoe(f, Math.max(0, Math.min(1e4, +(m.dmg as number) || 0)), !m.npc);
    G.hitFlash = flash; // not your shot
    if (f.hp <= 0 && !m.npc) relay({ t: 'kill', nid: m.nid }, m.from);
  } else if (m.t === 'kill') { // your shot killed their foe: it dies here as yours (loot, xp, bounties)
    const c = copyOf(m.from, +(m.nid as number));
    if (!c) return;
    theirs.get(m.from)!.foes.delete(+(m.nid as number));
    unmarkRemote(c.o);
    if (alive(c.o)) damageFoe(c.o, 1e9);
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
  } else if (m.t === 'bolt') {
    if (m.loc !== myLoc() || !Array.isArray(m.p) || !Array.isArray(m.v)) return;
    const [x, y, z] = m.p as number[], [vx, vy, vz] = m.v as number[];
    ghostBolt(V(nearX(x, G.pos.x), y, z), V(vx, vy, vz), +(m.c as number) || 0xffb347);
  }
});

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
  for (const [id, o] of [...theirs]) if (now - o.at > FOESYNC.quiet || !net.peers.has(id)) dropOwner(id);
  if ((clock -= dt) > 0) return;
  clock = FOESYNC.every;
  if (company()) tell(); else { mine.clear(); dying.clear(); }
}
