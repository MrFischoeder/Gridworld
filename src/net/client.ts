// The multiplayer connection (stage 1): talks to server/mp.mjs over a WebSocket. It knows nothing of three.js or
// the page: it keeps who is online and their last positions, and tells the game through callbacks. The game drives
// it with `sendState` (about 10 times a second) and reads `peers`.

/** Must match PROTOCOL in server/mp.mjs. */
export const PROTOCOL = 11;
export const SEND_EVERY = 0.1;

/** `away`: in the menu (still in the game: the others see you standing there). */
/**
 * A player's own vehicles, as others see them: [model (0 Scout, 1 Mastodon), x, y, z, heading, pitch, roll, cannon 0/1,
 * the owner's seat + 1 (0 = not in it), the cannon's yaw (body-relative), condition percent] each (body pose as world/vehicles.ts sets
 * it), in the order of their save. Older clients send 9 numbers (the 9th 1 = driving).
 */
export type PeerCar = number[];
export interface PeerState { p: [number, number, number]; yaw: number; pitch: number; loc: string; held: string; mv: boolean; away?: boolean; cars?: PeerCar[]; carIds?: string[];
  /** Riding in another player's vehicle: [owner id, the vehicle's index in their cars, seat]; `gun` = where they aim its cannon. */
  ride?: [number, number, number]; gun?: number;
  /** On one of the boats: [boat id, u along it, v across, height of the feet over its waterline, seat (-1 on a ship's deck)]. */
  boat?: [string, number, number, number, number];
  /** Sneaking: how visible they are (world/stealth.ts myVis; the foes their turn is against read it) and whether they crouch. */
  vis?: number; cr?: boolean }
export interface Peer {
  id: number; name: string;
  /** The last two states and when they came: the drawing eases between them. */
  st: PeerState | null; prev: PeerState | null; at: number;
  /** The last few states with the times they came (performance.now), oldest first: drawing samples them a little in the past. */
  hist: { t: number; s: PeerState }[];
}
/** How far behind the newest snapshot the others are drawn (ms): enough to have two snapshots round any moment. */
export const PEER_DELAY = 220;
/**
 * Where a peer was at time t (performance.now): the two states round it and how far between them. Before the oldest
 * or after the newest it holds the end one (k 0), so a late packet makes them pause rather than jump back.
 */
export function peerAt(p: Peer, t: number): { a: PeerState; b: PeerState; k: number } | null {
  const h = p.hist;
  if (!h.length) return null;
  if (t <= h[0].t) return { a: h[0].s, b: h[0].s, k: 0 };
  for (let i = 1; i < h.length; i++) if (t <= h[i].t) {
    const a = h[i - 1], b = h[i];
    return { a: a.s, b: b.s, k: (t - a.t) / Math.max(1, b.t - a.t) };
  }
  const last = h[h.length - 1].s;
  return { a: last, b: last, k: 0 };
}
/** An item lying in the room's world (server/mp.mjs): put down by `by`, at p in the place `loc` (see world/peers.ts myLoc). */
/** `auto`: loot (a kill's drops, logs from a felled tree...) lying only a while (server `MP.lootTtl`); taken like any drop. */
export interface NetDrop { id: string; k: string; n: number; c?: number; p: [number, number, number]; loc: string; by: string; at: number; auto?: boolean }
let gotHook: ((d: NetDrop) => void) | null = null;
/** Who receives an item the server handed you (world/drops.ts). */
export function onGot(f: (d: NetDrop) => void) { gotHook = f; }
/** The shared world (src/world/share.ts): {field: {key: value}}. */
export type WorldDoc = Record<string, Record<string, unknown>>;
export interface WorldHooks {
  /** Joined: the room's shared world, whether anyone has brought one yet, and the room's world seed. */
  welcome(doc: WorldDoc, seeded: boolean, world: number): void;
  /** Take this whole world (someone else brought theirs first). */
  doc(doc: WorldDoc, from?: number): void;
  /** Server-ordered changes, including our acknowledgements; force/rejected values replace stale local data. */
  set(ch: [string, string, unknown, boolean?][], from?: number, seq?: number, force?: boolean): void;
}
let worldHooks: WorldHooks | null = null;
export function onWorld(h: WorldHooks) { worldHooks = h; }
/** Changes to the shared world; null deletes. */
export function sendWorld(ch: [string, string, unknown, unknown?][], seq?: number): boolean {
  if (!online() || net.ws?.readyState !== 1 || !ch.length) return false;
  net.ws.send(JSON.stringify({ t: 'wset', ch, seq }));
  return true;
}
/** Bring your world to a room nobody has brought one to. */
export function seedWorld(doc: WorldDoc) { if (online() && net.ws?.readyState === 1) net.ws.send(JSON.stringify({ t: 'wseed', doc })); }
export interface NetHooks {
  /** Joined: the host's world seed and clock (for the host: their own); on a dedicated server, the server's. */
  welcome(world: number, time: number, host: boolean, dedicated: boolean): void;
  /** Lines for the log / chat ("Ada joined", a chat message...). */
  say(text: string, kind: 'chat' | 'info' | 'error'): void;
  /** The host's clock, with every snapshot. */
  clock(time: number): void;
  /** The connection ended (or never came up). */
  closed(why: string): void;
}

