// Sliding doors, locked gate doors and stairwells with their walk-through transition.
import * as THREE from 'three';
import { scene, lineMat, V, circlePts } from './render';
import { G, W } from '../game';
import { DIRV, type Dir } from '../core/rng';
import { setDoorCells, type PlacedDoor } from '../gen/doors';
import type { PortalSpec } from '../gen/stairs';
import { EYE } from './player';
import { burst } from './fx';
import { takeOne, saveChar, progress, progressHas } from '../character';
import { showToast, logLine, el } from '../ui/hud';

export interface Door {
  g: THREE.Group; left: THREE.Group; right: THREE.Group; cx: number; cz: number; y0: number; axis: 'x' | 'z';
  cells: [number, number, number][]; open: number; blocked: boolean; locked: boolean; idx: number;
  panelMat: THREE.LineBasicMaterial; frameMat: THREE.LineBasicMaterial; lock: THREE.LineLoop;
}
export interface Stair {
  door: Door; key: string; go: () => void; dir: Dir; up: boolean; o: [number, number]; cx: number; cz: number; y0: number;
  axis: 'x' | 'z'; label: string; spawn: THREE.Vector3; yawIn: number; yawOut: number;
}

function panelGeo() {
  const pts: THREE.Vector3[] = [], w = 1.5, h = 3;
  const L = (a: number[], b: number[]) => pts.push(V(a[0], a[1], a[2]), V(b[0], b[1], b[2]));
  L([0, 0, 0], [w, 0, 0]); L([w, 0, 0], [w, h, 0]); L([w, h, 0], [0, h, 0]); L([0, h, 0], [0, 0, 0]);
  for (let y = 0.5; y < h; y += 0.5) L([0, y, 0], [w, y, 0]);
  L([w - 0.15, 0.3, 0], [w - 0.15, h - 0.3, 0]);
  return new THREE.BufferGeometry().setFromPoints(pts);
}
const PANEL_GEO = panelGeo(), panelFill = new THREE.PlaneGeometry(1.5, 3);
const panelFillMat = new THREE.MeshBasicMaterial({ color: 0x020f06, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });

/** Visuals and runtime state for a door already placed in the collision space. */
export function makeDoor(d: PlacedDoor, idx: number): Door {
  const g = new THREE.Group(); g.position.set(d.cx, d.y0, d.cz); if (d.axis === 'x') g.rotation.y = Math.PI / 2;
  const locked = d.locked && !progressHas('unlocked', idx);
  const panelMat = lineMat(locked ? 0xff5a3c : 0x6dffa0), frameMat = lineMat(locked ? 0xff5a3c : 0xb07a20);
  const mk = (side: number) => {
    const p = new THREE.Group();
    const fill = new THREE.Mesh(panelFill, panelFillMat);
    fill.position.set(0.75, 1.5, 0);
    const l = new THREE.LineSegments(PANEL_GEO, panelMat); p.add(fill, l);
    if (side < 0) p.scale.x = -1;
    g.add(p); return p;
  };
  const left = mk(-1), right = mk(1);
  const frame = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints([V(-1.5, 0, 0), V(1.5, 0, 0), V(1.5, 3, 0), V(-1.5, 3, 0)]), frameMat);
  g.add(frame);
  const lock = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(0.28, 4)), lineMat(0xff5a3c, { fog: true }));
  lock.position.set(0, 1.5, 0.12); lock.visible = locked; g.add(lock);
  scene.add(g);
  return { g, left, right, cx: d.cx, cz: d.cz, y0: d.y0, axis: d.axis, cells: d.cells, open: 0, blocked: true, locked, idx, panelMat, frameMat, lock };
}
export function setDoorBlock(door: Door, b: boolean) { if (door.blocked === b) return; door.blocked = b; setDoorCells(G.space, door.cells, b); }

export function updateDoors(dt: number) {
  for (const d of W.doors) {
    d.lock.rotation.z += dt * 1.5;
    const near = !d.locked && Math.hypot(d.cx - G.pos.x, d.cz - G.pos.z) < 3.6 && Math.abs(G.pos.y - d.y0) < 2;
    d.open = Math.max(0, Math.min(1, d.open + (near ? 2.5 : -1.6) * dt));
    const k = d.open * d.open * (3 - 2 * d.open);
    // panels start in the middle: the left one slides left (scale -1), the right one right
    d.left.position.x = -k * 1.5; d.right.position.x = k * 1.5;
    if (d.open > 0.85) setDoorBlock(d, false);
    else if (!near) setDoorBlock(d, true);
  }
}
export function unlockDoor(d: Door) {
  if (!takeOne('key')) { logLine('Locked. You need an Access Key'); return; }
  d.locked = false; d.panelMat.color.setHex(0x6dffa0); d.frameMat.color.setHex(0xb07a20); d.lock.visible = false;
  progress('unlocked').push(d.idx); saveChar();
  burst(V(d.cx, d.y0 + 1.5, d.cz), 0xff7a5c, 24, 1.2); showToast('Door unlocked');
}

