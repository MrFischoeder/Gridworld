// Ancient surface gates: a fixed, seeded network. No geometry or connection state is saved.
import { gateAddresses, GATE_COUNT, GATE_SECONDS } from '../../shared/gates.mjs';
export { GATE_COUNT, GATE_SECONDS };
import { hash, rng } from '../core/rng';
import { type GateAddress } from '../data/gates';
import { continents } from './continents';
import { nearX, wrapX, wrapDx, worldDist, poisNear } from './regions';
import { naturalHeight } from './heights';
import { seaMask } from './seas';
import { mountainMask } from './mountains';
import { nearRiver } from './rivers';
import { inCity } from './cities';
import { chasmsIn } from './chasms';
import { lakesIn, LAKE_REACH } from './water';

export const GATE_CLEAR = 24, GATE_BLEND = 10;
export const GATE_PANEL = [14, 4] as const, GATE_TABLET = [-14, 4] as const;
export interface WorldGate { id: number; x: number; z: number; y: number; yaw: number; address: GateAddress; seed: number }
const cache = new Map<number, WorldGate[]>();
export const gateName = (g: Pick<WorldGate, 'id'>) => `Ancient Gate ${String(g.id + 1).padStart(2, '0')}`;

function gateNetwork(world: number, count: number): WorldGate[] {
  const got = cache.get(world); if (got && got.length >= count) return got;
  const cs = continents(world), out: WorldGate[] = got ? [...got] : [];
  const addresses = gateAddresses(world);
  const base = { world, base: (x: number, z: number) => naturalHeight(world, x, z) };
  for (let id = out.length; id < count; id++) {
    const Q = rng(hash(world, id, 0x6a7f)), c = cs[id % cs.length];
    let site: [number, number, number] | null = null;
    for (let attempt = 0; attempt < 1600; attempt++) {
      const a = Q() * Math.PI * 2, r = id === 0 ? 450 + Q() * 650 : Math.sqrt(.04 + Q() * .67);
      const x = wrapX(Math.round(id === 0 ? Math.cos(a) * r : c.x + Math.cos(a) * c.rx * r));
      const z = Math.round(id === 0 ? Math.sin(a) * r : c.z + Math.sin(a) * c.rz * r);
      let lo = Infinity, hi = -Infinity, dry = true;
      for (const dx of [-20, 0, 20]) for (const dz of [-20, 0, 20]) {
        const h = base.base(x + dx, z + dz); lo = Math.min(lo, h); hi = Math.max(hi, h);
        if (seaMask(world, x + dx, z + dz) > 0) dry = false;
      }
      if (!dry || hi - lo > 3 || lo < 2) continue;
      if (out.some(g => worldDist(g.x, g.z, x, z) < 1600) || inCity(world, x, z, 100)) continue;
      if (poisNear(world, x, z, 220).some(p => Math.hypot(Math.max(p.rect.x0 - x, 0, x - p.rect.x1), Math.max(p.rect.z0 - z, 0, z - p.rect.z1)) < p.flat + p.blend + 35)) continue;
      if (seaMask(world, x, z) > 0 || mountainMask(world, x, z) > .01 || nearRiver(world, x, z, 65)) continue;
      const rect = { x0: x - 25, z0: z - 25, x1: x + 25, z1: z + 25 };
      if (chasmsIn(world, rect).length || lakesIn(base, rect).some(l => Math.hypot(l.x - x, l.z - z) < l.r * LAKE_REACH * 1.3 + 30)) continue;
      site = [x, z, Math.round(base.base(x, z))]; break;
    }
    if (!site) throw new Error(`No dry site for ancient gate ${id} in world ${world}`);
    out.push({ id, x: site[0], z: site[1], y: site[2], yaw: Q() * Math.PI * 2,
      address: addresses[id], seed: hash(world, id, 0x6a80) });
  }
  if (cache.size > 128) cache.clear(); cache.set(world, out); return out;
}
export const worldGates = (world: number): WorldGate[] => gateNetwork(world, GATE_COUNT);
export function gatesNear(world: number, x: number, z: number, r: number): WorldGate[] {
  // All non-home gates are outside the inner 20% of their continent. Near Gridholm there is no need
  // to survey the whole planet (including its rivers) just to build a local terrain chunk.
  const cs = continents(world), remoteMinimum = Math.min(...cs.map((c, i) => i ?
    Math.hypot(wrapDx(c.x), c.z) - Math.max(c.rx, c.rz) * Math.sqrt(.71) : Math.min(c.rx, c.rz) * .2)) - 2;
  const localOnly = Math.hypot(wrapDx(x), z) + r < remoteMinimum;
  const list = gateNetwork(world, localOnly ? 1 : GATE_COUNT);
  return (localOnly ? list.slice(0, 1) : list).filter(g => worldDist(g.x, g.z, x, z) < r).map(g => ({ ...g, x: nearX(g.x, x) }));
}
export const inGateClearing = (world: number, x: number, z: number, extra = 0) => gatesNear(world, x, z, GATE_CLEAR + extra).length > 0;
export function gateDestination(world: number, source: number, symbols: readonly number[]): WorldGate | null {
  if (symbols.length !== 3 || symbols.some(s => !Number.isInteger(s) || s < 0 || s >= 6)) return null;
  return worldGates(world).find(g => g.id !== source && g.address.every((s, i) => s === symbols[i])) ?? null;
}
export function gateLocal(g: WorldGate, x: number, z: number): [number, number] {
  const dx = wrapDx(x - g.x), dz = z - g.z, c = Math.cos(g.yaw), s = Math.sin(g.yaw);
  return [c * dx - s * dz, s * dx + c * dz];
}
export function gatePoint(g: WorldGate, x: number, z: number): [number, number] {
  const c = Math.cos(g.yaw), s = Math.sin(g.yaw); return [wrapX(g.x + c * x + s * z), g.z - s * x + c * z];
}
/** Different faceted debris, always outside the console, walking lane and arrival area. */
export function gateRocks(g: WorldGate): { x: number; z: number; r: number; h: number; rot: number; sides: number }[] {
  const R = rng(g.seed), out = [];
  for (let i = 0, n = 12 + Math.floor(R() * 12); i < n; i++) {
    const a = R() * Math.PI * 2, d = 17 + R() * 10, x = Math.cos(a) * d, z = Math.sin(a) * d;
    const r = .6 + R() * 1.6;
    if (Math.abs(x) - r < 5 && Math.abs(z) - r < 24 || [GATE_PANEL, GATE_TABLET].some(([px, pz]) => Math.hypot(x - px, z - pz) - r < 3)) continue;
    out.push({ x, z, r, h: r * (.7 + R()), rot: R() * Math.PI * 2, sides: 5 + Math.floor(R() * 3) });
  }
  return out;
}

/** Three different destinations, permanently engraved on this gate's stationary tablet. */
export function tabletDestinations(world: number, gate: WorldGate): Pick<WorldGate, 'id' | 'address'>[] {
  // The tablet needs addresses, not terrain surveys of all forty remote sites.
  const list = gateAddresses(world).map((address, id) => ({ id, address })).filter(g => g.id !== gate.id), R = rng(hash(gate.seed, 0x7ab1));
  for (let i = list.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [list[i], list[j]] = [list[j], list[i]]; }
  return list.slice(0, 3);
}
