// Darkness and light (pure; 0.199, the owner's direction: light matters). How dark a place is and the lamps that hang
// in it, all from the seed, so every player in a place sees the same lamps. The runtime (world/light.ts) turns this
// into the light map the shaders read (world/darkshader.ts): beyond the reach of a light the lines fade to the
// place's ambient light, which is low at night and in the deeper labyrinths, and next to nothing in the caves and the
// metro: there you go no further without a lamp or a flashlight of your own.
import { hash } from '../core/rng';
import type { DungeonMap } from './dungeon';
import type { CaveMap } from './cavegen';

/** A light hanging in a place (world coordinates): its reach `r` (m). */
export interface Lamp { x: number; y: number; z: number; r: number }

/**
 * The lights you carry and the others: the flashlight's beam (`range` m, `spill` round you) burns an Energy Cell every
 * `perCell` game minutes, the oil lamp lights `r` m round you and burns a flask of Lamp Oil every `perOil` minutes;
 * a vehicle's headlights reach `head` m; another player's light, a powered village lamp and a fire light this far;
 * the shader takes the `slots` nearest lights within `near` m.
 */
export const LIGHT = {
  flash: { range: 34, spill: 4.5, perCell: 180 },
  lamp: { r: 13, perOil: 360 },
  head: 52, headSpill: 6,
  peer: [0, 10, 13] as const,
  village: 16, fire: 11,
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
 * The lamps of a labyrinth, a crashed ship or a metro (own hash stream, so nothing else in the map moves): a lantern
 * hangs in some rooms (fewer the deeper you go), now and then a torch in a long passage; a ship's emergency lights in
 * some compartments; in the metro the stations that still have power keep a row of lamps over the platform, and a
 * work lamp burns here and there in the tunnels.
 */
export function dungeonLamps(map: DungeonMap, depth = 1): Lamp[] {
  const out: Lamp[] = [], P = (i: number, s: number) => (hash(map.seed, i, s, 0x1a3b) % 1000) / 1000;
  if (map.style === 'metro' && map.metro) {
    map.metro.stations.forEach((st, i) => {
      if (P(i, 1) > 0.5) return; // no power left here
      for (const t of [-11, 0, 11]) out.push({ x: st.alongX ? st.x + t : st.x, y: 6.5, z: st.alongX ? st.z : st.z + t, r: 14 });
    });
    map.boxes.forEach((b, i) => {
      if (!b.tunnel) return;
      const len = Math.max(b.w, b.d);
      for (let s = 15, k = 0; s < len - 5; s += 30, k++) if (P(i, 10 + k) < 0.16) out.push(b.w > b.d ? { x: b.x + s, y: 5, z: b.z + b.d / 2, r: 9 } : { x: b.x + b.w / 2, y: 5, z: b.z + s, r: 9 });
    });
    return out;
  }
  const room = map.style === 'ship' ? 0.35 : [0.55, 0.38, 0.22][Math.max(0, Math.min(2, depth - 1))];
  map.boxes.forEach((b, i) => {
    const len = Math.max(b.w, b.d);
    if (b.tunnel) { if (len >= 10 && P(i, 2) < room * 0.3) out.push({ x: b.x + b.w / 2, y: Math.min(b.h - 0.6, 2.6), z: b.z + b.d / 2, r: 7 }); return; }
    if (P(i, 3) < room) out.push({ x: b.x + b.w / 2, y: Math.min(b.h - 0.8, 3.4), z: b.z + b.d / 2, r: Math.max(7, Math.min(14, len * 0.7)) });
  });
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
