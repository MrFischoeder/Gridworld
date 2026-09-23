// Minimap of voxel locations: a window around the player, revealed while exploring.
import { G, W } from '../game';
import { el } from './hud';
import { drawWorldMini } from './worldmap';

const mini = document.getElementById('mini') as HTMLCanvasElement, mctx = mini.getContext('2d')!;
const MS = 3, MV = 150; mini.width = mini.height = MV;
let miniBase: HTMLCanvasElement, mbctx: CanvasRenderingContext2D, explored: Uint8Array, lastReveal = '';
export const miniCtx = () => ({ canvas: mini, ctx: mctx, size: MV });

function colOpen(x: number, z: number) {
  const s = G.space;
  return s.empty(x, 0, z) || s.empty(x, 1, z) || s.empty(x, 2, z) || W.doors.some((d) => d.cells.some((q) => q[0] === x && q[2] === z));
}
export function buildMini() {
  const g = G.grid;
  miniBase = document.createElement('canvas'); miniBase.width = g.nx * MS; miniBase.height = g.nz * MS;
  mbctx = miniBase.getContext('2d')!; mbctx.fillStyle = '#0d4a1d';
  explored = new Uint8Array(g.nx * g.nz); lastReveal = ''; reveal();
}
/** Whole map known at once (the village). */
export function revealAll() {
  const g = G.grid;
  explored.fill(0); lastReveal = ''; mbctx.clearRect(0, 0, miniBase.width, miniBase.height);
  for (let x = g.ox; x < g.ox + g.nx; x++) for (let z = g.oz; z < g.oz + g.nz; z++) {
    explored[(x - g.ox) + g.nx * (z - g.oz)] = 1; if (colOpen(x, z)) mbctx.fillRect((x - g.ox) * MS, (z - g.oz) * MS, MS, MS);
  }
}
function reveal() {
  const g = G.grid, cx = Math.floor(G.pos.x), cz = Math.floor(G.pos.z), key = cx + ',' + cz; if (key === lastReveal) return; lastReveal = key;
  for (let dz = -12; dz <= 12; dz++) for (let dx = -12; dx <= 12; dx++) {
    if (dx * dx + dz * dz > 144) continue;
    const i = cx + dx - g.ox, k = cz + dz - g.oz; if (i < 0 || k < 0 || i >= g.nx || k >= g.nz || explored[i + g.nx * k]) continue;
    explored[i + g.nx * k] = 1; if (colOpen(cx + dx, cz + dz)) mbctx.fillRect(i * MS, k * MS, MS, MS);
  }
}
const seen = (x: number, z: number) => { const g = G.grid, i = Math.floor(x) - g.ox, k = Math.floor(z) - g.oz; return i >= 0 && k >= 0 && i < g.nx && k < g.nz && !!explored[i + g.nx * k]; };

export function drawPlayerArrow(ctx: CanvasRenderingContext2D, px: number, py: number) {
  const fx = -Math.sin(G.yaw), fz = -Math.cos(G.yaw);
  ctx.fillStyle = '#3dff6e'; ctx.beginPath();
  ctx.moveTo(px + fx * 6, py + fz * 6); ctx.lineTo(px - fz * 3 - fx * 3, py + fx * 3 - fz * 3); ctx.lineTo(px + fz * 3 - fx * 3, py - fx * 3 - fz * 3); ctx.fill();
}

let mode: 'voxel' | 'world' = 'voxel';
export function setMiniMode(m: 'voxel' | 'world') { mode = m; }
export function drawMini() {
  if (mode === 'world') { drawWorldMini(mctx, MV); return; }
  reveal();
  const g = G.grid, pos = G.pos;
  const sx = (pos.x - g.ox) * MS - MV / 2, sy = (pos.z - g.oz) * MS - MV / 2;
  mctx.clearRect(0, 0, MV, MV); mctx.drawImage(miniBase, -sx, -sy);
  const P = (x: number, z: number) => [(x - g.ox) * MS - sx, (z - g.oz) * MS - sy];
  for (const b of W.bosses) { if (!b.engaged && !seen(b.p.x, b.p.z)) continue; const [x, y] = P(b.p.x, b.p.z); mctx.strokeStyle = '#ff6a4a'; mctx.lineWidth = 1.5; mctx.strokeRect(x - 4, y - 4, 8, 8); mctx.lineWidth = 1; }
  for (const d of W.doors) {
    if (!seen(d.cx, d.cz)) continue; const [x, y] = P(d.cx, d.cz); mctx.fillStyle = d.locked ? '#ff5a3c' : d.blocked ? '#b07a20' : '#3dff6e';
    if (d.axis === 'x') mctx.fillRect(x - 1, y - 3, 2, 6); else mctx.fillRect(x - 3, y - 1, 6, 2);
  }
  for (const t of W.drones) { if (!t.chasing && !seen(t.p.x, t.p.z)) continue; const [x, y] = P(t.p.x, t.p.z); mctx.fillStyle = t.chasing ? '#ffb347' : '#7a5520'; mctx.fillRect(x - 1.5, y - 1.5, 3, 3); }
  for (const c of W.chests) { if (c.open || !seen(c.g.position.x, c.g.position.z)) continue; const [x, y] = P(c.g.position.x, c.g.position.z); mctx.fillStyle = '#ffd060'; mctx.fillRect(x - 2.5, y - 2.5, 5, 5); }
  mctx.strokeStyle = '#5cc8ff'; mctx.fillStyle = '#5cc8ff'; mctx.font = '10px VT323, monospace'; mctx.textAlign = 'center';
  for (const p of W.portals) {
    if (!seen(p.cx, p.cz)) continue; const [x, y] = P(p.cx + p.o[0] * 2, p.cz + p.o[1] * 2);
    mctx.strokeRect(x - 3, y - 3, 6, 6); mctx.fillText((p.up ? '▲' : '▼') + (p.key.length === 1 && 'VD'.includes(p.key) ? p.key : p.dir), x, y - 5);
  }
  const hatch = W.hatch;
  if (hatch && seen(hatch.g.position.x, hatch.g.position.z)) { const [x, y] = P(hatch.g.position.x, hatch.g.position.z); mctx.strokeStyle = '#e8fff0'; mctx.strokeRect(x - 3.5, y - 3.5, 7, 7); }
  drawPlayerArrow(mctx, MV / 2, MV / 2);
  // progress towards the hatch
  if (hatch && G.map) { const s0 = G.map.spawn[2], s1 = hatch.g.position.z; el.route.textContent = 'Route ' + Math.round(Math.max(0, Math.min(1, (pos.z - s0) / (s1 - s0))) * 100) + '%'; }
}