export const activeContainers = new Set<string>();
export const activeTowns = new Set<string>();
export const net = {
  ws: null as WebSocket | null,
  /** Our id on the server, and the host's (0 = not connected). */
  id: 0, host: 0,
  /** Your name as the server knows you (a dedicated server: your account's). */
  name: '',
  /** The last refusal asked you to log in (again). */
  needAuth: false,
  peers: new Map<number, Peer>(),
  address: '',
  /** A dedicated server (server/main.mjs): the world and the clock are the room's, nobody hosts. */
  dedicated: false,
  /** The room (game server) you are in on a dedicated server. */
  room: null as { id: string; name: string } | null,
  /** Suppress stale movement packets while a server-authorized gate transfer is in flight. */
  gateTravelling: false,
  /** Everything lying on the ground in the room's world, by id. */
  drops: new Map<string, NetDrop>(),
};
export const online = () => net.id > 0;
export const isHost = () => online() && net.id === net.host;

import type { GateLink } from '../../shared/gates.mjs';
export interface VehicleWarp { owner: number; index: number; carId: string; car: PeerCar; to: number; trip: number }
export interface GateDecision { ok: boolean; why?: string; to?: number }
let gateDrafts = new Map<number, number[]>();
let gateTransitHook: ((m: GateTransitEvent) => void) | null = null;
export type GateTransitEvent = { t: 'gdepart'; trip: number; players: number[]; finishAt: number } | { t: 'gabort'; trip?: number };
export function onGateTransit(fn: (m: GateTransitEvent) => void) { gateTransitHook = fn; }
export const liveGateDraft = (id: number) => gateDrafts.get(id) ?? [];
export const sendGateDraft = (gate: number, symbols: readonly number[]) => { if (online()) net.ws?.send(JSON.stringify({ t: 'gdraft', gate, symbols })); };
let gateLinks: GateLink[] = [], vehicleWarpHook: ((m: VehicleWarp) => void) | null = null;
let gateReq = 0;
const gateReplies = new Map<number, { finish: (m: GateDecision) => void; timer: ReturnType<typeof setTimeout> }>();
export function liveGateLinks(): GateLink[] { return gateLinks.filter(l => l.until > Date.now() || !!l.inTransit); }
export function onVehicleWarp(fn: (m: VehicleWarp) => void) { vehicleWarpHook = fn; }
function receiveGates(m: { links?: GateLink[]; drafts?: { gate: number; symbols: number[] }[]; now?: number }) {
  const now = Date.now(), serverNow = m.now ?? now;
  gateLinks = (m.links ?? []).map(l => ({ ...l, until: now + l.until - serverNow, finishAt: l.finishAt === undefined ? undefined : now + l.finishAt - serverNow }));
  if (m.drafts) gateDrafts = new Map(m.drafts.map(d => [d.gate, d.symbols]));
}
function gateRequest(m: object): Promise<GateDecision> {
  if (!online() || net.ws?.readyState !== 1) return Promise.resolve({ ok: false, why: 'Disconnected from the server.' });
  const req = ++gateReq;
  return new Promise(resolve => {
    const timer = setTimeout(() => { gateReplies.delete(req); resolve({ ok: false, why: 'The gate request timed out. Try again.' }); }, 15000);
    gateReplies.set(req, { finish: resolve, timer }); net.ws!.send(JSON.stringify({ ...m, req }));
  });
}
export const requestGateDial = (gate: number, symbols: readonly number[]) => gateRequest({ t: 'gdial', gate, symbols });
export const requestGateTravel = (gate: number, car?: { index: number; id: string; pose: PeerCar }) => gateRequest({ t: 'gtravel', gate, car });
function clearGateRequests() {
  net.gateTravelling = false;
  gateLinks = []; gateDrafts.clear(); gateTransitHook?.({ t: 'gabort' }); for (const r of gateReplies.values()) { clearTimeout(r.timer); r.finish({ ok: false, why: 'Disconnected from the server.' }); } gateReplies.clear();
}

