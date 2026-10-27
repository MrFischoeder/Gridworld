// (0.274, the owner's request) The work ring: an empty dodecagon in the middle of the screen whose edge fills
// clockwise from the top while you work at something (stripping a machine, sawing, chopping, mining, the workshop,
// hand work). Each job reports its share done every frame with `reportWork`; `drawWorkRing` (main loop, once a frame)
// shows the largest share reported since the last frame and hides the ring when nobody reported. Local view only.

const SIZE = 92, R = 38, W = 6;
const pts = Array.from({ length: 12 }, (_, i) => {
  const a = -Math.PI / 2 + (i * Math.PI) / 6; // from the top, clockwise on screen (y grows down)
  return `${(SIZE / 2 + Math.cos(a) * R).toFixed(2)} ${(SIZE / 2 + Math.sin(a) * R).toFixed(2)}`;
});
const d = `M${pts.join(' L')} Z`;

let box: HTMLDivElement | null = null, fill: SVGPathElement | null = null, label: HTMLDivElement | null = null;
let want = -1, shown = -1, last = 0;

function build() {
  box = document.createElement('div');
  box.id = 'workring';
  box.style.cssText = `position:fixed;left:50%;top:50%;width:${SIZE}px;height:${SIZE}px;margin:${-SIZE / 2}px 0 0 ${-SIZE / 2}px;pointer-events:none;z-index:6;display:none;transition:opacity .15s;filter:drop-shadow(0 0 4px rgba(47,224,96,.55))`;
  box.innerHTML = `<svg width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">`
    + `<path d="${d}" fill="none" stroke="#010d04" stroke-opacity=".55" stroke-width="${W + 4}" stroke-linejoin="miter"/>`
    + `<path d="${d}" fill="none" stroke="#2fe060" stroke-opacity=".22" stroke-width="${W}" stroke-linejoin="miter"/>`
    + `<path class="f" d="${d}" pathLength="1" fill="none" stroke="#5dff8a" stroke-width="${W}" stroke-linejoin="miter" stroke-linecap="butt" stroke-dasharray="0 1"/>`
    + `</svg><div style="position:absolute;left:0;right:0;top:${SIZE / 2 + 9}px;text-align:center;font:600 11px monospace;color:#9dffb0;text-shadow:0 0 3px #000"></div>`;
  document.body.appendChild(box);
  fill = box.querySelector('path.f');
  label = box.querySelector('div');
}

/** A job in progress this frame: `f` = its share done, 0..1. */
export function reportWork(f: number) {
  if (Number.isFinite(f)) want = Math.max(want, Math.min(1, Math.max(0, f)));
}

/** Once a frame: draw what was reported, or hide the ring. */
export function drawWorkRing() {
  const f = want; want = -1;
  if (f < 0) { if (box && shown >= 0) { box.style.display = 'none'; shown = -1; } last = 0; return; }
  if (!box) build();
  if (shown < 0) box!.style.display = 'block';
  // a unit just finished and the next began: flash the full ring for a moment
  if (last > 0.8 && f < last - 0.5) box!.animate([{ transform: 'scale(1.12)', opacity: 1 }, { transform: 'scale(1)', opacity: 1 }], { duration: 220 });
  last = f;
  const q = Math.round(f * 400) / 400;
  if (q !== shown) {
    shown = q;
    fill!.setAttribute('stroke-dasharray', `${q} 1`);
    label!.textContent = `${Math.round(q * 100)}%`;
  }
}
