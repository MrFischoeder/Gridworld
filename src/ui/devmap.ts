// Developer world map (console: `map`): the whole planet, explored or not, with every village and every toxic fog
// zone (lime rings), ancient gate and canyon (orange rim and descent paths); zoom in and the ruins, bandit camps and crash
// sites of the regions in view appear too. Drag to pan, wheel to zoom, click a
// place (or any spot) to teleport there. Only a testing tool: nothing here is part of the game proper.
import { G } from '../game';
import { allVillages, regionInfo, regionOf, X_MIN, WORLD_W, POLE_Z, POLAR_Z, REGION, wrapDx, type Poi } from '../gen/regions';
import { worldGates, gateName, gatePoint, type WorldGate } from '../gen/worldgates';
import { chasmsIn, chasmPath, CHASM_CELL, type Chasm } from '../gen/chasms';
import { dangerAt } from '../gen/danger';
import { seaMask } from '../gen/seas';
import { riversOf } from '../gen/rivers';
import { regionFog, type FogZone } from '../gen/toxic';
import { teleportTo } from '../world/level';
import { citySites } from '../gen/cities';
import { $, logLine } from './hud';
import { lockPointer } from './input';

const root = $('devmap'), cv = $<HTMLCanvasElement>('devmapCv'), info = $('devmapInfo'), ctx = cv.getContext('2d')!;
/** View: centre (world metres) and scale (metres per pixel). */
const view = { x: 0, z: 0, mpp: 60 };
let hoverGate: WorldGate | null = null, hoverChasm: Chasm | null = null;
let open = false, hover: Poi | null = null, hoverFog: FogZone | null = null, mouse = { x: 0, y: 0 }, drag: { x: number; y: number; vx: number; vz: number; moved: boolean } | null = null;

const COLOR: Record<string, string> = { village: '#ffd060', ruin: '#5cc8ff', camp: '#ff6a4a', wreck: '#7dffc8' };
const toScreen = (x: number, z: number) => [cv.width / 2 + wrapDx(x - view.x) / view.mpp, cv.height / 2 + (z - view.z) / view.mpp];
const toWorld = (sx: number, sy: number) => [view.x + (sx - cv.width / 2) * view.mpp, view.z + (sy - cv.height / 2) * view.mpp];

/** The places worth drawing now: all villages, and the rest only when zoomed in far enough to be useful. */
function places(): Poi[] {
  const out = [...allVillages(G.char.world)];
  const hw = cv.width / 2 * view.mpp, hh = cv.height / 2 * view.mpp;
  if (hw < 9000) {
    const [ax, az] = regionOf(view.x - hw, view.z - hh), [bx, bz] = regionOf(view.x + hw, view.z + hh);
    for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) {
      for (const p of regionInfo(G.char.world, rx, rz).pois) if (p.type !== 'village') out.push(p);
    }
  }
  return out;
}

/** Every toxic fog zone of the planet: scanned a slice of regions per frame while the map is open (kept per world). */
const fogScan = { world: NaN, rx: 0, zones: [] as FogZone[], done: false };
const R_MIN = Math.round(X_MIN / REGION + 0.5), R_Z = Math.ceil(POLAR_Z / REGION);
function scanFog(ms: number) {
  const w = G.char.world;
  if (fogScan.world !== w) Object.assign(fogScan, { world: w, rx: R_MIN, zones: [], done: false });
  const t0 = performance.now();
  while (!fogScan.done && performance.now() - t0 < ms) {
    for (let rz = -R_Z; rz <= R_Z; rz++) { const f = regionFog(w, fogScan.rx, rz); if (f) fogScan.zones.push(f); }
    if (++fogScan.rx >= R_MIN + WORLD_W / REGION) fogScan.done = true;
  }
}

