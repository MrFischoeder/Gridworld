// (0.227, PLAN_WALKI.md stage W5: conditions) The runtime side of gen/conditions.ts. A foe's owner game puts a hit's
// condition on it (`applyFx`, from damageFoe), breaks off its attack, holds it while the condition lasts and bleeds
// it (`tickCond`, from the update loops of creatures, robots, bandits and drones); the condition and the bleeding go to
// the other games with the foe (world/foesync.ts entries 14 and 15), so copies lie, reel or spark there too and take
// the extra. The player's own conditions (`knockDown`, `stagger`, `bleed`, `updateMyCond`) are put on whoever a foe's
// turn runs against: you, or through the turn's `hurt` (world/remote.ts) the other player.
import * as THREE from 'three';
import { G } from '../game';
import { condOf, condTime, bleedDps, BLEED, COND, PLAYER_COND, playerBleed, type Cond, type HitFx } from '../gen/conditions';
import type { FoeKey } from '../gen/tactics';
import { proxied, peerFx } from './remote';
import { tl } from '../i18n';

let logLine = (_t: string) => {};
/** main.ts: where the lines go (kept out of here so headless tests need no DOM). */
export function setCondLog(f: (t: string) => void) { logLine = f; }

/** The fields a foe carries for its condition (all optional; copies only get `cond` and `bleed` from their owner). */
export interface CondFoe {
  hp: number; maxHp?: number;
  cond?: string; condT?: number; condGuard?: number;
  bleed?: number; bleedT?: number; bleedBy?: number;
}
type AnyFoe = CondFoe & Record<string, unknown>;

/** What kind of foe it is for the tables (null: a raider's vehicle, a boss). */
export function keyOf(t: object): FoeKey | null {
  const o = t as { kind?: string; role?: string; model?: string; boss?: boolean };
  if (o.kind) return o.kind === 'raider' ? null : o.kind === 'bandit' ? (o.role as FoeKey) : o.kind === 'robot' ? (o.model as FoeKey) : (o.kind as FoeKey);
  return o.boss ? null : 'drone';
}

/** Breaks off what the foe was doing: a beast's leap, charge or dive, a machine's swing or charge, a bandit's blow or burst. */
function breakOff(f: AnyFoe, c: Cond) {
  const o = f as Record<string, unknown> & { state?: string; timer?: number };
  if (o.kind === 'robot') {
    o.charge = 0; o.swing2 = 0;
    if (o.mode === 'shield' || o.mode === 'mark') { o.mode = ''; o.modeT = 0; o.markAt = undefined; }
    o.atkT = Math.max(+(o.atkT as number) || 0, 0.6);
  } else if (o.kind === 'bandit') {
    o.blow = false; o.burst = 0; o.hitT = 0; o.fireT = Math.max(+(o.fireT as number) || 0, 0.8);
  } else if (o.kind) { // a beast
    const s = o.state;
    if (o.kind === 'leechwing' && c === 'down') { o.state = 'grounded'; o.timer = COND.down; return; } // brought down out of the air
    if (s === 'dash' || s === 'howl') { o.state = 'retreat'; o.timer = 0.6; }
    else if (s === 'charge' || s === 'threat') { o.state = 'recover'; o.timer = 0.6; }
    else if (s === 'dive' || s === 'screech') { o.state = 'climb'; o.timer = 2; }
  }
}

/**
 * The owner's side of a hit with effects: a condition by its weight against the foe's poise (not again while the
 * foe has only just got up), and a cut's bleeding on a beast. `by` = the player whose hit it was (0: yours).
 */
export function applyFx(f: object, dmg: number, fx: HitFx, by = 0): Cond | null {
  const o = f as AnyFoe, k = keyOf(f);
  if (!k || o.hp <= 0) return null;
  if (fx.cut && 'kind' in o && o.kind !== 'robot' && o.kind !== 'bandit' && o.kind !== 'raider') {
    o.bleed = bleedDps(o.bleed ?? 0, dmg, o.maxHp ?? o.hp); o.bleedT = BLEED.time; o.bleedBy = by;
  }
  const c = condOf(k, dmg, o.maxHp ?? o.hp + dmg, fx);
  if (!c || (c !== 'stun' && (o.condGuard ?? 0) > 0)) return null;
  if (o.cond === 'down' && c === 'stagger') return null; // already lying there
  if (o.kind === 'leechwing' && c === 'stagger' && o.state === 'grounded') return null;
  o.cond = c; o.condT = condTime(k, c);
  breakOff(o, c);
  if (o.cond === 'down' && o.kind === 'leechwing') { o.cond = ''; o.condT = 0; } // its own 'grounded' does it
  return c;
}

let bleedRoute = (_f: object, _by: number, d: number, hurt: (d: number, credit: boolean) => void) => hurt(d, true);
/** world/foesync.ts: how bleeding from another player's cut is taken (their kill, not yours). */
export function setBleedRoute(f: typeof bleedRoute) { bleedRoute = f; }

