// The great installations of the old world (pure, deterministic from the world seed): huge ruined plants standing in
// fixed places far out on the continent, which the player can one day bring back to life (the uranium enrichment
// plant, then the chip foundry; the radar station and the rocket fuel complex will follow the same pattern). Each
// lies in its own distance band from Gridholm on dry, fairly level ground away from villages, places, roads, lakes and
// the mountains. The ground round it is bare: trees, rocks and plants inside `inInstall` are not generated.
import { hash } from '../core/rng';
import { CHUNK, worldDist, wrapDx, poisNear, type Poi } from './regions';
import { nearestOnRoad } from './roads';
import { mountainMask } from './mountains';
import { inSea } from './seas';
import { nearRiver } from './rivers';
import { rectDist, type Terrain } from './terrain';
import type { ItemKey } from '../data/items';

export type InstallKind = 'uranium' | 'chips' | 'radar';
export interface InstallSpec { k: InstallKind; name: string; blurb: string; band: [number, number]; r: number }
export const INSTALLS: InstallSpec[] = [
  { k: 'uranium', name: 'Old Enrichment Plant', blurb: 'a ruined plant of the old world where ore was once made into reactor fuel: a centrifuge hall, two cooling towers and a stack', band: [15000, 25000], r: 34 },
  { k: 'chips', name: 'Old Chip Foundry', blurb: 'a sealed fabrication plant of the old world where crystal wafers were etched into chips: a long clean-room block, a tank farm and a water tower', band: [12000, 20000], r: 32 },
  { k: 'radar', name: 'Old Radar Station', blurb: 'a listening post of the old world on a rise: a great dish on a lattice tower, a mast held by guy wires and a bunker full of screens', band: [18000, 28000], r: 30 },
];
export interface InstallSite { k: InstallKind; name: string; x: number; z: number; y: number; yaw: number; r: number }

/** Why a spot does not fit (null: it does). */
export function installMisfit(t: Terrain, x: number, z: number, r: number): string | null {
  const y0 = t.heightAt(x, z);
  if (mountainMask(t.world, x, z) > 0.12) return 'mountain';
  if (inSea(t.world, x, z, r + 60)) return 'sea';
  if (nearRiver(t.world, x, z, r + 80)) return 'river';
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
/** Every installation of a world: for each, the first of a hashed list of spots in its band that fits (the first spot if none does). */
export function installSites(t: Terrain): InstallSite[] {
  const hit = cache.get(t.world); if (hit) return hit;
  const out: InstallSite[] = [];
  cache.set(t.world, out); // (filled below; set first so a nested call during the search sees no sites rather than recursing)
  INSTALLS.forEach((spec, i) => {
    let best: InstallSite | null = null;
    for (let k = 0; k < 120; k++) {
      const a = (hash(t.world, i, k, 0x1e57) % 3600) / 3600 * Math.PI * 2, [d0, d1] = spec.band;
      const d = d0 + (hash(t.world, i, k, 0x1e58) % 1000) / 1000 * (d1 - d0), x = Math.cos(a) * d, z = Math.sin(a) * d;
      const c: InstallSite = { k: spec.k, name: spec.name, x, z, y: t.heightAt(x, z), yaw: (hash(t.world, i, k, 0x1e59) % 4) * Math.PI / 2, r: spec.r };
      if (!best) best = c;
      if (out.some((o) => worldDist(o.x, o.z, x, z) < 3000)) continue; // the installations lie well apart
      if (!installMisfit(t, x, z, spec.r)) { best = c; break; }
    }
    out.push(best!);
  });
  return out;
}
/** Is (x, z) on the bare ground of an installation (within its radius plus m)? */
export function inInstall(t: Terrain, x: number, z: number, m = 0): boolean {
  if (Math.hypot(x, z) < 12000) return false; // all of them lie far out: a cheap early out near home
  for (const s of installSites(t)) if (worldDist(s.x, s.z, x, z) < s.r + m) return true;
  return false;
}
export const installAt = (t: Terrain, x: number, z: number, m = 0) => installSites(t).find((s) => worldDist(s.x, s.z, x, z) < s.r + m) ?? null;

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
};
/** What a working installation makes: the crates of each input in `inp` into one of `out` every `batch` game minutes (at most `hopper` of each input loaded, `bay` made waiting). */
export interface InstallWork { inp: [ItemKey, number][]; out: ItemKey; batch: number; hopper: number; bay: number; what: string }
export const INSTALL_WORK: Partial<Record<InstallKind, InstallWork>> = {
  uranium: { inp: [['uranium', 3], ['chems', 1]], out: 'nfuel', batch: 360, hopper: 30, bay: 10, what: 'The centrifuges hum again.' },
  chips: { inp: [['glass', 2], ['copperbar', 1], ['chems', 1], ['rareearth', 1]], out: 'microchip', batch: 240, hopper: 30, bay: 12, what: 'The etching line glows behind its windows.' },
};

