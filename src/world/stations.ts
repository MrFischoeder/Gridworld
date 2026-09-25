// Power stations outside a village's fence (gen/energy.ts): a solar farm (rows of tilted panels and an inverter), a
// wind farm (three turbines whose rotors turn with the wind), a coal power station (boiler house, cooling tower,
// stack, coal heap and conveyor) and a diesel generator bank (containers, exhaust stacks, a fuel tank). A building
// site while one goes up, staked plots where there is room. A lamp on each glows while it makes power. E at one opens
// its window (ui/stations.ts): the output, and the bunker of a coal or diesel station.
import * as THREE from 'three';
import { G } from '../game';
import { PropBatch } from './props';
import { add } from './render';
import { findPoi } from '../gen/regions';
import { industryOf } from '../gen/industry';
import { isStation, specOf } from '../gen/plants';
import { STATIONS, STATION_SLOTS, stationSite, stationKw, fuelAt, windAt, type StationKind } from '../gen/energy';
import type { VillageMap } from '../gen/village';
import type { Terrain } from '../gen/terrain';

const METAL = 0xb8c4cc, PANEL = 0x5cc8ff, WOOD = 0xb8b060, CONC = 0x8fb89a, HOT = 0xffb347, WHITE = 0xe8fff0;
export interface Station { vid: number; seed: number; slot: number; town: string; x0: number; z0: number; x1: number; z1: number; lamp: THREE.Object3D | null; rotors: THREE.Object3D[] }
const placed = new Map<number, Station[]>();

function cyl(pb: PropBatch, x: number, y: number, z: number, r: number, h: number, c: number, n = 10, r2 = r) {
  const P = (i: number, yy: number, rr: number) => [x + Math.cos(i / n * 6.283) * rr, yy, z + Math.sin(i / n * 6.283) * rr];
  for (let i = 0; i < n; i++) {
    pb.face(P(i, y, r), P(i + 1, y, r), P(i + 1, y + h, r2), P(i, y + h, r2));
    pb.seg(c, P(i, y + h, r2), P(i + 1, y + h, r2)); pb.seg(c, P(i, y, r), P(i + 1, y, r)); if (i % 2 === 0) pb.seg(c, P(i, y, r), P(i, y + h, r2));
  }
}