/** Whole-planet canyon index, deduplicated by stable id and generated in short frame slices. */
const canyonScan = { world: NaN, column: 0, row: 0, start: 0, zones: new Map<string, Chasm>(), done: false };
const C_Z = Math.ceil(POLAR_Z / CHASM_CELL), C_N = WORLD_W / CHASM_CELL;
function scanCanyons(ms: number) {
  const world = G.char.world;
  if (canyonScan.world !== world) Object.assign(canyonScan, { world, column: 0, row: -C_Z, start: Math.floor(view.x / CHASM_CELL), zones: new Map<string, Chasm>(), done: false });
  const started = performance.now();
  while (!canyonScan.done && performance.now() - started < ms) {
    const x = (canyonScan.start + canyonScan.column) * CHASM_CELL, z = canyonScan.row * CHASM_CELL;
    for (const c of chasmsIn(world, { x0: x, z0: z, x1: x + CHASM_CELL, z1: z + CHASM_CELL })) canyonScan.zones.set(c.id, c);
    if (++canyonScan.row >= C_Z) { canyonScan.row = -C_Z; if (++canyonScan.column >= C_N) canyonScan.done = true; }
  }
}

/** The seas of the whole planet, 250 m a pixel (made once per world). */
let seaLayer: { world: number; cv: HTMLCanvasElement } | null = null;
const SEA_PX = 250;
function seas(): HTMLCanvasElement {
  const w = G.char.world;
  if (seaLayer?.world === w) return seaLayer.cv;
  const c = document.createElement('canvas'), W = Math.round(WORLD_W / SEA_PX), H = Math.round(2 * POLAR_Z / SEA_PX);
  c.width = W; c.height = H;
  const x2 = c.getContext('2d')!, img = x2.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const m = seaMask(w, X_MIN + (i + 0.5) * SEA_PX, -POLAR_Z + (j + 0.5) * SEA_PX), o = 4 * (i + W * j);
    if (m < 0.3) continue;
    img.data[o] = 10; img.data[o + 1] = 60 - 30 * m; img.data[o + 2] = 140 - 50 * m; img.data[o + 3] = 200;
  }
  x2.putImageData(img, 0, 0);
  seaLayer = { world: w, cv: c };
  return c;
}

