// The great installations of the old world (pure, deterministic from the world seed): huge ruined plants standing in
// fixed places across the continents, which the player can one day bring back to life (the uranium enrichment
// plant, then the chip foundry; the radar station and the rocket fuel complex will follow the same pattern). Each
// lies in its own distance band from Gridholm on dry, fairly level ground away from villages, places, roads, lakes and
// the mountains. The ground round it is bare: trees, rocks and plants inside `inInstall` are not generated.
import { hash } from '../core/rng';
import { CHUNK, POLAR_Z, worldDist, wrapX, wrapDx, poisNear, type Poi } from './regions';
import { nearestOnRoad } from './roads';
import { mountainMask } from './mountains';
import { continents } from './continents';
import { inSea } from './seas';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { rectDist, Terrain } from './terrain';
import type { ItemKey } from '../data/items';

export type InstallKind = 'uranium' | 'chips' | 'radar' | 'propellant' | 'battery' | 'optical' | 'alloy' | 'precision' | 'robotics';
export interface InstallSpec { k: InstallKind; name: string; blurb: string; band: [number, number]; r: number }
export const INSTALLS: InstallSpec[] = [
  { k: 'uranium', name: 'Old Enrichment Plant', blurb: 'a ruined plant of the old world where ore was once made into reactor fuel: a centrifuge hall, two cooling towers and a stack', band: [15000, 65000], r: 34 },
  { k: 'chips', name: 'Old Chip Foundry', blurb: 'a sealed fabrication plant of the old world where crystal wafers were etched into chips: a long clean-room block, a tank farm and a water tower', band: [12000, 65000], r: 32 },
  { k: 'radar', name: 'Old Radar Station', blurb: 'a listening post of the old world on a rise: a great dish on a lattice tower, a mast held by guy wires and a bunker full of screens', band: [18000, 65000], r: 30 },
  // (new ones go last: each is placed after those before it, so the older ones keep their places)
  { k: 'propellant', name: 'Old Propellant Plant', blurb: 'a rocket fuel works of the old world: spherical tanks, two distillation columns, a flare stack and a bunkered mixing house', band: [10000, 65000], r: 30 },
  { k: 'battery', name: 'Old Battery Plant', blurb: 'a cell works of the old world: a long sawtooth-roofed hall, rows of electrolyte tanks and a brine basin', band: [14000, 65000], r: 30 },
  { k: 'optical', name: 'Old Optical Works', blurb: 'a lens and sensor works of the old world: long glass-roofed grinding halls, a tall crystal-growing tower and a row of annealing kilns', band: [14000, 65000], r: 30 },
  { k: 'alloy', name: 'Old Alloy Complex', blurb: 'a metal works of the old world: two great arc furnaces crowned with electrodes, a towering casting hall, twin stacks and heaps of slag', band: [16000, 65000], r: 32 },
  { k: 'precision', name: 'Old Precision Works', blurb: 'a machining works of the old world: a vaulted hall of machine tools, a tall test tower and a white measuring dome', band: [18000, 65000], r: 30 },
  { k: 'robotics', name: 'Old Robotics Plant', blurb: 'the greatest works of the old world: an assembly hall like a hangar, a gantry yard, giant robot arms on their pedestals and a walled test arena under a control tower', band: [20000, 65000], r: 34 },
];
/** How much bigger the plants stand than their plans (and their `r`): the ground is searched at the plan's radius, so a plant's place never moves when it grows. */
export const INSTALL_SCALE = 2;
/** `r`: the radius of the plant's bare ground as it stands (the plan's radius × INSTALL_SCALE). */
export interface InstallSite { k: InstallKind; name: string; x: number; z: number; y: number; yaw: number; r: number }

/** Why a spot does not fit (null: it does). */
export function installMisfit(t: Terrain, x: number, z: number, r: number): string | null {
  const y0 = t.heightAt(x, z);
  if (mountainMask(t.world, x, z) > 0.12) return 'mountain';
  if (inSea(t.world, x, z, r + 60)) return 'sea';
  if (nearRiver(t.world, x, z, r + 80)) return 'river';
  if (inCity(t.world, x, z, r + 150)) return 'city';
  for (let a = 0; a < 6.28; a += 0.785) for (const d of [0, r * 0.5, r]) {
    const px = x + Math.cos(a) * d, pz = z + Math.sin(a) * d;
    if (t.water(px, pz)) return 'water';
    if (Math.abs(t.heightAt(px, pz) - y0) > 4) return 'slope';
    const f = t.chunkFeatures(Math.floor(px / CHUNK), Math.floor(pz / CHUNK));
    if (f.lakes.some((l) => Math.hypot(l.x - px, l.z - pz) < 70)) return 'lake';
    if (f.pads.some((p) => rectDist(p.poi.rect, px, pz) < p.poi.flat + 60)) return 'place';
    if (f.roads.some((rd) => nearestOnRoad(rd, px, pz)[0] < rd.half + 25)) return 'road';
  }
  return null;
}

