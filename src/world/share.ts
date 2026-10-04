import { commsRuin, initializeSettlements } from '../gen/settlement';
import { findPoi } from '../gen/regions';
import { GRIDHOLM_ID } from '../gen/regions';
// The shared world (multiplayer): on a server everyone plays in one world, so what belongs to the world rather than to
// a hero lives on the server (server/mp.mjs keeps it per room) and every change reaches everyone: the villages (walls,
// farms, works, stations, the hall's stock, defences...), the markets, bridges, piers and boats, the great
// installations, the Chariot, chests and dungeon progress, felled trees and picked plants, cleared bandit camps and
// the caravans' fates. The hero's own things stay theirs: kit, gold, xp, quests, contracts, maps, knowledge, vehicles
// (shared through world/peers.ts), the house chest.
// Once a second the shared parts of the save are compared with what was last sent (key by key) and the changes go to
// the server; the others' changes are written into the save and shown (a village rebuilt, a tree gone...).
// Independent property edits merge; conflicting leaves follow server order. The first player to join who already
// played the room's world brings their world along.
import { mergeWorld, mergeProgress } from '../net/worlddoc.mjs';
import { G, W } from '../game';
import { net, activeContainers, activeTowns, online, sendWorld, seedWorld, onWorld, type WorldDoc } from '../net/client';
import { saveChar, dungeonKey } from '../character';
import { OW, reloadStruct, rebuildChunkAt } from './overworld';
import { CHUNK, HANGAR_ID, nearX } from '../gen/regions';
import type { Char } from '../save';
import { retireOldCrossings } from '../gen/bridges';

type Kind = 'map' | 'list' | 'one';
interface Field { f: keyof Char; kind: Kind; skip?: (k: string) => boolean }
/** The parts of the save that are the world's. */
export const SHARED: Field[] = [
  { f: 'towns', kind: 'map' }, { f: 'market', kind: 'map' }, { f: 'installs', kind: 'map' }, { f: 'bridges', kind: 'map' },
  { f: 'bridgeSites', kind: 'list' }, { f: 'piers', kind: 'list' }, { f: 'boats', kind: 'list' }, { f: 'shuttle', kind: 'one' },
  { f: 'containers', kind: 'map', skip: (k) => k.startsWith('home:') }, // your house chest is yours
  { f: 'opened', kind: 'map' }, { f: 'unlocked', kind: 'map' }, { f: 'killed', kind: 'map' },
  { f: 'harvest', kind: 'map' }, { f: 'camps', kind: 'map' }, { f: 'cityGarrisons', kind: 'map' }, { f: 'caravans', kind: 'map' },
];
const EMPTY: Partial<Record<keyof Char, () => unknown>> = { shuttle: () => ({ given: {}, v: 2 }) };

/** What was last sent or heard, per field and key, as JSON. */
let last = new Map<string, Map<string, string>>();
const bag = (c: Char, f: Field) => c[f.f] as unknown;
/** A field of the save as key → value. */
function entries(c: Char, f: Field): [string, unknown][] {
  const v = bag(c, f);
  if (f.kind === 'one') return v === undefined ? [] : [['_', v]];
  if (f.kind === 'list') return ((v as { id: string }[]) ?? []).map((o) => [o.id, o]);
  return Object.entries((v as Record<string, unknown>) ?? {}).filter(([k]) => !f.skip?.(k));
}
/** The shared world as it stands in your save. */
export function worldDoc(c = G.char): WorldDoc {
  const doc: WorldDoc = {};
  for (const f of SHARED) doc[f.f] = Object.fromEntries(entries(c, f));
  return doc;
}
function remember(doc: WorldDoc) {
  last = new Map();
  for (const f of SHARED) last.set(f.f, new Map(Object.entries(doc[f.f] ?? {}).map(([k, v]) => [k, JSON.stringify(v)])));
}
/** Write v into an object in place (open windows and the world keep their references to it). */
function patchInto(t: Record<string, unknown>, v: Record<string, unknown>) {
  for (const k of Object.keys(t)) if (!(k in v)) delete t[k];
  Object.assign(t, v);
}
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
/** Set one key of a field in the save (null / undefined removes it). */
function put(c: Char, f: Field, k: string, v: unknown) {
  const cur = bag(c, f);
  if (f.kind === 'one') {
    const val = v ?? EMPTY[f.f]?.();
    if (isObj(cur) && isObj(val)) patchInto(cur, structuredClone(val)); else (c as unknown as Record<string, unknown>)[f.f] = structuredClone(val);
    return;
  }
  if (f.kind === 'list') {
    const list = cur as { id: string }[], i = list.findIndex((o) => o.id === k);
    if (v === null || v === undefined) { if (i >= 0) list.splice(i, 1); return; }
    if (i >= 0) patchInto(list[i] as unknown as Record<string, unknown>, structuredClone(v) as Record<string, unknown>); else list.push(structuredClone(v) as { id: string });
    return;
  }
  const map = cur as Record<string, unknown>;
  if (v === null || v === undefined) { delete map[k]; return; }
  if (isObj(map[k]) && isObj(v)) patchInto(map[k] as Record<string, unknown>, structuredClone(v)); else map[k] = structuredClone(v);
}