/** One request on its own connection (no game): the server answers once and closes. Resolves its answer, or
 * {t: 'refused', why} when it could not be reached. */
export type Reply = { t: string; why?: string; name?: string; token?: string; wait?: boolean; email?: string; next?: string; mailing?: boolean };
function ask(url: string, m: object): Promise<Reply> {
  return new Promise((done) => {
    let ws: WebSocket, reply: Reply = { t: 'refused', why: 'Could not reach the server.' };
    try { ws = new WebSocket(url); } catch { done(reply); return; }
    const timer = setTimeout(() => { ws.close(); }, 10000);
    ws.onopen = () => ws.send(JSON.stringify({ ver: PROTOCOL, ...m }));
    ws.onmessage = (e) => { try { const r = JSON.parse(String(e.data)); if (r && typeof r.t === 'string') reply = r; } catch { /* not ours */ } };
    ws.onclose = () => { clearTimeout(timer); done(reply); };
  });
}
/** Close (delete) a server you created on a dedicated server: `token` = your account's session (`key` = the old
 * per-browser secret, for servers made before accounts). Resolves '' when done, else why not. */
export async function deleteRoom(url: string, room: string, token: string, key?: string): Promise<string> {
  const r = await ask(url, { t: 'delroom', room, token, key });
  return r.t === 'deleted' ? '' : r.why ?? 'Could not reach the server.';
}
/** A dedicated server's accounts: make one / log in (→ {name, token} or {why}), log out, change the password. */
export async function account(url: string, how: 'register' | 'login', name: string, pass: string, email = ''): Promise<{ name?: string; token?: string; why?: string; wait?: boolean }> {
  const r = await ask(url, { t: how, name, pass, email });
  return r.t === 'auth' && r.token ? { name: r.name, token: r.token } : r.t === 'wait' ? { name: r.name, wait: true } : { why: r.why ?? 'Could not reach the server.', wait: r.wait, name: r.name };
}
/** The rest of the account's email business (server/accounts.mjs): confirm a code, mail it again, forgotten password,
 * a new password with its code, add an email, what the account shows. The raw reply. */