// ---------- stairwells ----------
/** Eye-height point along a stairwell (t: 0 = doorway, < 0 = inside the room). */
export function stairPoint(st: Pick<Stair, 'up' | 'cx' | 'cz' | 'o' | 'y0'>, t: number) {
  const fl = t <= 1 ? 0 : (st.up ? Math.min(t - 1, 6) : -Math.min(t - 1, 6));
  return V(st.cx + st.o[0] * t, st.y0 + fl + EYE, st.cz + st.o[1] * t);
}
export function signTexture(text: string, color: string, font = 56) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const c = cv.getContext('2d')!;
  c.fillStyle = '#000'; c.fillRect(0, 0, 512, 96); c.strokeStyle = color; c.lineWidth = 4; c.strokeRect(4, 4, 504, 88);
  c.fillStyle = color; c.font = font + 'px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText(text, 256, 50);
  return new THREE.CanvasTexture(cv);
}
/** Stairwell = door + sign + where it leads. The door must already be placed at `placed`. */
export function makeStair(p: PortalSpec, placed: PlacedDoor, idx: number, text: string, label: string, go: () => void): Stair {
  const door = makeDoor(placed, idx);
  W.doors.push(door);
  const o = DIRV[p.dir], cx = p.axis === 'x' ? p.m + 0.5 : p.c + 0.5, cz = p.axis === 'x' ? p.c + 0.5 : p.m + 0.5;
  // sign above the door
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({ map: signTexture(text, '#5cc8ff'), fog: true }));
  const inward = -(o[0] || o[1]);
  sign.position.set(0, 3.45, inward * 0.52); if (inward < 0) sign.rotation.y = Math.PI;
  door.g.add(sign);
  door.frameMat.color.setHex(0x5cc8ff);
  const inv = V(-o[0], 0, -o[1]), y0 = placed.y0;
  return {
    door, key: p.key, go, dir: p.dir, up: p.up, o, cx, cz, y0, axis: p.axis, label,
    spawn: V(cx + inv.x * 2.2, y0, cz + inv.z * 2.2), yawIn: Math.atan2(o[0], o[1]), yawOut: Math.atan2(-o[0], -o[1]),
  };
}

// ---------- transition: the camera climbs the stairs, the screen fades, the new place loads, the camera walks out ----------
function polyAt(pts: THREE.Vector3[], k: number) {
  const L = [0]; for (let i = 1; i < pts.length; i++) L.push(L[i - 1] + pts[i].distanceTo(pts[i - 1]));
  const t = k * L[L.length - 1]; let i = 1; while (i < pts.length - 1 && L[i] < t) i++;
  const f = (t - L[i - 1]) / Math.max(1e-6, L[i] - L[i - 1]); return pts[i - 1].clone().lerp(pts[i], Math.min(1, Math.max(0, f)));
}
export function startStairs(st: Stair) {
  G.firing = false; for (const k in G.keys) G.keys[k] = false;
  const here = V(G.pos.x, G.pos.y + EYE, G.pos.z);
  G.trans = { phase: 'out', t: 0, dur: 1.4, st, pts: [here, stairPoint(st, 1), stairPoint(st, 3), stairPoint(st, 6)], yaw0: G.yaw, yaw1: st.yawOut, p0: G.pitch, p1: st.up ? 0.3 : -0.3, go: st.go };
}
export function arriveVia(a: Stair | null) {
  const pos = G.pos;
  if (a) {
    a.door.open = 1; setDoorBlock(a.door, false);
    G.trans = { phase: 'in', t: 0, dur: 1.4, st: a, pts: [stairPoint(a, 6), stairPoint(a, 3), stairPoint(a, 1), stairPoint(a, -2.2)], yaw0: a.yawIn, yaw1: a.yawIn, p0: a.up ? -0.3 : 0.3, p1: 0 };
  } else {
    G.trans = { phase: 'in', t: 0, dur: 0.8, st: {}, pts: [V(pos.x, pos.y + EYE, pos.z), V(pos.x, pos.y + EYE, pos.z)], yaw0: G.yaw, yaw1: G.yaw, p0: G.pitch, p1: G.pitch };
  }
}
export function updateTrans(dt: number, camera: THREE.Camera) {
  const T = G.trans!; T.t += dt; const k = Math.min(1, T.t / T.dur), e = k * k * (3 - 2 * k);
  const p = polyAt(T.pts, e);
  const stepBob = Math.abs(Math.sin(e * Math.PI * 7)) * 0.06;
  camera.position.set(p.x, p.y + stepBob, p.z);
  let dy = T.yaw1 - T.yaw0; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
  G.yaw = T.yaw0 + dy * Math.min(1, e * 2.5); G.pitch = T.p0 + (T.p1 - T.p0) * e;
  el.warp.style.opacity = String(T.phase === 'out' ? Math.pow(k, 1.6) : 1 - k);
  if (T.st.door) { T.st.door.open = 1; setDoorBlock(T.st.door, false); }
  if (k >= 1) { if (T.phase === 'out') T.go!(); else { G.trans = null; el.warp.style.opacity = '0'; } }
}
