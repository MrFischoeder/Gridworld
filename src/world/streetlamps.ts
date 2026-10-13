// (0.203) The villages' street lamps (gen/streetlamps.ts): every lamp is built by a hero from a kit (Electric Street
// Lamp or Oil Street Lamp, made by the blacksmith). Use the kit in or near a village and a hologram shows the post
// where you look; a click puts it up. They are drawn round the villages near you, burn by night (an electric one while
// the village's power plant gives power, an oil one while its tank has oil) and light the ground (world/light.ts).
// E at a lamp opens its window: the oil left, fill it with Lamp Oil or a fuel canister, or take it down (the kit back).
// Multiplayer: the lamps live in the shared `TownState.lamps`, written only under the village's lock
// (`withTownStock`), so two heroes cannot put up a lamp on the same spot or pour the same tank at once; every game
// draws and lights them from that state the same way. `PROTOCOL` unchanged.
import * as THREE from 'three';
import { G, W } from '../game';
import { OW } from './overworld';
import { driving } from './vehicles';
import { scene, lineMat } from './render';
import { addLights } from './light';
import { powerUp } from './power';
import { allVillages, findPoi, worldDist, nearX, type Poi } from '../gen/regions';
import { STREET, oilLeft, fillLamp, lampLit, lampProblem, isNight, type StreetKind, type StreetLamp } from '../gen/streetlamps';
import { takeOne, hasItem, addItem, saveChar } from '../character';
import { withTownStock } from '../ui/stock';
import { lockPointer } from '../ui/input';
import { logLine, showToast } from '../ui/hud';
import { item, type ItemKey } from '../data/items';
import { tl, TL } from '../i18n';

const KIT: Record<StreetKind, ItemKey> = { electric: 'elampkit', oil: 'olampkit' };
const NAME = (k: StreetKind) => (k === 'electric' ? tl('electric street lamp') : tl('oil street lamp'));
const where = (v: Poi, l: StreetLamp) => ({ x: nearX(v.x + l.x, G.pos.x), z: v.z + l.z });
const groundAt = (x: number, z: number) => OW.terrain?.heightAt(x, z) ?? 0;

