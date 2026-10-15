// (0.204) Lighthouses (gen/lighthouses.ts): built by the heroes from Lighthouse Plans (the blacksmith). Use the plans on
// dry ground away from the villages and click where the tower should stand; then bring the materials to its door and
// hand them over bit by bit (from the backpack and the trunks of your vehicles by it). Finished, its lamp turns: two
// beams sweep round and whoever they pass sees a sharp flash, kilometres away (world/glows.ts); it lights nothing round
// it. At the door you light it or put it out and set how fast it turns, so the lighthouses can be told apart.
// Multiplayer: the lighthouses are the shared list `Char.lighthouses` (world/share.ts; the server's FIELDS); the beam's
// angle comes from the shared game clock, so everyone sees the same flash; the last change of speed wins.
import * as THREE from 'three';
import { G, W } from '../game';
import { OW } from './overworld';
import { driving } from './vehicles';
import { scene, lineMat, fillMat } from './render';
import { addGlows } from './light';
import { allVillages, nearX, worldDist } from '../gen/regions';
import { LH, lhRows, lhProgress, handOverLh, beamAngle, flashAt, lhProblem, type Lighthouse } from '../gen/lighthouses';
import { takeOne, hasItem, addItem, saveChar, gainXp, calcStats } from '../character';
import { carried, takeFrom, putAway } from '../ui/market';
import { lockPointer } from '../ui/input';
import { logLine, showToast } from '../ui/hud';
import { ITEMS, type ItemKey } from '../data/items';
import { tl, TL } from '../i18n';
import { lhPower, type LhPower } from '../gen/lhpower';

/** (0.221, PLAN_PRAD_I_LUDZIE.md stage Z7) Each lighthouse's power (gen/lhpower.ts), worked out every 2 s for the
 *  ones within sight; a lamp that is on but has no power stays dark. */
const power = new Map<string, LhPower>();
let powTick = 0;
const powerOf = (l: Lighthouse) => { let p = power.get(l.id); if (!p) { p = lhPower(G.char.world, l, G.char.towns, G.char.outposts, G.char.time); power.set(l.id, p); } return p; };
/** Its lamp turns now: finished, lit and powered. */
const shining = (l: Lighthouse) => !!l.done && l.on && powerOf(l).ok;

const list = () => (G.char.lighthouses ??= []);
const byId = (id: string) => list().find((l) => l.id === id) ?? null;
const placeOf = (l: Lighthouse) => ({ x: nearX(l.x, G.pos.x), z: l.z });

