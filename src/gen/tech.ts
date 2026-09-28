// Technologies of the old civilisation (pure, deterministic from the world seed). They are not learnt from experience:
// each one's plans survive on a single old data carrier (a floppy disk, a data disk or a memory crystal) lying in a
// fixed place of the world: a ruin's first vault, a crashed ship or a cave system, chosen when the world is made, not
// when a chest is opened. Early technologies lie near Gridholm, advanced ones further out, so the player's range
// grows with what they need. Recovering a carrier records the technology (`char.tech`); what each one unlocks comes
// in later steps.
import { hash } from '../core/rng';
import { poisNear, regionOf, worldDist, type Poi } from './regions';
import { regionCaves } from './caves';
import type { Terrain } from './terrain';

export type Carrier = 'floppy' | 'disk' | 'crystal';
export const CARRIER_NAME: Record<Carrier, string> = { floppy: 'Floppy Disk', disk: 'Data Disk', crystal: 'Memory Crystal' };
export type TechArea = 'farming' | 'building' | 'power' | 'metal' | 'electronics' | 'transport' | 'navigation' | 'chemistry' | 'nuclear';
export interface Tech { id: string; name: string; area: TechArea; tier: 1 | 2 | 3 | 4; blurb: string }

export const TECHS: Tech[] = [
  { id: 'fields', name: 'Irrigated Fields', area: 'farming', tier: 1, blurb: 'Channels, sluices and crop rotation: more food from the same land.' },
  { id: 'framing', name: 'Timber Framing', area: 'building', tier: 1, blurb: 'Joined frames of sawn timber: bigger barns, granaries and workshops.' },
  { id: 'rotor', name: 'Improved Wind Rotor', area: 'power', tier: 1, blurb: 'A better blade shape and a geared hub: more power from a village wind wheel.' },
  { id: 'forging', name: 'Forged Tools', area: 'metal', tier: 1, blurb: 'Hardening and tempering steel: tools that last.' },
  { id: 'plough', name: 'Steel Ploughs', area: 'farming', tier: 2, blurb: 'Steel-shod ploughs and harrows: farms worked with metal yield far more.' },
  { id: 'solar', name: 'Solar Cells', area: 'power', tier: 2, blurb: 'Glass and silicon panels that turn daylight into current.' },
  { id: 'furnace', name: 'Blast Furnace', area: 'metal', tier: 2, blurb: 'Ore, coke and hot air: iron in quantity, then steel.' },
  { id: 'circuits', name: 'Basic Circuits', area: 'electronics', tier: 2, blurb: 'Printed boards and simple components, soldered by hand.' },
  { id: 'wagons', name: 'Wagon Axles', area: 'transport', tier: 2, blurb: 'Iron axles and sprung wagons for draught animals: regular haulage between villages.' },
  { id: 'chips', name: 'Integrated Circuits', area: 'electronics', tier: 3, blurb: 'Etching whole circuits into crystal wafers. The heart of a chip foundry.' },
  { id: 'radio', name: 'Radio Triangulation', area: 'navigation', tier: 3, blurb: 'Beacons, dishes and timing: finding one\'s place anywhere on the planet.' },
  { id: 'engines', name: 'Combustion Engines', area: 'transport', tier: 3, blurb: 'Fuel, pistons and gears: motor lorries on the roads.' },
  { id: 'chemistry', name: 'Industrial Chemistry', area: 'chemistry', tier: 3, blurb: 'Reactors, columns and catalysts: making what the land does not give.' },
  { id: 'enrichment', name: 'Uranium Enrichment', area: 'nuclear', tier: 4, blurb: 'Separating the fuel of the old reactors from raw ore.' },
  { id: 'propellant', name: 'Rocket Propellant Synthesis', area: 'chemistry', tier: 4, blurb: 'The full chain from feedstock to fuel that can lift a ship off the planet.' },
  { id: 'rail', name: 'Rail Lines', area: 'transport', tier: 4, blurb: 'Tracks, points and locomotives: freight running on its own across the land.' },
];
export const TECH_BY_ID: Record<string, Tech> = Object.fromEntries(TECHS.map((t) => [t.id, t]));
/** How far from Gridholm (m) each tier's carriers lie. */
export const TIER_BAND: Record<Tech['tier'], [number, number]> = { 1: [600, 3000], 2: [3000, 8000], 3: [8000, 16000], 4: [16000, 30000] };
const CARRIER_OF: Record<Tech['tier'], Carrier> = { 1: 'floppy', 2: 'disk', 3: 'disk', 4: 'crystal' };

