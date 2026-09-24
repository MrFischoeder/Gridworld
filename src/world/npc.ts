// Village folk: wireframe figures with name labels, shopkeepers at their counters, villagers strolling.
import * as THREE from 'three';
import { scene, lineMat, V, fillMat } from './render';
import { G, W } from '../game';
import { NPC_INFO, type NpcRole } from '../data/npcs';
import type { Building } from '../gen/village';
import { houseHit } from './houses';
import { makeRig, poseRig, type Rig, type Kit } from './rig';

/** A figure: body, head, legs (swung by rotation) and a rig of arms holding its kit (world/rig.ts). */
export interface Figure { g: THREE.Group; legL: THREE.Line; legR: THREE.Line; rig: Rig; mat: THREE.LineBasicMaterial }
export interface Npc extends Figure {
  role: NpcRole; name: string; title: string; p: THREE.Vector3; home: THREE.Vector3; building: Building | null;
  target: THREE.Vector3 | null; wait: number; phase: number; face: number; y0: number;
  /** The village they live in. */
  town?: string;
  /** Where a guard walks his rounds (world cells along the inside of the wall). */
  route?: [number, number][];
}

export function textSprite(text: string, color: string, w = 1.9) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 48; const c = cv.getContext('2d')!;
  c.fillStyle = color; c.font = '38px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, 128, 26);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false }));
  sp.scale.set(w, w * 48 / 256, 1); return sp;
}

const headGeo = new THREE.IcosahedronGeometry(0.17, 0), bodyGeo = new THREE.BoxGeometry(0.42, 0.6, 0.24), figureFill = fillMat();
export function makeFigure(color: number, kit: Kit = 'none', shield = false, big = false): Figure {
  const m = lineMat(color), g = new THREE.Group();
  const head = new THREE.LineSegments(new THREE.EdgesGeometry(headGeo), m); head.position.y = 1.62;
  head.add(new THREE.Mesh(headGeo, figureFill));
  const visor = new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-0.08, 1.64, 0.17), V(0.08, 1.64, 0.17)]), m);
  const body = new THREE.LineSegments(new THREE.EdgesGeometry(bodyGeo), m); body.position.y = 1.12;
  body.add(new THREE.Mesh(bodyGeo, figureFill));
  const limb = (len: number) => new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(0, 0, 0), V(0, -len, 0)]), m);
  const legL = limb(0.8), legR = limb(0.8);
  legL.position.set(-0.12, 0.82, 0); legR.position.set(0.12, 0.82, 0);
  g.add(head, visor, body, legL, legR); scene.add(g);
  return { g, legL, legR, rig: makeRig(g, m, kit, shield, big), mat: m };
}
export function makeNpc(role: NpcRole, name: string, at: THREE.Vector3, building: Building | null): Npc {
  const info = NPC_INFO[role], f = makeFigure(info.color, role === 'guard' ? 'spear' : 'none', role === 'guard');
  const label = textSprite(name, '#' + info.color.toString(16).padStart(6, '0')); label.position.y = 2.15; f.g.add(label);
  f.g.position.copy(at);
  return Object.assign(f, {
    role, name, title: info.title, p: at.clone(), home: at.clone(), building, target: null,
    wait: Math.random() * 2, phase: Math.random() * 6, face: Math.random() * 6, y0: at.y,
  });
}
function npcFree(x: number, z: number, y0: number) {
  for (const [dx, dz] of [[-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25]]) {
    const cx = Math.floor(x + dx), cz = Math.floor(z + dz);
    if (!G.space.empty(cx, y0, cz) || !G.space.empty(cx, y0 + 1, cz)) return false;
  }
  return !houseHit(x, y0, z, 0.3);
}
export function updateNpcs(dt: number, time: number) {
  W.nearNpc = null; let best = 2.8;
  const pos = G.pos;
  for (const n of W.npcs) {
    let moving = false;
    const toP = V(pos.x - n.p.x, 0, pos.z - n.p.z), dP = toP.length();
    if (n === W.talkNpc || (n.role !== 'villager' && dP < 6)) { n.face = Math.atan2(toP.x, toP.z); }
    else if (n.role === 'guard' && dP < 4) { n.face = Math.atan2(toP.x, toP.z); } // stops to talk
    else if ((n.role === 'villager' && W.villageWalk.length) || (n.role === 'guard' && n.route?.length)) {
      if (n.wait > 0) n.wait -= dt;
      else {
        if (!n.target) { const list = n.route?.length ? n.route : W.villageWalk, c = list[(Math.random() * list.length) | 0]; n.target = V(c[0] + 0.5, n.y0, c[1] + 0.5); }
        const d = n.target.clone().sub(n.p); d.y = 0; const L = d.length();
        if (L < 0.3) { n.target = null; n.wait = 1 + Math.random() * 4; }
        else {
          d.normalize(); const nx = n.p.x + d.x * 1.3 * dt, nz = n.p.z + d.z * 1.3 * dt;
          if (npcFree(nx, nz, n.y0)) { n.p.x = nx; n.p.z = nz; moving = true; n.face = Math.atan2(d.x, d.z); } else { n.target = null; n.wait = 0.5; }
        }
      }
    } else { n.face += Math.sin(time * 0.3 + n.phase) * dt * 0.3; }
    n.phase += dt * (moving ? 7 : 0);
    const sw = moving ? Math.sin(n.phase) * 0.5 : 0;
    n.legL.rotation.x = sw; n.legR.rotation.x = -sw; poseRig(n.rig, { swing: sw });
    n.g.position.set(n.p.x, n.y0 + (moving ? Math.abs(Math.sin(n.phase)) * 0.04 : 0), n.p.z);
    let dr = n.face - n.g.rotation.y; dr = Math.atan2(Math.sin(dr), Math.cos(dr)); n.g.rotation.y += dr * Math.min(1, dt * 6);
    if (dP < best && Math.abs(pos.y - n.y0) < 2) { best = dP; W.nearNpc = n; }
  }
}
