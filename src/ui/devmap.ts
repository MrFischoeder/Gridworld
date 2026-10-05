// Developer world map (console: `map`): the whole planet, explored or not, with every village and every toxic fog
// zone (lime rings), ancient gate and megalith; zoom in and the ruins, bandit camps and crash
// sites of the regions in view appear too. Drag to pan, wheel to zoom, click a
// place (or any spot) to teleport there. Only a testing tool: nothing here is part of the game proper.
import { cityEntrances, type CityEntrance } from '../gen/citydungeons';
import { G } from '../game';
import { allVillages, regionInfo, regionOf, X_MIN, WORLD_W, POLE_Z, POLAR_Z, REGION, wrapX, nearX, type Poi } from '../gen/regions';
import { worldGates, gateName, gatePoint, type WorldGate } from '../gen/worldgates';
import { worldMegaliths, megalithPoint, type Megalith } from '../gen/megaliths';
import { dangerAt } from '../gen/danger';
import { seaMask, isleHeight, SEA } from '../gen/seas';
import { riversOf, type River } from '../gen/rivers';
import { regionFog, type FogZone } from '../gen/toxic';
import { teleportTo } from '../world/level';
import { citySites } from '../gen/cities';
import { $, logLine } from './hud';
import { lockPointer } from './input';
import { oceanMapSeam, mapOverview, longitudeCopies, mapToScreen, mapToWorld } from './devmap-layout';

const root = $('devmap'), cv = $<HTMLCanvasElement>('devmapCv'), info = $('devmapInfo'), ctx = cv.getContext('2d')!;
/** View: centre (world metres) and scale (metres per pixel). */
const view = { x: 0, z: 0, mpp: 60 };
let overviewActive = false;
let hoverVault: CityEntrance | null = null;
let hoverMegalith: Megalith | null = null;
let hoverGate: WorldGate | null = null;
let open = false, hover: Poi | null = null, hoverFog: FogZone | null = null, mouse = { x: 0, y: 0 }, drag: { x: number; y: number; vx: number; vz: number; moved: boolean } | null = null;

const COLOR: Record<string, string> = { village: '#ffd060', ruin: '#5cc8ff', camp: '#ff6a4a', wreck: '#7dffc8' };
const toScreen = (x: number, z: number) => mapToScreen(view, cv.width, cv.height, x, z);
const toWorld = (sx: number, sy: number) => mapToWorld(view, cv.width, cv.height, sx, sy);
function screenCopies(x: number, z: number, margin = 20): [number, number][] {
  const sy = toScreen(0, z)[1];
  if (sy < -margin || sy > cv.height + margin) return [];
  return longitudeCopies(x, view.x, visibleSpan(), margin * view.mpp).map(copy => toScreen(copy, z));
}
const visibleSpan = () => overviewActive ? WORLD_W : cv.width * view.mpp;
const hoverScreen = (x: number, z: number) => toScreen(nearX(x, toWorld(mouse.x, mouse.y)[0]), z);
function overview() { overviewActive = true; Object.assign(view, mapOverview(G.char.world, root.clientWidth, root.clientHeight)); }

// River longitudes are already unwrapped by the generator; translate the entire path together.
const riverBounds = new WeakMap<River, { centre: number; radius: number }>();
function bounds(r: River) {
  let found = riverBounds.get(r);
  if (!found) {
    let lo = Infinity, hi = -Infinity;
    for (const x of r.x) { lo = Math.min(lo, x); hi = Math.max(hi, x); }
    found = { centre: (lo + hi) / 2, radius: (hi - lo) / 2 }; riverBounds.set(r, found);
  }
  return found;
}

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