// ---------- the towers ----------
interface Live { l: Lighthouse; g: THREE.Group; spin: THREE.Group | null; core: THREE.Mesh | null; sig: string }
const live = new Map<string, Live>();
const WHITE = 0xe8f4ec, RED = 0xff6a4a, GLASS = 0x8fe8ff, STAKE = 0xffd060;
const sigOf = (l: Lighthouse) => `${nearX(l.x, G.pos.x).toFixed(1)}|${l.done ? 'd' : Math.round(lhProgress(l) * 20)}`;
function tower(l: Lighthouse): Live {
  const g = new THREE.Group(), x = nearX(l.x, G.pos.x), y = l.y, prog = lhProgress(l), done = !!l.done;
  g.position.set(x, y, l.z);
  if (!done) { // the site: stakes round the foot, and the tower rising with what has been handed over
    const sm = lineMat(STAKE), pts: THREE.Vector3[] = [];
    for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2, r = LH.r + 1.2; pts.push(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r), new THREE.Vector3(Math.cos(a) * r, 1.3, Math.sin(a) * r)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), sm));
  }
  const H = done ? LH.h : Math.max(0.6, LH.h * prog * 0.85), rTop = LH.r - (LH.r - 2.1) * (H / LH.h);
  const body = new THREE.CylinderGeometry(rTop, LH.r, H, 8, 1, true); body.translate(0, H / 2, 0);
  g.add(new THREE.Mesh(body, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(body), lineMat(WHITE)));
  // painted bands, every other one red
  for (let h = 3, k = 0; h < H - 1; h += 3.5, k++) {
    const r = LH.r - (LH.r - 2.1) * (h / LH.h) + 0.03, ring: THREE.Vector3[] = [];
    for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2 + Math.PI / 8; ring.push(new THREE.Vector3(Math.cos(a) * r, h, Math.sin(a) * r)); }
    g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ring), lineMat(k % 2 ? WHITE : RED)));
  }
  // the door
  const door = new THREE.BufferGeometry().setFromPoints([[-0.6, 0, LH.r], [-0.6, 2.2, LH.r], [-0.6, 2.2, LH.r], [0.6, 2.2, LH.r - 0.02], [0.6, 2.2, LH.r - 0.02], [0.6, 0, LH.r - 0.02]].map(([a, b, c]) => new THREE.Vector3(a, b, c)));
  g.add(new THREE.LineSegments(door, lineMat(WHITE)));
  let spin: THREE.Group | null = null, core: THREE.Mesh | null = null;
  if (done) {
    const top = LH.h, wm = lineMat(WHITE);
    // the gallery: a deck and a rail
    const deck = new THREE.CylinderGeometry(2.9, 2.9, 0.2, 12); deck.translate(0, top + 0.1, 0);
    g.add(new THREE.Mesh(deck, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(deck), wm));
    const rail: THREE.Vector3[] = [];
    for (let i = 0; i < 12; i++) { const a = i / 12 * Math.PI * 2, b = (i + 1) / 12 * Math.PI * 2; rail.push(new THREE.Vector3(Math.cos(a) * 2.85, top + 1.1, Math.sin(a) * 2.85), new THREE.Vector3(Math.cos(b) * 2.85, top + 1.1, Math.sin(b) * 2.85), new THREE.Vector3(Math.cos(a) * 2.85, top + 0.2, Math.sin(a) * 2.85), new THREE.Vector3(Math.cos(a) * 2.85, top + 1.1, Math.sin(a) * 2.85)); }
    g.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rail), wm));
    // the lantern room: glazing, a red dome and a vent
    const lantern = new THREE.CylinderGeometry(1.6, 1.6, 2.6, 8, 1, true); lantern.translate(0, top + 1.5, 0);
    g.add(new THREE.LineSegments(new THREE.EdgesGeometry(lantern), lineMat(GLASS)));
    const dome = new THREE.ConeGeometry(1.9, 1.4, 8); dome.translate(0, top + 3.5, 0);
    g.add(new THREE.Mesh(dome, fillMat()), new THREE.LineSegments(new THREE.EdgesGeometry(dome), lineMat(RED)));
    // the lamp and its two beams, turning (`spin`)
    core = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 8), new THREE.MeshBasicMaterial({ color: 0xfff6d0, fog: false, transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false }));
    core.position.set(0, top + 1.5, 0); g.add(core);
    spin = new THREE.Group(); spin.position.set(0, top + 1.5, 0);
    const bm = new THREE.MeshBasicMaterial({ color: 0xfff2c0, fog: false, transparent: true, opacity: 0.09, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
    for (const s of [1, -1]) { const c = new THREE.ConeGeometry(3.2, 70, 14, 1, true); c.rotateX(s > 0 ? Math.PI / 2 : -Math.PI / 2); c.translate(0, 0, s * 35); spin.add(new THREE.Mesh(c, bm)); }
    g.add(spin);
  }
  scene.add(g);
  return { l, g, spin, core, sig: sigOf(l) };
}
function drop(id: string) { const t = live.get(id); if (!t) return; scene.remove(t.g); t.g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); live.delete(id); }
let syncT = 0;
/** Main loop: draw the lighthouses within 700 m, turn their beams. */
export function updateLighthouses(dt: number) {
  if (G.char.loc !== 'overworld') { for (const id of [...live.keys()]) drop(id); return; }
  if ((syncT -= dt) <= 0) {
    syncT = 0.5;
    const seen = new Set<string>();
    for (const l of list()) {
      if (worldDist(l.x, l.z, G.pos.x, G.pos.z) > 700) continue;
      seen.add(l.id);
      const t = live.get(l.id);
      if (!t || t.sig !== sigOf(l)) { drop(l.id); live.set(l.id, tower(l)); } else t.l = l;
    }
    for (const id of [...live.keys()]) if (!seen.has(id)) drop(id);
  }
  const now = G.char.time;
  if ((powTick -= dt) <= 0) { powTick = 2; power.clear(); }
  for (const t of live.values()) {
    const on = shining(t.l);
    if (t.spin) { t.spin.visible = on; t.spin.rotation.y = beamAngle(t.l, now); }
    if (t.core) t.core.visible = on;
  }
}
/** The flashes, seen from afar (they light nothing round them). */
addGlows((out) => {
  if (G.char.loc !== 'overworld') return;
  const now = G.char.time;
  for (const l of list()) {
    if (!l.done || !l.on || worldDist(l.x, l.z, G.pos.x, G.pos.z) > LH.see || !shining(l)) continue;
    const p = placeOf(l), f = flashAt(l, now, G.pos.x - (p.x - l.x), G.pos.z);
    out.push({ x: p.x, y: l.y + LH.h + 1.5, z: p.z, c: 0xfff4d0, s: 0.07 + f * 0.2, a: 0.35 + f * 0.65, far: LH.see });
  }
});
/** A tower stands in your way (its foot). */
export function lighthouseHit(px: number, _py: number, pz: number, r: number): boolean {
  for (const t of live.values()) if (lhProgress(t.l) > 0 || t.l.done) { const p = placeOf(t.l); if (Math.hypot(px - p.x, pz - p.z) < LH.r + r) return true; }
  return false;
}
export function clearLighthouses() { for (const id of [...live.keys()]) drop(id); cancelLhPlacing(true); }