const cache = new Map<number, InstallSite[]>();
let searching = false;
/** Every installation of a world: for each, the first of a hashed list of spots on the continents within its distance band that fits (the first eligible spot if none does). */
export function installSites(t: Terrain): InstallSite[] {
  const hit = cache.get(t.world); if (hit) return hit;
  // Survey the original seeded foundation, independently of new monument pads or player flattening.
  if (t.includeMegaliths) t = new Terrain(t.world, false);
  const out: InstallSite[] = [];
  cache.set(t.world, out); // (filled below; set first so a nested call during the search sees no sites rather than recursing)
  const land = continents(t.world);
  searching = true;
  try {
  INSTALLS.forEach((spec, i) => {
    let best: InstallSite | null = null;
    for (let k = 0; k < 400; k++) {
      const a = (hash(t.world, i, k, 0x1e57) % 3600) / 3600 * Math.PI * 2;
      const continent = land[hash(t.world, i, k, 0x1e60) % land.length];
      const reach = 0.2 + Math.sqrt(hash(t.world, i, k, 0x1e58) / 1e6) * 0.65;
      const x = wrapX(continent.x + Math.cos(a) * continent.rx * reach), z = continent.z + Math.sin(a) * continent.rz * reach;
      const distance = worldDist(x, z, 0, 0);
      if (distance < spec.band[0] || distance > spec.band[1] || Math.abs(z) > POLAR_Z - 2000) continue;
      const c: InstallSite = { k: spec.k, name: spec.name, x, z, y: t.heightAt(x, z), yaw: (hash(t.world, i, k, 0x1e59) % 4) * Math.PI / 2, r: spec.r * INSTALL_SCALE };
      if (!best) best = c;
      if (out.some((o) => worldDist(o.x, o.z, x, z) < 3000)) continue; // the installations lie well apart
      if (!installMisfit(t, x, z, spec.r)) { best = c; break; }
    }
    out.push(best!);
  });
  } finally { searching = false; }
  return out;
}
/** The installations if they are worked out already (by the worker started in openWorld, or an earlier call), else
 * null. Things done every frame (the maps, the drawing, the place name) use this so they never stall the game while
 * the search runs (it takes seconds: every spot it tries asks for the terrain's features far out). */
export const installSitesReady = (world: number): InstallSite[] | null => (searching ? null : cache.get(world) ?? null);
/** The sites a worker worked out (world/installworker.ts): the same as `installSites` would give. */
export function seedInstallSites(world: number, sites: InstallSite[]) { if (!cache.has(world)) cache.set(world, sites); }
/** No installation lies nearer Gridholm than this (the nearest band starts at 10 km): the cheap early out. */
const NEAREST = 9500;
/** Is (x, z) on the bare ground of an installation (within its radius plus m)? */
export function inInstall(t: Terrain, x: number, z: number, m = 0): boolean {
  if (Math.hypot(wrapDx(x), z) < NEAREST) return false; // all of them lie far out: a cheap early out near home
  for (const s of installSites(t)) if (worldDist(s.x, s.z, x, z) < s.r + m) return true;
  return false;
}
export const installAt = (t: Terrain, x: number, z: number, m = 0) => (Math.hypot(wrapDx(x), z) < NEAREST ? null : installSites(t).find((s) => worldDist(s.x, s.z, x, z) < s.r + m) ?? null);