/** The seas of the whole planet, 250 m a pixel (made once per world). */
let seaLayer: { world: number; cv: HTMLCanvasElement } | null = null;
const SEA_PX = 250;
function seas(): HTMLCanvasElement {
  const w = G.char.world, seam = oceanMapSeam(w);
  if (seaLayer?.world === w) return seaLayer.cv;
  const c = document.createElement('canvas'), W = Math.round(WORLD_W / SEA_PX), H = Math.round(2 * POLAR_Z / SEA_PX);
  c.width = W; c.height = H;
  const x2 = c.getContext('2d')!, img = x2.createImageData(W, H);
  for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
    const x = seam + (i + 0.5) * WORLD_W / W, z = -POLAR_Z + (j + 0.5) * SEA_PX;
    const m = seaMask(w, x, z), o = 4 * (i + W * j);
    if (m < 0.3) continue;
    if (isleHeight(w, x, z) > SEA.level) continue;
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
  ctx.save();
  // Wide screens get side margins rather than fragments of a second continent in the overview.
  if (overviewActive) {
    const width = WORLD_W / view.mpp;
    ctx.beginPath(); ctx.rect((W - width) / 2, 0, width, H); ctx.clip();
  }
  // the polar ice and the planet's ends
  for (const s of [-1, 1]) {
    const [, y0] = toScreen(0, s * POLAR_Z), [, y1] = toScreen(0, s * POLE_Z);
    ctx.fillStyle = 'rgba(191,255,232,0.12)'; ctx.fillRect(0, Math.min(y0, y1), W, Math.abs(y1 - y0));
    ctx.fillStyle = 'rgba(191,255,232,0.5)'; ctx.fillRect(0, y1 - 1, W, 2);
  }
  // the seas (the planet repeats east-west: draw the copies in view)
  const sl = seas(), [, sy0] = toScreen(0, -POLAR_Z), sw = WORLD_W / view.mpp, sh = 2 * POLAR_Z / view.mpp;
  ctx.imageSmoothingEnabled = true;
  let [sx0] = toScreen(oceanMapSeam(G.char.world), 0); sx0 -= Math.ceil(sx0 / sw) * sw;
  for (let sx = sx0; sx < W; sx += sw) ctx.drawImage(sl, sx, sy0, sw, sh);
  // the rivers
  ctx.strokeStyle = '#2ac8b0'; ctx.lineWidth = 1.5;
  for (const r of riversOf(G.char.world).list) {
    const { centre, radius } = bounds(r);
    for (const copy of longitudeCopies(centre, view.x, visibleSpan(), radius)) {
      const shift = copy - centre;
      ctx.beginPath();
      for (let i = 0; i < r.x.length; i += view.mpp > 30 ? 4 : 1) {
        const [px, py] = toScreen(r.x[i] + shift, r.z[i]);
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      const last = r.x.length - 1, [ex, ey] = toScreen(r.x[last] + shift, r.z[last]);
      ctx.lineTo(ex, ey); ctx.stroke();
    }
  }
  // grid: every region when close, every 10 km otherwise; the seam of the planet in amber
  const step = view.mpp < 4 ? REGION : view.mpp < 40 ? 2560 : 10240;
  ctx.strokeStyle = 'rgba(47,224,96,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  const [wx0, wz0] = toWorld(0, 0), [wx1, wz1] = toWorld(W, H);
  for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) { const [sx] = toScreen(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
  for (let z = Math.floor(wz0 / step) * step; z <= wz1; z += step) { const [, sy] = toScreen(0, z); ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,179,71,0.5)'; ctx.beginPath();
  for (const x of longitudeCopies(oceanMapSeam(G.char.world), view.x, visibleSpan())) {
    const [seam] = toScreen(x, 0); ctx.moveTo(seam, 0); ctx.lineTo(seam, H);
  }
  ctx.stroke();
  // toxic fog: a lime ring as big as the zone (a dot at least), the site in the middle
  ctx.lineWidth = 1.5; ctx.font = '15px VT323, monospace'; ctx.textAlign = 'center';
  hoverFog = null; let fd = 12;
  for (const f of fogScan.zones) for (const [sx, sy] of screenCopies(f.x, f.z, Math.max(4, f.r / view.mpp))) {
    const r = Math.max(4, f.r / view.mpp);
    ctx.strokeStyle = ctx.fillStyle = '#b6ff3a'; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    if (view.mpp < 25) ctx.fillText(f.name, sx, sy - r - 4);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y);
    if (d < Math.max(fd, r) && d < fd + r) { fd = d; hoverFog = f; }
  }
  // the dead cities: a pale grey-green disc as big as the city
  for (const c of citySites(G.char.world)) for (const [sx, sy] of screenCopies(c.x, c.z, Math.max(5, c.r / view.mpp))) {
    const r = Math.max(5, c.r / view.mpp);
    ctx.strokeStyle = ctx.fillStyle = '#9ad8a8'; ctx.globalAlpha = 0.2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke();
    ctx.fillText(c.name + ' (' + c.pattern + ')', sx, sy - r - 4);
  }
  // places
  ctx.font = '15px VT323, monospace'; ctx.textAlign = 'center';
  const list = places(), labels = view.mpp < 25;
  hover = null; let hd = 12;
  for (const p of list) for (const [sx, sy] of screenCopies(p.x, p.z)) {
    const c = COLOR[p.type] ?? '#3dff6e', r = p.type === 'village' ? 4 : 3;
    ctx.strokeStyle = ctx.fillStyle = c;
    if (p.type === 'village') ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
    else { ctx.beginPath(); ctx.arc(sx, sy, r, 0, 6.283); ctx.stroke(); }
    if (labels && (p.type === 'village' || view.mpp < 6)) ctx.fillText(p.name, sx, sy - 7);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y);
    if (d < hd) { hd = d; hover = p; }
  }
  hoverVault = null; let vd = 12;
  if (view.mpp < 12) for (const city of citySites(G.char.world)) {
    if (!screenCopies(city.x, city.z, city.r / view.mpp).length) continue;
    for (const e of cityEntrances(G.char.world,city)) for (const [sx,sy] of screenCopies(e.x,e.z)) {
      ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 2; ctx.strokeRect(sx-6,sy-6,12,12);
      ctx.beginPath(); ctx.moveTo(sx-4,sy-2); ctx.lineTo(sx,sy+4); ctx.lineTo(sx+4,sy-2); ctx.stroke();
      if (view.mpp<3) ctx.fillText('Underground '+(e.n+1),sx,sy-12);
      const d = Math.hypot(sx-mouse.x,sy-mouse.y); if (d<vd) { vd=d; hoverVault=e; }
    }
  }
  hoverMegalith = null; let md = 12;
  const monuments = worldMegaliths(G.char.world);
  for (const m of monuments) for (const [sx, sy] of screenCopies(m.x, m.z, Math.max(7, m.radius / view.mpp))) {
    const r = Math.max(7, m.radius / view.mpp);
    ctx.strokeStyle = ctx.fillStyle = '#d1c597'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(sx - 4, sy - 4, 2, 8); ctx.strokeRect(sx + 2, sy - 4, 2, 8); ctx.fillRect(sx - 5, sy - 5, 10, 2);
    if (labels) ctx.fillText(m.name, sx, sy - r - 6);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y); if (d < Math.max(md, r)) { md = d; hoverMegalith = m; }
  }
  // Every ancient portal is shown, regardless of exploration, as a cyan octagon.
  const gates = worldGates(G.char.world); hoverGate = null; let gd = 12;
  for (const g of gates) for (const [sx, sy] of screenCopies(g.x, g.z, 7)) {
    const r = 7;
    ctx.strokeStyle = ctx.fillStyle = '#80e8ff'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; if (i) ctx.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); else ctx.moveTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(gateName(g), sx, sy - r - 6);
    const d = Math.hypot(sx - mouse.x, sy - mouse.y); if (d < gd) { gd = d; hoverGate = g; }
  }
  if (hoverGate) { hover = null; hoverFog = null; hoverMegalith = null; hoverVault = null; }
  else if (hoverMegalith) { hover = null; hoverFog = null; hoverVault = null; }
  else if (hoverVault) { hover = null; hoverFog = null; }
  const feature = hoverGate ?? hoverMegalith ?? hoverVault;
  if (feature) { const [sx, sy] = hoverScreen(feature.x, feature.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(sx - 10, sy - 10, 20, 20); }
  // the player
  for (const [px, py] of screenCopies(G.pos.x, G.pos.z)) {
    ctx.strokeStyle = '#3dff6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 6.283); ctx.moveTo(px, py); ctx.lineTo(px - Math.sin(G.yaw) * 14, py - Math.cos(G.yaw) * 14); ctx.stroke();
  }
  if (hover) hoverFog = null;
  if (hoverFog) { const [hx, hy] = hoverScreen(hoverFog.x, hoverFog.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 8, hy - 8, 16, 16); }
  if (hover) { const [hx, hy] = hoverScreen(hover.x, hover.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 8, hy - 8, 16, 16); }
  ctx.restore();
  const [mx, mz] = toWorld(mouse.x, mouse.y);
  const fogNote = fogScan.done ? ` · ${fogScan.zones.length} toxic fog zones` : ` · finding toxic fog ${Math.round((fogScan.rx - R_MIN) / (WORLD_W / REGION) * 100)}%`;
  info.textContent = (hoverGate ? `${gateName(hoverGate)} (portal; click: beside the ring)` : hoverMegalith ? `${hoverMegalith.name} (${hoverMegalith.id}, ${Math.round(hoverMegalith.radius * 2)} m across, ${Math.round(hoverMegalith.height)} m tall; click: outer edge)` : hoverVault ? `${hoverVault.name} (underground; click: entrance, E: descend)` : hover ? `${hover.name} (${hover.type})` : hoverFog ? `${hoverFog.name} (toxic fog, ${hoverFog.kind === 'isle' ? 'island' : 'land'}, ${hoverFog.site}; click: its edge)` : `x ${Math.round(wrapX(mx))}, z ${Math.round(mz)}`) + ` · ${gates.length} portals · ${monuments.length} megaliths` + fogNote +
    ` · danger ${dangerAt(G.char.world, hover ? hover.x : mx, hover ? hover.z : mz).toFixed(1)} · ${Math.round(view.mpp * 100) / 100} m/px · click to teleport · drag to pan · wheel to zoom · Esc to close`;
}

