// The map board in every village (E at it): a map of the land around the village, about 900 m each way, drawn in
// the game's style: the lie of the land, lakes, roads, the villages, ruins, bandit camps and crash sites with their
// names (the nearest ones), arrows at the edge towards the nearest other villages, where you stand, and a list of
// the places with their distance and direction. Reading it also marks those
// places on your own map (M).
import { G } from '../game';
import { poisNear, allVillages, CHUNK, POLAR_Z, wrapDx, regionOf, type Poi } from '../gen/regions';
import { regionRoads } from '../gen/roads';
import { discover } from '../save';
import { saveChar } from '../character';
import { OW } from '../world/overworld';
import { bearingTo, point8, fmtDist } from './compass';
import { $, logLine } from './hud';
import { lockPointer } from './input';

const root = $('areamap'), cv = $<HTMLCanvasElement>('areamapCv'), list = $('areamapList'), title = $('areamapTitle'), ctx = cv.getContext('2d')!;
const RANGE = 900, SIZE = 640, LABELS = 14;
const COLOR: Record<string, string> = { village: '#ffd060', ruin: '#5cc8ff', camp: '#ff6a4a', wreck: '#7dffc8' };
const KIND: Record<string, string> = { village: 'village', ruin: 'ruins', camp: 'bandit camp', wreck: 'crash site' };
let open = false;

function symbol(p: Poi, x: number, y: number) {
  ctx.strokeStyle = ctx.fillStyle = COLOR[p.type]; ctx.lineWidth = 2; ctx.beginPath();
  if (p.type === 'village') { ctx.strokeRect(x - 6, y - 6, 12, 12); ctx.fillRect(x - 2, y - 2, 4, 4); return; }
  if (p.type === 'ruin') { ctx.moveTo(x - 6, y + 5); ctx.lineTo(x, y - 6); ctx.lineTo(x + 6, y + 5); ctx.closePath(); }
  else if (p.type === 'camp') { ctx.moveTo(x - 6, y + 5); ctx.lineTo(x, y - 5); ctx.lineTo(x + 6, y + 5); ctx.moveTo(x - 3, y + 5); ctx.lineTo(x, y); ctx.lineTo(x + 3, y + 5); }
  else { ctx.moveTo(x - 8, y); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x + 8, y - 1); ctx.lineTo(x + 8, y + 1); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 6, y - 7); }
  ctx.stroke();
}

