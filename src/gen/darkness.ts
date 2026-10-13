// Darkness and light (pure; 0.199, the owner's direction: light matters). How dark a place is and the lamps that hang
// in it, all from the seed, so every player in a place sees the same lamps. The runtime (world/light.ts) turns this
// into the light map the shaders read (world/darkshader.ts): beyond the reach of a light the lines fade to the
// place's ambient light, which is low at night and in the deeper labyrinths, and next to nothing in the caves and the
// metro: there you go no further without a lamp or a flashlight of your own.
import { hash } from '../core/rng';
import type { DungeonMap } from './dungeon';
import type { CaveMap } from './cavegen';
import type { VillageMap } from './village';

/**
 * A light in a place (world coordinates): its reach `r` (m); (0.200) `k` what it is (an electric fixture, a torch on a
 * wall, a fire, an oil lantern: flames flicker) and `n` the way it faces (into the room, for a torch on its wall).
 */
export interface Lamp { x: number; y: number; z: number; r: number; k?: LampKind; n?: [number, number] }
export type LampKind = 'electric' | 'torch' | 'fire' | 'oil';
/** Whether a light flickers (a flame). */
export const flickers = (k?: LampKind) => k === 'torch' || k === 'fire' || k === 'oil';

/**
 * The lights you carry and the others: the flashlight's beam (`range` m, `spill` round you) runs a Battery flat every
 * `perBattery` game minutes, the oil lamp lights `r` m round you and burns a flask of Lamp Oil every `perOil` minutes,
 * a torch lights `r` m round you (flickering) and burns down in `per` minutes; a vehicle's headlights reach `head` m;
 * another player's light (by kind), a powered village lamp, a town's oil lantern and a fire light this far;
 * the shader takes the `slots` nearest lights within `near` m.
 */
export const LIGHT = {
  flash: { range: 34, spill: 4.5, perBattery: 180 },
  lamp: { r: 13, perOil: 360 },
  torch: { r: 10, per: 45 },
  head: 52, headSpill: 6,
  peer: [0, 10, 13, 10] as const,
  village: 16, fire: 11, lantern: 11,
  slots: 12, near: 95,
};
/** The surface at night: the moon's light (`amb`), less under clouds; dark only once the day has faded below `from`. */
export const NIGHT = { amb: 0.24, cloud: 0.13, from: 0.45 };
/** Below ground: a labyrinth's ambient light by depth, a crashed ship's, the metro's and a cave's (next to none). */
export const UNDER = { depth: [0.42, 0.2, 0.07], wreck: 0.12, metro: 0.035, cave: 0.03 };

/** How dark the surface is (0 day .. 1 night) and its ambient light, from the daylight (core/time.ts) and the clouds. */
export function surfaceDark(day: number, cloud = 0): { dark: number; amb: number } {
  const dark = Math.max(0, Math.min(1, 1 - day / NIGHT.from));
  return { dark, amb: Math.max(0.06, NIGHT.amb - cloud * NIGHT.cloud) };
}
export type Under = 'labyrinth' | 'wreck' | 'metro' | 'cave';
/** The ambient light below ground. */
export const underAmb = (k: Under, depth = 1) => (k === 'labyrinth' ? UNDER.depth[Math.max(0, Math.min(2, depth - 1))] : UNDER[k]);

/**
 * (0.200, the owner's rule: below ground light is rare, electric or a torch.) The lights of a labyrinth, a crashed
 * ship or a metro (own hash stream, so nothing else in the map moves): now and then a torch burns on the wall of a
 * room (fewer the deeper you go) or, rarer, an old electric fixture still works; a torch in a long passage once in a
 * while; a ship's emergency lights in a few compartments; in the metro only some stations still have power (a row of
 * lamps over the platform), a work lamp burns here and there in the tunnels and scavengers left a torch or two.
 */