function draw() {
  if (!open) return;
  cv.width = root.clientWidth; cv.height = root.clientHeight;
  const W = cv.width, H = cv.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
  // the polar ice and the planet's ends
  for (const s of [-1, 1]) {
    const [, y0] = toScreen(0, s * POLAR_Z), [, y1] = toScreen(0, s * POLE_Z);
    ctx.fillStyle = 'rgba(191,255,232,0.12)'; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
    ctx.fillStyle = 'rgba(191,255,232,0.5)'; ctx.fillRect(0, y1 - 1, W, 2);
  }
  // the seas (the planet repeats east-west: draw the copies in view)
  const sl = seas(), [, sy0] = toScreen(0, -POLAR_Z), sw = WORLD_W / view.mpp, sh = 2 * POLAR_Z / view.mpp;
  ctx.imageSmoothingEnabled = true;
  let [sx0] = toScreen(X_MIN, 0); sx0 -= Math.ceil(sx0 / sw) * sw;
  for (let sx = sx0; sx < W; sx += sw) ctx.drawImage(sl, sx, sy0, sw, sh);
  // the rivers
  ctx.strokeStyle = '#2ac8b0'; ctx.lineWidth = 1.5;
  for (const r of riversOf(G.char.world).list) {
    ctx.beginPath();
    let lx = NaN; // a river crossing the planet's seam jumps across the screen: lift the pen there
    const to = (px: number, py: number) => { if (Number.isNaN(lx) || Math.abs(px - lx) > W / 2) ctx.moveTo(px, py); else ctx.lineTo(px, py); lx = px; };
    for (let i = 0; i < r.x.length; i += view.mpp > 30 ? 4 : 1) { const [px, py] = toScreen(r.x[i], r.z[i]); to(px, py); }
    const [ex, ey] = toScreen(r.x[r.x.length - 1], r.z[r.z.length - 1]); to(ex, ey);
    ctx.stroke();
  }
  // grid: every region when close, every 10 km otherwise; the seam of the planet in amber
  const step = view.mpp < 4 ? REGION : view.mpp < 40 ? 2560 : 10240;
  ctx.strokeStyle = 'rgba(47,224,96,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  const [wx0, wz0] = toWorld(0, 0), [wx1, wz1] = toWorld(W, H);
  for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) { const [sx] = toScreen(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
  for (let z = Math.floor(wz0 / step) * step; z <= wz1; z += step) { const [, sy] = toScreen(0, z); ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
  ctx.stroke();
  const [seam] = toScreen(X_MIN, 0); ctx.strokeStyle = 'rgba(255,179,71,0.5)'; ctx.beginPath(); ctx.moveTo(seam, 0); ctx.lineTo(seam, H); ctx.stroke();
  // toxic fog: a lime ring as big as the zone (a dot at least), the site in the middle
  ctx.lineWidth = 1.5; ctx.font = '15px VT323, monospace'; ctx.textAlign = 'center';
  hoverFog = null; let fd = 12;
  for (const f of fogScan.zones) {
    const [sx, sy] = toScreen(f.x, f.z), r = Math.max(4, f.r / view.mpp);
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    ctx.strokeStyle = ctx.fillStyle = '#b6ff3a'; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    if (view.mpp < 25) ctx.fillText(f.name, sx, sy - r - 4);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y);
    if (d < Math.max(fd, r) && d < fd + r) { fd = d; hoverFog = f; }
  }
  // the dead cities: a pale grey-green disc as big as the city
  for (const c of citySites(G.char.world)) {
    const [sx, sy] = toScreen(c.x, c.z), r = Math.max(5, c.r / view.mpp);
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    ctx.strokeStyle = ctx.fillStyle = '#9ad8a8'; ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    ctx.fillText(c.name + ' (' + c.pattern + ')', sx, sy - r - 4);
  }
  // places
  ctx.font = '15px VT323, monospace'; ctx.textAlign = 'center';
  const list = places(), labels = view.mpp < 25;
  hover = null; let hd = 12;
  for (const p of list) {
    const [sx, sy] = toScreen(p.x, p.z);
    if (sx < -20 || sy < -20 || sx > W + 20 || sy > H + 20) continue;
    const c = COLOR[p.type] ?? '#3dff6e', r = p.type === 'village' ? 4 : 3;
    ctx.strokeStyle = ctx.fillStyle = c;
    if (p.type === 'village') ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.stroke(); }
    if (labels && (p.type === 'village' || view.mpp < 6)) ctx.fillText(p.name, sx, sy - 7);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y);
    if (d < hd) { hd = d; hover = p; }
  }
  // Canyon rims retain their real orientation and footprint; dots remain visible at planetary zoom.
  hoverChasm = null; let cd = 10;
  for (const c of canyonScan.zones.values()) {
    const [sx, sy] = toScreen(c.x, c.z), halfL = Math.max(5, c.length / view.mpp / 2), halfW = Math.max(2, c.width / view.mpp / 2);
    if (sx < -halfL - halfW || sy < -halfL - halfW || sx > W + halfL + halfW || sy > H + halfL + halfW) continue;
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(Math.atan2(c.dz, c.dx));
    ctx.fillStyle = 'rgba(255,154,74,.2)'; ctx.strokeStyle = '#ff9a4a'; ctx.lineWidth = 2;
    ctx.fillRect(-halfL, -halfW, halfL * 2, halfW * 2); ctx.strokeRect(-halfL, -halfW, halfL * 2, halfW * 2); ctx.restore();
    if (view.mpp < 2) for (let i = 0; i < c.entries; i++) {
      ctx.strokeStyle = '#ffd060'; ctx.lineWidth = 2; ctx.beginPath();
      for (let j = 0; j <= 12; j++) { const [x, z] = chasmPath(c, i, j / 12), [px, py] = toScreen(x, z); if (j) ctx.lineTo(px, py); else ctx.moveTo(px, py); }
      ctx.stroke(); const [x, z] = chasmPath(c, i, 0), [px, py] = toScreen(x, z); ctx.fillStyle = '#ffd060'; ctx.fillRect(px - 3, py - 3, 6, 6);
    }
    if (labels) { ctx.fillStyle = '#ff9a4a'; ctx.fillText('Canyon', sx, sy - halfL * Math.abs(c.dz) - halfW - 6); }
    const ox = mouse.x - sx, oz = mouse.y - sy, u = ox * c.dx + oz * c.dz, v = -ox * c.dz + oz * c.dx;
    const distance = Math.hypot(Math.max(0, Math.abs(u) - halfL), Math.max(0, Math.abs(v) - halfW));
    if (distance < cd) { cd = distance; hoverChasm = c; }
  }
  // Every ancient portal is shown, regardless of exploration, as a cyan octagon.
  const gates = worldGates(G.char.world); hoverGate = null; let gd = 12;
  for (const g of gates) {
    const [sx, sy] = toScreen(g.x, g.z), r = 7;
    if (sx < -r || sy < -r || sx > W + r || sy > H + r) continue;
    ctx.strokeStyle = ctx.fillStyle = '#80e8ff'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; if (i) ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); else ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(gateName(g), sx, sy - r - 6);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y); if (d < gd) { gd = d; hoverGate = g; }
  }
  if (hoverGate) { hover = null; hoverFog = null; hoverChasm = null; }
  else if (hover) hoverChasm = null;
  else if (hoverChasm) hoverFog = null;
  const feature = hoverGate ?? hoverChasm;
  if (feature) { const [sx, sy] = toScreen(feature.x, feature.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 10, sy - 10, 20, 20); }
  // the player
  const [px, py] = toScreen(G.pos.x, G.pos.z);
  ctx.strokeStyle = '#3dff6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 6.283); ctx.moveTo(px, py); ctx.lineTo(px - Math.sin(G.yaw) * 14, py - Math.cos(G.yaw) * 14); ctx.stroke();
  if (hover) hoverFog = null;
  if (hoverFog) { const [hx, hy] = toScreen(hoverFog.x, hoverFog.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 8, hy - 8, 16, 16); }
  if (hover) { const [hx, hy] = toScreen(hover.x, hover.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 8, hy - 8, 16, 16); }
  const [mx, mz] = toWorld(mouse.x, mouse.y);
  const fogNote = fogScan.done ? ` · ${fogScan.zones.length} toxic fog zones` : ` · finding toxic fog ${Math.round((fogScan.rx - R_MIN) / (WORLD_W / REGION) * 100)}%`;
  const canyonNote = canyonScan.done ? ` · ${canyonScan.zones.size} canyons` : ` · finding canyons ${Math.floor((canyonScan.column + (canyonScan.row + C_Z) / (2 * C_Z)) / C_N * 100)}%`;
  info.textContent = (hoverGate ? `${gateName(hoverGate)} (portal; click: beside the ring)` : hoverChasm ? `Canyon ${hoverChasm.id} (${Math.round(hoverChasm.length)} × ${Math.round(hoverChasm.width)} m, depth ${Math.round(hoverChasm.depth)} m, ${hoverChasm.entries} paths; click: path entrance)` : hover ? `${hover.name} (${hover.type})` : hoverFog ? `${hoverFog.name} (toxic fog, ${hoverFog.kind === 'isle' ? 'island' : 'land'}, ${hoverFog.site}; click: its edge)` : `x ${Math.round(mx)}, z ${Math.round(mz)}`) + ` · ${gates.length} portals` + canyonNote + fogNote +
    ` · danger ${dangerAt(G.char.world, hover ? hover.x : mx, hover ? hover.z : mz).toFixed(1)} · ${Math.round(view.mpp * 100) / 100} m/px · click to teleport · drag to pan · wheel to zoom · Esc to close`;
}

