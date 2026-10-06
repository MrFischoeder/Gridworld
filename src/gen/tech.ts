// Technologies of the old civilisation (pure, deterministic from the world seed). They are not learnt from experience:
// each one's plans survive on a single old data carrier (a floppy disk, a data disk or a memory crystal) lying in a
// fixed place of the world: a ruin's first vault, a crashed ship or a cave system, chosen when the world is made, not
// when a chest is opened. Early technologies lie near Gridholm, advanced ones further out, so the player's range
// grows with what they need. Recovering a carrier records the technology (`char.tech`); what each one unlocks comes
// in later steps.
import { hash } from '../core/rng';
import { poisNear, regionOf, worldDist, wrapDx, type Poi } from './regions';
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
  // (new technologies go last: each one's site is hashed from its place in this list)
  { id: 'filters', name: 'Filter Masks', area: 'chemistry', tier: 2, blurb: 'Rubber face masks and charcoal filter canisters: breathing in the poisoned fog of the old world.' },
  { id: 'aluminium', name: 'Aluminium Processing', area: 'metal', tier: 2, blurb: 'Dissolving bauxite and smelting it with a great deal of current: the light metal of the old world.' },
  { id: 'batteries', name: 'Battery Chemistry', area: 'chemistry', tier: 2, blurb: 'Lead plates in acid, sealed in cells: current you can carry.' },
  { id: 'alloys', name: 'Alloy Metallurgy', area: 'metal', tier: 3, blurb: 'Steel, aluminium and nickel melted together in exact measure: plates that hold against heat and strain.' },
  { id: 'powercells', name: 'Power Cell Chemistry', area: 'chemistry', tier: 3, blurb: 'Lithium, nickel and an electrolyte nobody remembers: cells that hold a day\'s power in a crate.' },
  { id: 'sensors', name: 'Advanced Sensors', area: 'electronics', tier: 3, blurb: 'Crystals grown in a furnace and ground into lenses: eyes that see heat, distance and the shape of metal.' },
  { id: 'ancmetal', name: 'Ancient Metallurgy', area: 'metal', tier: 4, blurb: 'The alloy the Ancients built their ships of: lighter than steel, harder than anything since.' },
  { id: 'precision', name: 'Precision Manufacturing', area: 'metal', tier: 4, blurb: 'The master machines that cut to a hair and made every other machine: bearings, gears and spindles that never wear.' },
  { id: 'automation', name: 'Automation', area: 'electronics', tier: 4, blurb: 'How the Ancients taught arms of steel to work alone: drives, sensors and a small mind in one sealed case.' },
  { id: 'gunsmith', name: 'Gunsmithing', area: 'metal', tier: 2, blurb: 'Barrels, springs and the loading of cartridges: how the Ancients\' simple firearms and their rounds were made by hand.' },
  { id: 'weaving', name: 'Woven Armour', area: 'building', tier: 2, blurb: 'Cloth quilted in many layers round steel wire, and light frames of aluminium: armour you can march in, packs that carry more.' },
  { id: 'composites', name: 'Composite Armour', area: 'chemistry', tier: 3, blurb: 'Plastic, cloth and alloy laid up in layers and cured: shells lighter than steel that stop what steel stops.' },
  { id: 'exoframe', name: 'Exoframes', area: 'metal', tier: 3, blurb: 'Struts, sprung joints and harness: a frame along the legs and back that carries the load for the one who wears it.' },
  { id: 'electricity', name: 'Electric Machines', area: 'power', tier: 2, blurb: 'Winding copper on iron: electric motors and generators, the heart of every machine and power station.' },
  { id: 'metallurgy', name: 'Advanced Metallurgy', area: 'metal', tier: 3, blurb: 'Arc furnaces and vacuum retorts: steels alloyed with nickel and chromium, titanium, and the platinum metals.' },
  { id: 'semiconductors', name: 'Semiconductor Industry', area: 'electronics', tier: 3, blurb: 'Zone furnaces and acid baths: silicon pure enough to switch and compute.' },
  { id: 'computing', name: 'Advanced Computing', area: 'electronics', tier: 3, blurb: 'Computer systems, power switching and control: the brains of the great machines.' },
  { id: 'aerospace', name: 'Aerospace Engineering', area: 'transport', tier: 4, blurb: 'Airframes of titanium and composite, built on jigs and proved in the wind tunnel.' },
  { id: 'powergrid', name: 'Ancient Power Grid', area: 'power', tier: 4, blurb: 'How to wake the great core and carry its power along the pylons to the old plants.' },
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

