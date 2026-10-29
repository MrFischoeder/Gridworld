import { roadLength, roadBuilt, roadShare, PROAD, clsOf, upFrontAt } from '../gen/playerroads';
import { hubTruckAt } from '../world/hublines';
import { droneMapAt } from '../world/airlines';
import { airshipsForMap } from '../world/airships';
import { skyShipsForMap } from '../world/skyships';
import { coptersForMap } from '../world/copters';
import { allSkyLines } from '../gen/skylines';
import { allAirLines } from '../gen/airlines';
import { allHubLines, hlWrecked } from '../gen/hublines';
import { truckAt } from '../world/convoyroutes';
import { anchorAt, planWay, stakePlanned, endWord, costShort } from '../world/playerroads';
import type { RoadEnd } from '../gen/playerroads';
import { wayNear } from '../gen/roadnet';
import { hubs, hexCorners, parseHex, HEX } from '../gen/warehouses';
import { biomeAt, biomeName, BIOMES, BIOME_KINDS, type BiomeHere } from '../gen/biomes';
import { wrecked } from '../gen/routes';
import { shipPos } from '../gen/shiplines';
import { cityEntrances, stationName } from '../gen/citydungeons';
import { megalithsNear } from '../gen/megaliths';
import { dryCaravan } from '../world/convoyfuel';
import { gatesNear, gateName } from '../gen/worldgates';
// Surface maps: the minimap (150 m around the player) and the full world map (M), both built from
// explored chunks only (fog of war). Chunk tiles are rendered once from the deterministic terrain.
import { nearX, wrapDx, wrapX } from '../gen/regions';
import { G, W } from '../game';
import { OW, villageHere } from '../world/overworld';
import { CHUNK, poisNear, villageSeed, GRIDHOLM_ID } from '../gen/regions';
import { isStation, projectDone, satelliteUp, scanWait, ORBIT, RELAY, hasRelay, vehiclesOpen } from '../gen/settlement';
import { allVillages } from '../gen/regions';
import { planRoute } from '../gen/roads';
import { fogsNear } from '../gen/toxic';
import { weatherAt } from '../gen/weather';
import { showToast, logLine } from './hud';
import { wallPolygon, villageSides, VILLAGE_R } from '../gen/village';
import { STEP, VERTS, CELLS, inRect } from '../gen/terrain';
import { SEA } from '../gen/seas';
import { discover, isDiscovered } from '../save';
import { installSitesReady } from '../gen/installs';
import { LODES, type LodeKind } from '../gen/lodes';
import { POWER_SRC } from '../gen/grid';
import { fertility, fertilityColor, fertilityWord } from '../gen/fertility';
import { townsWorld } from '../gen/worldrules';
import { scanLodes } from '../world/lodes';
import { cityAt, citySites, cityLayout, worldToCity, bldsNear, inBld, segDist, CITY } from '../gen/cities';
import { saveChar, hasItem } from '../character';

/** The colour of the GPS waypoint (maps and compass). */
export const WAYPOINT_C = '#8fd8ff';
import { drawPlayerArrow } from './minimap';
import { vehicles, driving } from '../world/vehicles';
import { questMarkers } from '../world/quests';
import { leadMarkers } from '../world/datacarriers';
import { mapWagons, plundered } from '../world/caravans';
import { network, pathKnown } from '../gen/roads';
import { onRoad, caravanPos } from '../gen/caravans';
import { raiders } from '../world/raiders';
import { $ } from './hud';
import { myOwner, ownerName } from '../world/rivals';
import { mayUse } from '../gen/outposts';
import { tl, TL } from '../i18n';

const tiles = new Map<string, HTMLCanvasElement>();
let tileWorld = -1;

