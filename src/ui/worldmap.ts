// Surface maps: the minimap (150 m around the player) and the full world map (M), both built from
// explored chunks only (fog of war). Chunk tiles are rendered once from the deterministic terrain.
import { G, W } from '../game';
import { OW, inVillage } from '../world/overworld';
import { CHUNK, poisNear } from '../gen/regions';
import { STEP, VERTS, CELLS, inRect } from '../gen/terrain';
import { discover, isDiscovered } from '../save';
import { saveChar } from '../character';
import { drawPlayerArrow } from './minimap';
import { vehicles, driving } from '../world/vehicles';
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
    const h = lat[i + VERTS * j], band = Math.floor(h / 4) !== Math.floor(lat[i + 1 + VERTS * j] / 4) || Math.floor(h / 4) !== Math.floor(lat[i + VERTS * (j + 1)] / 4);
    const x = cx * CHUNK + i * STEP + 1, z = cz * CHUNK + j * STEP + 1;
    let r = 0, g = 28 + h * 3.2, b = 10 + h * 1.2;
    if (band) { g += 30; b += 12; }
    if (f.pads.some((p) => inRect(p.poi.rect, x, z))) { r = 10; g = 90; b = 40; }
    else if (f.roads.some((rd) => nearest(rd.pts, x, z) < rd.half + 0.5)) { r = 60; g = 170; b = 90; }
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
    if (p.type === 'village') { ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2; const s = Math.max(6, 76 * ppm / 2); ctx.strokeRect(x - s, y - s, s * 2, s * 2); }
    else { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.stroke(); }
    if (labels) ctx.fillText(p.name, x, y - 12);
  }
  ctx.lineWidth = 1;
  for (const v of vehicles) {
    if (v === driving.v || (!v.claimed && !isDiscovered(d, Math.floor(v.st.x / CHUNK), Math.floor(v.st.z / CHUNK)))) continue;
    const x = X(v.st.x), y = Z(v.st.z), l = Math.max(3, v.spec.length * ppm / 2), w = Math.max(2, v.spec.width * ppm / 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-v.st.heading); ctx.strokeStyle = '#e8fff0'; ctx.strokeRect(-w, -l, w * 2, l * 2); ctx.restore();
    if (labels) { ctx.fillStyle = '#e8fff0'; ctx.fillText(v.spec.name, x, y - l - 6); }
  }
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
  bctx.textAlign = 'right'; bctx.fillText(inVillage(G.pos.x, G.pos.z) ? 'Gridholm' : $('hudL').textContent ?? '', w - 16, 30);
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
