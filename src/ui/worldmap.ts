// Surface maps: the minimap (150 m around the player) and the full world map (M), both built from
// explored chunks only (fog of war). Chunk tiles are rendered once from the deterministic terrain.
import { nearX, wrapDx } from '../gen/regions';
import { G, W } from '../game';
import { OW, villageHere } from '../world/overworld';
import { CHUNK, poisNear, villageSeed, GRIDHOLM_ID } from '../gen/regions';
import { wallPolygon, villageSides } from '../gen/village';
import { STEP, VERTS, CELLS, inRect } from '../gen/terrain';
import { discover, isDiscovered } from '../save';
import { saveChar } from '../character';
import { drawPlayerArrow } from './minimap';
import { vehicles, driving } from '../world/vehicles';
import { questMarkers } from '../world/quests';
import { mapWagons, plundered } from '../world/caravans';
import { network, pathKnown } from '../gen/roads';
import { onRoad, caravanPos } from '../gen/caravans';
import { raiders } from '../world/raiders';
import { $ } from './hud';

const tiles = new Map<string, HTMLCanvasElement>();
let tileWorld = -1;

function tile(cx: number, cz: number): HTMLCanvasElement {
  const T = OW.terrain!;
  if (tileWorld !== T.world) { tiles.clear(); tileWorld = T.world; }
  const k = cx + ',' + cz;
  let cv = tiles.get(k);
  if (cv) return cv;
  cv = document.createElement('canvas'); cv.width = cv.height = CELLS;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(CELLS, CELLS), lat = T.lattice(cx, cz), f = T.chunkFeatures(cx, cz);
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    // contour lines every 4 m in the lowlands, every 12 m up the mountains
    const h = lat[i + VERTS * j], cs = h > 26 ? 12 : 4, band = Math.floor(h / cs) !== Math.floor(lat[i + 1 + VERTS * j] / cs) || Math.floor(h / cs) !== Math.floor(lat[i + VERTS * (j + 1)] / cs);
    const x = cx * CHUNK + i * STEP + 1, z = cz * CHUNK + j * STEP + 1;
    let r = 0, g = 28 + Math.min(h, 25) * 3.2, b = 10 + Math.min(h, 25) * 1.2;
    if (h > 25) { const m = Math.min(1, (h - 25) / 120); r = 30 + m * 150; g = 108 + m * 120; b = 40 + m * 150; } // rock, pale towards the peaks
    if (band) { g += 30; b += 12; }
    if (f.pads.some((p) => inRect(p.poi.rect, x, z))) { r = 10; g = 90; b = 40; }
    else if (f.roads.some((rd) => nearest(rd.pts, x, z) < rd.half + 0.5)) { r = 60; g = 170; b = 90; }
    else if (f.lakes.length) { const w = T.water(x, z); if (w) [r, g, b] = w.kind === 'toxic' ? [110, 190, 20] : w.kind === 'murky' ? [70, 80, 30] : [15, 110, 100]; }
    const o = 4 * (i + CELLS * j); img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tiles.set(k, cv);
  return cv;
}
function nearest(pts: [number, number][], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** Explore the chunks around the player (radius 2 = about 64 m). */
let lastC = '';
function explore() {
  const cx = Math.floor(G.pos.x / CHUNK), cz = Math.floor(G.pos.z / CHUNK), k = cx + ',' + cz;
  if (k === lastC) return; lastC = k;
  let changed = false;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) changed = discover(G.char.discovered, cx + i, cz + j) || changed;
  if (changed) saveChar();
}