export const UNDER_LAMPS = { room: [0.2, 0.12, 0.06], electric: 0.3, tunnel: 0.35, ship: 0.18, station: 0.35, work: 0.07, scav: 0.05 };
export function dungeonLamps(map: DungeonMap, depth = 1): Lamp[] {
  const out: Lamp[] = [], P = (i: number, s: number) => (hash(map.seed, i, s, 0x1a3b) % 1000) / 1000, U = UNDER_LAMPS;
  if (map.style === 'metro' && map.metro) {
    map.metro.stations.forEach((st, i) => {
      if (P(i, 1) > U.station) return; // no power left here
      for (const t of [-11, 0, 11]) out.push({ x: st.alongX ? st.x + t : st.x, y: 6.5, z: st.alongX ? st.z : st.z + t, r: 14, k: 'electric' });
    });
    map.boxes.forEach((b, i) => {
      if (!b.tunnel) return;
      const len = Math.max(b.w, b.d), along = b.w > b.d;
      for (let s = 15, k = 0; s < len - 5; s += 30, k++) {
        const p = P(i, 10 + k);
        if (p < U.work) out.push(along ? { x: b.x + s, y: 5, z: b.z + b.d / 2, r: 9, k: 'electric' } : { x: b.x + b.w / 2, y: 5, z: b.z + s, r: 9, k: 'electric' });
        else if (p < U.work + U.scav) out.push(along ? { x: b.x + s, y: 2.2, z: b.z + 0.3, r: 7, k: 'torch', n: [0, 1] } : { x: b.x + 0.3, y: 2.2, z: b.z + s, r: 7, k: 'torch', n: [1, 0] });
      }
    });
    return out;
  }
  const ship = map.style === 'ship', room = ship ? U.ship : U.room[Math.max(0, Math.min(2, depth - 1))];
  map.boxes.forEach((b, i) => {
    const len = Math.max(b.w, b.d);
    if (b.tunnel) { if (len >= 10 && P(i, 2) < room * U.tunnel) out.push(ship ? { x: b.x + b.w / 2, y: Math.min(b.h - 0.6, 2.6), z: b.z + b.d / 2, r: 7, k: 'electric' } : wallTorch(b, P(i, 4), 7)); return; }
    if (P(i, 3) >= room) return;
    if (ship || P(i, 6) < U.electric) out.push({ x: b.x + b.w / 2, y: Math.min(b.h - 0.8, 3.4), z: b.z + b.d / 2, r: Math.max(7, Math.min(14, len * 0.7)), k: 'electric' });
    else out.push(wallTorch(b, P(i, 4), Math.max(7, Math.min(11, len * 0.6))));
  });
  return out;
}
/** A torch on one of a box's four walls (by `p`), in the middle of it, facing in. */
function wallTorch(b: { x: number; z: number; w: number; d: number; h: number }, p: number, r: number): Lamp {
  const side = Math.floor(p * 4), y = Math.min(b.h - 0.6, 2.2);
  return side === 0 ? { x: b.x + b.w / 2, y, z: b.z + 0.25, r, k: 'torch', n: [0, 1] }
    : side === 1 ? { x: b.x + b.w / 2, y, z: b.z + b.d - 0.25, r, k: 'torch', n: [0, -1] }
    : side === 2 ? { x: b.x + 0.25, y, z: b.z + b.d / 2, r, k: 'torch', n: [1, 0] }
    : { x: b.x + b.w - 0.25, y, z: b.z + b.d / 2, r, k: 'torch', n: [-1, 0] };
}
/**
 * (0.200) A town's oil lanterns (village-local, as the map): on posts either side of every gate, a little way in, and
 * by the door of every shop, the tavern and the hall. They burn every night, with power or without.
 */
export function villageLanterns(map: VillageMap): { x: number; z: number }[] {
  const out: { x: number; z: number }[] = [], bs = map.buildings;
  const cx = bs.reduce((a, b) => a + b.x + b.w / 2, 0) / Math.max(1, bs.length), cz = bs.reduce((a, b) => a + b.z + b.d / 2, 0) / Math.max(1, bs.length);
  for (const g of map.gates) {
    const dx = cx - g.x, dz = cz - g.z, l = Math.hypot(dx, dz) || 1, ix = dx / l, iz = dz / l, side = g.w / 2 + 1.2;
    for (const s of [-1, 1]) out.push({ x: g.x + ix * 5 - iz * side * s, z: g.z + iz * 5 + ix * side * s });
  }
  for (const b of bs) {
    if (b.role === 'house') continue;
    const [ox, oz] = b.out; // out of the door, then a step to its side
    out.push({ x: b.door.x + ox * 0.9 - oz * 1.7, z: b.door.z + oz * 0.9 + ox * 1.7 });
  }
  return out;
}
/** A cave's lights: daylight (or moonlight) falling in at each mouth, and the glow of its nutrient crystals. */
export function caveLamps(m: CaveMap, floor: (x: number, z: number) => number): Lamp[] {
  return [
    ...m.exits.map((e) => ({ x: e.x, y: e.y + 2.5, z: e.z, r: 15 })),
    ...m.crystals.map((c) => ({ x: c.x, y: floor(c.x, c.z) + 0.6, z: c.z, r: 4.5 })),
  ];
}
/** Lamps in reach: the `n` nearest to (x, y, z) within `near` m (for the shader's slots). */
export function nearestLamps(lamps: Lamp[], x: number, y: number, z: number, n = LIGHT.slots, near = LIGHT.near): Lamp[] {
  const d2 = (l: Lamp) => (l.x - x) ** 2 + (l.y - y) ** 2 + (l.z - z) ** 2, lim = (near + 0) ** 2;
  return lamps.filter((l) => d2(l) < lim + l.r * l.r).sort((a, b) => d2(a) - d2(b)).slice(0, n);
}