// ---------- restoring an installation, and what it makes ----------
/** A stage of the restoration: what it is called, what the crew say, what it needs (and the plans, if any). */
export interface InstallStage { title: string; text: string; needs: [ItemKey, number][]; tech?: string; gold: number; xp: number }
export const INSTALL_STAGES: Record<InstallKind, InstallStage[]> = {
  // (the economy plan's model: I the structure (steel, cement, machine parts), II the systems and the power hall
  // (cable, boards, parts, chemicals), III the core (the plans and rare parts))
  uranium: [
    { title: 'Securing the plant', text: 'The hall is choked with fallen trusses, the gate is jammed and the walls are cracked through. Steel for new props and trusses, cement for the breaches, machine parts for the cranes.', needs: [['steel', 8], ['cement', 10], ['parts', 4]], gold: 250, xp: 250 },
    { title: 'Power and control', text: 'A new roof over the centrifuges, and the power hall beside the gate brought back: cable for the lines, circuit boards and machine parts for the drives and the generator sets, chemicals to flush the cascade.', needs: [['cable', 10], ['boards', 4], ['parts', 4], ['chems', 4]], gold: 400, xp: 400 },
    { title: 'The core', text: 'The cascade controller is dead. Only the old plans for enrichment show how it was built, and it wants power cores and advanced alloy.', needs: [['pcore', 2], ['alloy', 4], ['circuit', 6]], tech: 'enrichment', gold: 500, xp: 600 },
  ],
  radar: [
    { title: 'Clearing the compound', text: 'The dish lies on its back in the weeds and the bunker door is buried. Timber and stone to shore up the bunker, scrap to brace the tower.', needs: [['log', 10], ['stone', 8], ['scrap', 10]], gold: 150, xp: 200 },
    { title: 'Power and cable', text: 'The generator shed is a ruin and the cable runs are eaten through. Copper cable, steel for the tower and the mast, electronics for the switchgear.', needs: [['cable', 8], ['steel', 6], ['circuit', 6]], gold: 250, xp: 300 },
    { title: 'The dish and the console', text: 'The dish goes back up on its tower. Only the old plans for radio triangulation show how to aim it and read the screens; it wants circuit boards and advanced alloy for the mount.', needs: [['boards', 4], ['circuit', 8], ['alloy', 4]], tech: 'radio', gold: 400, xp: 500 },
  ],
  chips: [
    { title: 'Opening the block', text: 'The clean-room block is sealed and half buried in its own rubble, a corner of its roof fallen in. Steel for the new beams, cement to seal the breaches, machine parts for the air locks.', needs: [['steel', 10], ['cement', 10], ['parts', 6]], gold: 250, xp: 250 },
    { title: 'Air, water and power', text: 'Nothing is made in dust: the filters and the water plant must run first, and the power hall beside the gate. Cable for the fans, pumps and generator sets, circuit boards for the controls, chemicals for the water plant, glass for the filter housings.', needs: [['cable', 12], ['boards', 6], ['chems', 4], ['glass', 6]], gold: 400, xp: 400 },
    { title: 'The etching line', text: 'The etchers stand dead in their bays. Only the old plans for integrated circuits show how to wake them, and they want circuit boards and a power core.', needs: [['boards', 4], ['circuit', 8], ['pcore', 1]], tech: 'chips', gold: 450, xp: 550 },
  ],
  propellant: [
    { title: 'Securing the tank farm', text: 'The spheres lean on cracked footings and the mixing house is roofless. Steel for new legs and trusses, cement for the footings, machine parts for the valves.', needs: [['steel', 8], ['cement', 10], ['parts', 4]], gold: 250, xp: 250 },
    { title: 'Lines, pumps and power', text: 'The pipe racks are rusted through and the power hall by the gate is a shell. Cable for the pumps and the hall, circuit boards for the controls, machine parts for the pumps, chemicals to flush the lines.', needs: [['cable', 10], ['boards', 4], ['parts', 4], ['chems', 6]], gold: 400, xp: 400 },
    { title: 'The mixing column', text: 'The columns stand cold. Only the old plans for rocket propellant synthesis show how the feed is blended, and the controller wants a power core and advanced alloy.', needs: [['pcore', 1], ['alloy', 4], ['circuit', 6]], tech: 'propellant', gold: 500, xp: 600 },
  ],
  battery: [
    { title: 'Opening the cell hall', text: 'Half the sawtooth roof has come down on the formation lines. Steel for the trusses, cement and bricks for the walls, machine parts for the hoists.', needs: [['steel', 8], ['cement', 8], ['bricks', 10], ['parts', 4]], gold: 250, xp: 250 },
    { title: 'Formation lines and power', text: 'The lines, the electrolyte tanks and the power hall by the gate must run again. Cable for the lines and the hall, circuit boards for the chargers, chemicals for the tanks, glass for the sight gauges.', needs: [['cable', 12], ['boards', 6], ['chems', 6], ['glass', 4]], gold: 400, xp: 400 },
    { title: 'The electrolyte plant', text: 'The cells need an electrolyte nobody remembers how to make. Only the old plans for power cell chemistry show it, and the plant wants power cores and advanced alloy.', needs: [['pcore', 2], ['alloy', 2], ['circuit', 8]], tech: 'powercells', gold: 500, xp: 600 },
  ],
  optical: [
    { title: 'Opening the lens halls', text: 'The glass roofs of the grinding halls lie in shards on the benches. Steel for the frames, cement for the footings, glass for the roof panes, machine parts for the grinders.', needs: [['steel', 8], ['cement', 8], ['glass', 6], ['parts', 4]], gold: 250, xp: 250 },
    { title: 'Clean air, water and power', text: 'A lens is ruined by a speck of dust. The air plant, the water stills and the power hall by the gate must run again: cable, circuit boards, chemicals for the stills, glass for the filter housings.', needs: [['cable', 12], ['boards', 6], ['chems', 6], ['glass', 6]], gold: 400, xp: 400 },
    { title: 'The crystal furnace', text: 'The tower where the sensor crystals were grown stands cold. Only the old plans for advanced sensors show how it was run, and it wants a power core and advanced alloy.', needs: [['pcore', 1], ['alloy', 4], ['circuit', 8]], tech: 'sensors', gold: 500, xp: 600 },
  ],
  alloy: [
    { title: 'Securing the casting hall', text: 'The casting hall is the tallest thing for kilometres and it leans. Steel for new columns, cement and bricks for the furnace beds, machine parts for the cranes.', needs: [['steel', 12], ['cement', 12], ['bricks', 16], ['parts', 6]], gold: 300, xp: 300 },
    { title: 'The arc furnaces and power', text: 'The furnaces want more current than anything else here: heavy cable, circuit boards for the regulators, machine parts for the electrode hoists, chemicals for the fluxes, and the power hall by the gate.', needs: [['cable', 16], ['boards', 4], ['parts', 6], ['chems', 4]], gold: 450, xp: 450 },
    { title: 'The alloy recipe', text: 'Steel, aluminium and nickel alone make only advanced alloy. What the Ancients cast here was more: only the old plans for ancient metallurgy hold the recipe, and the control room wants power cores and advanced alloy.', needs: [['pcore', 2], ['alloy', 6], ['circuit', 6]], tech: 'ancmetal', gold: 600, xp: 700 },
  ],
  precision: [
    { title: 'Opening the machine hall', text: 'The vault of the machine hall has sagged onto the lathes and the test tower leans on its guys. Steel for the ribs, cement for the machine beds, machine parts for the travelling cranes.', needs: [['steel', 10], ['cement', 10], ['parts', 6]], gold: 300, xp: 300 },
    { title: 'Drives, air and power', text: 'A machine that cuts to a hair wants steady current and still air. Cable for the drives and the power hall by the gate, circuit boards for the controls, chemicals for the coolant, glass for the measuring dome.', needs: [['cable', 12], ['boards', 6], ['chems', 4], ['glass', 4]], gold: 450, xp: 450 },
    { title: 'The master machines', text: 'The master machines that made the other machines stand dead. Only the old plans for precision manufacturing show how to true them, and they want microchips, ancient alloy for the spindles and electronics.', needs: [['microchip', 4], ['ancalloy', 2], ['circuit', 6]], tech: 'precision', gold: 600, xp: 700 },
  ],
  robotics: [
    { title: 'Raising the assembly hall', text: 'The assembly hall is the size of a hangar and its roof lies on the lines. Steel for the trusses, cement and bricks for the walls and the pedestals, machine parts for the gantries.', needs: [['steel', 14], ['cement', 12], ['bricks', 10], ['parts', 8]], gold: 350, xp: 350 },
    { title: 'The lines and power', text: 'The assembly lines, the gantries and the power hall by the gate must run again: heavy cable, circuit boards for the line controllers, power cells for the robot arms, chemicals for the paint and the coolant.', needs: [['cable', 16], ['boards', 8], ['powercell', 2], ['chems', 4]], gold: 500, xp: 500 },
    { title: 'Waking the arms', text: 'The great arms hang limp over the lines. Only the old plans for automation show how to teach them their work, and they want microchips, sensors to see with and precision components for their joints.', needs: [['microchip', 6], ['sensor', 4], ['precision', 4]], tech: 'automation', gold: 800, xp: 900 },
  ],
};
/** What a working installation makes: the crates of each input in `inp` into `n` (1) of `out` every `batch` game minutes (at most `hopper` of each input loaded, `bay` made waiting). */
export interface InstallWork { inp: [ItemKey, number][]; out: ItemKey; n?: number; batch: number; hopper: number; bay: number; what: string }
export const INSTALL_WORK: Partial<Record<InstallKind, InstallWork>> = {
  uranium: { inp: [['uranium', 3], ['chems', 1]], out: 'nfuel', batch: 360, hopper: 30, bay: 10, what: 'The centrifuges hum again.' },
  chips: { inp: [['glass', 2], ['copperbar', 1], ['chems', 1], ['rareearth', 1]], out: 'microchip', batch: 240, hopper: 30, bay: 12, what: 'The etching line glows behind its windows.' },
  propellant: { inp: [['fuel', 3], ['chems', 1], ['sulfur', 1]], out: 'propellant', n: 3, batch: 180, hopper: 30, bay: 30, what: 'The columns steam and the mixing house hums.' },
  battery: { inp: [['lithium', 1], ['nickel', 1], ['copperbar', 1], ['chems', 1]], out: 'powercell', batch: 240, hopper: 30, bay: 12, what: 'The formation lines crackle and the cells charge in their racks.' },
  optical: { inp: [['glass', 2], ['rareearth', 1], ['chems', 1]], out: 'sensor', batch: 240, hopper: 30, bay: 12, what: 'The crystal tower glows and the grinders whine in the lens halls.' },
  alloy: { inp: [['steel', 2], ['aluminium', 1], ['nickel', 1]], out: 'ancalloy', batch: 300, hopper: 30, bay: 12, what: 'The arc furnaces roar and the casting hall fills with a white glare.' },
  precision: { inp: [['steel', 2], ['ancalloy', 1], ['microchip', 1]], out: 'precision', batch: 300, hopper: 30, bay: 12, what: 'The machine hall hums and the test tower blinks its lamps.' },
  robotics: { inp: [['microchip', 1], ['sensor', 1], ['precision', 1], ['powercell', 1]], out: 'automation', batch: 360, hopper: 20, bay: 10, what: 'The great arms swing over the lines and a robot walks the test arena.' },
};
/** Further things an installation can make instead (picked at its desk while its bay is empty): the first is INSTALL_WORK[k]. */
export const INSTALL_MORE: Partial<Record<InstallKind, InstallWork[]>> = {
  alloy: [{ inp: [['clay', 3], ['aluminium', 1], ['chems', 1]], out: 'ceramics', n: 2, batch: 240, hopper: 30, bay: 12, what: 'The kiln line glows and the ceramic tiles come out white.' }],
};
/** Everything k can make, and what it makes now (`InstallState.rec`). */
export const installWorks = (k: InstallKind): InstallWork[] => (INSTALL_WORK[k] ? [INSTALL_WORK[k]!, ...(INSTALL_MORE[k] ?? [])] : []);
export const workOf = (k: InstallKind, s?: InstallState): InstallWork | undefined => installWorks(k)[s?.rec ?? 0] ?? INSTALL_WORK[k];
/** Switch what k makes (only while its bay is empty: the bay holds one kind); false when it cannot. */
export function setInstallRec(k: InstallKind, s: InstallState, i: number, now: number): boolean {
  if (!installWorks(k)[i] || (s.rec ?? 0) === i) return false;
  runInstall(k, s, now);
  if (s.out > 0) return false;
  s.rec = i; s.t = now;
  return true;
}