// ---------- the power hall: an installation makes its own power ----------
/**
 * What a working installation draws (kW). A batch runs only while its power hall gives that much: the hall comes back
 * with the second stage (`HALL_STAGE` stages done) and burns what you bring it, only while a batch is under way.
 */
export const INSTALL_DRAW: Partial<Record<InstallKind, number>> = { uranium: 200, chips: 100 };
export const HALL_STAGE = 2;
/** The hall's generator sets: each runs on its own fuel (a crate every `burn` game minutes of work), `bunker` crates at most. */
export interface HallSet { fuel: ItemKey; name: string; kw: number; burn: number; bunker: number }
export const HALL_SETS: HallSet[] = [
  { fuel: 'coal', name: 'Coal boiler', kw: 120, burn: 120, bunker: 30 },
  { fuel: 'fuel', name: 'Diesel sets', kw: 100, burn: 150, bunker: 30 },
  { fuel: 'nfuel', name: 'The plant\'s own reactor', kw: 250, burn: 5760, bunker: 4 },
];
/** The sets of k's hall: every hall has a coal boiler and diesel sets; the enrichment plant also its own reactor, which burns the rods it makes. */
export const hallSets = (k: InstallKind) => HALL_SETS.filter((h) => h.fuel !== 'nfuel' || k === 'uranium');
export const hallReady = (k: InstallKind, s: InstallState | undefined) => !!INSTALL_DRAW[k] && (s?.stage ?? 0) >= HALL_STAGE;
/**
 * The sets that would power one batch now (enough fuel in each for a whole batch), cheapest first: one set alone if it
 * gives enough, else the coal boiler and the diesel sets together; null when the hall cannot give the draw.
 */
export function hallPick(k: InstallKind, s: InstallState): HallSet[] | null {
  const w = INSTALL_WORK[k], draw = INSTALL_DRAW[k];
  if (!w || !draw || !hallReady(k, s)) return null;
  const ok = hallSets(k).filter((h) => (s.pw?.[h.fuel] ?? 0) >= w.batch / h.burn - 1e-9);
  const one = ok.find((h) => h.kw >= draw);
  if (one) return [one];
  const pair = ok.filter((h) => h.fuel !== 'nfuel');
  return pair.reduce((a, h) => a + h.kw, 0) >= draw && pair.length > 1 ? pair : null;
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
export interface InstallState { stage: number; given: Partial<Record<ItemKey, number>>; inp: Partial<Record<ItemKey, number>>; out: number; t: number; pw?: Partial<Record<ItemKey, number>> }
export const newInstall = (): InstallState => ({ stage: 0, given: {}, inp: {}, out: 0, t: 0 });
/** Saves from before installations took more than one input kept the ore as a number. */
export function fixInstall(k: InstallKind, s: InstallState): InstallState {
  if (typeof s.inp === 'number') s.inp = INSTALL_WORK[k] ? { [INSTALL_WORK[k]!.inp[0][0]]: s.inp } : {};
  return s;
}
/** How many batches the hopper holds inputs for. */
export const batchesIn = (k: InstallKind, s: InstallState) => Math.min(...(INSTALL_WORK[k]?.inp ?? []).map(([i, n]) => Math.floor((s.inp[i] ?? 0) / n)));
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
  const w = INSTALL_WORK[k];
  return !!w && installDone(k, s) && batchesIn(k, s) >= 1 && s.out < w.bay && !!hallPick(k, s);
}
/**
 * Settle the batches made since it was last looked at: one per batch while the hopper has enough, the bay has room
 * and the power hall gives the draw (its sets burn their fuel for that batch); idle time does not bank.
 */
export function runInstall(k: InstallKind, s: InstallState, now: number) {
  if (!installDone(k, s)) return;
  const w = INSTALL_WORK[k];
  if (!w) return; // it makes nothing (the radar station)
  let steps = 0;
  while (now - s.t >= w.batch && canRun(k, s) && steps++ < 400) {
    for (const h of hallPick(k, s)!) s.pw![h.fuel] = Math.max(0, (s.pw![h.fuel] ?? 0) - w.batch / h.burn);
    for (const [i, n] of w.inp) s.inp[i] = (s.inp[i] ?? 0) - n;
    s.out++; s.t += w.batch;
  }
  if (!canRun(k, s)) s.t = now; // stopped: the clock starts again when it is fed
}
/** Load up to n crates of input i (up to the hopper); returns how many went in. */
export function loadInstall(k: InstallKind, s: InstallState, i: ItemKey, n: number, now: number): number {
  runInstall(k, s, now);
  const w = INSTALL_WORK[k];
  if (!w || !w.inp.some(([x]) => x === i)) return 0;
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
/** The villages, ruins, wrecks and camps within RADAR.r of the station (for the map). */
export const radarPlaces = (world: number, s: InstallSite): Poi[] => poisNear(world, s.x, s.z, RADAR.r).filter((p) => worldDist(p.x, p.z, s.x, s.z) <= RADAR.r);
