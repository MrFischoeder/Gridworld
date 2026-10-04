// A continuous flight of light trails hides the world until an accepted gate journey arrives.
import { G } from '../game';
let canvas: HTMLCanvasElement | null = null, frame = 0, trip: number | null = null, started = 0;
export const gateTransitActive = () => trip !== null;
export function startGateTransit(token: number) {
  if (trip === token) return;
  finishGateTransit(); trip = token; started = performance.now();
  G.firing = G.aiming = false; G.vel.set(0, 0, 0);
  for (const key in G.keys) G.keys[key] = false;
  canvas = document.createElement('canvas'); canvas.id = 'gate-transit';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Travelling through the ancient gate');
  document.body.append(canvas);
  const ctx = canvas.getContext('2d')!;
  const draw = (now: number) => {
    if (!canvas || trip === null) return;
    const width = innerWidth, height = innerHeight, scale = Math.min(devicePixelRatio, 1.5);
    if (canvas.width !== Math.round(width * scale) || canvas.height !== Math.round(height * scale)) { canvas.width = Math.round(width * scale); canvas.height = Math.round(height * scale); }
    ctx.setTransform(scale, 0, 0, scale, 0, 0); ctx.fillStyle = '#010508'; ctx.fillRect(0, 0, width, height);
    const time = (now - started) / 1000, cx = width / 2, cy = height / 2;
    ctx.lineCap = 'round';
    for (let i = 0; i < 96; i++) {
      const angle = i * 2.399963229728653, phase = (i * .7548776662466927 + time * (.55 + i % 5 * .08)) % 1;
      const near = .025 + phase * phase * 1.25, far = near + .12 + phase * .55;
      const dx = Math.cos(angle) * width * .75, dy = Math.sin(angle) * height * .85;
      ctx.strokeStyle = i % 3 ? '#80e8ff' : '#e8ffff'; ctx.globalAlpha = .25 + phase * .75; ctx.lineWidth = .8 + phase * 2.8;
      ctx.beginPath(); ctx.moveTo(cx + dx * near, cy + dy * near); ctx.lineTo(cx + dx * far, cy + dy * far); ctx.stroke();
    }
    ctx.globalAlpha = 1; frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
}
export function finishGateTransit(token?: number) {
  if (token !== undefined && trip !== token) return;
  cancelAnimationFrame(frame); canvas?.remove(); canvas = null; trip = null;
}