/** New tiles worked out per drawn frame of each map: a scan or a sweep can uncover hundreds at once, and each costs a lattice. */
const TILE_BUDGET = { n: 6, ms: 6 };
function tile(cx: number, cz: number, budget?: { n: number; until: number }): HTMLCanvasElement | null {
  const T = OW.terrain!;
  if (tileWorld !== T.world) { tiles.clear(); tileWorld = T.world; }
  const k = cx + ',' + cz;
  let cv = tiles.get(k);
  if (cv) return cv;
  if (budget) { if (budget.n <= 0 || performance.now() > budget.until) return null; budget.n--; }
  cv = document.createElement('canvas'); cv.width = cv.height = CELLS;
  const ctx = cv.getContext('2d')!, img = ctx.createImageData(CELLS, CELLS), lat = T.lattice(cx, cz), f = T.chunkFeatures(cx, cz);
  // a dead city here: its streets and buildings show on the map
  const city = cityAt(T.world, cx * CHUNK + CHUNK / 2, cz * CHUNK + CHUNK / 2, CHUNK), L = city ? cityLayout(T.world, city) : null;
  const cityPx = (x: number, z: number): [number, number, number] | null => {
    if (!city || !L) return null;
    const [u, v] = worldToCity(city, x, z);
    if (Math.hypot(u, v) > city.r) return null;
    for (const k of bldsNear(L, u, v, 1)) if (inBld(L.blds[k], u, v, 0)) return L.blds[k].st === 2 ? [70, 110, 70] : L.blds[k].f > 12 ? [170, 230, 180] : [120, 180, 130];
    const near = L.sIdx[Math.max(0, Math.min(L.n - 1, Math.floor((u + L.half) / L.cell))) + L.n * Math.max(0, Math.min(L.n - 1, Math.floor((v + L.half) / L.cell)))];
    for (const k of near) { const s = L.streets[k]; if (segDist(u, v, s.ax, s.az, s.bx, s.bz) < s.w / 2) return [45, 75, 50]; }
    return [22, 48, 26];
  };
  const swampy = [[0, 0], [CHUNK, 0], [0, CHUNK], [CHUNK, CHUNK], [CHUNK / 2, CHUNK / 2]].some(([a, b]) => T.swampLevel(cx * CHUNK + a, cz * CHUNK + b) !== null); // (0.233) a swamp's pools
  for (let j = 0; j < CELLS; j++) for (let i = 0; i < CELLS; i++) {
    // contour lines every 4 m in the lowlands, every 12 m up the mountains
    const h = lat[i + VERTS * j], cs = h > 26 ? 12 : 4, band = Math.floor(h / cs) !== Math.floor(lat[i + 1 + VERTS * j] / cs) || Math.floor(h / cs) !== Math.floor(lat[i + VERTS * (j + 1)] / cs);
    const x = cx * CHUNK + i * STEP + 1, z = cz * CHUNK + j * STEP + 1;
    let r = 0, g = 28 + Math.min(h, 25) * 3.2, b = 10 + Math.min(h, 25) * 1.2;
    if (h > 25) { const m = Math.min(1, (h - 25) / 120); r = 30 + m * 150; g = 108 + m * 120; b = 40 + m * 150; } // rock, pale towards the peaks
    if (band) { g += 30; b += 12; }
    const cp = cityPx(x, z);
    if (cp) [r, g, b] = cp;
    else if (f.pads.some((p) => inRect(p.poi.rect, x, z))) { r = 10; g = 90; b = 40; }
    else if (f.roads.some((rd) => nearest(rd.pts, x, z) < rd.half + 0.5)) { r = 60; g = 170; b = 90; }
    else if (f.lakes.length || f.rivers.length || swampy || h < SEA.level) { const w = T.water(x, z); if (w) [r, g, b] = w.kind === 'sea' ? [8, 60 - Math.min(30, w.depth), 130 - Math.min(60, w.depth * 1.5)] : w.kind === 'toxic' ? [110, 190, 20] : w.kind === 'murky' ? [70, 80, 30] : [15, 110, 100]; }
    const o = 4 * (i + CELLS * j); img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tiles.set(k, cv);
  return cv;
}
/** (0.182) The fertility layer of the big map (F): the land's fertility (gen/fertility.ts) over the explored ground, on
 *  a 128 m grid, rust (barren) to bright green (rich). Worked out a few hundred cells a frame and kept. */
export let fertLayer = false;
export const toggleFertility = () => { fertLayer = !fertLayer; };
const FCELL = 128, fertCells = new Map<string, number>();
let fertWorld = NaN;
function drawFertility(ctx: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number, px: number, pz: number, hw: number, hh: number, ppm: number) {
  const world = G.char.world, d = G.char.discovered;
  if (fertWorld !== world) { fertCells.clear(); fertWorld = world; }
  const until = performance.now() + 8;
  ctx.globalAlpha = 0.55;
  for (let i = Math.floor((px - hw) / FCELL); i <= Math.floor((px + hw) / FCELL); i++) for (let j = Math.floor((pz - hh) / FCELL); j <= Math.floor((pz + hh) / FCELL); j++) {
    const x = i * FCELL + FCELL / 2, z = j * FCELL + FCELL / 2;
    if (!isDiscovered(d, Math.floor(x / CHUNK), Math.floor(z / CHUNK))) continue;
    const k = Math.floor(wrapX(x) / FCELL) + ',' + j;
    let f = fertCells.get(k);
    if (f === undefined) { if (performance.now() > until) continue; f = fertility(world, x, z); fertCells.set(k, f); }
    if (f <= 0) continue;
    const [r, g, b] = fertilityColor(f);
    ctx.fillStyle = `rgb(${r},${g},${b})`; ctx.fillRect(X(i * FCELL), Z(j * FCELL), FCELL * ppm + 0.5, FCELL * ppm + 0.5);
  }
  ctx.globalAlpha = 1;
}
/** (0.231) The biome layer of the big map (B): each 128 m cell of explored ground in its biome's colour (gen/biomes.ts). */
export let biomeLayer = false;
export const toggleBiomes = () => { biomeLayer = !biomeLayer; };
const biomeCells = new Map<string, BiomeHere>();
let biomeWorld = NaN;
function drawBiomes(ctx: CanvasRenderingContext2D, X: (x: number) => number, Z: (z: number) => number, px: number, pz: number, hw: number, hh: number, ppm: number) {
  const world = G.char.world, d = G.char.discovered;
  if (biomeWorld !== world) { biomeCells.clear(); biomeWorld = world; }
  const until = performance.now() + 8;
  ctx.globalAlpha = 0.5;
  for (let i = Math.floor((px - hw) / FCELL); i <= Math.floor((px + hw) / FCELL); i++) for (let j = Math.floor((pz - hh) / FCELL); j <= Math.floor((pz + hh) / FCELL); j++) {
    const x = i * FCELL + FCELL / 2, z = j * FCELL + FCELL / 2;
    if (!isDiscovered(d, Math.floor(x / CHUNK), Math.floor(z / CHUNK))) continue;
    const k = Math.floor(wrapX(x) / FCELL) + ',' + j;
    let b = biomeCells.get(k);
    if (b === undefined) { if (performance.now() > until) continue; b = biomeAt(world, x, z); biomeCells.set(k, b); }
    if (b === 'sea') continue;
    ctx.fillStyle = BIOMES[b].c; ctx.fillRect(X(i * FCELL), Z(j * FCELL), FCELL * ppm + 0.5, FCELL * ppm + 0.5);
  }
  ctx.globalAlpha = 1;
}
/** The biome layer's key: the biomes seen in the cells worked out so far, with their colours. */
function biomeKey(ctx: CanvasRenderingContext2D, w: number) {
  const seen = BIOME_KINDS.filter((b) => [...biomeCells.values()].includes(b));
  ctx.font = '18px VT323, monospace'; ctx.textAlign = 'left';
  if (seen.length) { ctx.fillStyle = 'rgba(0,8,3,0.85)'; ctx.fillRect(w - 180, 46, 170, seen.length * 20 + 10); }
  seen.forEach((b, i) => { const y = 64 + i * 20; ctx.fillStyle = BIOMES[b].c; ctx.fillRect(w - 170, y - 11, 12, 12); ctx.fillStyle = '#c4ffd2'; ctx.fillText(tl(biomeName(b)), w - 152, y); });
}
function nearest(pts: [number, number][], x: number, z: number) {
  let best = Infinity;
  for (let i = 0; i + 1 < pts.length; i++) {
    const [ax, az] = pts[i], [bx, bz] = pts[i + 1], dx = bx - ax, dz = bz - az, L = dx * dx + dz * dz;
    const t = L ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

/** Explore the chunks around the player (radius 2 = about 64 m). */
let lastC = '';
function explore() {
  const cx = Math.floor(G.pos.x / CHUNK), cz = Math.floor(G.pos.z / CHUNK), k = cx + ',' + cz;
  if (k === lastC) return; lastC = k;
  let changed = false;
  for (let i = -2; i <= 2; i++) for (let j = -2; j <= 2; j++) if (i * i + j * j <= 5) changed = discover(G.char.discovered, cx + i, cz + j) || changed;
  if (changed) saveChar();
}

/** Draws explored terrain around (x, z) at `ppm` pixels per metre into a w x h canvas area. */
function drawArea(ctx: CanvasRenderingContext2D, w: number, h: number, ppm: number, labels: boolean) {
  const px = G.pos.x, pz = G.pos.z, d = G.char.discovered;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingEnabled = false;
  const X = (x: number) => w / 2 + (x - px) * ppm, Z = (z: number) => h / 2 + (z - pz) * ppm;
  const hw = w / 2 / ppm, hh = h / 2 / ppm;
  const cx0 = Math.floor((px - hw) / CHUNK), cx1 = Math.floor((px + hw) / CHUNK), cz0 = Math.floor((pz - hh) / CHUNK), cz1 = Math.floor((pz + hh) / CHUNK);
  // the explored tiles, nearest first; the ones not worked out yet come in over the next frames (a dim square meanwhile)
  const pcx = Math.floor(px / CHUNK), pcz = Math.floor(pz / CHUNK), todo: [number, number][] = [];
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) if (isDiscovered(d, cx, cz)) todo.push([cx, cz]);
  todo.sort((a, b) => Math.hypot(a[0] - pcx, a[1] - pcz) - Math.hypot(b[0] - pcx, b[1] - pcz));
  const budget = { n: TILE_BUDGET.n, until: performance.now() + TILE_BUDGET.ms };
  for (const [cx, cz] of todo) {
    const t = tile(cx, cz, Math.abs(cx - pcx) <= 1 && Math.abs(cz - pcz) <= 1 ? undefined : budget);
    if (t) ctx.drawImage(t, X(cx * CHUNK), Z(cz * CHUNK), CHUNK * ppm + 0.5, CHUNK * ppm + 0.5);
    else { ctx.fillStyle = '#06200c'; ctx.fillRect(X(cx * CHUNK), Z(cz * CHUNK), CHUNK * ppm + 0.5, CHUNK * ppm + 0.5); }
  }
  if (fertLayer && labels) drawFertility(ctx, X, Z, px, pz, hw, hh, ppm);
  if (biomeLayer && labels) drawBiomes(ctx, X, Z, px, pz, hw, hh, ppm);
  ctx.font = (labels ? 20 : 11) + 'px VT323, monospace'; ctx.textAlign = 'center';
  for (const p of poisNear(OW.terrain!.world, px, pz, Math.max(hw, hh) + 60)) {
    if (!isDiscovered(d, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) continue;
    const x = X(p.x), y = Z(p.z);
    if (p.type === 'camp') { ctx.strokeStyle = ctx.fillStyle = '#ff6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'wreck') { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 7, y + 1); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 6, y - 6); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'hangar') { ctx.strokeStyle = ctx.fillStyle = '#9dffe0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x, y - 8, x + 7, y + 4); ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'village') { // the wall's own shape (gen/village.ts wallPolygon), at least a few pixels across
      ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2;
      const world = OW.terrain!.world, poly = wallPolygon(villageSides(villageSeed(world, p), p.id === GRIDHOLM_ID)), k = Math.max(6, (VILLAGE_R * 2 + 4) * ppm / 2) / VILLAGE_R;
      ctx.beginPath(); poly.forEach(([u, v], i) => (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + (u - 36) * k, y + (v - 36) * k)); ctx.closePath(); ctx.stroke();
    }
    else { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y - 4); ctx.lineTo(x + 5, y - 4); ctx.lineTo(x, y + 5); ctx.closePath(); ctx.stroke(); }
    if (labels) ctx.fillText(p.name, x, y - 12);
  }
  // City signs advertise every street entrance as soon as you enter the city.
  const currentCity = cityAt(G.char.world, px, pz);
  for (const city of citySites(G.char.world)) {
    if (Math.abs(wrapDx(city.x-px)) > hw+city.r || Math.abs(city.z-pz) > hh+city.r) continue;
    for (const e of cityEntrances(G.char.world, city)) {
      if (currentCity?.i !== city.i && !isDiscovered(d, Math.floor(e.x/CHUNK), Math.floor(e.z/CHUNK))) continue;
      const x = X(nearX(e.x,px)), y = Z(e.z);
      if (x < -15 || y < -15 || x > w+15 || y > h+15) continue;
      ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 2;
      ctx.strokeRect(x-6,y-6,12,12); ctx.beginPath(); ctx.moveTo(x-4,y-2); ctx.lineTo(x,y+4); ctx.lineTo(x+4,y-2); ctx.stroke();
      if (labels) ctx.fillText(TL`M ${stationName(G.char.world, city.i, e.n)}`,x,y-13);
    }
  }
  for (const g of gatesNear(G.char.world, px, pz, Math.hypot(hw, hh) + 30)) {
    if (!isDiscovered(d, Math.floor(g.x / CHUNK), Math.floor(g.z / CHUNK))) continue;
    const x = X(g.x), y = Z(g.z), r = labels ? 9 : 5;
    ctx.strokeStyle = ctx.fillStyle = '#80e8ff'; ctx.lineWidth = 2; ctx.beginPath();
    for (let i = 0; i < 8; i++) { const a = Math.PI / 8 + i * Math.PI / 4; (i ? ctx.lineTo : ctx.moveTo).call(ctx, x + Math.cos(a) * r, y + Math.sin(a) * r); }
    ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(gateName(g), x, y - r - 7);
  }
  for (const m of megalithsNear(G.char.world, px, pz, Math.hypot(hw, hh))) {
    if (!isDiscovered(d, Math.floor(m.x / CHUNK), Math.floor(m.z / CHUNK))) continue;
    const x = X(m.x), y = Z(m.z), r = Math.max(labels ? 8 : 5, m.radius * ppm);
    ctx.strokeStyle = ctx.fillStyle = '#d1c597'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeRect(x - 4, y - 3, 2, 7); ctx.strokeRect(x + 2, y - 3, 2, 7); ctx.fillRect(x - 5, y - 5, 10, 2);
    if (labels) ctx.fillText(m.name, x, y - r - 7);
  }
  ctx.lineWidth = 1;
  for (const v of vehicles) {
    if (v === driving.v || (!v.claimed && !isDiscovered(d, Math.floor(v.st.x / CHUNK), Math.floor(v.st.z / CHUNK)))) continue;
    const x = X(nearX(v.st.x, px)), y = Z(v.st.z), l = Math.max(3, v.spec.length * ppm / 2), w = Math.max(2, v.spec.width * ppm / 2);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-v.st.heading); ctx.strokeStyle = '#e8fff0'; ctx.strokeRect(-w, -l, w * 2, l * 2); ctx.restore();
    if (labels) { ctx.fillStyle = '#e8fff0'; ctx.fillText(v.spec.name, x, y - l - 6); }
  }
  // (0.280) the heroes' tracks: built solid and earthy, the graded part of the works solid, the rest dashed gold
  for (const r of Object.values(G.char.proads)) {
    if (!r) continue;
    const sx = nearX(r.pts[0][0], px) - r.pts[0][0], pts = r.pts.map(([x, z]) => [X(x + sx), Z(z)] as [number, number]);
    if (pts.every(([x, y]) => x < -20 || y < -20 || x > w + 20 || y > h + 20)) continue;
    const L = roadLength(r.pts), done = roadBuilt(r, G.char.time) ? L : roadShare(r, G.char.time) * L;
    const SURF_C = ['#d8c890', '#c4bca4', '#e6ece6'];
    const line = (from: number, to: number, solid: boolean, cls = clsOf(r)) => {
      ctx.strokeStyle = solid ? SURF_C[cls] : '#ffd060'; ctx.lineWidth = solid ? Math.max(2, PROAD.half * 2 * ppm) : 1.5; ctx.setLineDash(solid ? [] : [4, 3]);
      ctx.beginPath(); let d = 0, on = false;
      for (let i = 1; i < pts.length; i++) {
        const seg = Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]), a0 = Math.max(from, d), a1 = Math.min(to, d + seg);
        if (a1 > a0 && seg > 0) {
          const t0 = (a0 - d) / seg, t1 = (a1 - d) / seg, [ax, ay] = pts[i - 1], [bx, by] = pts[i];
          if (!on) { ctx.moveTo(ax + (bx - ax) * t0, ay + (by - ay) * t0); on = true; }
          ctx.lineTo(ax + (bx - ax) * t1, ay + (by - ay) * t1);
        }
        d += seg;
      }
      ctx.stroke(); ctx.setLineDash([]);
    };
    if (done > 0) line(0, done, true);
    if (done < L) line(done, L, false);
    if (r.up && r.up.t0 !== undefined) { const f = upFrontAt(r, G.char.time) / Math.max(1, r.len) * L; if (f > 0) line(0, f, true, r.up.to); } // (0.282) the new surface laid so far
    if (labels && ppm > 0.08) { const [mx, my] = pts[Math.floor(pts.length / 2)]; ctx.fillStyle = '#d8c890'; ctx.fillText(r.name, mx, my - 6); }
  }
  ctx.lineWidth = 1;
  // bridges: the built ones, and the sites you staked out (dashed)
  const bars: [number, number, number, number, number, boolean][] = [];
  for (const b of Object.values(G.char.bridges)) if (b.done && b.at) bars.push([...b.at, true]);
  for (const f of G.char.bridgeSites) if (!G.char.bridges[f.id]?.done) bars.push([f.x, f.z, f.dx, f.dz, f.end, false]);
  for (const p of G.char.piers) bars.push([p.x + p.dx * p.len / 2, p.z + p.dz * p.len / 2, p.dx, p.dz, p.len / 2, !!p.done]); // piers too
  for (const [bx, bz, dx, dz, e, done] of bars) {
    const x = X(nearX(bx, px)), y = Z(bz), l = Math.max(4, e * ppm);
    ctx.strokeStyle = done ? '#e8fff0' : '#ffd060'; ctx.lineWidth = done ? Math.max(2, 5.4 * ppm) : 1.5; ctx.setLineDash(done ? [] : [3, 3]);
    ctx.beginPath(); ctx.moveTo(x - dx * l, y - dz * l); ctx.lineTo(x + dx * l, y + dz * l); ctx.stroke(); ctx.setLineDash([]);
  }
  ctx.lineWidth = 1;
  for (const b of G.char.boats) { // your boats: a little hull pointing the way it lies
    const x = X(nearX(b.x, px)), y = Z(b.z), fx = Math.sin(b.yaw), fz = Math.cos(b.yaw), l = Math.max(4, 2.1 * ppm), w = Math.max(2, 0.75 * ppm);
    ctx.strokeStyle = '#e8fff0'; ctx.lineWidth = 1.5; ctx.beginPath();
    ctx.moveTo(x + fx * l, y + fz * l); ctx.lineTo(x - fx * l + fz * w, y - fz * l - fx * w); ctx.lineTo(x - fx * l - fz * w, y - fz * l + fx * w); ctx.closePath(); ctx.stroke();
  }
  for (const c of G.char.claims) { // your flags: a pole and a pennant, the claimed land round them
    const x = X(nearX(c.x, px)), y = Z(c.z);
    ctx.strokeStyle = ctx.fillStyle = '#c4ffd2'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(x, y, Math.max(4, 30 * ppm), 0, 6.283); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y + 5); ctx.lineTo(x, y - 8); ctx.lineTo(x + 7, y - 5); ctx.lineTo(x, y - 2); ctx.stroke(); ctx.lineWidth = 1;
    if (labels) ctx.fillText(tl('Your flag'), x, y - 12);
  }
  for (const [x0, z0, r, name] of Object.values(G.char.fogs)) { // toxic fog you have found: a dashed lime ring
    const x = X(nearX(x0, px)), y = Z(z0), rr = Math.max(5, r * ppm);
    if (x < -rr || y < -rr || x > w + rr || y > h + rr) continue;
    ctx.strokeStyle = ctx.fillStyle = '#b6ff3a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
    if (labels) ctx.fillText(name + tl(' (toxic fog)'), x, y - rr - 6);
  }
  for (const c of citySites(OW.terrain!.world)) { // the dead cities, once you have seen them: an outline and the name
    const x = X(nearX(c.x, px)), y = Z(c.z), rr = Math.max(6, c.r * ppm);
    if (x < -rr || y < -rr || x > w + rr || y > h + rr) continue;
    const seen = Math.hypot(wrapDx(c.x - px), c.z - pz) < c.r + CITY.fade || [0, 0.5, 0.9].some((k) => [0, 1, 2, 3, 4, 5, 6, 7].some((a) => isDiscovered(d, Math.floor((c.x + Math.cos(a * 0.785) * c.r * k) / CHUNK), Math.floor((c.z + Math.sin(a * 0.785) * c.r * k) / CHUNK))));
    if (!seen) continue;
    ctx.strokeStyle = ctx.fillStyle = '#9ad8a8'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (labels) ctx.fillText(tl('Ruins of ') + c.name, x, y - rr - 6);
  }
  for (const ins of installSitesReady(OW.terrain!.world) ?? []) { // the great installations, once their ground is explored: a lime hexagon
    if (!isDiscovered(d, Math.floor(ins.x / CHUNK), Math.floor(ins.z / CHUNK))) continue;
    const x = X(nearX(ins.x, px)), y = Z(ins.z), r = labels ? 10 : 5;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    ctx.strokeStyle = ctx.fillStyle = '#b6ff3a'; ctx.lineWidth = 2; ctx.beginPath();
    for (let k = 0; k <= 6; k++) { const a = k / 6 * 6.283; if (k) ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); else ctx.moveTo(x + r, y); }
    ctx.stroke(); ctx.lineWidth = 1;
    if (labels) ctx.fillText(ins.name, x, y - 15);
  }
  for (const [x0, z0, k, name, seen] of Object.values(G.char.lodes)) { // (0.182) deposits on your map: a square in the deposit's colour, dashed while only heard of
    const x = X(nearX(x0, px)), y = Z(z0), r = labels ? 6 : 3.5;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    ctx.strokeStyle = ctx.fillStyle = '#' + (LODES[k as LodeKind]?.c ?? 0xffffff).toString(16).padStart(6, '0'); ctx.lineWidth = 2;
    if (!seen) ctx.setLineDash([3, 2]);
    ctx.beginPath(); ctx.rect(x - r, y - r, 2 * r, 2 * r); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (seen) { ctx.globalAlpha = 0.35; ctx.fill(); ctx.globalAlpha = 1; }
    if (labels && ppm > 0.05) ctx.fillText(name + (seen ? '' : tl(' (heard of)')), x, y - 10);
  }
  for (const o of Object.values(G.char.outposts)) { // (0.184) the reach of every power source: a dashed pale ring
    if (!o?.k || !o.done?.power || !o.pk) continue;
    const x = X(nearX(o.x, px)), y = Z(o.z), rr = POWER_SRC[o.pk].r * ppm;
    if (x < -rr || y < -rr || x > w + rr || y > h + rr) continue;
    ctx.strokeStyle = '#9dffe0'; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
  }
  for (const o of Object.values(G.char.outposts)) { // (0.187) convoy routes: a dashed gold line to the village, the truck a dot
    const r = o?.route;
    if (!r) continue;
    const ax = X(nearX(o.x, px)), ay = Z(o.z), bx = X(nearX(r.vx, nearX(o.x, px))), by = Z(r.vz);
    ctx.strokeStyle = '#ffd060'; ctx.globalAlpha = 0.6; ctx.setLineDash([6, 5]); ctx.beginPath();
    if (r.way) wayLine(ctx, r.way.pts, px, X, Z); else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); } // (0.283) along its road
    ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const at = truckAt(o, r, G.char.time, px);
    if (at) { ctx.fillStyle = wrecked(r) ? '#ff6a4a' : '#ffd060'; ctx.fillRect(X(at[0]) - 3, Z(at[1]) - 3, 6, 6); }
  }
  for (const [id, o] of Object.entries(G.char.outposts)) { // (0.217) cargo lines between ports: a dashed teal line, the ship a dot
    const l = o?.line;
    if (!l) continue;
    const ax = X(nearX(o.x, px)), ay = Z(o.z), bx = X(nearX(l.tx, nearX(o.x, px))), by = Z(l.tz);
    ctx.strokeStyle = '#2ac8b0'; ctx.globalAlpha = 0.7; ctx.setLineDash([6, 5]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const p = l.ship ? shipPos(G.char.world, G.char.outposts, id, G.char.time) : null;
    if (p !== null) { ctx.fillStyle = '#2ac8b0'; ctx.fillRect(ax + (bx - ax) * p - 3, ay + (by - ay) * p - 3, 6, 6); }
  }
  for (const o of Object.values(G.char.outposts)) { // (0.219) power lines: a pale yellow line to the village (dashed while going up)
    const l = o?.pl;
    if (!l || !(o.done?.pline || o.job?.p === 'pline')) continue;
    const ax = X(nearX(o.x, px)), ay = Z(o.z), bx = X(nearX(l.x, nearX(o.x, px))), by = Z(l.z);
    ctx.strokeStyle = '#e8e070'; ctx.globalAlpha = o.done?.pline ? 0.85 : 0.45; ctx.lineWidth = o.done?.pline ? 2 : 1; if (!o.done?.pline) ctx.setLineDash([3, 4]);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1; ctx.lineWidth = 1;
  }
  { // (0.254) air lines between drone pads: a dotted pale blue line, the drone a dot
    const all = hubs(G.char.world, G.char.towns, G.char.outposts), byId = new Map(all.map((q) => [q.id, q]));
    for (const [home, l] of allAirLines(G.char.towns, G.char.outposts)) {
      const hb = byId.get(home);
      if (!hb) continue;
      const ax = X(nearX(hb.x, px)), ay = Z(hb.z), bx = X(nearX(l.tx, nearX(hb.x, px))), by = Z(l.tz);
      ctx.strokeStyle = '#9fd8ff'; ctx.globalAlpha = 0.75; ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const at = l.drone ? droneMapAt(hb, byId.get(l.to), l, G.char.time, px) : null;
      if (at) { ctx.fillStyle = '#9fd8ff'; ctx.fillRect(X(at[0]) - 2, Z(at[1]) - 2, 4, 4); }
    }
  }
  for (const [x, z, yaw] of [...airshipsForMap(), ...skyShipsForMap()]) { // (0.256) the airships: a pale blue cigar along their heading
    const ax = X(nearX(x, px)), ay = Z(z), fx = Math.sin(yaw), fz = Math.cos(yaw);
    ctx.strokeStyle = '#c4ffd2'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(ax - fx * 5, ay - fz * 5); ctx.lineTo(ax + fx * 5, ay + fz * 5); ctx.stroke(); ctx.lineWidth = 1;
  }
  for (const [x, z, yaw] of coptersForMap()) { // (0.259) the rotorcrafts: a small pale cross along their heading
    const ax = X(nearX(x, px)), ay = Z(z), fx = Math.sin(yaw), fz = Math.cos(yaw);
    ctx.strokeStyle = '#c4ffd2'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(ax - fx * 4, ay - fz * 4); ctx.lineTo(ax + fx * 4, ay + fz * 4); ctx.moveTo(ax - fz * 3, ay + fx * 3); ctx.lineTo(ax + fz * 3, ay - fx * 3); ctx.stroke(); ctx.lineWidth = 1;
  }
  { // (0.258) airship lines between warehouses with masts: a dashed pale green line
    const all = hubs(G.char.world, G.char.towns, G.char.outposts), byId = new Map(all.map((q) => [q.id, q]));
    for (const [home, l] of allSkyLines(G.char.towns, G.char.outposts)) {
      const hb = byId.get(home);
      if (!hb) continue;
      const ax = X(nearX(hb.x, px)), ay = Z(hb.z), bx = X(nearX(l.tx, nearX(hb.x, px))), by = Z(l.tz);
      ctx.strokeStyle = '#c4ffd2'; ctx.globalAlpha = 0.6; ctx.setLineDash([8, 4]); ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
  }
  { // (0.252) convoy lines between warehouses: a dashed amber line, the truck a dot
    const all = hubs(G.char.world, G.char.towns, G.char.outposts), byId = new Map(all.map((q) => [q.id, q]));
    for (const [home, l] of allHubLines(G.char.towns, G.char.outposts)) {
      const hb = byId.get(home);
      if (!hb) continue;
      const ax = X(nearX(hb.x, px)), ay = Z(hb.z), bx = X(nearX(l.tx, nearX(hb.x, px))), by = Z(l.tz);
      ctx.strokeStyle = '#ffb347'; ctx.globalAlpha = 0.7; ctx.setLineDash([6, 5]); ctx.beginPath();
      if (l.way) wayLine(ctx, l.way.pts, px, X, Z); else { ctx.moveTo(ax, ay); ctx.lineTo(bx, by); }
      ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      const at = hubTruckAt(hb, l, G.char.time, px);
      if (at) { ctx.fillStyle = hlWrecked(l) ? '#ff6a4a' : '#ffb347'; ctx.fillRect(X(at[0]) - 3, Z(at[1]) - 3, 6, 6); }
    }
  }
  for (const hb of hubs(G.char.world, G.char.towns, G.char.outposts)) { // (0.249) the warehouses' areas: a dashed hex, the name at its top
    const cs = hexCorners(parseHex(hb.hex), px).map(([x, z]) => [X(x), Z(z)] as const);
    if (cs.every(([x]) => x < -20) || cs.every(([x]) => x > w + 20) || cs.every(([, y]) => y < -20) || cs.every(([, y]) => y > h + 20)) continue;
    ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.globalAlpha = hb.kind === 'village' ? 0.3 : 0.55; ctx.setLineDash([5, 6]);
    ctx.beginPath(); cs.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    if (labels) { const [hx, hz] = hexCorners(parseHex(hb.hex), px).reduce((a, [x, z]) => [a[0] + x / 6, a[1] + z / 6], [0, 0]); ctx.globalAlpha = 0.8; ctx.fillText(hb.name, X(hx), Z(hz) - HEX.r * ppm * 0.78); }
    ctx.globalAlpha = 1;
  }
  for (const o of Object.values(G.char.outposts)) { // (0.183) the outposts (shared): a gold ring round the deposit
    if (!o?.k) continue;
    const x = X(nearX(o.x, px)), y = Z(o.z), r = labels ? 11 : 6;
    if (x < -20 || y < -20 || x > w + 20 || y > h + 20) continue;
    const theirs = !mayUse(o, myOwner()); // (0.189) a rival's outpost: rust, with its owner's name
    ctx.strokeStyle = ctx.fillStyle = theirs ? '#d0805a' : '#ffd060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283); ctx.stroke(); ctx.lineWidth = 1;
    if (theirs && labels) ctx.fillText(TL`${ownerName(o.o)}'s`, x, y - r - 6);
    if (o.life?.v) { ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 6.283); ctx.stroke(); } // (0.185) a hamlet: a double ring
    if (labels) ctx.fillText(o.life?.v ? TL`Hamlet · ${Math.floor(o.life.n)} people` : (o.k === 'port' || o.k === 'store' || o.k === 'camp' ? o.name : tl('Outpost') + (o.done?.dig ? '' : ' (building)')) + (o.life && o.life.n >= 1 ? ` · ${Math.floor(o.life.n)} people` : ''), x, y + r + 16);
  }
  for (const m of leadMarkers()) { // leads: a violet diamond for a data carrier, a lime one for a great installation (held at the edge of the big map when further)
    let x = X(m.x), y = Z(m.z); const r = labels ? 9 : 5, out = x < 24 || y < 40 || x > w - 24 || y > h - 40;
    if (out && !labels) continue;
    if (out) { x = Math.max(24, Math.min(w - 24, x)); y = Math.max(40, Math.min(h - 40, y)); }
    ctx.strokeStyle = ctx.fillStyle = m.c; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); ctx.stroke(); ctx.lineWidth = 1;
    if (labels) { const t = m.label + (out ? ` ${(Math.hypot(m.x - px, m.z - pz) / 1000).toFixed(1)} km` : ''), hw2 = ctx.measureText(t).width / 2 + 6; ctx.fillText(t, Math.max(hw2, Math.min(w - hw2, x)), y - 14); } // kept whole on the screen
  }
  for (const m of questMarkers()) {
    const x = X(m.x), y = Z(m.z);
    ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, labels ? 12 : 6, 0, 6.283); ctx.stroke(); ctx.lineWidth = 1;
    ctx.fillText('!', x, y + 4); if (labels) ctx.fillText(m.label, x, y - 16);
  }
  if (route) { // (D3) the planned route by road: a dashed pale blue line
    ctx.strokeStyle = WAYPOINT_C; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.beginPath();
    route.pts.forEach(([x0, z0], i) => { const x = X(nearX(x0, px)), y = Z(z0); if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
  }
  const wp = G.char.waypoint;
  if (wp) { // the GPS Tablet's waypoint: a pale blue cross in a ring, held at the edge of the big map when further
    let x = X(nearX(wp[0], px)), y = Z(wp[1]); const out = x < 24 || y < 40 || x > w - 24 || y > h - 40, r = labels ? 10 : 5;
    if (!out || labels) {
      if (out) { x = Math.max(24, Math.min(w - 24, x)); y = Math.max(40, Math.min(h - 40, y)); }
      ctx.strokeStyle = ctx.fillStyle = WAYPOINT_C; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
      ctx.moveTo(x - r - 4, y); ctx.lineTo(x + r + 4, y); ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y + r + 4); ctx.stroke(); ctx.lineWidth = 1;
      if (labels) ctx.fillText(TL`Waypoint ${(Math.hypot(wrapDx(wp[0] - px), wp[1] - pz) / 1000).toFixed(1)} km`, x, y - r - 8);
    }
  }
  // on the big map: every caravan on the roads between villages you know (from the timetables), as an arrow
  if (labels && vehiclesOpen(G.char)) { // (0.202) no convoys before the mechanic comes
    let budget = 2; // new roads worked out per frame, so zooming far out does not stall the game
    const world = OW.terrain!.world, r = Math.max(hw, hh) + 2000, known = (v: { x: number; z: number }) => isDiscovered(d, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK));
    for (const e of network(world)) {
      if (!known(e.a) && !known(e.b)) continue;
      if (Math.min(Math.hypot(wrapDx(e.a.x - px), e.a.z - pz), Math.hypot(wrapDx(e.b.x - px), e.b.z - pz)) > r + 8000) continue;
      if (!pathKnown(world, e) && budget-- <= 0) continue;
      for (const c of onRoad(world, e, G.char.time)) {
        if (plundered(c.id) || dryCaravan(c)) continue;
        const p = caravanPos(world, e, c, G.char.time);
        if (!p) continue;
        const x = X(nearX(p.x, px)), y = Z(p.z);
        if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
        ctx.save(); ctx.translate(x, y); ctx.rotate(-p.yaw); ctx.fillStyle = G.char.escort?.id === c.id ? '#ffd060' : '#c8e0ff';
        ctx.beginPath(); ctx.moveTo(0, 6); ctx.lineTo(-4, -4); ctx.lineTo(4, -4); ctx.closePath(); ctx.fill(); ctx.restore();
      }
    }
  }
  // caravans on the roads near you: pale wagons (gold: the one you guard, red rim: under attack)
  for (const c of mapWagons()) {
    const x = X(nearX(c.x, px)), y = Z(c.z), l = Math.max(3, 3 * ppm), w = Math.max(2, 1.3 * ppm);
    ctx.save(); ctx.translate(x, y); ctx.rotate(-c.yaw); ctx.strokeStyle = c.mine ? '#ffd060' : '#c8e0ff'; ctx.lineWidth = 1.5; ctx.strokeRect(-w, -l, w * 2, l * 2);
    if (c.raided) { ctx.strokeStyle = '#ff6a4a'; ctx.strokeRect(-w - 2, -l - 2, w * 2 + 4, l * 2 + 4); }
    ctx.restore(); ctx.lineWidth = 1;
  }
  for (const r of raiders) { ctx.fillStyle = '#ff6a4a'; ctx.fillRect(X(r.p.x) - 3, Z(r.p.z) - 3, 6, 6); }
  for (const b of W.bandits) { if (b.state === 'idle') continue; ctx.fillStyle = '#ff6a4a'; ctx.fillRect(X(b.p.x) - 2, Z(b.p.z) - 2, 4, 4); }
  for (const c of W.creatures) { if (c.state === 'roam') continue; ctx.fillStyle = '#ff9a3c'; ctx.fillRect(X(c.p.x) - 2, Z(c.p.z) - 2, 4, 4); }
  for (const t of W.drones) { if (!t.chasing) continue; ctx.fillStyle = '#ffb347'; ctx.fillRect(X(t.p.x) - 1.5, Z(t.p.z) - 1.5, 3, 3); }
  drawPlayerArrow(ctx, w / 2, h / 2);
}