// ---------- showing the others' changes ----------
/** The parts of a village that change how it looks (a change rebuilds it). */
const townLook = (t: unknown) => {
  const s = (t ?? {}) as Record<string, unknown>;
  const settlement = s.settlement as { v?: number; done?: unknown } | undefined;
  return JSON.stringify([s.wall, s.works, s.farms, s.crops, s.fup, s.pup, s.imp, s.built, settlement?.v, settlement?.done, s.pbuild, (s.plants as { k: string }[] | undefined)?.map((p) => p.k), (s.stations as { k: string }[] | undefined)?.map((p) => p.k)]);
};
function show(f: string, k: string, before: unknown, after: unknown) {
  if (G.char.loc === 'dungeon' && G.char.dungeon && k === dungeonKey()) {
    const indices = Array.isArray(after) ? after : [];
    if (f === 'opened') for (const c of W.chests) {
      const open = indices.includes(c.i);
      if (open !== c.open) { c.open = open; c.anim = open ? 0.001 : 0; }
    }
    if (f === 'unlocked') for (const d of W.doors) if (d.locked && indices.includes(d.idx)) {
      d.locked = false; d.panelMat.color.setHex(0x6dffa0); d.frameMat.color.setHex(0xb07a20); d.lock.visible = false;
    }
    return;
  }
  if (!OW.terrain || G.char.loc !== 'overworld') return; // underground, or not loaded: seen when you come back
  if (f === 'towns' && townLook(before) !== townLook(after)) {
    reloadStruct(+k);
    const v = findPoi(G.char.world, +k), r = v && G.char.towns[k]?.settlement && commsRuin(G.char.world, v);
    if (r) reloadStruct(r.id);
  }
  else if (f === 'shuttle') reloadStruct(HANGAR_ID);
  else if (f === 'harvest' && (k.startsWith('tree:') || k.startsWith('rock:'))) {
    const [, cx, cz] = k.split(':').map(Number);
    rebuildChunkAt(nearX(cx * CHUNK + CHUNK / 2, G.pos.x), cz * CHUNK + CHUNK / 2);
  }
  // bridges, piers, boats, installations, flora and the market redraw from the save on their own
}

let reload: () => void = () => {};
/** How to redraw the whole world after taking another one (main.ts). */
export function setWorldReload(f: () => void) { reload = f; }

