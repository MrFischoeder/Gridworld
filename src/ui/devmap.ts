// Developer world map (console: `worldmap`): the whole planet, explored or not, with every village; zoom in and
// the ruins, bandit camps and crash sites of the regions in view appear too. Drag to pan, wheel to zoom, click a
// place (or any spot) to teleport there. Only a testing tool: nothing here is part of the game proper.
import { G } from '../game';
import { allVillages, regionInfo, regionOf, X_MIN, WORLD_W, POLE_Z, POLAR_Z, REGION, wrapDx, type Poi } from '../gen/regions';
import { dangerAt } from '../gen/danger';
import { teleportTo } from '../world/level';
import { $, logLine } from './hud';
import { lockPointer } from './input';

const root = $('devmap'), cv = $<HTMLCanvasElement>('devmapCv'), info = $('devmapInfo'), ctx = cv.getContext('2d')!;
/** View: centre (world metres) and scale (metres per pixel). */
const view = { x: 0, z: 0, mpp: 60 };
let open = false, hover: Poi | null = null, mouse = { x: 0, y: 0 }, drag: { x: number; y: number; vx: number; vz: number; moved: boolean } | null = null;

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
  // grid: every region when close, every 10 km otherwise; the seam of the planet in amber
  const step = view.mpp < 4 ? REGION : view.mpp < 40 ? 2560 : 10240;
  ctx.strokeStyle = 'rgba(47,224,96,0.18)'; ctx.lineWidth = 1; ctx.beginPath();
  const [wx0, wz0] = toWorld(0, 0), [wx1, wz1] = toWorld(W, H);
  for (let x = Math.floor(wx0 / step) * step; x <= wx1; x += step) { const [sx] = toScreen(x, 0); ctx.moveTo(sx, 0); ctx.lineTo(sx, H); }
  for (let z = Math.floor(wz0 / step) * step; z <= wz1; z += step) { const [, sy] = toScreen(0, z); ctx.moveTo(0, sy); ctx.lineTo(W, sy); }
  ctx.stroke();
  const [seam] = toScreen(X_MIN, 0); ctx.strokeStyle = 'rgba(255,179,71,0.5)'; ctx.beginPath(); ctx.moveTo(seam, 0); ctx.lineTo(seam, H); ctx.stroke();
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
  // the player
  const [px, py] = toScreen(G.pos.x, G.pos.z);
  ctx.strokeStyle = '#3dff6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(px, py, 7, 0, 6.283); ctx.moveTo(px, py); ctx.lineTo(px - Math.sin(G.yaw) * 14, py - Math.cos(G.yaw) * 14); ctx.stroke();
  if (hover) { const [hx, hy] = toScreen(hover.x, hover.z); ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.strokeRect(hx - 8, hy - 8, 16, 16); }
  const [mx, mz] = toWorld(mouse.x, mouse.y);
  info.textContent = (hover ? `${hover.name} (${hover.type})` : `x ${Math.round(mx)}, z ${Math.round(mz)}`) +
    ` · danger ${dangerAt(G.char.world, hover ? hover.x : mx, hover ? hover.z : mz).toFixed(1)} · ${Math.round(view.mpp * 100) / 100} m/px · click to teleport · drag to pan · wheel to zoom · Esc to close`;
}

export function openDevMap() {
  open = true; G.playing = false; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  view.x = G.pos.x; view.z = G.pos.z; if (G.char.loc === 'dungeon') { view.x = 0; view.z = 0; }
  root.style.display = 'block';
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => { if (open && document.pointerLockElement) document.exitPointerLock(); }, 150); // a lock still on its way
  requestAnimationFrame(draw);
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
  const msg = teleportTo(hover ? hover.x : x, hover ? hover.z : z, hover ?? undefined);
  closeDevMap(); logLine(msg);
});
$('devmapClose').onclick = closeDevMap;
$('devmapHome').onclick = () => { view.x = G.pos.x; view.z = G.pos.z; draw(); };
window.addEventListener('keydown', (e) => { if (open && e.code === 'Escape') { e.stopImmediatePropagation(); e.preventDefault(); closeDevMap(); } }, true);
window.addEventListener('resize', () => draw());
/** The planet's size, for the console. */
export const planetSize = () => `${Math.round(WORLD_W / 1000)} km round, ${Math.round(POLE_Z * 2 / 1000)} km pole to pole`;