/** Draw the power stations (built, being built, empty plots) of village vm. */
export function drawStations(vm: VillageMap, T: Terrain, id: number): THREE.Group {
  const grp = new THREE.Group(), pb = new PropBatch(), c = G.char, st = c.towns[id], poi = findPoi(c.world, id), list: Station[] = [];
  if (!poi) return grp;
  const ind = industryOf(c.world, poi, vm.seed), built = st?.stations ?? [];
  for (let slot = 0; slot < STATION_SLOTS; slot++) {
    const s = stationSite(vm.seed, ind, slot), cx = vm.ox + s.x, cz = vm.oz + s.z, [fx, fz] = s.face, rx = -fz, rz = fx;
    const along = s.side === 'S' ? s.w : s.d, out = s.side === 'S' ? s.d : s.w;
    const P = (u: number, v: number): [number, number] => [cx + rx * u + fx * v, cz + rz * u + fz * v];
    const H = (u: number, v: number) => { const [x, z] = P(u, v); return T.heightAt(x, z); };
    const box = (u: number, v: number, hu: number, hv: number, y0: number, y1: number, col: number) => {
      const [x, z] = P(u, v), ax = Math.abs(rx) * hu + Math.abs(fx) * hv, az = Math.abs(rz) * hu + Math.abs(fz) * hv;
      pb.box(x - ax, y0, z - az, x + ax, y1, z + az, col);
    };
    const [x0a, z0a] = P(-along / 2, -out / 2), [x1a, z1a] = P(along / 2, out / 2);
    const w: Station = { vid: id, seed: vm.seed, slot, town: vm.name, x0: Math.min(x0a, x1a), z0: Math.min(z0a, z1a), x1: Math.max(x0a, x1a), z1: Math.max(z0a, z1a), lamp: null, rotors: [] };
    const k: StationKind | undefined = built[slot]?.k;
    if (!k) {
      for (const [u, v] of [[-along / 2 + 1, -out / 2 + 1], [along / 2 - 1, -out / 2 + 1], [along / 2 - 1, out / 2 - 1], [-along / 2 + 1, out / 2 - 1]]) {
        const [x, z] = P(u, v), g = T.heightAt(x, z); pb.box(x - 0.06, g, z - 0.06, x + 0.06, g + 1.1, z + 0.06, WOOD); pb.seg(PANEL, [x, g + 1.1, z], [x + 0.3, g + 0.95, z]);
      }
      if (slot === built.length && st?.pbuild && isStation(st.pbuild.k)) { // the building site
        const g = H(0, 0);
        for (let u = -along / 2 + 2; u <= along / 2 - 2; u += 3) for (const v of [-out / 2 + 2, out / 2 - 2]) { const [x, z] = P(u, v); pb.box(x - 0.08, g, z - 0.08, x + 0.08, g + 5, z + 0.08, WOOD); }
        for (let i = 0; i < 4; i++) box(-along / 2 + 3 + i * 1.3, 0, 0.5, 0.8, g, g + 0.6 + (i % 2) * 0.4, i % 2 ? METAL : WOOD);
      }
      list.push(w); continue;
    }
    const g0 = H(0, 0);
    let lampAt: [number, number, number] = [cx, g0 + 3, cz];
    if (k === 'solarfarm') {
      for (let r = 0; r < 3; r++) for (let i = 0; i < 5; i++) {
        const u = -along / 2 + 2 + i * 2.9, v = -out / 2 + 2.5 + r * 3.3, g = H(u, v);
        const lo = (a: number) => { const [x, z] = P(u + a, v - 0.9); return [x, g + 0.7, z]; }, hi = (a: number) => { const [x, z] = P(u + a, v + 0.9); return [x, g + 1.9, z]; };
        const q = [lo(-1.3), lo(1.3), hi(1.3), hi(-1.3)];
        pb.face(...q); pb.line(PANEL, q[0], q[1], q[2], q[3], q[0]);
        for (const a of [-0.43, 0.43]) pb.seg(PANEL, lo(a), hi(a)); pb.seg(PANEL, [(q[0][0] + q[3][0]) / 2, (q[0][1] + q[3][1]) / 2, (q[0][2] + q[3][2]) / 2], [(q[1][0] + q[2][0]) / 2, (q[1][1] + q[2][1]) / 2, (q[1][2] + q[2][2]) / 2]);
        for (const a of [-1, 1]) { const [x, z] = P(u + a, v); pb.seg(METAL, [x, g, z], [x, g + 1.3, z]); }
      }
      box(along / 2 - 1.5, -out / 2 + 1.2, 0.8, 0.6, g0, g0 + 1.6, METAL);
      lampAt = [P(along / 2 - 1.5, -out / 2 + 0.5)[0], g0 + 1.4, P(along / 2 - 1.5, -out / 2 + 0.5)[1]];
    } else if (k === 'windfarm') {
      for (const u of [-5.5, 0, 5.5]) {
        const [x, z] = P(u, 1), g = T.heightAt(x, z), top = g + 15;
        cyl(pb, x, g, z, 0.55, 15, WHITE, 8, 0.28);
        const [nx, nz] = P(u, 1 - 1.2); pb.box(Math.min(x, nx) - 0.35, top - 0.35, Math.min(z, nz) - 0.35, Math.max(x, nx) + 0.35, top + 0.4, Math.max(z, nz) + 0.35, WHITE);
        const rotor = new PropBatch(), L = 6.5;
        for (let b = 0; b < 3; b++) { const a = b / 3 * Math.PI * 2, e = [Math.cos(a) * L, Math.sin(a) * L, 0], m = [Math.cos(a + 0.12) * L * 0.3, Math.sin(a + 0.12) * L * 0.3, 0]; rotor.line(WHITE, [0, 0, 0], m, e, [Math.cos(a - 0.05) * L * 0.3, Math.sin(a - 0.05) * L * 0.3, 0], [0, 0, 0]); }
        const r = rotor.build(), [hx, hz] = P(u, 1 - 1.6);
        r.position.set(hx, top, hz); r.rotation.y = Math.atan2(fx, fz); r.userData.spin = 0; grp.add(r); w.rotors.push(r);
      }
      box(-along / 2 + 1.5, -out / 2 + 1.2, 0.7, 0.6, g0, g0 + 1.4, METAL);
      lampAt = [P(-along / 2 + 1.5, -out / 2 + 0.5)[0], g0 + 1.2, P(-along / 2 + 1.5, -out / 2 + 0.5)[1]];
    } else if (k === 'coalplant') {
      box(-2.5, 0, 3.5, 3, g0 - 0.1, g0 + 5, CONC);
      { const [a, b] = P(-6, -3), [d, e] = P(1, 3); pb.gableRoof(Math.min(a, d), Math.min(b, e), Math.max(a, d), Math.max(b, e), g0 + 5, 1.2, CONC); }
      { const [x, z] = P(4.5, 1.5), g = T.heightAt(x, z); cyl(pb, x, g, z, 3, 5, CONC, 12, 2.1); cyl(pb, x, g + 5, z, 2.1, 3, CONC, 12, 2.5); }
      { const [x, z] = P(-5, 3.5), g = T.heightAt(x, z); cyl(pb, x, g, z, 0.6, 14, CONC, 8, 0.45); }
      { const [a, b] = P(3, -3.8), g = H(3, -3.8); pb.pyramid(a - 1.6, b - 1.2, a + 1.6, b + 1.2, g, 1.5, 0x8a9a4a); }
      { const [a, b] = P(3, -3.8), [d, e] = P(0.5, -1.5); pb.line(METAL, [a, H(3, -3.8) + 1.4, b], [d, g0 + 4, e]); pb.line(METAL, [a, H(3, -3.8) + 1.7, b], [d, g0 + 4.3, e]); }
      lampAt = [P(-5, 3.5)[0], H(-5, 3.5) + 14.6, P(-5, 3.5)[1]];
    } else {
      for (let i = 0; i < 4; i++) {
        const u = -along / 2 + 2.5 + i * 3.2; box(u, 1, 1.2, 2.6, H(u, 1) - 0.1, H(u, 1) + 2.6, METAL);
        for (let v = -1; v <= 3; v += 0.5) { const [a, b] = P(u - 1.21, v); pb.seg(CONC, [a, H(u, 1) + 0.6, b], [a, H(u, 1) + 2.1, b]); }
        const [sx, sz] = P(u + 0.5, 2.5); pb.box(sx - 0.12, H(u, 1) + 2.6, sz - 0.12, sx + 0.12, H(u, 1) + 4.2, sz + 0.12, METAL);
      }
      { const [x0, z0] = P(-along / 2 + 1.5, -4), [x1, z1] = P(along / 2 - 1.5, -4), g = H(0, -4); for (const t of [0, 1]) { const x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t; pb.seg(METAL, [x, g, z], [x, g + 1.9, z]); } pb.line(METAL, [x0, g + 1, z0], [x1, g + 1, z1]); pb.line(METAL, [x0, g + 1.9, z0], [x1, g + 1.9, z1]); }
      lampAt = [P(-along / 2 + 2.5, -1)[0], H(-along / 2 + 2.5, 1) + 2.8, P(-along / 2 + 2.5, -1)[1]];
    }
    const lb = new PropBatch(); lb.seg(HOT, [0, 0, 0], [0, 0.5, 0]); lb.seg(HOT, [-0.25, 0.25, 0], [0.25, 0.25, 0]); lb.seg(HOT, [0, 0.25, -0.25], [0, 0.25, 0.25]);
    const lamp = lb.build(); lamp.position.set(...lampAt); lamp.traverse((o) => { if ((o as THREE.LineSegments).material) (o as THREE.LineSegments).material = add(0x9dffe0); }); grp.add(lamp);
    w.lamp = lamp;
    list.push(w);
  }
  placed.set(id, list);
  grp.add(pb.build());
  return grp;
}
export function forgetStations(id: number) { placed.delete(id); }