// ---------- drawing ----------
interface Drawn { g: THREE.Group; sig: string; heads: { lit: THREE.LineBasicMaterial; glow: THREE.Mesh }[] }
const drawn = new Map<number, Drawn>();
const POST_E = 0x9ab8a8, POST_O = 0x8a6a3a, LIT_E = 0xeaffff, LIT_O = 0xffc070, DARK_HEAD = 0x4a5a50;
const glowGeo = new THREE.SphereGeometry(0.16, 8, 6);
function lampModel(l: StreetLamp, x: number, z: number): [THREE.Group, { lit: THREE.LineBasicMaterial; glow: THREE.Mesh }] {
  const g = new THREE.Group(), y = groundAt(x, z), h = STREET.h, e = l.k === 'electric';
  const post = lineMat(e ? POST_E : POST_O), head = lineMat(DARK_HEAD); head.fog = false;
  const pts = e ? [[0, 0, 0], [0, h, 0], [0, h, 0], [0.8, h + 0.1, 0], [0.8, h + 0.1, 0], [0.8, h - 0.1, 0], [-0.15, 0, -0.15], [0.15, 0, 0.15], [-0.15, 0, 0.15], [0.15, 0, -0.15]]
    : [[0, 0, 0], [0, h, 0], [0, h - 0.2, 0], [0.6, h - 0.05, 0], [0, h - 0.6, 0], [0.4, h - 0.12, 0], [0.6, h - 0.05, 0], [0.6, h - 0.25, 0], [-0.2, 0, 0], [0.2, 0, 0]];
  g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts.map(([a, b, c]) => new THREE.Vector3(a, b, c))), post));
  const hd = e ? new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.08, 0.32, 0.22, 8, 1, true)), head)
    : new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.14, 0.17, 0.4, 6)), head);
  hd.position.set(e ? 0.8 : 0.6, e ? h - 0.2 : h - 0.48, 0); g.add(hd);
  const glow = new THREE.Mesh(glowGeo, new THREE.MeshBasicMaterial({ color: e ? LIT_E : LIT_O, fog: false, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.position.set(hd.position.x, hd.position.y - (e ? 0.12 : 0), 0); glow.visible = false; g.add(glow);
  g.position.set(x, y, z); g.rotation.y = ((l.x * 7 + l.z * 3) % 6.283); // each arm its own way
  return [g, { lit: head, glow }];
}
const sigOf = (v: Poi) => `${nearX(v.x, G.pos.x)}|` + (G.char.towns[v.id]?.lamps ?? []).map((l) => `${l.k}:${l.x}:${l.z}`).join(',');
function dropDrawn(id: number) { const d = drawn.get(id); if (!d) return; scene.remove(d.g); d.g.traverse((o) => (o as THREE.Line).geometry !== glowGeo && (o as THREE.Line).geometry?.dispose()); drawn.delete(id); }
let syncT = 0;
/** Main loop: draw the lamps of the villages near you, and light the ones that burn now. */
export function updateStreetLamps(dt: number) {
  if (G.char.loc !== 'overworld' || !OW.terrain) { for (const id of [...drawn.keys()]) dropDrawn(id); return; }
  if ((syncT -= dt) > 0) return;
  syncT = 0.5;
  const near = new Set<number>(), now = G.char.time;
  for (const v of allVillages(G.char.world)) {
    if (worldDist(v.x, v.z, G.pos.x, G.pos.z) > 450) continue;
    const lamps = G.char.towns[v.id]?.lamps ?? [];
    if (!lamps.length) continue;
    near.add(v.id);
    let d = drawn.get(v.id); const sig = sigOf(v);
    if (!d || d.sig !== sig) {
      dropDrawn(v.id); d = { g: new THREE.Group(), sig, heads: [] };
      for (const l of lamps) { const p = where(v, l), [m, h] = lampModel(l, p.x, p.z); d.g.add(m); d.heads.push(h); }
      scene.add(d.g); drawn.set(v.id, d);
    }
    const pw = powerUp(v.id);
    lamps.forEach((l, i) => { const h = d!.heads[i]; if (!h) return; const on = lampLit(l, now, pw); h.glow.visible = on; h.lit.color.setHex(on ? (l.k === 'electric' ? LIT_E : LIT_O) : DARK_HEAD); });
  }
  for (const id of [...drawn.keys()]) if (!near.has(id)) dropDrawn(id);
}
/** The lamps burning now, for the light map. */
addLights((out) => {
  if (G.char.loc !== 'overworld' || !isNight(G.char.time)) return;
  for (const id of drawn.keys()) {
    const v = findPoi(G.char.world, id), lamps = G.char.towns[id]?.lamps ?? [], pw = powerUp(id);
    if (!v) continue;
    for (const l of lamps) if (lampLit(l, G.char.time, pw)) { const p = where(v, l); out.push({ x: p.x, y: groundAt(p.x, p.z) + STREET.h - 0.3, z: p.z, r: l.k === 'electric' ? STREET.r : STREET.ro, k: l.k === 'oil' ? 'oil' : 'electric' }); }
  }
});
export function clearStreetLamps() { for (const id of [...drawn.keys()]) dropDrawn(id); cancelStreetPlacing(true); }

// ---------- the lamp you stand at ----------
export interface NearLamp { vid: number; i: number }
export function nearStreetLamp(): NearLamp | null {
  if (G.char.loc !== 'overworld' || driving.v) return null;
  for (const id of drawn.keys()) {
    const v = findPoi(G.char.world, id); if (!v) continue;
    const lamps = G.char.towns[id]?.lamps ?? [];
    for (let i = 0; i < lamps.length; i++) { const p = where(v, lamps[i]); if (Math.hypot(p.x - G.pos.x, p.z - G.pos.z) < 1.6) return { vid: id, i }; }
  }
  return null;
}
const hm = (m: number) => `${Math.floor(m / 60)}:${String(Math.floor(m % 60)).padStart(2, '0')}`;
export function streetLampPrompt(n: NearLamp): string {
  const l = G.char.towns[n.vid]?.lamps?.[n.i]; if (!l) return '';
  if (l.k === 'oil') return TL`E — the oil street lamp (oil for ${hm(oilLeft(l, G.char.time))} of burning)`;
  return powerUp(n.vid) ? tl('E — the electric street lamp (on the village power)') : tl('E — the electric street lamp (no power: the village needs its power plant)');
}

// ---------- its window ----------
let open: NearLamp | null = null;
const root = () => document.getElementById('dlg')!;
function render(msg = '') {
  const n = open!, v = findPoi(G.char.world, n.vid)!, l = G.char.towns[n.vid]?.lamps?.[n.i];
  if (!l) { close(); return; }
  let h = TL`<div data-slamp="1"><h2>Street lamp</h2><div class="role">${NAME(l.k)} · ${v.name}</div>`;
  if (l.k === 'oil') {
    const left = oilLeft(l, G.char.time), share = Math.round(left / STREET.cap * 100);
    h += TL`<div class="say">Oil in the tank: <b>${hm(left)}</b> of burning (${share}%). It burns only by night, from 20:00 to 06:00.${msg ? '<br>' + msg : ''}</div>`;
    h += TL`<div class="shoprow"><div>${item('lampoil').name}<br><span>+${hm(STREET.flask)} a flask</span></div><button class="buy" data-sl="flask" ${hasItem('lampoil') && left < STREET.cap ? '' : 'disabled'}>Pour a flask</button></div>`;
    h += TL`<div class="shoprow"><div>${item('fuel').name}<br><span>+${hm(STREET.can)} a canister</span></div><button class="buy" data-sl="can" ${hasItem('fuel') && left < STREET.cap ? '' : 'disabled'}>Pour a canister</button></div>`;
  } else {
    h += `<div class="say">${powerUp(n.vid) ? tl('It burns by night on the village power and draws a little of it. It needs no tending.') : tl('It stays dark: the village has no power. Build or mend its power plant.')}${msg ? '<br>' + msg : ''}</div>`;
  }
  h += TL`<button class="opt" data-sl="down">Take it down (the kit back)</button><button class="opt" data-sl="close">Close</button></div>`;
  root().querySelector('.panel')!.innerHTML = h;
}
export function openStreetLamp(n: NearLamp) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = n; G.dlgOpen = true; G.firing = false; W.talkNpc = null; for (const k in G.keys) G.keys[k] = false;
  render(); root().style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = null; G.dlgOpen = false; root().style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in a lamp's window (from the dialogue's click handler). */
export function streetLampClick(t: HTMLElement): boolean {
  if (!open || !G.dlgOpen || !t.closest('[data-slamp]')) return false;
  const b = t.closest('[data-sl]') as HTMLElement | null; if (!b) return true;
  const a = b.dataset.sl!, n = open;
  if (a === 'close') { close(); return true; }
  let msg = '';
  void withTownStock(n.vid, () => {
    const lamps = G.char.towns[n.vid]?.lamps, l = lamps?.[n.i]; if (!l || !lamps) return;
    if (a === 'down') {
      if (!addItem(KIT[l.k], 1, true)) { msg = tl('No room in your backpack for the kit.'); return; }
      lamps.splice(n.i, 1); msg = TL`You take the ${NAME(l.k)} down.`; open = null; return;
    }
    const k: ItemKey = a === 'flask' ? 'lampoil' : 'fuel';
    if (l.k !== 'oil' || !hasItem(k)) return;
    if (oilLeft(l, G.char.time) >= STREET.cap) { msg = tl('The tank is full.'); return; }
    takeOne(k); fillLamp(l, G.char.time, k === 'lampoil' ? STREET.flask : STREET.can);
    msg = TL`The tank holds oil for ${hm(oilLeft(l, G.char.time))} of burning.`;
  }).then((ok) => { if (!ok) return; saveChar(); syncT = 0; if (msg) logLine(msg); if (open) render(msg); else { close(); if (msg) showToast(msg); } });
  return true;
}

// ---------- putting one up ----------
let placing: StreetKind | null = null, vid = -1, spot: { x: number; z: number } | null = null, problem: string | null = null, preview: THREE.Group | null = null;
const OK = 0xb6ff3a, BAD = 0xff5a3c, holoMat = new THREE.LineBasicMaterial({ color: OK, depthTest: false, transparent: true, opacity: 0.9 });
export const isStreetPlacing = () => placing !== null;
/** Use a lamp kit: choose where it stands in or round the nearest village. */
export function startStreetPlacing(k: StreetKind): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine(tl('A street lamp is put up in or near a village, in the open.')); return false; }
  if (driving.v) { logLine(tl('Get out of the vehicle first.')); return false; }
  const v = allVillages(G.char.world).filter((p) => worldDist(p.x, p.z, G.pos.x, G.pos.z) < STREET.reach + 40).sort((a, b) => worldDist(a.x, a.z, G.pos.x, G.pos.z) - worldDist(b.x, b.z, G.pos.x, G.pos.z))[0];
  if (!v) { logLine(tl('Street lamps stand in or near a village: go closer to one.')); return false; }
  placing = k; vid = v.id; spot = null; problem = null;
  logLine(TL`Look where the ${NAME(k)} should stand in ${v.name}: click to put it up, right mouse button or Esc to cancel.`);
  return true;
}
export function cancelStreetPlacing(quiet = false) {
  if (placing === null) return;
  placing = null; spot = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine(tl('You put the lamp kit away.'));
}
function why(p: string): string {
  return p === 'too far' ? TL`Too far from the village (within ${STREET.reach} m of its middle).` : p === 'full' ? TL`The village has ${STREET.max} lamps already.` : p === 'close' ? tl('Too close to another lamp.') : p === 'water' ? tl('Not in the water.') : '';
}
export const streetPlacingHint = () => (placing === null ? null : problem ?? tl('Click — put the lamp up here · right mouse / Esc — cancel'));
export const streetPlacingOk = () => !!spot && !problem;
/** Every frame while placing: follow the view, check the spot, move the hologram. */
export function updateStreetPlacing() {
  if (placing === null) return;
  const T = OW.terrain, v = findPoi(G.char.world, vid);
  if (G.char.loc !== 'overworld' || driving.v || !T || !v) { cancelStreetPlacing(true); return; }
  const cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  let x = G.pos.x + dx * 3, z = G.pos.z + dz * 3;
  for (let t = 1; t <= 25; t += 0.25) { const px = G.pos.x + dx * t, pz = G.pos.z + dz * t; if (y0 + dy * t <= T.heightAt(px, pz)) { x = px; z = pz; break; } }
  x = Math.round(x * 2) / 2; z = Math.round(z * 2) / 2;
  const rx = Math.round((x - nearX(v.x, x)) * 2) / 2, rz = Math.round((z - v.z) * 2) / 2, wet = (T.water(x, z)?.depth ?? 0) > 0.2;
  problem = (wet ? why('water') : why(lampProblem(G.char.towns[vid], rx, rz))) || null;
  spot = { x: rx, z: rz };
  const y = T.heightAt(x, z), pts: number[] = [x, y, z, x, y + STREET.h, z, x, y + STREET.h, z, x + 0.7, y + STREET.h, z];
  const R = placing === 'electric' ? STREET.r : STREET.ro;
  for (let k = 0; k < 24; k++) { const a0 = k / 24 * 6.283, a1 = (k + 1) / 24 * 6.283; pts.push(x + Math.cos(a0) * R, T.heightAt(x + Math.cos(a0) * R, z + Math.sin(a0) * R) + 0.1, z + Math.sin(a0) * R, x + Math.cos(a1) * R, T.heightAt(x + Math.cos(a1) * R, z + Math.sin(a1) * R) + 0.1, z + Math.sin(a1) * R); }
  if (!preview) { preview = new THREE.Group(); preview.renderOrder = 10; scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const l = new THREE.LineSegments(geo, holoMat); l.renderOrder = 10; l.frustumCulled = false; preview.add(l);
  holoMat.color.setHex(problem ? BAD : OK);
}
/** Put the lamp up where the hologram stands. */
export async function confirmStreetPlacing() {
  if (placing === null || !spot || problem) { if (problem) logLine(problem); return; }
  const k = placing, at = spot, id = vid, v = findPoi(G.char.world, id);
  if (!hasItem(KIT[k])) { cancelStreetPlacing(true); return; }
  let done = false;
  const ok = await withTownStock(id, () => {
    const s = (G.char.towns[id] ??= {}), p = lampProblem(s, at.x, at.z);
    if (p) { logLine(why(p)); return; }
    if (!takeOne(KIT[k])) return;
    (s.lamps ??= []).push(k === 'oil' ? { k, x: at.x, z: at.z, oil: 0, t: G.char.time } : { k, x: at.x, z: at.z });
    done = true;
  });
  if (!ok || !done) return;
  saveChar(); syncT = 0; cancelStreetPlacing(true);
  showToast(TL`A street lamp in ${v?.name ?? ''}`);
  logLine(k === 'oil' ? tl('The oil lamp stands. Fill its tank with Lamp Oil or a fuel canister (E at the lamp): it burns by night.') : tl('The electric lamp stands. It burns by night while the village has power.'));
}
