// Display coordinates only: the world's canonical coordinates and saved IDs stay unchanged.
import { continents } from '../gen/continents';
import { WORLD_W, POLE_Z, wrapX } from '../gen/regions';

export interface MapView { x: number; z: number; mpp: number }

/** The middle of the guaranteed ocean lane between the first two continents. */
export const oceanMapSeam = (world: number): number => wrapX(WORLD_W / (2 * continents(world).length));

export function mapOverview(world: number, width: number, height: number): MapView {
  return { x: oceanMapSeam(world) + WORLD_W / 2, z: 0,
    mpp: Math.max(WORLD_W / Math.max(1, width), 2 * POLE_Z / Math.max(1, height - 100)) };
}

/** Every visible longitude copy, including objects extending past the viewport edge. */
export function longitudeCopies(x: number, centre: number, span: number, margin = 0): number[] {
  // Three-continent seams fall at fractional metres; retain copies exactly on either edge.
  const first = Math.ceil((centre - span / 2 - margin - x) / WORLD_W - 1e-12);
  const last = Math.floor((centre + span / 2 + margin - x) / WORLD_W + 1e-12);
  return Array.from({ length: Math.max(0, last - first + 1) }, (_, i) => x + (first + i) * WORLD_W);
}

// Project already-selected copies linearly: folding individual points splits rivers and hides markers.
export const mapToScreen = (view: MapView, width: number, height: number, x: number, z: number): [number, number] =>
  [width / 2 + (x - view.x) / view.mpp, height / 2 + (z - view.z) / view.mpp];
export const mapToWorld = (view: MapView, width: number, height: number, sx: number, sy: number): [number, number] =>
  [view.x + (sx - width / 2) * view.mpp, view.z + (sy - height / 2) * view.mpp];