/**
 * The owner's turn of a foe's condition: the bleeding runs on (through `hurt`, the foe's own damage), the condition
 * counts down. True while the condition holds it (it does nothing this turn).
 */
export function tickCond(f: object, dt: number, hurt: (d: number, credit: boolean) => void): boolean {
  const o = f as AnyFoe;
  if (o.bleedT && o.bleedT > 0) {
    o.bleedT -= dt;
    const d = (o.bleed ?? 0) * dt, flash = G.hitFlash;
    if (d > 0) bleedRoute(f, o.bleedBy ?? 0, d, hurt);
    G.hitFlash = flash; // not a hit of yours this frame
    if (o.bleedT <= 0) { o.bleed = 0; o.bleedT = 0; }
  }
  if (o.condGuard && o.condGuard > 0) o.condGuard -= dt;
  if (!o.cond) return false;
  if ((o.condT = (o.condT ?? 0) - dt) > 0) return true;
  o.condGuard = o.cond === 'stun' ? 0 : COND.guard; o.cond = ''; o.condT = 0;
  return false;
}
/** Forget a foe's condition (it died, or was dropped). */
export function clearCond(f: object) { const o = f as AnyFoe; o.cond = ''; o.condT = 0; o.bleed = 0; o.bleedT = 0; }

// ---------- the player ----------
let downT = 0, staggerT = 0, wounds: number[] = [], told = 0;
/** Lying on the ground after a fall (s left), for updatePlayer, the camera and the weapons. */
export const playerDown = () => downT > 0;
export const downShare = () => Math.min(1, downT / PLAYER_COND.down);
/** Reeling from a heavy blow: movement slowed. */
export const playerStaggered = () => staggerT > 0;
export const bleedingWounds = () => wounds.length;

/** Thrown to the ground (a Bramble's charge, the Assault's hammer, a grenade at your feet): on whoever the turn is against. */
export function knockDown() {
  if (proxied()) { peerFx('down'); return; }
  if (G.god || downT > 0) return;
  downT = PLAYER_COND.down; staggerT = 0;
  G.crouch = false;
  logLine(tl('You are knocked off your feet!'));
}
/** Staggered by a heavy blow: slowed for a moment, the view jolted. */
export function stagger() {
  if (proxied()) { peerFx('stagger'); return; }
  if (G.god || downT > 0) return;
  staggerT = PLAYER_COND.stagger;
  G.pitch = Math.min(1.5, G.pitch + 0.08); G.yaw += (Math.random() - 0.5) * 0.12;
}
/** A wound that bleeds (a bite, a blade). */
export function bleed() {
  if (proxied()) { peerFx('bleed'); return; }
  if (G.god) return;
  if (wounds.length >= PLAYER_COND.bleed.max) wounds.shift();
  wounds.push(PLAYER_COND.bleed.time);
  const now = performance.now();
  if (now - told > 4000) { told = now; logLine(tl('You are bleeding! A medkit will stop it.')); }
}
/** A hit of `dmg` taken: a heavy one staggers (called where the foes hurt you). */
export function heavyHit(dmg: number) { if (dmg >= G.S.maxHp * PLAYER_COND.heavy) stagger(); }
/** Another player's foe did this to you (the relayed `hurt`). */
export function takeFx(k: string) { if (k === 'down') knockDown(); else if (k === 'stagger') stagger(); else if (k === 'bleed') bleed(); }
/** A medkit closes every wound. */
export function stopBleeding() { const n = wounds.length; wounds = []; return n > 0; }
/** Clear everything (death, a new place). */
export function clearMyCond() { downT = 0; staggerT = 0; wounds = []; }

/** Main loop: your conditions run down; the wounds bleed (a red pulse at the edges now and then). */
export function updateMyCond(dt: number, hurt: (d: number) => void) {
  if (downT > 0) downT = Math.max(0, downT - dt);
  if (staggerT > 0) staggerT = Math.max(0, staggerT - dt);
  if (!wounds.length) return;
  hurt(playerBleed(wounds.length) * dt);
  for (let i = wounds.length - 1; i >= 0; i--) if ((wounds[i] -= dt) <= 0) wounds.splice(i, 1);
  if (Math.random() < dt * 0.8) G.dmgFlash = Math.max(G.dmgFlash, 0.12);
}

/** The camera while down: lower, rolled to a side, looking up a little. */
export function downView(): { drop: number; roll: number } {
  if (downT <= 0) return { drop: 0, roll: 0 };
  const k = downT / PLAYER_COND.down, e = k > 0.8 ? (1 - k) / 0.2 : k < 0.25 ? k / 0.25 : 1; // fall, lie, get up
  return { drop: 1.15 * e, roll: 0.55 * e };
}

// ---------- looks (owner and copies alike) ----------
const tmp = new THREE.Vector3();
/** A small red-amber drip under a bleeding beast now and then. */
export function bleedDrip(o: { bleed?: number }, p: THREE.Vector3, dt: number, drip: (at: THREE.Vector3) => void) {
  if ((o.bleed ?? 0) > 0 && Math.random() < dt * 5) drip(tmp.copy(p));
}
