// The inside of a crashed freighter (a crash site's "dungeon"): unlike the temple mazes it is built like a ship.
// A straight spine corridor runs from the engine room at the stern to the bridge at the bow; along it come bays,
// mirrored left and right: pairs of crew cabins, side compartments, a cargo hold that spans the whole beam, and the
// airlock with the way back up. Bulkhead doors split the spine, short stub corridors (with doors) lead to the side
// rooms. The crash left debris everywhere. Pure and deterministic; returns the same DungeonMap as gen/dungeon.ts.
import { rng, rangeInt } from '../core/rng';
import type { Op } from '../core/voxel';
import { stairOpsFor, type PortalSpec } from './stairs';
import type { DungeonMap, DoorCand, BossSpec, DecoBox } from './dungeon';

/** Keel line of the ship (x); the spine corridor is 3 cells wide around it. */
export const SHIP_CX = 32;

export function generateShip(seed: number): DungeonMap {
  const R = rng(seed), ri = rangeInt(R), CX = SHIP_CX;
  const ops: Op[] = [], debris: Op[] = [], boxes: DecoBox[] = [], doorCands: DoorCand[] = [], chests: { x: number; z: number }[] = [];
  const mirror = (x: number, w: number) => 2 * CX - (x + w - 1);
  const room = (x: number, z: number, w: number, d: number, h: number) => { ops.push({ op: 'room', x, y: 0, z, w, h, d }); boxes.push({ x, z, w, d, h, tunnel: false }); };
  /** A side room on both sides of the spine, each reached by a stub corridor with a door. */
  const sidePair = (off: number, z: number, w: number, d: number, h: number) => {
    const x = CX + 2 + off, c = z + (d >> 1);
    for (const [rx, sx] of [[x, 1], [mirror(x, w), -1]] as const) {
      room(rx, z, w, d, h);
      const x0 = sx > 0 ? CX + 1 : rx + w - 1, x1 = sx > 0 ? rx : CX - 1;
      ops.push({ op: 'room', x: Math.min(x0, x1), y: 0, z: c - 1, w: Math.abs(x1 - x0) + 1, h: 3, d: 3 });
      // decoration only between the spine's wall and the room's wall (not hanging into either)
      const dx0 = sx > 0 ? CX + 2 : rx + w, dx1 = sx > 0 ? rx : CX - 1;
      boxes.push({ x: dx0, z: c - 1, w: dx1 - dx0, d: 3, h: 3, tunnel: true });
      doorCands.push({ axis: 'x', m: sx > 0 ? CX + 2 + (off >> 1) : CX - 2 - (off >> 1), c });
    }
    return [{ x, z, w, d }, { x: mirror(x, w), z, w, d }];
  };
  const inside = (r: { x: number; z: number; w: number; d: number }) => ({ x: r.x + 1 + ri(0, Math.max(0, r.w - 3)), z: r.z + 1 + ri(0, Math.max(0, r.d - 3)) });
  const scatter = (r: { x: number; z: number; w: number; d: number }, n: number) => {
    for (let i = 0; i < n; i++) { const s = ri(1, 2); debris.push({ op: 'solid', x: ri(r.x + 1, r.x + r.w - s - 1), y: 0, z: ri(r.z + 1, r.z + r.d - s - 1), w: s, h: ri(1, 2), d: s }); }
  };

  // the engine room at the stern: a tall hall with two reactor drums (and the ship's guardian)
  const engine = { x: CX - 11, z: 2, w: 23, d: 12, h: 7 };
  room(engine.x, engine.z, engine.w, engine.d, engine.h);
  for (const x of [CX - 7, mirror(CX - 7, 3)]) ops.push({ op: 'solid', x, y: 0, z: 5, w: 3, h: 5, d: 3 });
  chests.push({ x: CX, z: 3 });
  const bosses: BossSpec[] = [{ x: CX, z: 8, room: { x: engine.x, z: engine.z, w: engine.w, d: engine.d, h: engine.h }, guard: false }];

  // bays along the spine
  const holds: [number, number][] = [];
  let z = engine.z + engine.d + 2, spawn: [number, number, number] = [CX + 0.5, 0, z + 1], portal: PortalSpec | null = null;
  const n = ri(4, 6), airlockAt = 1;
  for (let b = 0; b < n; b++) {
    doorCands.push({ axis: 'z', m: z - 1, c: CX }); // a bulkhead before every bay
    const roll = R();
    if (b === airlockAt) {
      const [left] = sidePair(4, z, 6, 6, 3).slice(1);
      // the airlock: the stairwell back up to the hatch leaves from its outer wall
      const c = left.z + 3, m = left.x - 1;
      ops.push(...stairOpsFor('W', m, c, true));
      portal = { key: 'V', dir: 'W', m, c, up: true, axis: 'x' };
      spawn = [left.x + 3.5, 0, c + 0.5];
      z += 8;
    } else if (roll < 0.35) { // crew cabins: two pairs
      for (const zz of [z, z + 6]) for (const r of sidePair(4, zz, 6, 5, 3)) { if (R() < 0.35) chests.push(inside(r)); if (R() < 0.3) scatter(r, 1); }
      z += 13;
    } else if (roll < 0.7) { // side compartments
      const w = ri(8, 10), d = ri(8, 10);
      for (const r of sidePair(4, z, w, d, ri(4, 5))) { if (R() < 0.5) chests.push(inside(r)); scatter(r, ri(0, 3)); }
      z += d + 3;
    } else { // the cargo hold across the whole beam, crates stacked in rows
      const d = ri(12, 14), hold = { x: CX - 13, z, w: 27, d };
      holds.push([z, z + d]);
      room(hold.x, z, hold.w, d, 6);
      for (const s of [-1, 1]) for (let k = 0; k < 3; k++) {
        const x = s > 0 ? CX + 4 + k * 3 : mirror(CX + 4 + k * 3, 2);
        if (R() < 0.75) debris.push({ op: 'solid', x, y: 0, z: z + 2 + ri(0, 1), w: 2, h: ri(1, 3), d: 2 });
        if (R() < 0.6) debris.push({ op: 'solid', x, y: 0, z: z + d - 4 + ri(0, 1), w: 2, h: ri(1, 2), d: 2 });
      }
      chests.push({ x: CX - 11, z: z + 1 }, { x: CX + 11, z: z + d - 2 });
      z += d + 2;
    }
  }
  doorCands.push({ axis: 'z', m: z - 1, c: CX });
  // the bridge at the bow: consoles along the front, two seats
  const bridge = { x: CX - 8, z: z + 1, w: 17, d: 10, h: 5 };
  room(bridge.x, bridge.z, bridge.w, bridge.d, bridge.h);
  ops.push({ op: 'solid', x: CX - 6, y: 0, z: bridge.z + bridge.d - 2, w: 13, h: 1, d: 1 });
  for (const x of [CX - 3, mirror(CX - 3, 1)]) ops.push({ op: 'solid', x, y: 0, z: bridge.z + 4, w: 1, h: 1, d: 1 });
  chests.push({ x: CX, z: bridge.z + 2 });
  // the spine last, so it cuts through everything along the keel
  const spine: Op = { op: 'room', x: CX - 1, y: 0, z: engine.z + engine.d - 1, w: 3, h: 3, d: bridge.z - engine.z - engine.d + 2 };
  // its decoration runs between the engine room and the bridge, broken where it crosses a cargo hold
  let sz = engine.z + engine.d;
  for (const [h0, h1] of [...holds, [bridge.z, bridge.z] as [number, number]]) { if (h0 > sz) boxes.push({ x: CX - 1, z: sz, w: 3, d: h0 - sz, h: 3, tunnel: true }); sz = h1; }
  // debris from the crash breaks the symmetry a little (never on the keel line)
  const free = debris.filter((o) => o.x + o.w < CX - 1 || o.x > CX + 1);
  // Robots still guard the wreck (own RNG stream: the layout above stays as it was). The big ones only fit the tall
  // rooms (the corridors are 3 m high): a sentinel or an assault construct in the engine room, maybe one in the hold.
  const Gd = rng(seed ^ 0x60b0), guards: NonNullable<DungeonMap['guards']> = [];
  const mid = (b: DecoBox, dx = 0, dz = 0) => ({ x: b.x + (b.w >> 1) + dx, z: b.z + (b.d >> 1) + dz });
  for (const b of boxes) {
    if (b.tunnel) {
      if (b.w === 3 && b.d > 12 && Gd() < 0.6) guards.push({ kind: 'scout', ...mid(b, 0, Math.round((Gd() - 0.5) * (b.d - 6))) });
      continue;
    }
    const roll = Gd();
    if (b.h === 7) guards.push({ kind: roll < 0.5 ? 'assault' : 'sentinel', ...mid(b, 0, 2) }, { kind: 'repair', ...mid(b, -6, 0) });
    else if (b.h === 6) { if (roll < 0.45) guards.push({ kind: 'sentinel', ...mid(b) }); else guards.push({ kind: 'guardian', ...mid(b, -6, 0) }, { kind: 'guardian', ...mid(b, 6, 0) }, { kind: 'repair', ...mid(b, 0, 3) }); }
    else if (b.w === 17) guards.push({ kind: 'guardian', ...mid(b, -4, 0) }, { kind: 'guardian', ...mid(b, 4, 0) });
    else if (b.h >= 4) { if (roll < 0.6) guards.push({ kind: 'guardian', ...mid(b) }); if (Gd() < 0.3) guards.push({ kind: 'scout', ...mid(b, 1, 1) }); }
    else if (b.w === 6 && b.d === 5 && roll < 0.35) guards.push({ kind: 'scout', ...mid(b) });
  }
  return {
    seed, spawn, guards, ops: [...ops, ...free, spine], rooms: Math.round(boxes.filter((b) => !b.tunnel).length / 2) + 1,
    chests, crystals: [], hatch: null, portals: portal ? [portal] : [], doorCands, bosses, gates: [], boxes, style: 'ship',
  };
}
