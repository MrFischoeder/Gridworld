import { cityEntrances } from '../gen/citydungeons';
import { megalithsNear } from '../gen/megaliths';
import { gatesNear, gateName } from '../gen/worldgates';
// Surface maps: the minimap (150 m around the player) and the full world map (M), both built from
// explored chunks only (fog of war). Chunk tiles are rendered once from the deterministic terrain.
import { nearX, wrapDx } from '../gen/regions';
import { G, W } from '../game';
import { OW, villageHere } from '../world/overworld';
import { CHUNK, poisNear, villageSeed, GRIDHOLM_ID } from '../gen/regions';
import { isStation, projectDone } from '../gen/settlement';
import { wallPolygon, villageSides } from '../gen/village';
import { STEP, VERTS, CELLS, inRect } from '../gen/terrain';
import { SEA } from '../gen/seas';
import { discover, isDiscovered } from '../save';
import { installSitesReady } from '../gen/installs';
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

const tiles = new Map<string, HTMLCanvasElement>();
let tileWorld = -1;

function tile(cx: number, cz: number): HTMLCanvasElement {
  const T = OW.terrain!;
  if (tileWorld !== T.world) { tiles.clear(); tileWorld = T.world; }
  const k = cx + ',' + cz;
  let cv = tiles.get(k);
  if (cv) return cv;
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
    else if (f.lakes.length || f.rivers.length || h < SEA.level) { const w = T.water(x, z); if (w) [r, g, b] = w.kind === 'sea' ? [8, 60 - Math.min(30, w.depth), 130 - Math.min(60, w.depth * 1.5)] : w.kind === 'toxic' ? [110, 190, 20] : w.kind === 'murky' ? [70, 80, 30] : [15, 110, 100]; }
    const o = 4 * (i + CELLS * j); img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  tiles.set(k, cv);
  return cv;
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
  for (let cx = cx0; cx <= cx1; cx++) for (let cz = cz0; cz <= cz1; cz++) {
    if (!isDiscovered(d, cx, cz)) continue;
    ctx.drawImage(tile(cx, cz), X(cx * CHUNK), Z(cz * CHUNK), CHUNK * ppm + 0.5, CHUNK * ppm + 0.5);
  }
  ctx.font = (labels ? 20 : 11) + 'px VT323, monospace'; ctx.textAlign = 'center';
  for (const p of poisNear(OW.terrain!.world, px, pz, Math.max(hw, hh) + 60)) {
    if (!isDiscovered(d, Math.floor(p.x / CHUNK), Math.floor(p.z / CHUNK))) continue;
    const x = X(p.x), y = Z(p.z);
    if (p.type === 'camp') { ctx.strokeStyle = ctx.fillStyle = '#ff6a4a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 5, y + 4); ctx.lineTo(x, y - 5); ctx.lineTo(x + 5, y + 4); ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'wreck') { ctx.strokeStyle = ctx.fillStyle = '#5cc8ff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x + 7, y - 1); ctx.lineTo(x + 7, y + 1); ctx.lineTo(x - 3, y + 3); ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x - 5, y - 2); ctx.lineTo(x - 6, y - 6); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'hangar') { ctx.strokeStyle = ctx.fillStyle = '#9dffe0'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x - 7, y + 4); ctx.quadraticCurveTo(x, y - 8, x + 7, y + 4); ctx.closePath(); ctx.stroke(); if (labels) ctx.fillText(p.name, x, y - 12); continue; }
    if (p.type === 'village') { // the wall's own shape (gen/village.ts wallPolygon), at least a few pixels across
      ctx.strokeStyle = ctx.fillStyle = '#ffd060'; ctx.lineWidth = 2;
      const world = OW.terrain!.world, poly = wallPolygon(villageSides(villageSeed(world, p), p.id === GRIDHOLM_ID)), k = Math.max(6, 76 * ppm / 2) / 36.5;
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
      if (labels) ctx.fillText('Underground '+(e.n+1),x,y-13);
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
    if (labels) ctx.fillText('Your flag', x, y - 12);
  }
  for (const [x0, z0, r, name] of Object.values(G.char.fogs)) { // toxic fog you have found: a dashed lime ring
    const x = X(nearX(x0, px)), y = Z(z0), rr = Math.max(5, r * ppm);
    if (x < -rr || y < -rr || x > w + rr || y > h + rr) continue;
    ctx.strokeStyle = ctx.fillStyle = '#b6ff3a'; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    ctx.globalAlpha = 0.18; ctx.fill(); ctx.globalAlpha = 1;
    if (labels) ctx.fillText(name + ' (toxic fog)', x, y - rr - 6);
  }
  for (const c of citySites(OW.terrain!.world)) { // the dead cities, once you have seen them: an outline and the name
    const x = X(nearX(c.x, px)), y = Z(c.z), rr = Math.max(6, c.r * ppm);
    if (x < -rr || y < -rr || x > w + rr || y > h + rr) continue;
    const seen = Math.hypot(wrapDx(c.x - px), c.z - pz) < c.r + CITY.fade || [0, 0.5, 0.9].some((k) => [0, 1, 2, 3, 4, 5, 6, 7].some((a) => isDiscovered(d, Math.floor((c.x + Math.cos(a * 0.785) * c.r * k) / CHUNK), Math.floor((c.z + Math.sin(a * 0.785) * c.r * k) / CHUNK))));
    if (!seen) continue;
    ctx.strokeStyle = ctx.fillStyle = '#9ad8a8'; ctx.lineWidth = 1.5; ctx.setLineDash([6, 4]); ctx.beginPath(); ctx.arc(x, y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]); ctx.lineWidth = 1;
    if (labels) ctx.fillText('Ruins of ' + c.name, x, y - rr - 6);
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
  const wp = G.char.waypoint;
  if (wp) { // the GPS Tablet's waypoint: a pale blue cross in a ring, held at the edge of the big map when further
    let x = X(nearX(wp[0], px)), y = Z(wp[1]); const out = x < 24 || y < 40 || x > w - 24 || y > h - 40, r = labels ? 10 : 5;
    if (!out || labels) {
      if (out) { x = Math.max(24, Math.min(w - 24, x)); y = Math.max(40, Math.min(h - 40, y)); }
      ctx.strokeStyle = ctx.fillStyle = WAYPOINT_C; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r, 0, 6.283);
      ctx.moveTo(x - r - 4, y); ctx.lineTo(x + r + 4, y); ctx.moveTo(x, y - r - 4); ctx.lineTo(x, y + r + 4); ctx.stroke(); ctx.lineWidth = 1;
      if (labels) ctx.fillText(`Waypoint ${(Math.hypot(wrapDx(wp[0] - px), wp[1] - pz) / 1000).toFixed(1)} km`, x, y - r - 8);
    }
  }
  // on the big map: every caravan on the roads between villages you know (from the timetables), as an arrow
  if (labels) {
    let budget = 2; // new roads worked out per frame, so zooming far out does not stall the game
    const world = OW.terrain!.world, r = Math.max(hw, hh) + 2000, known = (v: { x: number; z: number }) => isDiscovered(d, Math.floor(v.x / CHUNK), Math.floor(v.z / CHUNK));
    for (const e of network(world)) {
      if (!known(e.a) && !known(e.b)) continue;
      if (Math.min(Math.hypot(wrapDx(e.a.x - px), e.a.z - pz), Math.hypot(wrapDx(e.b.x - px), e.b.z - pz)) > r + 8000) continue;
      if (!pathKnown(world, e) && budget-- <= 0) continue;
      for (const c of onRoad(world, e, G.char.time)) {
        if (plundered(c.id)) continue;
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

export function drawWorldMini(ctx: CanvasRenderingContext2D, size: number) {
  explore();
  drawArea(ctx, size, size, 1, false);
  if (G.mapOpen) drawFullMap();
}

// ---------- full-screen world map ----------
const big = $<HTMLCanvasElement>('worldmap'), bctx = big.getContext('2d')!;
let zoom = 0.6;
/** The glove computer's satellite map waits for the start village's station in a new world (document 04). */
export const mapLocked = () => { const s = G.char.towns[GRIDHOLM_ID]; return isStation(s) && !projectDone(s, 'comms'); };
function drawFullMap() {
  const w = innerWidth, h = innerHeight;
  if (big.width !== w || big.height !== h) { big.width = w; big.height = h; }
  if (mapLocked()) { // the glove's screen: no uplink
    bctx.fillStyle = '#010d04'; bctx.fillRect(0, 0, w, h);
    bctx.strokeStyle = '#2fe06055'; for (let y = 0; y < h; y += 4) { bctx.beginPath(); bctx.moveTo(0, y); bctx.lineTo(w, y); bctx.stroke(); }
    bctx.textAlign = 'center'; bctx.fillStyle = '#3dff6e'; bctx.font = '30px VT323, monospace';
    bctx.fillText('GLOVE COMPUTER · SATELLITE MAP', w / 2, h / 2 - 60);
    bctx.fillStyle = (Date.now() >> 9) % 2 ? '#ff6a4a' : '#ffb347'; bctx.font = '44px VT323, monospace'; bctx.fillText('NO SATELLITE LINK', w / 2, h / 2);
    bctx.fillStyle = '#9dffb4'; bctx.font = '22px VT323, monospace';
    bctx.fillText('No ground station answers. Restore the radar and communications station near Gridholm', w / 2, h / 2 + 50);
    bctx.fillText('(ask the elder) and the satellites still circling the planet will feed this map.', w / 2, h / 2 + 78);
    bctx.fillStyle = '#3dff6e'; bctx.fillText('M or Esc to close · the minimap still shows what your glove sees around you', w / 2, h - 20);
    return;
  }
  drawArea(bctx, w, h, zoom, true);
  bctx.fillStyle = '#3dff6e'; bctx.font = '22px VT323, monospace'; bctx.textAlign = 'left';
  bctx.fillText('WORLD MAP — M or Esc to close · wheel / + - to zoom' + (hasItem('tablet') ? ' · right click: set / clear the GPS waypoint' : ''), 16, h - 16);
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
  if (!hasItem('tablet')) return;
  const x = G.pos.x + (e.clientX - innerWidth / 2) / zoom, z = G.pos.z + (e.clientY - innerHeight / 2) / zoom, wp = G.char.waypoint;
  G.char.waypoint = wp && Math.hypot(nearX(wp[0], x) - x, wp[1] - z) * zoom < 14 ? null : [x, z];
  saveChar();
});
$('mini').addEventListener('click', () => toggleMap());
$('mini').addEventListener('touchstart', (e) => { e.preventDefault(); toggleMap(); }, { passive: false });