export const accountAsk = (url: string, m: { t: 'verify' | 'resend' | 'forgot' | 'reset' | 'email' | 'profile'; [k: string]: string }) => ask(url, m);
export const logout = (url: string, token: string) => ask(url, { t: 'logout', token });
export async function changePassword(url: string, token: string, old: string, pass: string): Promise<string> {
  const r = await ask(url, { t: 'passwd', token, old, pass });
  return r.t === 'ok' ? '' : r.why ?? 'Could not reach the server.';
}
/** Is the page served by a dedicated server (server/main.mjs)? It answers mp/info next to the page. */
/** A game server ("room") of a dedicated server, as the menu lists it: `running` while someone is in it. */
export interface RoomInfo { id: string; name: string; world: number; time: number; online: number; max: number; running: boolean; players: string[]; by?: string }
export interface ServerInfo { dedicated: boolean; accounts?: boolean; mail?: boolean; name: string; world: number; online: number; max: number; players: string[]; version: string; rooms?: RoomInfo[] }
export async function serverInfo(): Promise<ServerInfo | null> {
  try {
    const r = await fetch('mp/info', { cache: 'no-store' });
    if (!r.ok || !(r.headers.get('content-type') ?? '').includes('json')) return null;
    const j = await r.json();
    return j && j.dedicated ? j as ServerInfo : null;
  } catch { return null; }
}

/** ws://… for what the player typed: "", "localhost:5173", "192.168.1.5", "ws://…", "http://…".
 * Empty = the server this page came from, next to the page (so a game behind a portal at /gridworld/ uses
 * /gridworld/mp). */
