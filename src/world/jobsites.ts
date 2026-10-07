// Builds under way (gen/construction.ts) in the world: the site of each one near you (stakes and lines, a scaffold
// that rises as the work goes on, a stack of timber that shrinks, a sign with how far along it is) and the builders at
// work on it (two hammering, one carrying from the stack). When a job's time is up any game that sees it finishes it
// (gen/jobs.ts): the state change is the same on every game, so in multiplayer it does not matter who does.
import * as THREE from 'three';
import { G } from '../game';
import { OW, reloadStruct } from './overworld';
import { PropBatch } from './props';
import { scene } from './render';
import { makeFigure, type Figure } from './npc';
import { poseRig } from './rig';
import { dueJobs, jobKey, jobShare, jobLeft, type Job } from '../gen/construction';
import { finishJob } from '../gen/jobs';
import { findPoi, worldDist, nearX, villageSeed } from '../gen/regions';
import { farmsOf, upgradedOf } from '../gen/farms';
import { farmField } from '../gen/fields';
import { powerSite, worksOf, WORKS, type TownState } from '../gen/town';
import { WALL_TIERS } from '../gen/village';
import { ITEMS } from '../data/items';
import { industrySite, industryOf, INDUSTRY } from '../gen/industry';
import { plantSite, specOf, isStation, PLANTS } from '../gen/plants';
import { stationSite, STATIONS, DRAW } from '../gen/energy';
import { IMPROVE, type ImproveKind } from '../gen/improve';
import { PLANT_LEVELS } from '../gen/plantup';
import { PROJECTS, RESOURCE_PLOTS, linkRuin, isStation as isStationVillage, stationStage, STATION_STAGES, type Project } from '../gen/settlement';
import { VEHICLE_HALL } from '../gen/hall';
import type { VillageMap } from '../gen/village';
import { syncFarmVillage } from './farms';
import { settlementReward, stationSweep } from '../ui/settlement';
import { saveChar, calcStats } from '../character';
import { showToast, logLine } from '../ui/hud';

const STAKE = 0xffd060, WOOD = 0xb8b060, PLANK = 0xd8c890, WORKER = 0xdce8ff;
/** What a job builds, for the sign and the news. */
export function jobName(s: TownState | undefined, j: Job): string {
  const a = j.a ?? '';
  switch (j.k) {
    case 'farm': return `farm ${farmsOf(s) + 1}`;
    case 'plough': return 'steel ploughs';
    case 'wall': return WALL_TIERS[+a]?.name.toLowerCase() ?? 'wall';
    case 'work': return WORKS[a as keyof typeof WORKS]?.name.toLowerCase() ?? 'defences';
    case 'refinery': return 'refinery';
    case 'improve': return IMPROVE[a as ImproveKind]?.name.toLowerCase() ?? 'improvement';
    case 'plantup': return `power plant, ${PLANT_LEVELS[+a]?.name.toLowerCase() ?? 'upgrade'}`;
    case 'plant': return s?.pbuild ? specOf(s.pbuild.k).name : 'works';
    case 'project': return a === 'comms' && isStationVillage(s) ? STATION_STAGES[Math.min(stationStage(s), STATION_STAGES.length - 1)].title.toLowerCase() : PROJECTS[a as Project]?.name.toLowerCase() ?? 'project';
  }
}
/** Where a job's site is (world) and how big, or null while it cannot be placed (its village not loaded). */
function spotOf(vid: number, s: TownState, j: Job): { x: number; z: number; w: number; d: number } | null {
  const c = G.char, a = j.a ?? '';
  if (j.k === 'project' && (a === 'comms' || a === 'relay')) { // at the receiver's ruin, kilometres out for the station
    const v = findPoi(c.world, vid), r = v && linkRuin(c.world, v, s);
    return r ? { x: r.rect.x0 - 3 + (a === 'relay' ? 5 : 0), z: r.z + (a === 'relay' ? -4 : 6), w: 8, d: 6 } : null;
  }
  const st = OW.structs.get(vid), vm: VillageMap | undefined = st?.village;
  if (!vm) return null;
  const v = findPoi(c.world, vid)!, seed = vm.seed, P = (p: { x: number; z: number }, w = 10, d = 8) => ({ x: vm.ox + p.x, z: vm.oz + p.z, w, d });
  const plot = (i: number, w: number) => { const f = farmField(v, seed, s, i); return { x: nearX((f.x0 + f.x1) / 2, vm.ox), z: (f.z0 + f.z1) / 2, w, d: w }; }; // the staked field, or the old corner
  const gate = () => { const g = vm.gates[0], o = { N: [0, -7], S: [0, 7], E: [7, 0], W: [-7, 0] }[g.dir]; return { x: g.x + o[0], z: g.z + o[1], w: 8, d: 5 }; };
  const ind = industryOf(c.world, v, seed);
  switch (j.k) {
    case 'farm': return plot(farmsOf(s), 12);
    case 'plough': return plot(upgradedOf(s), 6);
    case 'wall': return gate();
    case 'work': { if (a === 'turret') { const m = vm.mounts[worksOf(s, 'turret')] ?? vm.mounts[0]; return m ? { x: m.x - m.fx * 3, z: m.z - m.fz * 3, w: 4, d: 4 } : gate(); } return P(a === 'siteGuard' ? industrySite(seed, ind) : powerSite(seed), 9, 9); }
    case 'refinery': return P(industrySite(seed, ind), 14, 12);
    case 'improve': return a === 'automation' ? P(industrySite(seed, ind)) : a === 'sights' || a === 'armour' ? gate() : P(powerSite(seed), 8, 6);
    case 'plantup': return P(powerSite(seed), 8, 6);
    case 'plant': { const k = s.pbuild?.k; if (!k) return null; const p = isStation(k) ? stationSite(seed, ind, s.stations?.length ?? 0) : plantSite(seed, ind, s.plants?.length ?? 0); return P(p, 14, 12); }
    case 'project': {
      if (a === 'warehouse') return P({ x: (VEHICLE_HALL.x0 + VEHICLE_HALL.x1) / 2, z: (VEHICLE_HALL.z0 + VEHICLE_HALL.z1) / 2 }, 22, 22);
      if (a === 'power') return P(powerSite(seed), 10, 8);
      const r = RESOURCE_PLOTS[(a === 'sawmill2' || a === 'sawmill3' ? 'sawmill' : a) as keyof typeof RESOURCE_PLOTS];
      return r ? P(r, 16, 12) : null;
    }
  }
}

