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

/** Seeded wall lights: more frequent near the entrance and on upper floors, with dark stretches between them. */
export const UNDER_LAMPS = { room: [0.7, 0.55, 0.42], electric: 0.38, tunnel: 0.65, ship: 0.62, station: 0.65, work: 0.32, scav: 0.16 };
export function dungeonLamps(map: DungeonMap, depth = 1): Lamp[] {
  const out: Lamp[] = [], P = (i: number, s: number) => (hash(map.seed, i, s, 0x1a3b) % 1000) / 1000, U = UNDER_LAMPS;
  // Query the final CSG operations without building a second voxel grid. Openings, stairs and debris count too.
  const empty = (x: number, y: number, z: number) => {
    x = Math.floor(x); y = Math.floor(y); z = Math.floor(z);
    for (let i = map.ops.length - 1; i >= 0; i--) {
      const o = map.ops[i];
      if (x >= o.x && x < o.x + o.w && y >= o.y && y < o.y + o.h && z >= o.z && z < o.z + o.d) return o.op === 'room';
    }
    return false;
  };
  const place = (b: DungeonMap['boxes'][number], p: number, r: number, kind: 'torch' | 'electric', along = .5, fixedSide?: number) => {
    const first = Math.floor(p * 4);
    for (let turn = 0; turn < (fixedSide === undefined ? 4 : 1); turn++) for (const f of [along, Math.max(.15, along - .15), Math.min(.85, along + .15)]) {
      const side = fixedSide ?? (first + turn) % 4;
      const x = side < 2 ? b.x + b.w * f : side === 2 ? b.x + .25 : b.x + b.w - .25;
      const z = side < 2 ? side === 0 ? b.z + .25 : b.z + b.d - .25 : b.z + b.d * f;
      const deck = map.metro?.decks.find(d => x >= d.x && x < d.x + d.w && z >= d.z && z < d.z + d.d);
      const y = Math.min(b.h - .8, (deck ? deck.y + deck.h : 0) + (kind === 'torch' ? 2.2 : 2.5));
      const n: [number, number] = side === 0 ? [0, 1] : side === 1 ? [0, -1] : side === 2 ? [1, 0] : [-1, 0];
      if (out.some(l => Math.hypot(l.x - x, l.z - z) < 6)) continue;
      if ([...map.doorCands, ...map.portals].some(d => Math.abs(x - (d.axis === 'x' ? d.m : d.c)) < 2 && Math.abs(z - (d.axis === 'x' ? d.c : d.m)) < 2)) continue;
      // The bracket has solid backing, the flame/bulb and its sides have air, above players' heads.
      if (![-.2, 0, .2].every(t => [.0, .35].every(dy => empty(x + n[0] * .2 - n[1] * t, y + dy, z + n[1] * .2 + n[0] * t) && !empty(x - n[0] * .5 - n[1] * t, y + dy, z - n[1] * .5 + n[0] * t)))) continue;
      out.push({ x, y, z, r, k: kind, n }); return;
    }
  };
  if (map.style === 'metro' && map.metro) {
    map.metro.stations.forEach((st, i) => {
      if (P(i, 1) > U.station) { if (P(i, 2) < .5) place(st.hall, P(i, 4), 8, 'torch'); return; }
      for (const f of [.18, .5, .82]) for (const side of st.alongX ? [0, 1] : [2, 3]) place(st.hall, 0, 14, 'electric', f, side);
    });
    map.boxes.forEach((b, i) => {
      if (!b.tunnel) return;
      const len = Math.max(b.w, b.d), alongX = b.w > b.d;
      for (let s = 7, k = 0; s < len - 3; s += 18, k++) {
        const p = P(i, 10 + k), side = (alongX ? 0 : 2) + (k % 2);
        if (p < U.work + U.scav) place(b, p, p < U.work ? 10 : 8, p < U.work ? 'electric' : 'torch', s / len, side);
      }
    });
    return out;
  }
  const ship = map.style === 'ship', room = ship ? U.ship : U.room[Math.max(0, Math.min(2, depth - 1))];
  map.boxes.forEach((b, i) => {
    const len = Math.max(b.w, b.d), alongX = b.w > b.d;
    if (b.tunnel) {
      for (let s = 4, k = 0; s < len - 2; s += ship ? 10 : 14, k++) {
        if (P(i, 20 + k) < (ship ? U.ship : U.tunnel * room)) place(b, P(i, 40 + k), 8, ship || P(i, 60 + k) < U.electric ? 'electric' : 'torch', s / len, (alongX ? 0 : 2) + (k % 2));
      }
      return;
    }
    const entry = map.spawn[0] >= b.x && map.spawn[0] < b.x + b.w && map.spawn[2] >= b.z && map.spawn[2] < b.z + b.d;
    if (!entry && P(i, 3) >= room) return;
    const kind = ship || P(i, 6) < U.electric ? 'electric' : 'torch';
    place(b, P(i, 4), kind === 'electric' ? 12 : 10, kind);
    if (len >= 16 && P(i, 7) < .45) place(b, (P(i, 4) + .5) % 1, 10, kind);
  });
  return out;
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
