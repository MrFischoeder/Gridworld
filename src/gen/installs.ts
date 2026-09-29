// The great installations of the old world (pure, deterministic from the world seed): huge ruined plants standing in
// fixed places far out on the continent, which the player can one day bring back to life (the uranium enrichment
// plant, then the chip foundry; the radar station and the rocket fuel complex will follow the same pattern). Each
// lies in its own distance band from Gridholm on dry, fairly level ground away from villages, places, roads, lakes and
// the mountains. The ground round it is bare: trees, rocks and plants inside `inInstall` are not generated.
import { hash } from '../core/rng';
import { CHUNK, worldDist, wrapDx } from './regions';
import { nearestOnRoad } from './roads';
import { mountainMask } from './mountains';
import { rectDist, type Terrain } from './terrain';
import type { ItemKey } from '../data/items';

export type InstallKind = 'uranium' | 'chips';
export interface InstallSpec { k: InstallKind; name: string; blurb: string; band: [number, number]; r: number }
export const INSTALLS: InstallSpec[] = [
  { k: 'uranium', name: 'Old Enrichment Plant', blurb: 'a ruined plant of the old world where ore was once made into reactor fuel: a centrifuge hall, two cooling towers and a stack', band: [15000, 25000], r: 34 },
  { k: 'chips', name: 'Old Chip Foundry', blurb: 'a sealed fabrication plant of the old world where crystal wafers were etched into chips: a long clean-room block, a tank farm and a water tower', band: [12000, 20000], r: 32 },
];
export interface InstallSite { k: InstallKind; name: string; x: number; z: number; y: number; yaw: number; r: number }

/** Why a spot does not fit (null: it does). */
export function installMisfit(t: Terrain, x: number, z: number, r: number): string | null {
  const y0 = t.heightAt(x, z);
  if (mountainMask(t.world, x, z) > 0.12) return 'mountain';
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
  uranium: [
    { title: 'Clearing the rubble', text: 'The hall is choked with fallen trusses and the gate is jammed. Timber for props, stone for the breaches, scrap for the braces.', needs: [['log', 12], ['stone', 10], ['scrap', 6]], gold: 150, xp: 200 },
    { title: 'The centrifuge hall', text: 'A new roof, and the centrifuges rewired: steel for the trusses, cable for the lines, electronics for the drives.', needs: [['steel', 6], ['cable', 4], ['circuit', 8]], gold: 300, xp: 350 },
    { title: 'The core', text: 'The cascade controller is dead. Only the old plans for enrichment show how it was built, and it wants power cores and hull alloy.', needs: [['pcore', 2], ['alloy', 4], ['circuit', 6]], tech: 'enrichment', gold: 500, xp: 600 },
  ],
  chips: [
    { title: 'Opening the block', text: 'The clean-room block is sealed and half buried in its own rubble. Timber for shoring, stone to fill the breaches, scrap to brace the air locks.', needs: [['log', 10], ['stone', 12], ['scrap', 8]], gold: 150, xp: 200 },
    { title: 'Air and water', text: 'Nothing is made in dust: the filters and the water plant must run first. Glass for the filter housings, cable for the fans and pumps, steel for the ducts.', needs: [['glass', 6], ['cable', 6], ['steel', 4]], gold: 300, xp: 350 },
    { title: 'The etching line', text: 'The etchers stand dead in their bays. Only the old plans for integrated circuits show how to wake them, and they want circuit boards and a power core.', needs: [['boards', 4], ['circuit', 8], ['pcore', 1]], tech: 'chips', gold: 450, xp: 550 },
  ],
};
/** What a working installation makes: the crates of each input in `inp` into one of `out` every `batch` game minutes (at most `hopper` of each input loaded, `bay` made waiting). */
export interface InstallWork { inp: [ItemKey, number][]; out: ItemKey; batch: number; hopper: number; bay: number; what: string }
export const INSTALL_WORK: Record<InstallKind, InstallWork> = {
  uranium: { inp: [['uranium', 3]], out: 'nfuel', batch: 360, hopper: 30, bay: 10, what: 'The centrifuges hum again.' },
  chips: { inp: [['glass', 2], ['copperbar', 1]], out: 'microchip', batch: 240, hopper: 30, bay: 12, what: 'The etching line glows behind its windows.' },
};
/** An installation's saved state: the stage reached (stages done), materials handed over towards the next, and the works: inputs in the hopper, output ready, when it was last settled. */
export interface InstallState { stage: number; given: Partial<Record<ItemKey, number>>; inp: Partial<Record<ItemKey, number>>; out: number; t: number }
export const newInstall = (): InstallState => ({ stage: 0, given: {}, inp: {}, out: 0, t: 0 });
/** Saves from before installations took more than one input kept the ore as a number. */
export function fixInstall(k: InstallKind, s: InstallState): InstallState {
  if (typeof s.inp === 'number') s.inp = { [INSTALL_WORK[k].inp[0][0]]: s.inp };
  return s;
}
/** How many batches the hopper holds inputs for. */
export const batchesIn = (k: InstallKind, s: InstallState) => Math.min(...INSTALL_WORK[k].inp.map(([i, n]) => Math.floor((s.inp[i] ?? 0) / n)));
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
/** Settle the batches made since it was last looked at (one per batch while the hopper has enough and the bay has room; idle time does not bank). */
export function runInstall(k: InstallKind, s: InstallState, now: number) {
  if (!installDone(k, s)) return;
  const w = INSTALL_WORK[k];
  if (batchesIn(k, s) < 1 || s.out >= w.bay) { s.t = now; return; }
  const batches = Math.min(Math.floor((now - s.t) / w.batch), batchesIn(k, s), w.bay - s.out);
  if (batches <= 0) return;
  for (const [i, n] of w.inp) s.inp[i] = (s.inp[i] ?? 0) - batches * n;
  s.out += batches; s.t += batches * w.batch;
  if (batchesIn(k, s) < 1 || s.out >= w.bay) s.t = now;
}
/** Load up to n crates of input i (up to the hopper); returns how many went in. */
export function loadInstall(k: InstallKind, s: InstallState, i: ItemKey, n: number, now: number): number {
  runInstall(k, s, now);
  const w = INSTALL_WORK[k];
  if (!w.inp.some(([x]) => x === i)) return 0;
  const m = Math.max(0, Math.min(n, w.hopper - (s.inp[i] ?? 0)));
  if (m <= 0) return 0;
  const before = batchesIn(k, s);
  s.inp[i] = (s.inp[i] ?? 0) + m;
  if (before < 1) s.t = now; // it was idle: the batch starts now
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