// ---------- the power hall: an installation makes its own power ----------
/**
 * What a working installation draws (kW). A batch runs only while its power hall gives that much: the hall comes back
 * with the second stage (`HALL_STAGE` stages done) and burns what you bring it, only while a batch is under way.
 */
export const INSTALL_DRAW: Partial<Record<InstallKind, number>> = { uranium: 200, chips: 100, propellant: 120, battery: 150, optical: 130, alloy: 180, precision: 160, robotics: 200 };
export const HALL_STAGE = 2;
/** The hall's generator sets: each runs on its own fuel (a crate every `burn` game minutes of work), `bunker` crates at most. */
export interface HallSet { fuel: ItemKey; name: string; kw: number; burn: number; bunker: number }
export const HALL_SETS: HallSet[] = [
  { fuel: 'coal', name: 'Coal boiler', kw: 120, burn: 120, bunker: 30 },
  { fuel: 'fuel', name: 'Diesel sets', kw: 100, burn: 150, bunker: 30 },
  { fuel: 'nfuel', name: 'The plant\'s own reactor', kw: 250, burn: 5760, bunker: 4 },
  // (economy stage 6) racks of power cells from the Old Battery Plant: clean, strong and long, in any hall
  { fuel: 'powercell', name: 'Cell racks', kw: 160, burn: 480, bunker: 12 },
];
/** The sets of k's hall: every hall has a coal boiler and diesel sets; the enrichment plant also its own reactor, which burns the rods it makes. */
export const hallSets = (k: InstallKind) => HALL_SETS.filter((h) => h.fuel !== 'nfuel' || k === 'uranium');
export const hallReady = (k: InstallKind, s: InstallState | undefined) => !!INSTALL_DRAW[k] && (s?.stage ?? 0) >= HALL_STAGE;
/**
 * The sets that would power one batch now (enough fuel in each for a whole batch), cheapest first: one set alone if it
 * gives enough, else the coal boiler and the diesel sets together; null when the hall cannot give the draw.
 */
