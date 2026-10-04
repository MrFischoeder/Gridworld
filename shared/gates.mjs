// Gate addresses and real-time, atomic two-ended connections. No Node, DOM or rendering dependencies.
import { hash, rng } from './random.mjs';
export const GATE_COUNT = 40, GATE_SECONDS = 45;
const addresses = new Map();
export function gateAddresses(world) {
  if (addresses.has(world)) return addresses.get(world);
  const R = rng(hash(world, 0x6a7e)), values = Array.from({ length: 216 }, (_, i) => i);
  for (let i = values.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [values[i], values[j]] = [values[j], values[i]]; }
  const out = values.slice(0, GATE_COUNT).map(n => [Math.floor(n / 36), Math.floor(n / 6) % 6, n % 6]);
  if (addresses.size > 128) addresses.clear(); addresses.set(world, out); return out;
}
export function addressDestination(world, source, symbols) {
  if (!Number.isInteger(source) || source < 0 || source >= GATE_COUNT || !Array.isArray(symbols) || symbols.length !== 3 || symbols.some(s => !Number.isInteger(s) || s < 0 || s >= 6)) return -1;
  return gateAddresses(world).findIndex((a, id) => id !== source && a.every((s, i) => s === symbols[i]));
}
export class GateConnections {
  constructor(now = Date.now) { this.now = now; this.links = []; }
  state() { this.links = this.links.filter(link => link.until > this.now()); return this.links.map(link => ({ ...link })); }
  at(id) { return this.state().find(link => link.a === id || link.b === id) ?? null; }
  open(world, source, symbols) {
    const to = addressDestination(world, source, symbols);
    if (this.at(source) || (to >= 0 && this.at(to))) return { ok: false, why: 'A terminal is locked by an active connection.' };
    if (to < 0) return { ok: false, why: 'This address is unassigned or belongs to this gate.' };
    const link = { a: source, b: to, until: this.now() + GATE_SECONDS * 1000 };
    this.links.push(link); return { ok: true, link };
  }
}
