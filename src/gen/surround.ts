// (0.229, PLAN_WALKI.md stage W7: surrounding and tight places) A group that fights at close range (a Ravager pack, a
// Gnawer nest, bandit bruisers) spreads round its target: each member takes a place on a ring round it, as far apart
// as their number allows, so they come from several sides at once. Places where something solid stands (a wall, a
// rock, a trunk, the side of a passage) are no use; when there are fewer open places than members, the rest wait
// their turn further out. So a back to a wall halves the sides they can come from, and in a narrow passage they come
// one or two at a time. Shooting down from a height (a wall walk, a rock, a roof) counts more, and shooting up at
// someone on a height is harder. Pure: the ring, the share-out of places, the height's bonus.

export const SURROUND = {
  /** Places on the ring, and its radius for a pack's run-in (the bandits' blades stand closer). */
  slots: 12, ring: 4.5,
  /** Where those without a place wait (m from the target), and how often the places are shared out again (s). */
  wait: 8, every: 0.5,
  /** The target moving this far reshares the places. */
  moved: 1.5,
  /** Your own sides, looked at this far out: walled in on at least `wall` of 8, you have your back to something. */
  probe: 1.8, wall: 3,
};
/** Angle of place k (the ring's places sit at fixed bearings round the target, x = sin, z = cos). */
export const slotAngle = (k: number, n = SURROUND.slots) => (k / n) * Math.PI * 2;
/** The place nearest a bearing. */
export const nearestSlot = (a: number, n = SURROUND.slots) => ((Math.round((a / (Math.PI * 2)) * n) % n) + n) % n;
const ringDist = (a: number, b: number, n: number) => { const d = Math.abs(a - b) % n; return Math.min(d, n - d); };

/**
 * Share the ring's places out. `bearings[i]` = member i's bearing from the target, `order` = the members nearest
 * first (they choose first), `open[k]` = place k can be stood in. Each takes the open place nearest its own bearing
 * that keeps the spacing their number asks for (12 / n places apart), else any open place left, else −1 (it waits).
 */
export function shareSlots(bearings: number[], order: number[], open: boolean[]): number[] {
  const n = open.length, out = bearings.map(() => -1), taken: number[] = [];
  const spacing = Math.max(1, Math.floor(n / Math.max(1, bearings.length)));
  for (const pass of [spacing, 1]) {
    for (const i of order) {
      if (out[i] >= 0) continue;
      const want = nearestSlot(bearings[i], n);
      let best = -1, bd = Infinity;
      for (let k = 0; k < n; k++) {
        if (!open[k] || taken.includes(k) || taken.some((t) => ringDist(t, k, n) < pass)) continue;
        const d = ringDist(k, want, n);
        if (d < bd) { bd = d; best = k; }
      }
      if (best >= 0) { out[i] = best; taken.push(best); }
    }
  }
  return out;
}
/** How many of the 8 sides round you are walled in, and whether that puts your back to something. */
export const backToWall = (blocked: number) => blocked >= SURROUND.wall;

/** Shooting from above: from `from` m higher than the target's feet it starts to count more, up to `max` at `full` m. */
export const HEIGHT = { from: 1.5, full: 4, max: 1.3, flyer: 2.5, upSpread: 0.03 };
/** The multiplier of a shot or a blow from `dy` m above the target's ground. */
export function heightMult(dy: number): number {
  if (dy <= HEIGHT.from) return 1;
  return 1 + (HEIGHT.max - 1) * Math.min(1, (dy - HEIGHT.from) / (HEIGHT.full - HEIGHT.from));
}
/** Extra scatter a shooter gets aiming up at someone `dy` m above his feet. */
export const upSpread = (dy: number) => Math.max(0, dy - 2) * HEIGHT.upSpread;