let tick = 0;
/** Every frame: rotors turn with the wind; twice a second the lamps show whether a station makes power. */
export function updateStations(dt: number) {
  const now = G.char.time, lamps = (tick -= dt) <= 0;
  if (lamps) tick = 0.5;
  for (const list of placed.values()) for (const w of list) {
    const st = G.char.towns[w.vid]?.stations?.[w.slot];
    if (!st) continue;
    if (w.rotors.length) { const wind = st.on ? windAt(w.seed ^ 0x77, now) : 0; for (const r of w.rotors) r.rotateZ(dt * wind * 2.2); }
    if (lamps && w.lamp) { const poi = findPoi(G.char.world, w.vid); w.lamp.visible = !!poi && stationKw(poi, w.seed, st, now) > 1; }
  }
}
/** The station (or plot) you stand at. */
export function nearStation(): Station | null {
  if (G.char.loc !== 'overworld') return null;
  for (const list of placed.values()) for (const w of list) if (Math.hypot(Math.max(w.x0 - G.pos.x, 0, G.pos.x - w.x1), Math.max(w.z0 - G.pos.z, 0, G.pos.z - w.z1)) < 2.5) return w;
  return null;
}
export function stationPrompt(w: Station): string {
  const st = G.char.towns[w.vid], s = st?.stations?.[w.slot];
  if (!s) return st?.pbuild && isStation(st.pbuild.k) && w.slot === (st.stations?.length ?? 0) ? `${/^[AEIOU]/.test(specOf(st.pbuild.k).name) ? 'An' : 'A'} ${specOf(st.pbuild.k).name} is going up here: the elder keeps count of the materials` : 'An empty plot for a power station: ask the elder';
  const poi = findPoi(G.char.world, w.vid), kw = poi ? Math.round(stationKw(poi, w.seed, s, G.char.time)) : 0, spec = STATIONS[s.k];
  return `E — the ${spec.name} (${s.on ? `${kw} kW` : 'switched off'}${spec.fuel ? ` · ${Math.floor(fuelAt(s, G.char.time))} ${spec.fuel === 'coal' ? 'crates of coal' : 'canisters of fuel'} left` : ''})`;
}