// ---------- its door ----------
export function nearLighthouse(): Lighthouse | null {
  if (G.char.loc !== 'overworld' || driving.v) return null;
  for (const t of live.values()) { const p = placeOf(t.l); if (Math.hypot(G.pos.x - p.x, G.pos.z - p.z) < LH.r + 2.2) return t.l; }
  return null;
}
export const lighthousePrompt = (l: Lighthouse) => (l.done ? TL`E — the lighthouse (${l.on ? (powerOf(l).ok ? TL`lit, a turn every ${l.p} s` : tl('no power')) : tl('dark')})` : TL`E — the lighthouse site (${Math.round(lhProgress(l) * 100)}% handed over)`);
let open: string | null = null;
const root = () => document.getElementById('dlg')!;
const at = () => { const l = open ? byId(open) : null; return l ? placeOf(l) : null; };
const have = (k: ItemKey) => carried(k, at());
function render(msg = '') {
  const l = open ? byId(open) : null;
  if (!l) { close(); return; }
  let h = TL`<div data-lhouse="1"><h2>${l.done ? tl('Lighthouse') : tl('Lighthouse site')}</h2>`;
  if (l.done) {
    const pw = lhPower(G.char.world, l, G.char.towns, G.char.outposts, G.char.time); power.set(l.id, pw);
    h += TL`<div class="say">Its lamp ${l.on ? (pw.ok ? TL`is lit and turns once every <b>${l.p} s</b>: two beams, so it flashes every ${l.p / 2} s` : tl('is switched on but stands dark')) : tl('is dark')}. Seen from kilometres away by night; it lights nothing round it. Set its own rhythm so it can be told from the others.${msg ? '<br>' + msg : ''}</div>`;
    if (pw.by === 'village') h += TL`<div class="say">Power: ${LH.kw} kW from ${pw.name}'s spare.</div>`;
    else if (pw.by === 'grid') h += TL`<div class="say">Power: ${LH.kw} kW from the grid of ${pw.name}.</div>`;
    else if (!pw.ok) h += TL`<div class="say" style="color:#ff6a4a">No power: the lamp is electric and wants ${LH.kw} kW, from a village within ${LH.grid} m with power to spare or from an outpost's power source that reaches it (its grid at least ${Math.round(LH.share * 100)}% fed).</div>`;
    h += `<div class="acts" style="display:flex;flex-wrap:wrap;gap:6px">` + LH.periods.map((p) => `<button class="opt${p === l.p ? ' sel' : ''}" data-lh="p:${p}" style="width:auto;min-width:56px">${p} s</button>`).join('') + `</div>`;
    h += `<button class="opt" data-lh="on">${l.on ? tl('Put the lamp out') : tl('Light the lamp')}</button>`;
  } else {
    const rows = lhRows(l);
    h += TL`<div class="say">Stakes mark the tower's foot. Bring the materials (in your backpack or the trunk of a vehicle by it) and hand them over bit by bit.${msg ? '<br>' + msg : ''}</div>`;
    h += '<div class="shoprow"><div>' + rows.map((r) => { const n = have(r.k); return `<span style="color:${r.given >= r.n ? 'var(--xp)' : n ? 'var(--txt)' : '#ff9a7a'}">${ITEMS[r.k].name} ${r.given}/${r.n}${r.given < r.n && n ? TL` (you have ${n} with you)` : ''}</span>`; }).join(' · ') + TL`<br><span style="opacity:.7">On completion: ${LH.xp} xp.</span></div></div>`;
    h += TL`<button class="opt" data-lh="give" ${rows.some((r) => r.given < r.n && have(r.k) > 0) ? '' : 'disabled'}>Hand over what I carry</button>`;
    h += TL`<button class="opt" data-lh="drop">Pull up the stakes (the materials and the plans come back)</button>`;
  }
  h += TL`<button class="opt" data-lh="close">Close</button></div>`;
  root().querySelector('.panel')!.innerHTML = h;
}
export function openLighthouse(l: Lighthouse) {
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen) return;
  open = l.id; G.dlgOpen = true; G.firing = false; W.talkNpc = null; for (const k in G.keys) G.keys[k] = false;
  render(); root().style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