export function openAreaMap(centre: { x: number; z: number; name: string }) {
  const T = OW.terrain;
  if (!T || open) return;
  open = true; G.playing = false; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  if (document.pointerLockElement) document.exitPointerLock();
  title.textContent = `${centre.name.toUpperCase()} · THE SURROUNDINGS`;
  cv.width = cv.height = SIZE;
  const k = SIZE / (2 * RANGE), X = (x: number) => SIZE / 2 + wrapDx(x - centre.x) * k, Y = (z: number) => SIZE / 2 + (z - centre.z) * k;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE);
  // the land: brighter the higher, lakes in their water colours, ice pale
  const cell = 32, n = Math.ceil(2 * RANGE / cell);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const x = centre.x - RANGE + (i + 0.5) * cell, z = centre.z - RANGE + (j + 0.5) * cell, w = T.water(x, z);
    if (w) ctx.fillStyle = w.kind === 'fresh' ? '#0b4a42' : w.kind === 'murky' ? '#2a3216' : '#34501a';
    else if (Math.abs(z) > POLAR_Z) ctx.fillStyle = '#26403a';
    else { const h = T.heightAt(x, z), g = Math.max(0, Math.min(1, (h + 4) / 36)); ctx.fillStyle = `rgb(${Math.round(4 + g * 10)},${Math.round(22 + g * 60)},${Math.round(8 + g * 20)})`; }
    ctx.fillRect(Math.floor(i * cell * k), Math.floor(j * cell * k), Math.ceil(cell * k) + 1, Math.ceil(cell * k) + 1);
  }
  // a faint 500 m grid
  ctx.strokeStyle = 'rgba(61,255,110,0.12)'; ctx.lineWidth = 1; ctx.beginPath();
  for (let d = -RANGE; d <= RANGE; d += 500) { const s = SIZE / 2 + d * k; ctx.moveTo(s, 0); ctx.lineTo(s, SIZE); ctx.moveTo(0, s); ctx.lineTo(SIZE, s); }
  ctx.stroke();
  // roads
  const [ax, az] = regionOf(centre.x - RANGE, centre.z - RANGE), [bx, bz] = regionOf(centre.x + RANGE, centre.z + RANGE), seen = new Set<string>();
  ctx.strokeStyle = 'rgba(200,255,216,0.55)'; ctx.lineWidth = 2;
  for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) for (const r of regionRoads(G.char.world, rx, rz)) {
    if (seen.has(r.id)) continue; seen.add(r.id);
    ctx.beginPath(); r.pts.forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Y(z)) : ctx.moveTo(X(x), Y(z)))); ctx.stroke();
  }
  // places
  const places = poisNear(G.char.world, centre.x, centre.z, RANGE).filter((p) => Math.abs(wrapDx(p.x - centre.x)) < RANGE && Math.abs(p.z - centre.z) < RANGE);
  ctx.font = '16px VT323, monospace'; ctx.textAlign = 'center';
  const dc = (p: { x: number; z: number }) => Math.hypot(wrapDx(p.x - centre.x), p.z - centre.z);
  const named = new Set([...places].sort((a, b) => dc(a) - dc(b)).slice(0, LABELS));
  for (const p of places) { const x = X(p.x), y = Y(p.z); symbol(p, x, y); if (named.has(p)) { ctx.fillStyle = COLOR[p.type]; ctx.fillText(p.name, x, y - 10); } }
  // the nearest other villages, off the map: an arrow at the edge pointing their way
  const others = allVillages(G.char.world).filter((v) => dc(v) > RANGE).sort((a, b) => dc(a) - dc(b)).slice(0, 3);
  for (const v of others) {
    const dx = wrapDx(v.x - centre.x), dz = v.z - centre.z, m = Math.max(Math.abs(dx), Math.abs(dz)), e = (RANGE - 60) / m;
    const x = SIZE / 2 + dx * e * k, y = SIZE / 2 + dz * e * k, a = Math.atan2(dz, dx);
    ctx.fillStyle = COLOR.village; ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * 12, y + Math.sin(a) * 12); ctx.lineTo(x + Math.cos(a + 2.5) * 9, y + Math.sin(a + 2.5) * 9); ctx.lineTo(x + Math.cos(a - 2.5) * 9, y + Math.sin(a - 2.5) * 9); ctx.closePath(); ctx.fill();
    ctx.fillText(`${v.name} ${fmtDist(dc(v))}`, Math.max(90, Math.min(SIZE - 90, x)), y + (dz > 0 ? -14 : 24));
  }
  // you are here, north, scale
  const yx = X(G.pos.x), yy = Y(G.pos.z);
  ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(yx, yy, 6, 0, 6.283); ctx.stroke();
  ctx.fillStyle = '#fff'; ctx.fillText('YOU ARE HERE', yx, yy + 20);
  ctx.fillStyle = '#ff6a4a'; ctx.font = '22px VT323, monospace'; ctx.fillText('N', SIZE - 26, 30);
  ctx.beginPath(); ctx.moveTo(SIZE - 26, 36); ctx.lineTo(SIZE - 32, 50); ctx.lineTo(SIZE - 20, 50); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#3dff6e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, SIZE - 20); ctx.lineTo(20 + 500 * k, SIZE - 20); ctx.moveTo(20, SIZE - 25); ctx.lineTo(20, SIZE - 15); ctx.moveTo(20 + 500 * k, SIZE - 25); ctx.lineTo(20 + 500 * k, SIZE - 15); ctx.stroke();
  ctx.fillStyle = '#3dff6e'; ctx.font = '16px VT323, monospace'; ctx.textAlign = 'left'; ctx.fillText('500 m', 26 + 500 * k, SIZE - 15);
  // the list: nearest first, with the way to go from where you stand
  const rows = places.filter((p) => !(p.type === 'village' && Math.hypot(wrapDx(p.x - centre.x), p.z - centre.z) < 1))
    .map((p) => ({ p, d: Math.hypot(wrapDx(p.x - G.pos.x), p.z - G.pos.z) })).sort((a, b) => a.d - b.d);
  const way = others.map((v) => `<div class="way">Village: <span style="color:${COLOR.village}">${v.name}</span><br><span class="dir">${fmtDist(Math.hypot(wrapDx(v.x - G.pos.x), v.z - G.pos.z))} ${point8(bearingTo(v.x, v.z))}</span></div>`).join('');
  list.innerHTML = way + (rows.length ? rows.map(({ p, d }) => `<div><span style="color:${COLOR[p.type]}">${p.name}</span> <span class="k">${KIND[p.type]}</span><br><span class="dir">${fmtDist(d)} ${point8(bearingTo(p.x, p.z))}</span></div>`).join('')
    : '<div>Nothing else of note nearby.</div>');
  // what you read here, you remember: the places go on your own map
  let n2 = 0;
  for (const p of places) if (discover(G.char.discovered, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) n2++;
  if (n2) { saveChar(); logLine(`${n2} place${n2 === 1 ? '' : 's'} marked on your map (M).`); }
  root.style.display = 'flex';
}
export function closeAreaMap() {
  if (!open) return;
  open = false; root.style.display = 'none'; G.playing = true;
  if (!G.isTouch) lockPointer();
}
$('areamapClose').onclick = closeAreaMap;
window.addEventListener('keydown', (e) => { if (open && (e.code === 'Escape' || e.code === 'KeyE')) { e.stopImmediatePropagation(); e.preventDefault(); closeAreaMap(); } }, true);
