// Local coordinates shared by the stone model, collision and the swept portal crossing test.
export const GATE_OUTER = 4.8, GATE_INNER = 3.65, GATE_CENTRE = GATE_OUTER * Math.cos(Math.PI / 8), GATE_DEPTH = .65;
export const UNMARKED_CORNERS = [5, 6] as const;
export function gatePolygon(r: number): [number, number][] {
  return Array.from({ length: 8 }, (_, i) => {
    const a = Math.PI / 8 + i * Math.PI / 4;
    return [r * Math.cos(a), r === GATE_INNER && (i === 5 || i === 6) ? 0 : GATE_CENTRE + r * Math.sin(a)];
  });
}
export const GATE_OUTLINE = gatePolygon(GATE_OUTER), GATE_OPENING = gatePolygon(GATE_INNER);
export function insidePolygon(poly: readonly (readonly [number, number])[], x: number, y: number): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ax, ay] = poly[i], [bx, by] = poly[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) inside = !inside;
  }
  return inside;
}
export function ringHit(x: number, y: number, z: number, r: number): boolean {
  if (Math.abs(z) > GATE_DEPTH + r || y + r < 0) return false;
  for (const dx of [-r, 0, r]) for (const dy of [-r, 0, r]) {
    if (insidePolygon(GATE_OUTLINE, x + dx, y + dy) && !insidePolygon(GATE_OPENING, x + dx, y + dy)) return true;
  }
  return false;
}
/** Swept crossing, so running through in a long frame cannot skip the thin energy surface. */
export function crossedGate(a: readonly [number, number, number], b: readonly [number, number, number]): boolean {
  if (Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]) > 15 || a[2] === b[2] || a[2] * b[2] > 0) return false;
  const t = a[2] / (a[2] - b[2]);
  return t >= 0 && t <= 1 && insidePolygon(GATE_OPENING, a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t);
}