export function serverUrl(input: string, here: { protocol: string; host: string; pathname?: string }): string {
  let s = input.trim();
  const ws = here.protocol === 'https:' ? 'wss://' : 'ws://';
  if (!s) return new URL('mp', ws + here.host + (here.pathname ?? '/').replace(/[^/]*$/, '')).toString();
  if (/^https?:\/\//.test(s)) s = s.replace(/^http/, 'ws');
  if (!/^wss?:\/\//.test(s)) s = ws + s;
  const u = new URL(s);
  if (!u.pathname || u.pathname === '/') u.pathname = '/mp';
  return u.toString();
}

let hooks: NetHooks | null = null;
/** Connect and say hello; the hooks hear the rest. */
/** `room`: the dedicated server's room to join; `create`: make a new room (its name and world) and join it. */
export function connect(url: string, me: { name: string; world: number; time: number; token?: string; room?: string; create?: { name: string; world?: number } }, h: NetHooks) {
  disconnect();
  hooks = h; net.address = url;
  let ws: WebSocket;
  try { ws = new WebSocket(url); } catch { h.closed(`Not a server address: ${url}`); return; }
  net.ws = ws;
  let welcomed = false, why = '';
  ws.onopen = () => { net.needAuth = false; ws.send(JSON.stringify({ t: 'hello', ver: PROTOCOL, name: me.name, world: me.world, time: me.time, token: me.token, room: me.room, create: me.create })); };
  ws.onmessage = (e) => {
    let m: any;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    if (net.ws !== ws) return;
    switch (m.t) {
      case 'welcome':
        welcomed = true; net.id = m.id; net.name = typeof m.name === 'string' ? m.name : me.name; net.host = m.host; net.dedicated = !!m.dedicated; net.room = m.room ?? null; net.peers.clear();
        net.drops = new Map((Array.isArray(m.drops) ? m.drops : []).map((d: NetDrop) => [d.id, d]));
        receiveGates(m);
        for (const p of m.players) if (p.id !== m.id) net.peers.set(p.id, { id: p.id, name: p.name, st: null, prev: null, at: 0, hist: [] });
        worldHooks?.welcome(m.wdoc ?? {}, !!m.wseeded, m.world);
        h.welcome(m.world, m.time, m.id === m.host, net.dedicated);
        break;
      case 'join': net.peers.set(m.id, { id: m.id, name: m.name, st: null, prev: null, at: 0, hist: [] }); h.say(`${m.name} joined the game.`, 'info'); break;
      case 'leave': net.peers.delete(m.id); h.say(`${m.name} left the game.`, 'info'); break;
      case 'host': net.host = m.id; h.say(m.id === net.id ? 'The host left: you host the game now.' : `${net.peers.get(m.id)?.name ?? 'Someone'} hosts the game now.`, 'info'); break;
      case 'snap': {
        const now = performance.now();
        receiveGates(m);
        for (const s of m.ps) {
          const p = net.peers.get(s.id);
          if (!p) continue;
          if (p.st && (p.st.loc !== s.loc || Math.hypot(p.st.p[0] - s.p[0], p.st.p[2] - s.p[2]) > 80)) p.hist = [];
          p.prev = p.st; p.st = { p: s.p, yaw: s.yaw, pitch: s.pitch, loc: s.loc, held: s.held, mv: s.mv, away: !!s.away, cars: Array.isArray(s.cars) ? s.cars : [], carIds: s.carIds, ride: Array.isArray(s.ride) ? s.ride : undefined, gun: typeof s.gun === 'number' ? s.gun : undefined, boat: Array.isArray(s.boat) ? s.boat : undefined, vis: typeof s.vis === 'number' ? s.vis : undefined, cr: !!s.cr }; p.at = now;
          p.hist.push({ t: now, s: p.st }); if (p.hist.length > 8) p.hist.shift();
        }
        if (!isHost()) h.clock(m.time);
        break;
      }
      case 'gates': receiveGates(m); break;
      case 'gdepart': gateTransitHook?.({ ...m, finishAt: Date.now() + m.finishAt - m.now }); break;
      case 'gabort': gateTransitHook?.(m); break;
      case 'gdial': case 'gtravel': {
        if (m.links) receiveGates(m);
        const r = gateReplies.get(m.req); if (r) { clearTimeout(r.timer); gateReplies.delete(m.req); r.finish(m); } break;
      }
      case 'vwarp': {
        const p = net.peers.get(m.owner);
        if (p?.st && p.st.carIds?.[m.index] === m.carId) {
          const cars = [...(p.st.cars ?? [])]; cars[m.index] = m.car;
          p.st = { ...p.st, p: [m.car[1], m.car[2], m.car[3]], cars }; p.prev = p.st; p.at = performance.now(); p.hist = [{ t: p.at, s: p.st }];
        }
        vehicleWarpHook?.(m); break;
      }
      case 'seats': seatHook?.(m); break;
      case 'wlock': lockReplies.get(m.req)?.(!!m.ok); lockReplies.delete(m.req); break;
      case 'wset': worldHooks?.set(m.ch, m.from, m.seq, !!m.force); break;
      case 'wdoc': worldHooks?.doc(m.doc ?? {}, m.from); break;
      case 'drop': net.drops.set(m.d.id, m.d); break;
      case 'gone': net.drops.delete(m.id); break;
      case 'got': net.drops.delete(m.d.id); gotHook?.(m.d); break;
      case 'foes': case 'bolt': case 'fhit': case 'kill': case 'hurt': case 'thit': case 'boat': case 'row': for (const f of relayHooks) f(m); break;
      case 'chat': h.say(`${m.name}: ${m.text}`, 'chat'); break;
      case 'full': why = 'The server is full (8 players).'; break;
      case 'refused': why = m.why; if (m.auth) net.needAuth = true; break;
    }
  };
  ws.onclose = () => {
    if (net.ws !== ws) return;
    clearLocks();
    clearGateRequests();
    net.ws = null; net.id = 0; net.host = 0; net.dedicated = false; net.room = null; net.peers.clear(); net.drops.clear();
    h.closed(why || (welcomed ? 'Disconnected from the server.' : `Could not reach a server at ${url}.`));
  };
}
export function disconnect() {
  const ws = net.ws;
  clearLocks();
  clearGateRequests();
  net.ws = null; net.id = 0; net.host = 0; net.dedicated = false; net.room = null; net.peers.clear(); net.drops.clear();
  if (ws) { ws.onclose = null; ws.close(); }
}
export function sendState(s: PeerState, time?: number) {
  if (!online() || net.ws?.readyState !== 1) return;
  net.ws.send(JSON.stringify({ t: 'state', ...s, ...(isHost() && time !== undefined ? { time } : {}) }));
}
/** Put an item down where you stand (already taken out of your kit). */
export function sendDrop(k: string, n: number, c: number | undefined, p: [number, number, number], loc: string, auto = false): boolean {
  if (!online() || net.ws?.readyState !== 1) return false;
  net.ws.send(JSON.stringify({ t: 'drop', k, n, c, p, loc, ...(auto ? { auto } : {}) }));
  return true;
}
/** Ask for a lying item: the server answers 'got' if you were first, 'gone' if not. */
export function sendTake(id: string): boolean {
  if (!online() || net.ws?.readyState !== 1) return false;
  net.ws.send(JSON.stringify({ t: 'take', id }));
  return true;
}
/** The shared foes (world/foesync.ts): a message from another player ({t, from, ...}). */
export type Relay = { t: 'foes' | 'bolt' | 'fhit' | 'kill' | 'hurt' | 'thit' | 'boat' | 'row'; from: number; [k: string]: unknown };
const relayHooks: ((m: Relay) => void)[] = [];
/** Listen to the relayed messages (foes, turrets, boats...); every listener sees every message. */
export function onRelay(f: (m: Relay) => void) { relayHooks.push(f); }
/** Pass m to everyone else in the room (to = undefined) or to one player. */
export function relay(m: { t: Relay['t']; [k: string]: unknown }, to?: number): boolean {
  if (!online() || net.ws?.readyState !== 1) return false;
  net.ws.send(JSON.stringify(to === undefined ? { t: 'cast', m } : { t: 'to', to, m }));
  return true;
}
export function sendChat(text: string) {
  const t = text.trim().slice(0, 200);
  if (!t || !online() || net.ws?.readyState !== 1) return false;
  net.ws.send(JSON.stringify({ t: 'chat', text: t }));
  hooks?.say(`You: ${t}`, 'chat');
  return true;
}

let lockSeq = 0;
const lockReplies = new Map<number, (ok: boolean) => void>();
function clearLocks() { activeContainers.clear(); activeTowns.clear(); for (const reply of lockReplies.values()) reply(false); lockReplies.clear(); }
/** Short reservation for an atomic village-stock transaction; the server sends current state before granting it. */
export function lockTown(k: string, value: unknown): Promise<boolean> {
  if (!online() || net.ws?.readyState !== 1) return Promise.resolve(false);
  const req = ++lockSeq;
  return new Promise((resolve) => {
    lockReplies.set(req, (ok) => { if (ok) activeTowns.add(k); resolve(ok); });
    net.ws!.send(JSON.stringify({ t: 'wlock', f: 'towns', k, value, req }));
  });
}
export function unlockTown(k: string, value?: unknown) {
  activeTowns.delete(k);
  if (online() && net.ws?.readyState === 1) net.ws.send(JSON.stringify({ t: 'wunlock', f: 'towns', k, value }));
}
/** Reserve a shared container before changing the hero's inventory. Released on close or disconnect. */
export function lockContainer(k: string, value: unknown): Promise<boolean> {
  if (!online() || net.ws?.readyState !== 1) return Promise.resolve(false);
  const req = ++lockSeq;
  return new Promise((resolve) => {
    lockReplies.set(req, (ok) => { if (ok) activeContainers.add(k); resolve(ok); });
    net.ws!.send(JSON.stringify({ t: 'wlock', f: 'containers', k, value, req }));
  });
}
export function saveContainer(k: string, value: unknown) {
  if (online() && net.ws?.readyState === 1) net.ws.send(JSON.stringify({ t: 'wsave', f: 'containers', k, value }));
}
export function unlockContainer(k: string, value?: unknown) {
  activeContainers.delete(k);
  if (online() && net.ws?.readyState === 1) net.ws.send(JSON.stringify({ t: 'wunlock', f: 'containers', k, value }));
}

export interface SeatDecision { ride: [number, number, number] | null; requested: [number, number, number] | null; seats?: number[]; requestedSeats?: number[] }
let seatHook: ((m: SeatDecision) => void) | null = null;
export function onSeats(f: (m: SeatDecision) => void) { seatHook = f; }