// ---------- the sites ----------
interface Hand { f: Figure; x: number; z: number; face: number; phase: number; carry?: [number, number, number, number] }
interface Site { key: string; g: THREE.Group; hands: Hand[]; y: number }
const sites = new Map<string, Site>();
function drawSite(name: string, sp: { x: number; z: number; w: number; d: number }, share: number): Site {
  const T = OW.terrain!, g = new THREE.Group(), pb = new PropBatch(), y0 = T.heightAt(sp.x, sp.z);
  g.position.set(sp.x, y0, sp.z);
  const h = (x: number, z: number) => T.heightAt(sp.x + x, sp.z + z) - y0, hw = sp.w / 2, hd = sp.d / 2;
  // stakes at the corners and builder's lines between them
  const corners: [number, number][] = [[-hw, -hd], [hw, -hd], [hw, hd], [-hw, hd]];
  corners.forEach(([x, z], i) => {
    pb.seg(STAKE, [x, h(x, z), z], [x, h(x, z) + 0.9, z]);
    const [nx, nz] = corners[(i + 1) % 4]; pb.seg(STAKE, [x, h(x, z) + 0.7, z], [nx, h(nx, nz) + 0.7, nz]);
  });
  // the scaffold rises with the work: poles at the inner corners, a ledger every 1.6 m, braces, a deck on top
  const top = 1 + 5 * share, sx = hw - 1, sz = hd - 1;
  for (const [x, z] of [[-sx, -sz], [sx, -sz], [sx, sz], [-sx, sz]] as [number, number][]) pb.box(x - 0.08, h(x, z), z - 0.08, x + 0.08, h(x, z) + top, z + 0.08, WOOD);
  for (let lv = 1.6; lv <= top; lv += 1.6) {
    pb.seg(WOOD, [-sx, lv, -sz], [sx, lv, -sz]); pb.seg(WOOD, [sx, lv, -sz], [sx, lv, sz]); pb.seg(WOOD, [sx, lv, sz], [-sx, lv, sz]); pb.seg(WOOD, [-sx, lv, sz], [-sx, lv, -sz]);
    pb.seg(WOOD, [-sx, lv - 1.6, -sz], [sx, lv, -sz]); pb.seg(WOOD, [sx, lv - 1.6, sz], [-sx, lv, sz]);
  }
  if (share > 0.35) pb.box(-sx, top - 0.06, -sz, sx, top, sz * 0.2, PLANK); // the work's first floor, then the rest of it
  // the stack of timber and stone, smaller as it goes into the work
  const left = Math.max(0.15, 1 - share), px = -hw - 2, pz = hd - 1.5, py = h(px, pz);
  for (let i = 0; i < Math.ceil(5 * left); i++) pb.box(px - 1.2, py + i * 0.22, pz - 0.6 + (i % 2) * 0.1, px + 1.2, py + i * 0.22 + 0.2, pz + 0.6 + (i % 2) * 0.1, PLANK);
  for (let i = 0; i < Math.ceil(3 * left); i++) pb.box(px - 0.4 + i * 0.5, py, pz + 1, px + i * 0.5, py + 0.4, pz + 1.4, 0xb2b2a3);
  g.add(pb.build());
  const sign = label(['UNDER CONSTRUCTION', `${name.toUpperCase()} · ${Math.floor(share * 100)}%`]);
  sign.position.set(0, Math.max(h(0, 0), 0) + top + 2.4, 0); g.add(sign);
  // the builders: two hammering at the scaffold, one carrying from the stack to it
  const hands: Hand[] = [];
  for (const [x, z] of [[-sx - 0.9, 0], [sx + 0.9, sz * 0.4]] as [number, number][]) {
    const f = makeFigure(WORKER, 'hammer'); g.add(f.g);
    hands.push({ f, x, z, face: Math.atan2(-x, -z * 0.2), phase: hands.length * 0.41 });
  }
  const f = makeFigure(WORKER, 'carry'); g.add(f.g);
  hands.push({ f, x: px, z: pz, face: 0, phase: 0, carry: [px + 1.5, pz - 0.5, -sx - 0.5, -sz + 0.8] });
  return { key: '', g, hands, y: y0 };
}
/** A two-line gold sign, as wide as its longer line needs. */
function label(lines: string[]): THREE.Sprite {
  const n = Math.max(...lines.map((l) => l.length)), cv = document.createElement('canvas'), c = cv.getContext('2d')!;
  cv.width = Math.max(256, n * 21 + 24); cv.height = 96;
  c.fillStyle = '#ffd060'; c.font = '38px VT323, ui-monospace, monospace'; c.textAlign = 'center'; c.textBaseline = 'middle';
  lines.forEach((l, i) => c.fillText(l, cv.width / 2, 26 + i * 44));
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true, depthWrite: false })), w = cv.width / 40;
  sp.scale.set(w, w * cv.height / cv.width, 1); return sp;
}
let syncT = 0, finishT = 0;
/** Main loop: finish the jobs whose time is up (any village), draw the sites near you and move their builders. */
export function updateJobSites(dt: number) {
  if ((finishT -= dt) <= 0) { finishT = 1; finishDue(); }
  if ((syncT -= dt) <= 0) { syncT = 2; syncSites(); }
  for (const s of sites.values()) for (const hd of s.hands) {
    hd.phase += dt;
    const f = hd.f, T = OW.terrain;
    if (hd.carry) { // back and forth between the stack and the scaffold, a load on the way out
      const [ax, az, bx, bz] = hd.carry, cyc = (hd.phase * 0.12) % 1, t = cyc < 0.5 ? cyc * 2 : 2 - cyc * 2;
      const x = ax + (bx - ax) * t, z = az + (bz - az) * t, sw = Math.sin(hd.phase * 7) * 0.5;
      f.legL.rotation.x = sw; f.legR.rotation.x = -sw; poseRig(f.rig, { swing: sw, strike: -1 });
      f.g.position.set(x, T ? T.heightAt(s.g.position.x + x, s.g.position.z + z) - s.y : 0, z); f.g.rotation.y = Math.atan2(bx - ax, bz - az) + (cyc < 0.5 ? 0 : Math.PI);
    } else {
      poseRig(f.rig, { swing: 0, strike: (hd.phase * 0.85) % 1 });
      f.g.position.set(hd.x, T ? T.heightAt(s.g.position.x + hd.x, s.g.position.z + hd.z) - s.y : 0, hd.z); f.g.rotation.y = hd.face;
    }
  }
}
let terrainOf: unknown = null;
function syncSites() {
  const c = G.char, live = new Set<string>();
  if (OW.terrain !== terrainOf) { dropJobSites(); terrainOf = OW.terrain; } // another world (or none): its sites go
  if (c.loc === 'overworld' && OW.terrain) for (const [id, s] of Object.entries(c.towns)) {
    if (!s?.jobs) continue;
    for (const j of Object.values(s.jobs)) {
      const sp = spotOf(+id, s, j);
      if (!sp) continue;
      const x = nearX(sp.x, G.pos.x);
      if (worldDist(x, sp.z, G.pos.x, G.pos.z) > 500) continue;
      const share = jobShare(j, c.time), id2 = id + ':' + jobKey(j.k, j.a), key = `${x.toFixed(1)}:${sp.z.toFixed(1)}:${Math.floor(share * 50)}:${jobName(s, j)}`;
      live.add(id2);
      const old = sites.get(id2);
      if (old?.key === key) continue;
      if (old) dropSite(old);
      const site = drawSite(jobName(s, j), { ...sp, x }, share); site.key = key;
      scene.add(site.g); sites.set(id2, site);
    }
  }
  for (const [k, s] of sites) if (!live.has(k)) { dropSite(s); sites.delete(k); }
}
function dropSite(s: Site) {
  s.g.parent?.remove(s.g);
  s.g.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); if (o instanceof THREE.Sprite) { o.material.map?.dispose(); o.material.dispose(); } });
}
/** Forget every site (closing the world). */
export function dropJobSites() { for (const s of sites.values()) dropSite(s); sites.clear(); }