function tick() { if (!open || (fogScan.done && canyonScan.done)) return; scanFog(6); scanCanyons(4); draw(); requestAnimationFrame(tick); }
export function openDevMap() {
  open = true; G.playing = false; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  view.x = G.pos.x; view.z = G.pos.z; if (G.char.loc === 'dungeon') { view.x = 0; view.z = 0; }
  scanCanyons(4);
  root.style.display = 'block';
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => { if (open && document.pointerLockElement) document.exitPointerLock(); }, 150); // a lock still on its way
  requestAnimationFrame(draw);
  requestAnimationFrame(tick);
}
function closeDevMap() {
  open = false; root.style.display = 'none'; G.playing = true;
  if (!G.isTouch) lockPointer();
}

cv.addEventListener('wheel', (e) => {
  e.preventDefault();
  const [bx, bz] = toWorld(e.offsetX, e.offsetY);
  view.mpp = Math.min(400, Math.max(0.5, view.mpp * (e.deltaY > 0 ? 1.25 : 0.8)));
  const [ax, az] = toWorld(e.offsetX, e.offsetY);
  view.x += bx - ax; view.z += bz - az; // zoom about the pointer
  draw();
}, { passive: false });
cv.addEventListener('pointerdown', (e) => { drag = { x: e.offsetX, y: e.offsetY, vx: view.x, vz: view.z, moved: false }; });
cv.addEventListener('pointermove', (e) => {
  mouse = { x: e.offsetX, y: e.offsetY };
  if (drag) {
    const dx = e.offsetX - drag.x, dy = e.offsetY - drag.y;
    if (Math.hypot(dx, dy) > 4) drag.moved = true;
    if (drag.moved) { view.x = drag.vx - dx * view.mpp; view.z = Math.max(-POLE_Z, Math.min(POLE_Z, drag.vz - dy * view.mpp)); }
  }
  draw();
});
cv.addEventListener('pointerup', (e) => {
  const d = drag; drag = null;
  if (!d || d.moved) return;
  const [x, z] = toWorld(e.offsetX, e.offsetY);
  if (!hover && Math.abs(z) > POLE_Z - 300) { info.textContent = 'That is beyond the ice wall.'; return; }
  if (hoverGate) { const g = hoverGate, [gx, gz] = gatePoint(g, 0, 7); const msg = teleportTo(gx, gz); closeDevMap(); logLine(msg + ` Beside ${gateName(g)}.`); return; }
  if (hoverChasm) { const c = hoverChasm, [cx, cz] = chasmPath(c, 0, 0); const msg = teleportTo(cx, cz); closeDevMap(); logLine(msg + ` At the descent into ${c.id}.`); return; }
  // a fog zone: to its edge, where the fog is still thin (the site is in the middle)
  if (!hover && hoverFog) { const msg = teleportTo(hoverFog.x, hoverFog.z + hoverFog.r * 0.8); closeDevMap(); logLine(msg + ` The toxic fog of ${hoverFog.name} lies to the north.`); return; }
  const msg = teleportTo(hover ? hover.x : x, hover ? hover.z : z, hover ?? undefined);
  closeDevMap(); logLine(msg);
});
$('devmapClose').onclick = closeDevMap;
$('devmapHome').onclick = () => { view.x = G.pos.x; view.z = G.pos.z; draw(); };
window.addEventListener('keydown', (e) => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeDevMap(); } }, true);
window.addEventListener('resize', () => draw());
/** The planet's size, for the console. */
export const planetSize = () => `${Math.round(WORLD_W / 1000)} km round, ${Math.round(POLE_Z * 2 / 1000)} km pole to pole`;