function close() { open = null; G.dlgOpen = false; root().style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in a lighthouse's window (from the dialogue's click handler). */
export function lighthouseClick(t: HTMLElement): boolean {
  if (!open || !G.dlgOpen || !t.closest('[data-lhouse]')) return false;
  const b = t.closest('[data-lh]') as HTMLElement | null; if (!b) return true;
  const a = b.dataset.lh!, l = byId(open);
  if (a === 'close' || !l) { close(); return true; }
  if (a.startsWith('p:') && l.done) { const p = +a.slice(2); if (LH.periods.includes(p)) { l.p = p; saveChar(); render(TL`It turns once every ${p} s now.`); } return true; }
  if (a === 'on' && l.done) { l.on = !l.on; saveChar(); render(l.on ? tl('The lamp is lit.') : tl('The lamp is out.')); return true; }
  if (a === 'give' && !l.done) {
    const { taken, built } = handOverLh(l, have, G.char.time);
    for (const [k, n] of taken) takeFrom(k, n, at());
    let msg = taken.length ? tl('Handed over: ') + taken.map(([k, n]) => `${ITEMS[k].name} ×${n}`).join(', ') + '.' : tl('You carry nothing it still needs.');
    if (built) { gainXp(LH.xp); showToast(tl('Lighthouse built')); msg += ' ' + TL`<b>The lighthouse stands and its lamp is lit.</b> +${LH.xp} xp`; logLine(tl('The lighthouse stands: its lamp turns. Set its rhythm at the door.')); }
    calcStats(); saveChar(); syncT = 0; render(msg); return true;
  }
  if (a === 'drop' && !l.done) {
    const lost: string[] = [];
    for (const [k, n] of Object.entries(l.given) as [ItemKey, number][]) { const left = n ? putAway(k, n, at()) : 0; if (left) lost.push(`${ITEMS[k].name} ×${left}`); }
    addItem('lhkit');
    G.char.lighthouses = list().filter((q) => q.id !== l.id);
    logLine(TL`You pull up the lighthouse's stakes and take back what you had brought${lost.length ? TL` (no room for ${lost.join(', ')}: left behind)` : ''}.`);
    calcStats(); saveChar(); syncT = 0; close(); return true;
  }
  return true;
}