function tick() { if (!open || fogScan.done) return; scanFog(6); draw(); requestAnimationFrame(tick); }
export function openDevMap() {
  open = true; G.playing = false; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  root.style.display = 'block'; overview();
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
  overviewActive = false;
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
    if (drag.moved) { overviewActive = false; view.x = drag.vx - dx * view.mpp; view.z = Math.max(-POLE_Z, Math.min(POLE_Z, drag.vz - dy * view.mpp)); }
  }
  draw();
});
cv.addEventListener('pointerup', (e) => {
  const d = drag; drag = null;
  if (!d || d.moved) return;
  const [x, z] = toWorld(e.offsetX, e.offsetY);
  if (overviewActive && Math.abs(x - view.x) > WORLD_W / 2) return;
  if (!hover && Math.abs(z) > POLE_Z - 300) { info.textContent = 'That is beyond the ice wall.'; return; }
  if (hoverGate) { const g = hoverGate, [gx, gz] = gatePoint(g, 0, 7); const msg = teleportTo(gx, gz); closeDevMap(); logLine(msg + ` Beside ${gateName(g)}.`); return; }
  if (hoverMegalith) { const m = hoverMegalith, [mx, mz] = megalithPoint(m, 0, m.radius + 10); const msg = teleportTo(mx, mz); closeDevMap(); logLine(msg + ` At ${m.name}.`); return; }
  if (hoverVault) { const e = hoverVault, msg = teleportTo(e.x,e.z); closeDevMap(); logLine(msg + ` At ${e.name}. Press E to enter.`); return; }
  // a fog zone: to its edge, where the fog is still thin (the site is in the middle)
  if (!hover && hoverFog) { const msg = teleportTo(hoverFog.x, hoverFog.z + hoverFog.r * 0.8); closeDevMap(); logLine(msg + ` The toxic fog of ${hoverFog.name} lies to the north.`); return; }
  const msg = teleportTo(wrapX(hover ? hover.x : x), hover ? hover.z : z, hover ?? undefined);
  closeDevMap(); logLine(msg);
});
$('devmapClose').onclick = closeDevMap;
$('devmapOverview').onclick = () => { overview(); draw(); };
$('devmapHome').onclick = () => { overviewActive = false; view.x = G.pos.x; view.z = G.pos.z; draw(); };
window.addEventListener('keydown', (e) => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeDevMap(); } }, true);
window.addEventListener('resize', () => { if (open && overviewActive) overview(); draw(); });
/** The planet's size, for the console. */
export const planetSize = () => `${Math.round(WORLD_W / 1000)} km round, ${Math.round(POLE_Z * 2 / 1000)} km pole to pole`;
