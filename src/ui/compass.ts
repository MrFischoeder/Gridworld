// The compass strip at the top of the screen (only while you carry a Compass, on the surface): your heading with
// the cardinal points, a mark towards the nearest village (the next one while you stand in a village) (with its name and distance) and marks for the
// places your accepted quests send you to.
import { G } from '../game';
import { hasItem } from '../character';
import { allVillages, wrapDx } from '../gen/regions';
import { questMarkers } from '../world/quests';
import { $ } from './hud';

const cv = $<HTMLCanvasElement>('compass'), ctx = cv.getContext('2d')!;
const W = 460, H = 46, SPAN = 150; // degrees across the strip
const NAMES: Record<number, string> = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' };
cv.width = W; cv.height = H;

/** Compass bearing (degrees clockwise from north = -z) from the player to (x, z). */
export const bearingTo = (x: number, z: number) => ((Math.atan2(wrapDx(x - G.pos.x), -(z - G.pos.z)) * 180 / Math.PI) + 360) % 360;
export const heading = () => ((-G.yaw * 180 / Math.PI) % 360 + 360) % 360;
/** Eight-point name of a bearing ("NE"). */
export const point8 = (b: number) => NAMES[(Math.round(b / 45) * 45) % 360];
export const fmtDist = (m: number) => (m < 1000 ? Math.round(m / 10) * 10 + ' m' : (m / 1000).toFixed(1) + ' km');

let nearT = 0, near: { name: string; x: number; z: number } | null = null;
export function updateCompass(dt: number) {
  const on = G.char.loc === 'overworld' && hasItem('compass') && G.playing;
  cv.style.display = on ? 'block' : 'none';
  if (!on) return;
  if ((nearT -= dt) <= 0) { // the nearest village, looked up now and then
    nearT = 1;
    let bd = Infinity; near = null;
    for (const v of allVillages(G.char.world)) { const d = Math.hypot(wrapDx(v.x - G.pos.x), v.z - G.pos.z); if (d > 150 && d < bd) { bd = d; near = { name: v.name, x: v.x, z: v.z }; } }
  }
  const h = heading(), px = (b: number) => { let d = b - h; d = ((d + 540) % 360) - 180; return W / 2 + d / SPAN * W; };
  ctx.clearRect(0, 0, W, H);
  const grad = ctx.createLinearGradient(0, 0, W, 0);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(0.15, 'rgba(0,8,3,0.75)'); grad.addColorStop(0.85, 'rgba(0,8,3,0.75)'); grad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 24);
  ctx.font = '17px VT323, monospace'; ctx.textAlign = 'center';
  for (let b = 0; b < 360; b += 5) {
    const x = px(b);
    if (x < 8 || x > W - 8) continue;
    const alpha = 1 - Math.abs(x - W / 2) / (W / 2) * 0.8;
    ctx.globalAlpha = alpha;
    if (NAMES[b] !== undefined) { ctx.fillStyle = b === 0 ? '#ff6a4a' : '#3dff6e'; ctx.fillText(NAMES[b], x, 17); }
    else { ctx.strokeStyle = '#3dff6e'; ctx.beginPath(); ctx.moveTo(x, b % 15 === 0 ? 4 : 8); ctx.lineTo(x, b % 15 === 0 ? 12 : 11); ctx.stroke(); }
  }
  ctx.globalAlpha = 1;
  // where you look
  ctx.strokeStyle = '#c4ffd2'; ctx.beginPath(); ctx.moveTo(W / 2, 0); ctx.lineTo(W / 2, 24); ctx.stroke();
  // marks: quest targets, the nearest village
  const mark = (x: number, z: number, color: string, label: string) => {
    let sx = px(bearingTo(x, z)), edge = '';
    if (sx < 14) { sx = 14; edge = '◀ '; } else if (sx > W - 14) { sx = W - 14; edge = ' ▶'; }
    ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(sx - 5, 25); ctx.lineTo(sx + 5, 25); ctx.lineTo(sx, 31); ctx.closePath(); ctx.fill();
    ctx.font = '14px VT323, monospace'; ctx.textAlign = sx < 60 ? 'left' : sx > W - 60 ? 'right' : 'center';
    ctx.fillText((edge.startsWith('◀') ? edge : '') + label + (edge.endsWith('▶') ? edge : ''), sx, 43);
  };
  for (const q of questMarkers()) mark(q.x, q.z, '#ffd060', q.label);
  if (near) mark(near.x, near.z, '#9dffe0', `${near.name} ${fmtDist(Math.hypot(wrapDx(near.x - G.pos.x), near.z - G.pos.z))}`);
}