// ---------- staking one out ----------
let placing = false, spot: { x: number; z: number; y: number } | null = null, problem: string | null = null, preview: THREE.Group | null = null;
const holo = new THREE.LineBasicMaterial({ color: 0xb6ff3a, depthTest: false, transparent: true, opacity: 0.9 });
export const isLhPlacing = () => placing;
export function startLhPlacing(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine(tl('A lighthouse stands in the open.')); return false; }
  if (driving.v) { logLine(tl('Get out of the vehicle first.')); return false; }
  placing = true; spot = null; problem = null;
  logLine(tl('Look where the lighthouse should stand (dry, fairly level ground away from the villages; a coast or a hilltop is best): click to stake it out, right mouse button or Esc to cancel.'));
  return true;
}
export function cancelLhPlacing(quiet = false) {
  if (!placing) return;
  placing = false; spot = null;
  if (preview) { scene.remove(preview); preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview = null; }
  if (!quiet) logLine(tl('You put the lighthouse plans away.'));
}
export const lhPlacingHint = () => (!placing ? null : problem ?? tl('Click — stake the lighthouse out here · right mouse / Esc — cancel'));
export const lhPlacingOk = () => !!spot && !problem;
export function updateLhPlacing() {
  if (!placing) return;
  const T = OW.terrain;
  if (G.char.loc !== 'overworld' || driving.v || !T) { cancelLhPlacing(true); return; }
  const cp = Math.cos(G.pitch), dx = -Math.sin(G.yaw) * cp, dy = Math.sin(G.pitch), dz = -Math.cos(G.yaw) * cp, y0 = G.pos.y + 1.6;
  let x = G.pos.x + dx * 8, z = G.pos.z + dz * 8;
  for (let t = 2; t <= 40; t += 0.5) { const px = G.pos.x + dx * t, pz = G.pos.z + dz * t; if (y0 + dy * t <= T.heightAt(px, pz)) { x = px; z = pz; break; } }
  x = Math.round(x); z = Math.round(z);
  const hs: number[] = []; for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; hs.push(T.heightAt(x + Math.cos(a) * LH.r, z + Math.sin(a) * LH.r)); }
  const y = Math.min(...hs), wet = (T.water(x, z)?.depth ?? 0) > 0.05;
  const p = lhProblem(x, z, allVillages(G.char.world).map((v) => ({ x: nearX(v.x, x), z: v.z })), list().map((o) => ({ ...o, x: nearX(o.x, x) })));
  problem = wet ? tl('Not in the water.') : Math.max(...hs) - y > LH.steep ? tl('Too steep here.') : p === 'village' ? TL`Too close to a village (keep ${LH.village} m away).` : p === 'close' ? TL`Too close to another lighthouse (keep ${LH.apart} m apart).` : null;
  spot = { x, z, y };
  const pts: number[] = [];
  for (let i = 0; i < 16; i++) { const a0 = i / 16 * Math.PI * 2, a1 = (i + 1) / 16 * Math.PI * 2; pts.push(x + Math.cos(a0) * LH.r, y + 0.1, z + Math.sin(a0) * LH.r, x + Math.cos(a1) * LH.r, y + 0.1, z + Math.sin(a1) * LH.r); }
  pts.push(x, y, z, x, y + LH.h, z, x - 2.2, y + LH.h, z, x + 2.2, y + LH.h, z);
  if (!preview) { preview = new THREE.Group(); scene.add(preview); }
  preview.traverse((o) => (o as THREE.Line).geometry?.dispose()); preview.clear();
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
  const ln = new THREE.LineSegments(geo, holo); ln.renderOrder = 10; ln.frustumCulled = false; preview.add(ln);
  holo.color.setHex(problem ? 0xff5a3c : 0xb6ff3a);
}
export function confirmLhPlacing() {
  if (!placing || !spot) return;
  if (problem) { logLine(problem); return; }
  if (!hasItem('lhkit') || !takeOne('lhkit')) { cancelLhPlacing(true); return; }
  const c = G.char;
  list().push({ id: `lh:${c.pid}:${Math.round(c.time)}:${list().length}`, x: spot.x, z: spot.z, y: spot.y, given: {}, p: LH.p0, on: true, by: c.pid });
  saveChar(); syncT = 0; cancelLhPlacing(true);
  showToast(tl('Lighthouse staked out'));
  logLine(tl('The lighthouse is staked out. Bring the materials to its door (E) and hand them over.'));
}