// ---------- leads: what the villagers have seen or heard of old machines ----------
/** At most this many leads you have heard but not followed: asking again repeats the nearest one. */
export const MAX_LEADS = 2;
/** Villagers only know of places within this range of their village (m). */
export const LEAD_RANGE = 12000;
const DIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
/** Compass word for (dx, dz) (z grows southwards). */
export const dirWord = (dx: number, dz: number) => DIRS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
const distWord = (m: number) => (m < 950 ? `some ${Math.max(1, Math.round(m / 100)) * 100} m` : `about ${m < 9500 ? (m / 1000).toFixed(1).replace(/\.0$/, '') : Math.round(m / 1000)} km`);
const LOOKS: Record<Carrier, string> = { floppy: 'a flat plastic square with a metal shutter', disk: 'a shining disk in a case', crystal: 'a long crystal that hums when you come near' };
const SAY: Record<TechSite['kind'], string[]> = {
  ruin: [
    'A shepherd sheltered from a storm in {place}, {dist} {dir} of here. He swears something in the first vault glows violet, like a lamp that never goes out. {looks}, he said.',
    'My cousin dug round {place}, {dist} {dir} of here. Down in the first vault there is a little stand with {looks} on it, under a violet light. He was too scared to touch it.',
  ],
  wreck: [
    'Scavengers stripped most of {place}, {dist} {dir} of here, but nobody dared take the thing on the little stand inside: {looks}, lit violet.',
    'A trader told me that inside {place}, {dist} {dir} of here, there is {looks} glowing in the dark. The robots guard it, or so he said.',
  ],
  cave: [
    'Hunters who went into {place}, {dist} {dir} of here, came back talking of {looks} on a stone deep inside, lit violet.',
    'Deep in {place}, {dist} {dir} of here, there is a violet light. Old Tomasz saw {looks} there and ran.',
  ],
};
/** What a villager at (vx, vz) says of a site. */
export function leadText(s: TechSite, vx: number, vz: number, world: number): string {
  const dx = wrapDx(s.x - vx), dz = s.z - vz, lines = SAY[s.kind], line = lines[hash(world, s.place, 0x1ead) % lines.length];
  const looks = LOOKS[s.carrier];
  const place = /^(Ruins|Wreck) /.test(s.name) ? 'the ' + s.name : s.name;
  return line.replace('{place}', place).replace('{dist}', distWord(Math.hypot(dx, dz))).replace('{dir}', dirWord(dx, dz))
    .replace(/(^|\. |)\{looks\}/, (_, pre: string) => pre + (pre || line.startsWith('{looks}') ? looks[0].toUpperCase() + looks.slice(1) : looks));
}
/**
 * Which site a villager at (vx, vz) tells of: with MAX_LEADS open leads (heard, not recovered), the nearest of them
 * again; else the nearest site within LEAD_RANGE not heard of and not recovered. `fresh` = a new lead.
 */
export function pickLead(sites: TechSite[], recovered: Record<string, number>, leads: string[], vx: number, vz: number): { site: TechSite; fresh: boolean } | null {
  const dist = (s: TechSite) => worldDist(s.x, s.z, vx, vz);
  const open = sites.filter((s) => leads.includes(s.tech) && recovered[s.tech] === undefined).sort((a, b) => dist(a) - dist(b));
  if (open.length >= MAX_LEADS) return { site: open[0], fresh: false };
  const next = sites.filter((s) => !leads.includes(s.tech) && recovered[s.tech] === undefined && dist(s) <= LEAD_RANGE).sort((a, b) => dist(a) - dist(b))[0];
  if (next) return { site: next, fresh: true };
  return open.length ? { site: open[0], fresh: false } : null;
}