export function hallPick(k: InstallKind, s: InstallState): HallSet[] | null {
  const w = workOf(k, s), draw = INSTALL_DRAW[k];
  if (!w || !draw || !hallReady(k, s)) return null;
  const ok = hallSets(k).filter((h) => (s.pw?.[h.fuel] ?? 0) >= w.batch / h.burn - 1e-9);
  const one = ok.find((h) => h.kw >= draw);
  if (one) return [one];
  const pair = ok.filter((h) => h.fuel !== 'nfuel');
  for (let i = 0; i < pair.length; i++) for (let j = i + 1; j < pair.length; j++) if (pair[i].kw + pair[j].kw >= draw) return [pair[i], pair[j]];
  return pair.reduce((a, h) => a + h.kw, 0) >= draw && pair.length > 2 ? pair : null;
}
/** The power the hall could give now (kW): every set with fuel in its bunker. */
export const hallKw = (k: InstallKind, s: InstallState | undefined) => (hallReady(k, s) ? hallSets(k).filter((h) => (s!.pw?.[h.fuel] ?? 0) > 1e-9).reduce((a, h) => a + h.kw, 0) : 0);
/** Load up to n crates of fuel into the hall's bunker for it; returns how many went in. */
export function fuelHall(k: InstallKind, s: InstallState, fuel: ItemKey, n: number, now: number): number {
  const h = hallSets(k).find((x) => x.fuel === fuel);
  if (!h || !hallReady(k, s)) return 0;
  runInstall(k, s, now);
  const have = s.pw?.[fuel] ?? 0, m = Math.max(0, Math.min(n, Math.floor(h.bunker - have + 1e-9)));
  if (m <= 0) return 0;
  const could = canRun(k, s);
  (s.pw ??= {})[fuel] = have + m;
  if (!could) s.t = now; // it was waiting for power: the batch starts now
  return m;
}