/** (0.283) A convoy's way by road as a path on the map. */
function wayLine(ctx: CanvasRenderingContext2D, pts: [number, number][], px: number, X: (x: number) => number, Z: (z: number) => number) {
  wayNear(pts, px).forEach(([x, z], i) => (i ? ctx.lineTo(X(x), Z(z)) : ctx.moveTo(X(x), Z(z))));
}
export function drawWorldMini(ctx: CanvasRenderingContext2D, size: number) {
  explore();
  drawArea(ctx, size, size, 1, false);
  if (G.mapOpen) drawFullMap();
}

// ---------- full-screen world map ----------
const big = $<HTMLCanvasElement>('worldmap'), bctx = big.getContext('2d')!;
let zoom = 0.6;
/** The glove computer is a GPS once the satellites answer (document 04 stage D); in an old world the GPS Tablet is. */
export const gpsOn = () => hasItem('tablet') || satelliteUp(G.char.towns[GRIDHOLM_ID]);
/** The last orbital scan you saw (drawn as a ring on the map for a while). */
let lastScan: { x: number; z: number; t: number; r: number } | null = null;
const hrs = (m: number) => { const t = Math.ceil(m); return t >= 60 ? `${Math.floor(t / 60)} h${t % 60 ? ' ' + (t % 60) + ' min' : ''}` : `${t} min`; };
/**
 * Ask the passing satellite to look round your waypoint (or round you, with none): every place within ORBIT.r goes on
 * your map, with the old installations and the toxic fog there. One scan a pass for the whole world.
 */
