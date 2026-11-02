// (0.289) The player's own map markers: N on the big map puts one under the cursor (or takes away the one there),
// the journal (J) names them and switches them on and off. Pure: the list lives in the save (Char.marks, personal).
// Later a marker may want a structure built on the spot (a cairn, a beacon); for now it is just a mark on the map.

export interface MapMark {
  /** 'm<n>': unique within the character's list. */
  id: string;
  /** World x (as placed), z. */
  x: number;
  z: number;
  name: string;
  /** Shown on the maps and the compass. */
  on: boolean;
  /** Index into MARK_COLORS. */
  c: number;
}

export const MARKS = {
  /** Markers a character may keep. */
  max: 40,
  /** Screen pixels within which N takes a marker away instead of placing one. */
  pick: 14,
  /** The compass shows at most this many shown markers (the nearest), none nearer than `near` m. */
  compass: 4,
  near: 25,
  /** A name's longest length. */
  name: 24,
};
/** Marker colours, chosen in turn (pink, cyan, orange, white, violet, yellow). */
export const MARK_COLORS = ['#ff7ad9', '#6af0ff', '#ff9a3c', '#f2f2f2', '#b48cff', '#fff36a'];

/** A name cleaned for the list: control characters and angle brackets out, trimmed, cut to MARKS.name. */
export const cleanMarkName = (s: string) => s.replace(/[\u0000-\u001f<>&"]/g, '').trim().slice(0, MARKS.name);

/** The marker nearest (dx, dz) within `tol` metres, by the given distance function (the planet wraps). */
export function markNear(list: readonly MapMark[], x: number, z: number, tol: number, dx: (d: number) => number = (d) => d): MapMark | null {
  let best: MapMark | null = null, bd = tol;
  for (const m of list) { const d = Math.hypot(dx(m.x - x), m.z - z); if (d <= bd) { bd = d; best = m; } }
  return best;
}
/** A new marker at (x, z), or null when the list is full. `name` is the default name's pattern with {0} for the number. */
export function addMark(list: MapMark[], x: number, z: number, name: (n: number) => string, taken: readonly string[] = []): MapMark | null {
  if (list.length >= MARKS.max) return null;
  let n = 1;
  while (list.some((m) => m.id === `m${n}`)) n++;
  const used = new Set(list.map((m) => m.c));
  let c = list.length % MARK_COLORS.length;
  for (let i = 0; i < MARK_COLORS.length; i++) if (!used.has(i)) { c = i; break; }
  let k = n; // the default name's number: past the names already in use (yours, the shared ones)
  while (taken.includes(cleanMarkName(name(k))) || list.some((o) => o.name === cleanMarkName(name(k)))) k++;
  const m: MapMark = { id: `m${n}`, x, z, name: cleanMarkName(name(k)) || `#${n}`, on: true, c };
  list.push(m);
  return m;
}
export function removeMark(list: MapMark[], id: string): boolean {
  const i = list.findIndex((m) => m.id === id);
  if (i < 0) return false;
  list.splice(i, 1);
  return true;
}
export function renameMark(list: MapMark[], id: string, name: string): boolean {
  const m = list.find((k) => k.id === id), n = cleanMarkName(name);
  if (!m || !n) return false;
  m.name = n;
  return true;
}
/** The shown markers, nearest first (by the distance function). */
export const shownMarks = (list: readonly MapMark[], x: number, z: number, dx: (d: number) => number = (d) => d) =>
  list.filter((m) => m.on).map((m) => ({ m, d: Math.hypot(dx(m.x - x), m.z - z) })).sort((a, b) => a.d - b.d);

// (0.290) Markers for everyone: a marker can be shared with the whole room. A shared one leaves the owner's own list
// for the world's map `Char.pmarks` (shared, keyed by id); each player shows or hides it for themselves
// (`Char.hideMarks` holds 'pm:<id>'). Only its author changes it, and anyone may once the author has fallen.
export interface PubMark extends MapMark {
  /** The author's name and character id. */
  by: string;
  pid: string;
  /** Game time it was shared. */
  t: number;
}
/** Shared markers a world keeps. */
export const PUB_MAX = 120;
export const pubKey = (id: string) => `pm:${id}`;
/** May this character change (rename, take back, take away) a shared marker? */
export const mayEditPub = (m: PubMark, pid: string, fallen: Record<string, unknown>) => m.pid === pid || !!fallen[m.by.toLowerCase()];

/** Move one of your own markers to the shared map. Null when it is not yours or the map is full. */
export function shareMark(own: MapMark[], pub: Record<string, PubMark>, id: string, by: string, pid: string, t: number): PubMark | null {
  const m = own.find((k) => k.id === id);
  if (!m || Object.keys(pub).length >= PUB_MAX) return null;
  let n = 0, pidId = `${pid}:${Math.round(t)}`;
  while (pub[n ? `${pidId}:${n}` : pidId]) n++;
  const p: PubMark = { ...m, id: n ? `${pidId}:${n}` : pidId, on: true, by, pid, t };
  pub[p.id] = p;
  removeMark(own, id);
  return p;
}
/** A shared marker back into your own list (shown). Null when your list is full or it is gone. */
export function unshareMark(own: MapMark[], pub: Record<string, PubMark>, id: string): MapMark | null {
  const p = pub[id];
  if (!p) return null;
  const m = addMark(own, p.x, p.z, (n) => `#${n}`);
  if (!m) return null;
  m.name = p.name; m.c = p.c;
  delete pub[id];
  return m;
}
export interface Seen { m: MapMark; pub: PubMark | null; d: number }
/** Every marker you see (your own switched on, the shared ones you have not hidden), nearest first. */
export function visibleMarks(own: readonly MapMark[], pub: Record<string, PubMark>, hidden: readonly string[], x: number, z: number, dx: (d: number) => number = (d) => d): Seen[] {
  const out: Seen[] = [];
  for (const m of own) if (m.on) out.push({ m, pub: null, d: Math.hypot(dx(m.x - x), m.z - z) });
  for (const p of Object.values(pub)) if (p && !hidden.includes(pubKey(p.id))) out.push({ m: p, pub: p, d: Math.hypot(dx(p.x - x), p.z - z) });
  return out.sort((a, b) => a.d - b.d);
}