/** Where a technology's carrier lies: the place (a ruin's or wreck's id, or a cave system's id) and where it is. */
export interface TechSite { tech: string; carrier: Carrier; kind: 'ruin' | 'wreck' | 'cave'; place: number; name: string; x: number; z: number }
interface Spot { kind: TechSite['kind']; place: number; name: string; x: number; z: number }

/** Ruins, wrecks and cave mouths within r of a point (a cave system is listed once, by its first mouth). */
function spotsNear(t: Terrain, x: number, z: number, r: number): Spot[] {
  const out: Spot[] = [];
  for (const p of poisNear(t.world, x, z, r) as Poi[]) if (p.type === 'ruin' || p.type === 'wreck') out.push({ kind: p.type, place: p.id, name: p.name, x: p.x, z: p.z });
  const [ax, az] = regionOf(x - r, z - r), [bx, bz] = regionOf(x + r, z + r);
  for (let rx = ax; rx <= bx; rx++) for (let rz = az; rz <= bz; rz++) for (const c of regionCaves(t, rx, rz)) if (c.mouth === 0) out.push({ kind: 'cave', place: c.sys, name: c.name, x: c.x, z: c.z });
  return out;
}

const cache = new Map<number, TechSite[]>();
/**
 * Every technology's carrier site in a world. For each, in order: a hashed point in its tier's band round Gridholm,
 * then the nearest ruin, wreck or cave within 700 m of it that lies in the band and holds no other carrier (up to 40
 * tries, the band widened a little after 20). A technology with no site found is left out.
 */
export function techSites(t: Terrain): TechSite[] {
  const hit = cache.get(t.world); if (hit) return hit;
  const used = new Set<number>(), out: TechSite[] = [];
  TECHS.forEach((tech, i) => {
    const [d0, d1] = TIER_BAND[tech.tier];
    for (let k = 0; k < 40; k++) {
      const slack = k < 20 ? 0 : 0.15, lo = d0 * (1 - slack), hi = d1 * (1 + slack);
      const a = (hash(t.world, i, k, 0x7ec4) % 3600) / 3600 * Math.PI * 2, d = d0 + (hash(t.world, i, k, 0x7ec5) % 1000) / 1000 * (d1 - d0);
      const px = Math.cos(a) * d, pz = Math.sin(a) * d;
      const best = spotsNear(t, px, pz, 700)
        .filter((s) => !used.has(s.place)).filter((s) => { const r = worldDist(s.x, s.z, 0, 0); return r >= lo && r <= hi; })
        .sort((p, q) => worldDist(p.x, p.z, px, pz) - worldDist(q.x, q.z, px, pz))[0];
      if (!best) continue;
      used.add(best.place);
      out.push({ tech: tech.id, carrier: CARRIER_OF[tech.tier], ...best });
      return;
    }
  });
  cache.set(t.world, out);
  return out;
}
/** The carrier in a place (a ruin's, wreck's or cave system's id), if one lies there. */
export const siteIn = (t: Terrain, place: number) => techSites(t).find((s) => s.place === place) ?? null;
/** Which of the place's chests the carrier lies by (the dungeon's chest list is fixed by its seed). */
export const carrierChest = (world: number, place: number, chests: number) => (chests > 0 ? hash(world, place, 0xd15c) % chests : -1);