/**
 * An installation's saved state: the stage reached (stages done), materials handed over towards the next, and the
 * works: inputs in the hopper, output ready, when it was last settled, and the fuel in its power hall's bunkers.
 */
/** `up` / `upgiven`: an upgrade after restoration (the radar's: RADAR_UP) and materials towards it. */
export interface InstallState { stage: number; given: Partial<Record<ItemKey, number>>; inp: Partial<Record<ItemKey, number>>; out: number; t: number; pw?: Partial<Record<ItemKey, number>>; rec?: number; up?: boolean; upgiven?: Partial<Record<ItemKey, number>> }
export const newInstall = (): InstallState => ({ stage: 0, given: {}, inp: {}, out: 0, t: 0 });
/** Saves from before installations took more than one input kept the ore as a number. */
export function fixInstall(k: InstallKind, s: InstallState): InstallState {
  if (typeof s.inp === 'number') s.inp = INSTALL_WORK[k] ? { [INSTALL_WORK[k]!.inp[0][0]]: s.inp } : {};
  return s;
}
/** How many batches the hopper holds inputs for. */
export const batchesIn = (k: InstallKind, s: InstallState) => Math.min(...(workOf(k, s)?.inp ?? []).map(([i, n]) => Math.floor((s.inp[i] ?? 0) / n)));
export const installDone = (k: InstallKind, s: InstallState | undefined) => (s?.stage ?? 0) >= INSTALL_STAGES[k].length;
/** The next stage: its rows (given / needed), whether the plans are known, whether it is complete; null once restored. */
export function installPlan(k: InstallKind, s: InstallState | undefined, known: Record<string, number>) {
  const st = INSTALL_STAGES[k][s?.stage ?? 0];
  if (!st) return null;
  const rows = st.needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s?.given[i] ?? 0) }));
  return { st, n: (s?.stage ?? 0) + 1, rows, plans: !st.tech || known[st.tech] !== undefined, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the current stage (bit by bit; nothing without its plans); moves on to the next once complete. */
export function handOverInstall(k: InstallKind, s: InstallState, known: Record<string, number>, have: (i: ItemKey) => number, now: number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = installPlan(k, s, known);
  if (!plan || !plan.plans) return { taken: [], built: false };
  const taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { s.given[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!installPlan(k, s, known)!.done) return { taken, built: false };
  s.stage++; s.given = {};
  if (installDone(k, s)) s.t = now; // the works start now
  return { taken, built: true };
}
/** Can it work a batch now: restored, the inputs in the hopper, room in the bay and enough power from its hall? */
export function canRun(k: InstallKind, s: InstallState): boolean {
  const w = workOf(k, s);
  return !!w && installDone(k, s) && batchesIn(k, s) >= 1 && s.out + (w.n ?? 1) <= w.bay && !!hallPick(k, s);
}
/**
 * Settle the batches made since it was last looked at: one per batch while the hopper has enough, the bay has room
 * and the power hall gives the draw (its sets burn their fuel for that batch); idle time does not bank.
 */
export function runInstall(k: InstallKind, s: InstallState, now: number) {
  if (!installDone(k, s)) return;
  const w = workOf(k, s);
  if (!w) return; // it makes nothing (the radar station)
  let steps = 0;
  while (now - s.t >= w.batch && canRun(k, s) && steps++ < 400) {
    for (const h of hallPick(k, s)!) s.pw![h.fuel] = Math.max(0, (s.pw![h.fuel] ?? 0) - w.batch / h.burn);
    for (const [i, n] of w.inp) s.inp[i] = (s.inp[i] ?? 0) - n;
    s.out += w.n ?? 1; s.t += w.batch;
  }
  if (!canRun(k, s)) s.t = now; // stopped: the clock starts again when it is fed
}
/** Load up to n crates of input i (up to the hopper); returns how many went in. */
export function loadInstall(k: InstallKind, s: InstallState, i: ItemKey, n: number, now: number): number {
  runInstall(k, s, now);
  const w = workOf(k, s);
  if (!w || !installWorks(k).some((x) => x.inp.some(([y]) => y === i))) return 0; // (inputs of any of its recipes)
  const m = Math.max(0, Math.min(n, w.hopper - (s.inp[i] ?? 0)));
  if (m <= 0) return 0;
  const could = canRun(k, s);
  s.inp[i] = (s.inp[i] ?? 0) + m;
  if (!could) s.t = now; // it was idle: the batch starts now
  return m;
}

// ---------- leads: what the villagers have heard of the great installations ----------
/** Villagers know of an installation within this range of their village (m); the lead id in `char.leads`. */
export const INSTALL_LEAD = 16000;
export const installLeadId = (k: InstallKind) => 'install:' + k;
const IDIRS = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
const idir = (dx: number, dz: number) => IDIRS[Math.round(((Math.atan2(dx, -dz) * 180 / Math.PI + 360) % 360) / 45) % 8];
const ISAY: Record<InstallKind, string[]> = {
  precision: [
    'There is a hall with a round roof {dist} {dir} of here, full of machines finer than a watch, and beside it a white dome and a tower with lamps. The old folk say the machines that made machines stood there.',
    'A tinker told me of the old precision works {dist} {dir} of here. He brought back a gauge block so true that two of them stuck together like magnets.',
  ],
  robotics: [
    'Far out, {dist} {dir} of here, stands a hall as big as a hill, and giant iron arms bent over it like sleeping herons. Our grandmothers said the old world was built by those arms.',
    'Hunters who went to the old robot plant {dist} {dir} of here swear a walking machine stands in a walled yard there, frozen mid-step, taller than a house.',
  ],
  optical: [
    'Glass-roofed halls stand {dist} {dir} of here, most of the panes broken, beside a tower like a candle. The old folk say the eyes of the old machines were ground there.',
    'A glazier from our village went to the old optical works {dist} {dir} of here for panes. He came back with a crystal that bent the light into colours, and a fever.',
  ],
  alloy: [
    'You can see the casting hall of the old alloy works from a day away: {dist} {dir} of here, taller than any tree, with two furnaces like iron pots and hills of black slag.',
    'My father hauled slag from the old alloy complex {dist} {dir} of here. He said the Ancients melted metals there that no fire of ours could even soften.',
  ],
  propellant: [
    'Out {dist} {dir} of here stand great iron balls on legs, two tall columns and a flare stack. My uncle says the old world brewed the fuel of the sky-ships there, and that the ground still smells of it.',
    'Carters give a wide berth to the old fuel works {dist} {dir} of here: spheres on stilts, pipes everywhere, a squat house with walls a metre thick. They say one spark once took a whole valley.',
  ],
  battery: [
    'There is a long hall with a roof like saw teeth {dist} {dir} of here, rows of tanks beside it and a basin of white crust. The old folk call it the cell works: the old machines drank their power from what was made there.',
    'A salvager told me of the old battery plant {dist} {dir} of here. Racks and racks of dead cells in a hall half fallen in, and tanks that still bite if you touch the stuff inside.',
  ],
  uranium: [
    'My grandfather worked at the old enrichment plant, {dist} {dir} of here. Two great cooling towers, one snapped in half, and a hall full of spinning drums. He said the ore that went in came out as something that burns for years.',
    'Travellers talk of a dead plant {dist} {dir} of here: a fence hung with warning signs, a lime trefoil on the gate, two towers like hourglasses. Nobody stays there long.',
  ],
  radar: [
    'On a rise {dist} {dir} of here stands an old listening post: a dish as big as a barn roof, fallen on its back. The old folk say it could see a caravan a day\'s ride away.',
    'Hunters use the old radar station {dist} {dir} of here as a landmark: a lattice tower, a mast on wires, a dish lying in the grass. The bunker under it is sealed.',
  ],
  chips: [
    'There is a sealed block of the old world {dist} {dir} of here, with a water tower and a row of tanks. The traders call it the chip foundry: they say the old machines were born there, etched in crystal.',
    'A scavenger told me of a long windowless building {dist} {dir} of here, still sealed after all these years. Clean rooms, he called them. He could not get the air lock open.',
  ],
};
/** What a villager at (vx, vz) says of an installation. */
export function installLeadText(s: InstallSite, vx: number, vz: number, world: number): string {
  const dx = wrapDx(s.x - vx), dz = s.z - vz, d = Math.hypot(dx, dz), lines = ISAY[s.k], line = lines[hash(world, s.k.length, s.k.charCodeAt(0), 0x1ea5) % lines.length];
  return line.replace('{dist}', `about ${d < 9500 ? (d / 1000).toFixed(1).replace(/\.0$/, '') : Math.round(d / 1000)} km`).replace('{dir}', idir(dx, dz));
}
/** The nearest installation within INSTALL_LEAD of (vx, vz) not yet heard of and not yet found (`found(k)`), or null. */
export function pickInstallLead(sites: InstallSite[], leads: string[], found: (s: InstallSite) => boolean, vx: number, vz: number): InstallSite | null {
  return sites.filter((s) => !leads.includes(installLeadId(s.k)) && !found(s) && worldDist(s.x, s.z, vx, vz) <= INSTALL_LEAD)
    .sort((a, b) => worldDist(a.x, a.z, vx, vz) - worldDist(b.x, b.z, vx, vz))[0] ?? null;
}

// ---------- the radar station: what it shows once restored ----------
/** How far the restored radar station sees (m). */
export const RADAR = { r: 12000 };
/** (Economy stage 6) the radar station's upgrade once restored: sensors and chips in the dish, and it sees `r` m. */
export const RADAR_UP = { r: 20000, needs: [['sensor', 4], ['microchip', 2], ['cable', 6], ['pgm', 2]] as [ItemKey, number][], gold: 300, xp: 400 };
/** How far the radar sees now. */
export const radarRange = (s: InstallState | undefined) => (s?.up ? RADAR_UP.r : RADAR.r);
/** The upgrade's rows (given / needed), or null once done or while the station is not restored. */
export function radarUpPlan(s: InstallState | undefined) {
  if (!s || s.up || !installDone('radar', s)) return null;
  const rows = RADAR_UP.needs.map(([i, n]) => ({ k: i, n, given: Math.min(n, s.upgiven?.[i] ?? 0) }));
  return { rows, done: rows.every((r) => r.given >= r.n) };
}
/** Hand over materials for the radar's upgrade (bit by bit); true once it is done. */
export function handOverRadarUp(s: InstallState, have: (i: ItemKey) => number): { taken: [ItemKey, number][]; built: boolean } {
  const plan = radarUpPlan(s);
  if (!plan) return { taken: [], built: false };
  const g = (s.upgiven ??= {}), taken: [ItemKey, number][] = [];
  for (const r of plan.rows) { const n = Math.min(r.n - r.given, have(r.k)); if (n > 0) { g[r.k] = r.given + n; taken.push([r.k, n]); } }
  if (!radarUpPlan(s)!.done) return { taken, built: false };
  s.up = true; delete s.upgiven;
  return { taken, built: true };
}
/** The villages, ruins, wrecks and camps within RADAR.r of the station (for the map). */
export const radarPlaces = (world: number, s: InstallSite, r = RADAR.r): Poi[] => poisNear(world, s.x, s.z, r).filter((p) => worldDist(p.x, p.z, s.x, s.z) <= r);