let seeding = false;
let pending: { doc: WorldDoc; seeded: boolean; world: number; canSeed: boolean } | null = null;
onWorld({
  welcome(doc, seeded, world) { seeding = false; inFlight = 0; pending = { doc, seeded, world, canSeed: G.char.world === world }; },
  doc(doc, from) { adopt(doc, seeding && from === net.id); seeding = false; saveChar(); reload(); },
  set(ch, from, seq, force) {
    if (from === net.id && seq === inFlight) inFlight = 0;
    for (const [fk, k, v, rejected] of ch) {
      const f = SHARED.find((x) => x.f === fk);
      if (!f || f.skip?.(k)) continue;
      const before = entries(G.char, f).find(([kk]) => kk === k)?.[1], was = before === undefined ? undefined : JSON.stringify(before);
      const baseline = last.get(fk)?.get(k);
      const ownReservation = from === net.id && (fk === 'containers' && activeContainers.has(k) || fk === 'towns' && activeTowns.has(k));
      const authoritative = rejected || (force && !ownReservation);
      const merge = ['opened', 'unlocked', 'killed'].includes(fk) ? mergeProgress : mergeWorld;
      const rebased = authoritative ? v : merge(v, baseline === undefined ? undefined : JSON.parse(baseline), before);
      put(G.char, f, k, rebased);
      const m = last.get(fk) ?? new Map<string, string>(); last.set(fk, m);
      if (v === null || v === undefined) m.delete(k); else m.set(k, JSON.stringify(v));
      if (was !== (rebased == null ? undefined : JSON.stringify(rebased))) show(fk, k, before === undefined ? undefined : JSON.parse(was!), rebased);
    }
    retireOldCrossings(G.char);
    saveChar();
  },
});
/** Replace the shared parts of your save with the server's world. */
function adopt(doc: WorldDoc, keepEdits = false) {
  const c = G.char;
  for (const f of SHARED) {
    const want = { ...(doc[f.f] ?? {}) };
    if (keepEdits) {
      const live = Object.fromEntries(entries(c, f));
      for (const k of new Set([...Object.keys(want), ...Object.keys(live)])) {
        const baseline = last.get(f.f)?.get(k);
        const merge = ['opened', 'unlocked', 'killed'].includes(f.f) ? mergeProgress : mergeWorld;
        const value = merge(want[k], baseline === undefined ? undefined : JSON.parse(baseline), live[k]);
        if (value === undefined) delete want[k]; else want[k] = value;
      }
    }
    for (const [k] of entries(c, f)) if (!(k in want)) put(c, f, k, null);
    for (const [k, v] of Object.entries(want)) put(c, f, k, v);
    if (f.kind === 'one' && !('_' in want)) put(c, f, '_', null);
  }
  c.settlementRules = c.towns[GRIDHOLM_ID]?.settlement?.v === 1 ? 1 : 0;
  retireOldCrossings(c);
  remember(doc);
  if (c.loc === 'dungeon' && c.dungeon) {
    const key = dungeonKey();
    show('opened', key, undefined, c.opened[key]); show('unlocked', key, undefined, c.unlocked[key]);
  }
}
/**
 * Just joined (ui/mp.ts, after keeping a copy of your own save): bring your world to a room nobody has brought one to
 * if you have played its world, else take the room's. True if your save's world changed (redraw it).
 */
export function joinWorld(): boolean {
  const p = pending; pending = null;
  if (!p) return false;
  if (!p.seeded && p.canSeed) { const d = worldDoc(); seeding = true; seedWorld(d); remember(d); return false; }
  adopt(p.doc);
  // A room with no persisted world starts with the new rules, not the visiting character's old buildings.
  if (!p.seeded) { G.char.settlementRules = 1; initializeSettlements(G.char); }
  saveChar();
  return true;
}

let clock = 0, sequence = 0, inFlight = 0;
/** Main loop: once a second, send what changed in the shared world since last time. */
export function syncWorld(dt: number) {
  if (!online() || !net.id || pending || seeding || inFlight) return;
  if ((clock -= dt) > 0) return;
  clock = 1;
  const ch: [string, string, unknown, unknown?][] = [];
  for (const f of SHARED) {
    const m = last.get(f.f) ?? new Map<string, string>(); last.set(f.f, m);
    const seen = new Set<string>();
    for (const [k, v] of entries(G.char, f)) {
      seen.add(k);
      if (f.f === 'containers' && activeContainers.has(k)) continue; // transfer windows publish through their reservation
      if (f.f === 'towns' && activeTowns.has(k)) continue; // stock transactions publish atomically on release
      const j = JSON.stringify(v);
      if (m.get(k) !== j) { const base = m.get(k); ch.push([f.f, k, v, base === undefined ? null : JSON.parse(base)]); }
    }
    for (const k of [...m.keys()]) if (!seen.has(k)) { ch.push([f.f, k, null, JSON.parse(m.get(k)!)]); }
  }
  if (ch.length && sendWorld(ch, sequence + 1)) {
    inFlight = ++sequence;
    for (const [f, k, v] of ch) { const m = last.get(f)!; if (v == null) m.delete(k); else m.set(k, JSON.stringify(v)); }
  }
}