/** Where a scan would look now (the waypoint or you), and the relay mast whose pass it would use (null: the world's). */
function scanPlan() {
  const c = G.char, [x, z] = c.waypoint ? [nearX(c.waypoint[0], G.pos.x), c.waypoint[1]] : [G.pos.x, G.pos.z];
  let relay: { id: number; name: string } | null = null, bd = RELAY.reach;
  for (const v of allVillages(c.world)) { const d = Math.hypot(wrapDx(v.x - x), v.z - z); if (d < bd && hasRelay(c.towns[v.id])) { bd = d; relay = { id: v.id, name: v.name }; } }
  const at = relay ? c.towns[relay.id] : c.towns[GRIDHOLM_ID];
  return { x, z, relay, at, r: relay ? RELAY.r : ORBIT.r, wait: scanWait(at, c.time) };
}
export function orbitalScan(): string {
  const c = G.char, home = c.towns[GRIDHOLM_ID];
  if (!satelliteUp(home)) return tl('No satellite link.');
  const { x, z, relay, at, r: R, wait } = scanPlan();
  if (wait > 0) return TL`No satellite overhead${relay ? TL` of the ${relay.name} relay` : ''}: the next pass in ${hrs(wait)}.`;
  let n = 0;
  const see = (px: number, pz: number) => { if (discover(c.discovered, Math.floor(px / CHUNK), Math.floor(pz / CHUNK))) n++; };
  for (const p of poisNear(c.world, x, z, R)) if (Math.hypot(wrapDx(p.x - x), p.z - z) <= R) see(p.x, p.z);
  for (const s of OW.terrain ? installSitesReady(OW.terrain.world) ?? [] : []) if (Math.hypot(wrapDx(s.x - x), s.z - z) <= R) see(s.x, s.z);
  let f = 0;
  const lodes = scanLodes(x, z, R);
  for (const z0 of fogsNear(c.world, x, z, R)) if (!c.fogs[z0.id]) { c.fogs[z0.id] = [Math.round(z0.x), Math.round(z0.z), Math.round(z0.r), z0.name]; f++; }
  (at!.settlement!).scanAt = c.time; lastScan = { x, z, t: c.time, r: R };
  saveChar();
  const msg = TL`Orbital scan ${c.waypoint ? tl('round your waypoint') : tl('round you')}${relay ? TL` through the ${relay.name} relay` : ''}: ${n} new place${n === 1 ? '' : 's'} within ${R / 1000} km${f ? TL` and ${f} toxic fog zone${f === 1 ? '' : 's'}` : ''}${lodes ? `, ${lodes} deposit${lodes === 1 ? '' : 's'}` : ''} on your map.`;
  showToast(tl('Orbital scan complete')); logLine(msg);
  return msg;
}
/** (D3) The planned route by road: its polyline (world coordinates) and where it leads; runtime only, yours alone. */
export let route: { pts: [number, number][]; to: string } | null = null;
/** R on the satellite map: plan a route by road from the village nearest you to the one nearest your waypoint (again: clear it). */
export function toggleRoute(): string {
  if (route) { route = null; return tl('Route cleared.'); }
  if (!gpsOn()) return tl('No GPS: the glove needs the satellite link.');
  const wp = G.char.waypoint;
  if (!wp) return tl('Set a waypoint first (right click on the map).');
  const r = planRoute(G.char.world, G.pos.x, G.pos.z, nearX(wp[0], G.pos.x), wp[1]);
  if (!r) { showToast(tl('No road leads there')); return tl('No road leads there.'); }
  let len = 0; for (let i = 1; i < r.pts.length; i++) len += Math.hypot(r.pts[i][0] - r.pts[i - 1][0], r.pts[i][1] - r.pts[i - 1][1]);
  route = { pts: r.pts, to: r.via[r.via.length - 1].name };
  const msg = TL`Route by road: ${(len / 1000).toFixed(1)} km through ${r.via.map((v) => v.name).join(' → ')}.`;
  showToast(tl('Route planned')); logLine(msg);
  return msg;
}
/** The point of the route about `ahead` m past the nearest point to you, for the compass (null: no route, or you have arrived). */
export function routeAhead(ahead = 120): [number, number] | null {
  if (!route) return null;
  const P = route.pts, px = G.pos.x, pz = G.pos.z, end = P[P.length - 1];
  if (Math.hypot(wrapDx(end[0] - px), end[1] - pz) < 60) { route = null; logLine(tl('You have arrived at the end of your route.')); return null; }
  let bi = 0, bt = 0, bd = Infinity;
  for (let i = 1; i < P.length; i++) {
    const ax = P[i - 1][0], az = P[i - 1][1], ex = P[i][0] - ax, ez = P[i][1] - az, L = ex * ex + ez * ez || 1;
    const t = Math.max(0, Math.min(1, ((nearX(px, ax) - ax) * ex + (pz - az) * ez) / L)), d = Math.hypot(nearX(px, ax) - ax - ex * t, pz - az - ez * t);
    if (d < bd) { bd = d; bi = i; bt = t; }
  }
  let left = ahead, i = bi, x = P[bi - 1][0] + (P[bi][0] - P[bi - 1][0]) * bt, z = P[bi - 1][1] + (P[bi][1] - P[bi - 1][1]) * bt;
  while (i < P.length) { const sx = P[i][0] - x, sz = P[i][1] - z, L = Math.hypot(sx, sz); if (L >= left) return [x + sx / L * left, z + sz / L * left]; left -= L; x = P[i][0]; z = P[i][1]; i++; }
  return end;
}
/** (0.283, PLAN_DROG.md D4) A track planned on the GPS map: T by the waypoint picks the start, then the end (the
 *  surveyors lay out the way), then T again stakes it out. Yours alone until it is staked. */
