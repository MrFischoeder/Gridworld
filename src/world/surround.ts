// (0.229, PLAN_WALKI.md stage W7) The runtime of gen/surround.ts. A group's places round its target are shared out
// every half second (or when the target moves on): a place counts as open when a body could stand there and nothing
// solid stands between it and the target (`rayWorld`: walls, rocks, trunks, houses, voxels below ground), and the
// ground there is not a drop or a cliff. Run by the game that runs the group (its owner), against whoever the turn is
// against (G.pos), so nothing new goes over the wire.
import * as THREE from 'three';
import { G } from '../game';
import { rayWorld } from './player';
import { foeRules, foes } from './enemies';
import { proxied } from './remote';
import { SURROUND, slotAngle, shareSlots, backToWall } from '../gen/surround';
import { tl } from '../i18n';

interface Plan { t: number; tx: number; tz: number; n: number; slot: Map<object, number> }
const plans = new WeakMap<object, Plan>();
const O = new THREE.Vector3(), D = new THREE.Vector3();
/** Whether a body could stand `r` m from (tx, ty, tz) at bearing `a` and reach it from there. */
export function openAt(tx: number, ty: number, tz: number, a: number, r: number): boolean {
  O.set(tx, ty + 1, tz); D.set(Math.sin(a), 0, Math.cos(a));
  if (rayWorld(O, D, r) < r - 0.3) return false;
  const x = tx + D.x * r, z = tz + D.z * r, g = G.ground ? G.ground(x, z) : ty;
  const gy = Number.isFinite(g) ? g : ty;
  if (Math.abs(gy - ty) > 2.5) return false; // a drop or a cliff between
  return !foeRules.body(x, gy, z, 0.35);
}
export interface SlotPoint { x: number; z: number; wait: boolean }
/**
 * Where member `self` of `group` (the members fighting now, `self` among them; `key` the object that names the group)
 * should go to come at the target (G.pos) from its own side: its place on a ring of `ring` m, or, with no place
 * left, a waiting spot `SURROUND.wait` m out on its own bearing.
 */
export function slotFor(self: { p: THREE.Vector3 }, group: { p: THREE.Vector3 }[], key: object, ring = SURROUND.ring): SlotPoint {
  const now = performance.now() / 1000, tx = G.pos.x, tz = G.pos.z;
  let plan = plans.get(key);
  if (!plan || now - plan.t > SURROUND.every || plan.n !== group.length || !plan.slot.has(self) || Math.hypot(plan.tx - tx, plan.tz - tz) > SURROUND.moved) {
    const open: boolean[] = [];
    for (let k = 0; k < SURROUND.slots; k++) open.push(openAt(tx, G.pos.y, tz, slotAngle(k), ring));
    const bearings = group.map((m) => Math.atan2(m.p.x - tx, m.p.z - tz));
    const order = group.map((_, i) => i).sort((a, b) => Math.hypot(group[a].p.x - tx, group[a].p.z - tz) - Math.hypot(group[b].p.x - tx, group[b].p.z - tz));
    const got = shareSlots(bearings.map((b) => (b < 0 ? b + Math.PI * 2 : b)), order, open);
    plan = { t: now, tx, tz, n: group.length, slot: new Map(group.map((m, i) => [m as object, got[i]])) };
    plans.set(key, plan);
  }
  const k = plan.slot.get(self) ?? -1;
  if (k >= 0) { const a = slotAngle(k); return { x: tx + Math.sin(a) * ring, z: tz + Math.cos(a) * ring, wait: false }; }
  const a = Math.atan2(self.p.x - tx, self.p.z - tz);
  return { x: tx + Math.sin(a) * SURROUND.wait, z: tz + Math.cos(a) * SURROUND.wait, wait: true };
}

let probeT = 0, toldAt = -1e9, walled = false;
/** How many of the 8 sides round you are walled in (m away `SURROUND.probe`). */
export function sidesBlocked(x: number, y: number, z: number): number {
  let n = 0;
  for (let i = 0; i < 8; i++) if (!openAt(x, y, z, (i / 8) * Math.PI * 2, SURROUND.probe)) n++;
  return n;
}
/** Main loop: notices (now and then) that your back is to a wall while foes are close, and says what it means. */
export function updateSurround(dt: number, say: (t: string) => void) {
  if ((probeT -= dt) > 0 || proxied()) return;
  probeT = 0.5;
  const near = foes().some((f) => f.hp > 0 && Math.hypot(f.p.x - G.pos.x, f.p.z - G.pos.z) < 16);
  if (!near) { walled = false; return; }
  const was = walled;
  walled = backToWall(sidesBlocked(G.pos.x, G.pos.y, G.pos.z));
  const now = performance.now();
  if (walled && !was && now - toldAt > 90000) { toldAt = now; say(tl('Your back is to the wall: they can only come at you from the open side.')); }
}
/** Whether your back was to something at the last look (for the HUD and tests). */
export const atWall = () => walled;