/** The quest tracker's lines: every build under way, how far along. */
export function jobLines(): string[] {
  const c = G.char, out: string[] = [];
  for (const [id, s] of Object.entries(c.towns)) for (const j of Object.values(s?.jobs ?? {})) {
    out.push(`▸ Building at ${findPoi(c.world, +id)?.name ?? 'a village'}: ${jobName(s, j)} · ${Math.floor(jobShare(j, c.time) * 100)}% (${jobLeft(j, c.time)} left)`);
  }
  return out;
}

// ---------- finishing ----------
function finishDue() {
  const c = G.char;
  for (const [id, s] of Object.entries(c.towns)) {
    if (!s?.jobs) continue;
    const due = dueJobs(s, c.time), v = due.length ? findPoi(c.world, +id) : null;
    if (!v) continue;
    for (const j of due) {
      const name = jobName(s, j), plant = j.k === 'plant' ? s.pbuild?.k : undefined;
      const r = finishJob(c.world, v, s, j, c.time), a = j.a ?? '';
      if (j.k === 'farm' || j.k === 'plough' || j.k === 'project') syncFarmVillage(v.id);
      reloadStruct(v.id);
      const what = name.charAt(0).toUpperCase() + name.slice(1);
      let line = `${v.name}: the builders are done. ${what} is built.`;
      if (j.k === 'project') {
        if (a === 'comms' || a === 'relay') { const ruin = linkRuin(c.world, v, s); if (ruin) reloadStruct(ruin.id); }
        if (r.stage && !r.built) settlementReward(v.id, 'station-' + stationStage(s));
        if (r.built) {
          settlementReward(v.id, a, a === 'comms' ? 'tablet' : undefined);
          if (a === 'comms' && isStationVillage(s)) line += ` The satellites answer: the map in your glove computer is alive (M), and the station's sweep put ${stationSweep(v.x, v.z)} new places on it. Your GPS tablet waits for you.`;
          else line += ' The elder has the next objective.';
        }
      }
      if (plant) line += isStation(plant) ? ` It gives ${STATIONS[plant].kw} kW.` : ` Load its hopper with ${[...new Set(PLANTS[plant].recipes.flatMap((x) => x.in.map(([g]) => ITEMS[g].name)))].join(', ')}; it draws ${DRAW[plant]} kW.`;
      if (j.k === 'refinery') line = `${v.name}'s ${INDUSTRY[industryOf(c.world, v, villageSeed(c.world, v))].site.toLowerCase()} is built.`;
      showToast(`${v.name}: ${what} is built`); logLine(line);
    }
    calcStats(); saveChar();
  }
}