/** Draws explored terrain around (x, z) at `ppm` pixels per metre into a w x h canvas area. */
function drawArea(ctx: CanvasRenderingContext2D, w: number, h: number, ppm: number, labels: boolean) {
  const px = G.pos.x, pz = G.pos.z, d = G.char.discovered;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const X = (x: number) => w / 2 + (x - px) * ppm, Z = (z: number) => h / 2 + (z - pz) * ppm;
  const hw = w / 2 / ppm, hh = h / 2 / ppm;
  const cx0 = Math.floor((px - hw) / CHUNK), cx1 = Math.floor((px + hw) / CHUNK), cz0 = Math.floor((pz - hh) / CHUNK), cz1 = Math.floor((pz + hh) / CHUNK);
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    if (!isDiscovered(d, cx, cz)) continue;
    ctx.drawImage(tile(cx, cz), X(cx * CHUNK), Z(cz * CHUNK), CHUNK * ppm + 0.5, CHUNK * ppm + 0.5);
  }
  ctx.font = (labels ? 20 : 11) + 'px VT323, monospace'; ctx.textAlign = 'center';
  for (const p of poisNear(OW.terrain!.world, px, pz, Math.max(hw, hh) + 60)) {
    if (!isDiscovered(d, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) continue;
    const x = X(p.x), y = Z(p.z);
    if (p.type === 'camp') { ctx.strokeStyle = ctx.fillStyle = '#ff6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'wreck') { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 7, y + 1); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 6, y - 6); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'village') { // the wall's own shape (gen/village.ts wallPolygon), at least a few pixels across
      ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2;
      const world = OW.terrain!.world, poly = wallPolygon(villageSides(villageSeed(world, p), p.id === GRIDHOLM_ID)), k = Math.max(6, 76 * ppm / 2) / 36.5;
      ctx.beginPath(); poly.forEach(([u, v], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + (u - 36) * k, y + (v - 36) * k)); ctx.closePath(); ctx.stroke();
    }
    else { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.stroke(); }
    if (labels) ctx.fillText(p.name, x, y - 12);
  }
  ctx.lineWidth = 1;
  for (const v of vehicles) {
    if (v === driving.v || (!v.claimed && !isDiscovered(d, Math.floor(v.st.x / CHUNK), Math.floor(v.st.z / CHUNK)))) continue;
    const x = X(nearX(v.st.x, px)), y = Z(v.st.z), l = Math.max(3, v.spec.length * ppm / 2), w = Math.max(2, v.spec.width * ppm / 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-v.st.heading); ctx.strokeStyle = '#e8fff0'; ctx.strokeRect(-w, -l, w * 2, l * 2); ctx.restore();
    if (labels) { ctx.fillStyle = '#e8fff0'; ctx.fillText(v.spec.name, x, y - l - 6); }
  }
  for (const c of G.char.claims) { // your flags: a pole and a pennant, the claimed land round them
    const x = X(nearX(c.x, px)), y = Z(c.z);
    ctx.strokeStyle = ctx.fillStyle = '#c4ffd2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, Math.max(4, 30 * ppm), 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y - 8); ctx.lineTo(x + 7, y - 5); ctx.lineTo(x, y - 2); ctx.stroke(); ctx.lineWidth = 1;
    if (labels) ctx.fillText('Your flag', x, y - 12);
  }
  for (const m of questMarkers()) {
    const x = X(m.x), y = Z(m.z);
    ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, labels ? 12 : 6, 0, 6.283); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillText('!', x, y + 4); if (labels) ctx.fillText(m.label, x, y - 16);
  }
  // on the big map: every caravan on the roads between villages you know (from the timetables), as an arrow
  if (labels) {
    let budget = 2; // new roads worked out per frame, so zooming far out does not stall the game
    const world = OW.terrain!.world, r = Math.max(hw, hh) + 2000, known = (v: { x: number; z: number }) => isDiscovered(d, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK));
    for (const e of network(world)) {
      if (!known(e.a) && !known(e.b)) continue;
      if (Math.min(Math.hypot(wrapDx(e.a.x - px), e.a.z - pz), Math.hypot(wrapDx(e.b.x - px), e.b.z - pz)) > r + 8000) continue;
      if (!pathKnown(world, e) && budget-- <= 0) continue;
      for (const c of onRoad(world, e, G.char.time)) {
        if (plundered(c.id)) continue;
        const p = caravanPos(world, e, c, G.char.time);
        if (!p) continue;
        const x = X(nearX(p.x, px)), y = Z(p.z);
        if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-p.yaw); ctx.fillStyle = G.char.escort?.id === c.id ? '#ffd060' : '#c8e0ff';
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  // caravans on the roads near you: pale wagons (gold: the one you guard, red rim: under attack)
  for (const c of mapWagons()) {
    const x = X(nearX(c.x, px)), y = Z(c.z), l = Math.max(3, 3 * ppm), w = Math.max(2, 1.3 * ppm);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-c.yaw); ctx.strokeStyle = c.mine ? '#ffd060' : '#c8e0ff'; ctx.lineWidth = 1.5; ctx.strokeRect(-w, -l, w * 2, l * 2);
    if (c.raided) { ctx.strokeStyle = '#ff6a4a'; ctx.strokeRect(-w - 2, -l - 2, w * 2 + 4, l * 2 + 4); }
    ctx.restore(); ctx.lineWidth = 1;
  }
  for (const r of raiders) { ctx.fillStyle = '#ff6a4a'; ctx.fillRect(X(r.p.x) - 3, Z(r.p.z) - 3, 6, 6); }
  for (const b of W.bandits) { if (b.state === 'idle') continue; ctx.fillStyle = '#ff6a4a'; ctx.fillRect(X(b.p.x) - 2, Z(b.p.z) - 2, 4, 4); }
  for (const c of W.creatures) { if (c.state === 'roam') continue; ctx.fillStyle = '#ff9a3c'; ctx.fillRect(X(c.p.x) - 2, Z(c.p.z) - 2, 4, 4); }
  for (const t of W.drones) { if (!t.chasing) continue; ctx.fillStyle = '#ffb347'; ctx.fillRect(X(t.p.x) - 1.5, Z(t.p.z) - 1.5, 3, 3); }
  drawPlayerArrow(ctx, w / 2, h / 2);
}

export function drawWorldMini(ctx: CanvasRenderingContext2D, size: number) {
  explore();
  drawArea(ctx, size, size, 1, false);
  if (G.mapOpen) drawFullMap();
}

// ---------- full-screen world map ----------
const big = $<HTMLCanvasElement>('worldmap'), bctx = big.getContext('2d')!;
let zoom = 0.6;
function drawFullMap() {
  const w = innerWidth, h = innerHeight;
  if (big.width !== w || big.height !== h) { big.width = w; big.height = h; }
  drawArea(bctx, w, h, zoom, true);
  bctx.fillStyle = '#3dff6e'; bctx.font = '22px VT323, monospace'; bctx.textAlign = 'left';
  bctx.fillText('WORLD MAP — M or Esc to close · wheel / + - to zoom', 16, h - 16);
  bctx.textAlign = 'right'; bctx.fillText(villageHere(G.pos.x, G.pos.z)?.name ?? $('hudL').textContent ?? '', w - 16, 30);
}
export function toggleMap(open = !G.mapOpen) {
  if (G.char.loc !== 'overworld') open = false;
  G.mapOpen = open; big.style.display = open ? 'block' : 'none';
}
export const zoomMap = (f: number) => { zoom = Math.max(0.15, Math.min(4, zoom * f)); };
big.addEventListener('wheel', (e) => zoomMap(e.deltaY < 0 ? 1.2 : 1 / 1.2), { passive: true });
big.addEventListener('click', () => toggleMap(false));
$('mini').addEventListener('click', () => toggleMap());
$('mini').addEventListener('touchstart', (e) => { e.preventDefault(); toggleMap(); }, { passive: false });
