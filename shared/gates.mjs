// Gate addresses and real-time, atomic two-ended connections. No Node, DOM or rendering dependencies.
import { hash, rng } from './random.mjs';
export const GATE_COUNT = 40, GATE_SECONDS = 45, GATE_TRANSIT_SECONDS = 5;
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
  constructor(now = Date.now) { this.now = now; this.links = []; this.drafts = new Map(); this.trips = new Map(); this.seq = 0; }
  state() {
    this.links = this.links.filter(link => link.until > this.now() || [...this.trips.values()].some(t => t.link === link));
    return this.links.map(link => {
      const trips = [...this.trips.values()].filter(t => t.link === link);
      return { ...link, ...(trips.length ? { inTransit: trips.length, finishAt: Math.max(...trips.map(t => t.finishAt)) } : {}) };
    });
  }
  at(id) { return this.state().find(link => link.a === id || link.b === id) ?? null; }
  draft(id) { return [...(this.drafts.get(id) ?? [])]; }
  draftState() { return [...this.drafts].map(([gate, symbols]) => ({ gate, symbols: [...symbols] })); }
  setDraft(id, symbols) {
    if (!Number.isInteger(id) || id < 0 || id >= GATE_COUNT || !Array.isArray(symbols) || symbols.length > 3 || symbols.some(s => !Number.isInteger(s) || s < 0 || s >= 6) || this.at(id)) return false;
    if (symbols.length) this.drafts.set(id, [...symbols]); else this.drafts.delete(id);
    return true;
  }
  open(world, source, symbols) {
    const to = addressDestination(world, source, symbols);
    if (this.at(source) || (to >= 0 && this.at(to))) return { ok: false, why: 'A terminal is locked by an active connection.' };
    if (to < 0) return { ok: false, why: 'This address is unassigned or belongs to this gate.' };
    const link = { a: source, b: to, until: this.now() + GATE_SECONDS * 1000 };
    this.drafts.delete(source); this.drafts.delete(to);
    this.links.push(link); return { ok: true, link };
  }
  /** Closing is held by accepted journeys; the admission deadline itself never moves. */
  begin(id) {
    const current = this.at(id);
    if (!current || current.until <= this.now()) return null;
    const link = this.links.find(l => l.a === current.a && l.b === current.b), token = ++this.seq;
    const trip = { token, to: id === link.a ? link.b : link.a, finishAt: this.now() + GATE_TRANSIT_SECONDS * 1000 };
    this.trips.set(token, { ...trip, link }); return trip;
  }
  finish(token) { this.trips.delete(token); }
}