let plan: { a: RoadEnd; b?: RoadEnd; pts?: [number, number][] | null; why?: string } | null = null;
export function planTrack(): string {
  const c = G.char, say = (m: string) => { logLine(m); return m; };
  if (!gpsOn() || mapLocked()) return say(tl('No GPS: without the satellite link a track is staked out on foot with the Surveyor\'s Poles, stake by stake.'));
  if (!hasItem('roadkit')) return say(tl('You need the Surveyor\'s Poles with you to plan a track.'));
  if (plan?.pts && !plan.why) {
    if (stakePlanned(plan.a, plan.b!, plan.pts)) { plan = null; return tl('Track staked out.'); }
    return '';
  }
  const wp = c.waypoint;
  if (!wp) return say(tl('Set a waypoint (right click) by a village gate, an outpost, a warehouse or a road, then press T.'));
  const x = nearX(wp[0], G.pos.x), z = wp[1];
  if (!plan || plan.pts !== undefined) {
    const a = anchorAt(x, z, 160);
    if (!a) return say(tl('No gate, outpost, warehouse or road by the waypoint: move it nearer one.'));
    plan = { a };
    return say(TL`The track starts at ${endWord(a)}. Now set the waypoint at the other end and press T.`);
  }
  const b = anchorAt(x, z, 160, plan.a.id);
  if (!b) return say(tl('No gate, outpost, warehouse or road by the waypoint: move it nearer one.'));
  const r = planWay(plan.a, b);
  plan = { a: plan.a, b, pts: r.pts, why: r.why };
  if (!r.pts) { plan = { a: plan.a }; return say(r.why); }
  const len = roadLength(r.pts);
  if (r.why) return say(r.why);
  return say(TL`The surveyors lay out ${(len / 1000).toFixed(2)} km to ${endWord(b)}: ${costShort(len)}. T again stakes it out, Backspace drops the plan.`);
}
export function dropPlan() { if (plan) { plan = null; logLine(tl('The plan is dropped.')); } }
function drawPlan(w: number, h: number) {
  if (!plan) return;
  const X = (x: number) => w / 2 + (nearX(x, G.pos.x) - G.pos.x) * zoom, Z = (z: number) => h / 2 + (z - G.pos.z) * zoom;
  bctx.strokeStyle = plan.why ? '#ff5a3c' : '#ffd060'; bctx.lineWidth = 2;
  if (plan.pts) { bctx.setLineDash([6, 4]); bctx.beginPath(); const sx = nearX(plan.pts[0][0], G.pos.x) - plan.pts[0][0]; plan.pts.forEach(([x, z], i) => (i ? bctx.lineTo(X(x + sx), Z(z)) : bctx.moveTo(X(x + sx), Z(z)))); bctx.stroke(); bctx.setLineDash([]); }
  for (const e of [plan.a, plan.b]) if (e) { bctx.beginPath(); bctx.arc(X(e.x), Z(e.z), 6, 0, 6.283); bctx.stroke(); }
  bctx.lineWidth = 1;
  bctx.fillStyle = '#ffd060'; bctx.textAlign = 'center';
  const txt = plan.pts ? (plan.why ? plan.why : TL`Planned track: ${(roadLength(plan.pts) / 1000).toFixed(2)} km · ${costShort(roadLength(plan.pts))} · T — stake it out · Backspace — drop`) : TL`Track from ${endWord(plan.a)}: set the waypoint at the other end, T`;
  bctx.fillText(txt, w / 2, 58);
  bctx.textAlign = 'left';
}
/** The glove computer's satellite map waits for the start village's station in a new world (document 04). */
export const mapLocked = () => { const s = G.char.towns[GRIDHOLM_ID]; return isStation(s) && !projectDone(s, 'comms'); };
function drawFullMap() {
  const w = innerWidth, h = innerHeight;
  if (big.width !== w || big.height !== h) { big.width = w; big.height = h; }
  if (mapLocked()) { // the glove's screen: no uplink
    bctx.fillStyle = '#010d04'; bctx.fillRect(0, 0, w, h);
    bctx.strokeStyle = '#2fe06055'; for (let y = 0; y < h; y += 4) { bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(w, y); bctx.stroke(); }
    bctx.textAlign = 'center'; bctx.fillStyle = '#3dff6e'; bctx.font = '30px VT323, monospace';
    bctx.fillText(tl('GLOVE COMPUTER · SATELLITE MAP'), w / 2, h / 2 - 60);
    bctx.fillStyle = (Date.now() >> 9) % 2 ? '#ff6a4a' : '#ffb347'; bctx.font = '44px VT323, monospace'; bctx.fillText(tl('NO SATELLITE LINK'), w / 2, h / 2);
    bctx.fillStyle = '#9dffb4'; bctx.font = '22px VT323, monospace';
    bctx.fillText(tl('No ground station answers. Restore the radar and communications station near Gridholm'), w / 2, h / 2 + 50);
    bctx.fillText(tl('(ask the elder) and the satellites still circling the planet will feed this map.'), w / 2, h / 2 + 78);
    bctx.fillStyle = '#3dff6e'; bctx.fillText(tl('M or Esc to close · the minimap still shows what your glove sees around you'), w / 2, h - 20);
    return;
  }
  drawArea(bctx, w, h, zoom, true);
  drawPlan(w, h);
  bctx.fillStyle = '#3dff6e'; bctx.font = '22px VT323, monospace'; bctx.textAlign = 'left';
  const sat = satelliteUp(G.char.towns[GRIDHOLM_ID]);
  bctx.fillText((sat ? tl('SATELLITE MAP') : tl('WORLD MAP')) + tl(' — M or Esc to close · wheel / + - to zoom') + (gpsOn() ? tl(' · right click: set / clear the GPS waypoint') : ''), 16, h - 16);
  if (sat) { // the satellites: orbital scans and the weather they see
    const sp = scanPlan(), wait = sp.wait, now = weatherAt(G.char.world, G.pos.x, G.pos.z, G.char.time), later = weatherAt(G.char.world, G.pos.x, G.pos.z, G.char.time + 240);
    bctx.fillText(`O: orbital scan ${G.char.waypoint ? tl('round the waypoint') : tl('round you')} (${sp.r / 1000} km${sp.relay ? ', ' + sp.relay.name + ' relay' : ''}) · ${wait > 0 ? tl('next pass in ') + hrs(wait) : tl('a satellite is overhead')} · R: ${route ? tl('clear the route') + (route ? tl(' to ') + route.to : '') : tl('route by road to the waypoint')}`, 16, h - 42);
    bctx.fillText(TL`Sky where you stand: ${now.kind} now, ${later.kind} in 4 h`, 16, h - 68);
    if (hasItem('roadkit')) bctx.fillText(tl('T: plan a track from the waypoint (the Surveyor\'s Poles)'), 16, 84);
    if (lastScan && G.char.time - lastScan.t < 120) { // the scanned ring, for two game hours
      const sx = w / 2 + (nearX(lastScan.x, G.pos.x) - G.pos.x) * zoom, sy = h / 2 + (lastScan.z - G.pos.z) * zoom;
      bctx.strokeStyle = '#5cc8ff'; bctx.setLineDash([8, 6]); bctx.beginPath(); bctx.arc(sx, sy, lastScan.r * zoom, 0, Math.PI * 2); bctx.stroke(); bctx.setLineDash([]);
    }
  }
  { // (0.231) the biome layer
    const b = biomeAt(G.char.world, G.pos.x, G.pos.z);
    bctx.fillText((biomeLayer ? TL`B: biome layer on · the land where you stand: ${tl(biomeName(b))}` : TL`B: biome layer off · the land where you stand: ${tl(biomeName(b))}`), 16, h - (sat ? (townsWorld(G.char.world) ? 120 : 94) : townsWorld(G.char.world) ? 68 : 42));
    if (biomeLayer) biomeKey(bctx, w);
    bctx.textAlign = 'left';
  }
  if (townsWorld(G.char.world)) { // (0.182) the fertility layer
    const f = fertility(G.char.world, G.pos.x, G.pos.z);
    bctx.fillText(`F: fertility layer ${fertLayer ? 'on' : 'off'} · the soil where you stand: ${fertilityWord(f)}${f > 0 ? ` (${Math.round(f * 100)}%)` : ''}`, 16, h - (sat ? 94 : 42));
  }
  bctx.textAlign = 'right'; bctx.fillText(villageHere(G.pos.x, G.pos.z)?.name ?? $('hudL').textContent ?? '', w - 16, 30);
}
export function toggleMap(open = !G.mapOpen) {
  if (G.char.loc !== 'overworld') open = false;
  G.mapOpen = open; big.style.display = open ? 'block' : 'none';
}
export const zoomMap = (f: number) => { zoom = Math.max(0.15, Math.min(4, zoom * f)); };
big.addEventListener('wheel', (e) => zoomMap(e.deltaY < 0 ? 1.2 : 1 / 1.2), { passive: true });
big.addEventListener('click', () => toggleMap(false));
/** The GPS Tablet: a right click on the big map sets a waypoint there (on the old one: clears it). */
big.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  if (!gpsOn()) return;
  const x = G.pos.x + (e.clientX - innerWidth / 2) / zoom, z = G.pos.z + (e.clientY - innerHeight / 2) / zoom, wp = G.char.waypoint;
  G.char.waypoint = wp && Math.hypot(nearX(wp[0], x) - x, wp[1] - z) * zoom < 14 ? null : [x, z];
  saveChar();
});
$('mini').addEventListener('click', () => toggleMap());
$('mini').addEventListener('touchstart', (e) => { e.preventDefault(); toggleMap(); }, { passive: false });
