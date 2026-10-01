// The multiplayer connection (stage 1): talks to server/mp.mjs over a WebSocket. It knows nothing of three.js or
// the page: it keeps who is online and their last positions, and tells the game through callbacks. The game drives
// it with `sendState` (about 10 times a second) and reads `peers`.

/** Must match PROTOCOL in server/mp.mjs. */
export const PROTOCOL = 1;
export const SEND_EVERY = 0.1;

export interface PeerState { p: [number, number, number]; yaw: number; pitch: number; loc: string; held: string; mv: boolean }
export interface Peer {
  id: number; name: string;
  /** The last two states and when they came: the drawing eases between them. */
  st: PeerState | null; prev: PeerState | null; at: number;
}
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

export const net = {
  ws: null as WebSocket | null,
  /** Our id on the server, and the host's (0 = not connected). */
  id: 0, host: 0,
  peers: new Map<number, Peer>(),
  address: '',
  /** A dedicated server (server/main.mjs): the world and the clock are the server's, nobody hosts. */
  dedicated: false,
};
export const online = () => net.id > 0;
export const isHost = () => online() && net.id === net.host;

/** Is the page served by a dedicated server (server/main.mjs)? It answers mp/info next to the page. */
export interface ServerInfo { dedicated: boolean; name: string; world: number; online: number; max: number; players: string[]; version: string }
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
export function connect(url: string, me: { name: string; world: number; time: number }, h: NetHooks) {
  disconnect();
  hooks = h; net.address = url;
  let ws: WebSocket;
  try { ws = new WebSocket(url); } catch { h.closed(`Not a server address: ${url}`); return; }
  net.ws = ws;
  let welcomed = false, why = '';
  ws.onopen = () => ws.send(JSON.stringify({ t: 'hello', ver: PROTOCOL, name: me.name, world: me.world, time: me.time }));
  ws.onmessage = (e) => {
    let m: any;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    switch (m.t) {
      case 'welcome':
        welcomed = true; net.id = m.id; net.host = m.host; net.dedicated = !!m.dedicated; net.peers.clear();
        for (const p of m.players) if (p.id !== m.id) net.peers.set(p.id, { id: p.id, name: p.name, st: null, prev: null, at: 0 });
        h.welcome(m.world, m.time, m.id === m.host, net.dedicated);
        break;
      case 'join': net.peers.set(m.id, { id: m.id, name: m.name, st: null, prev: null, at: 0 }); h.say(`${m.name} joined the game.`, 'info'); break;
      case 'leave': net.peers.delete(m.id); h.say(`${m.name} left the game.`, 'info'); break;
      case 'host': net.host = m.id; h.say(m.id === net.id ? 'The host left: you host the game now.' : `${net.peers.get(m.id)?.name ?? 'Someone'} hosts the game now.`, 'info'); break;
      case 'snap': {
        const now = performance.now();
        for (const s of m.ps) {
          const p = net.peers.get(s.id);
          if (!p) continue;
          p.prev = p.st; p.st = { p: s.p, yaw: s.yaw, pitch: s.pitch, loc: s.loc, held: s.held, mv: s.mv }; p.at = now;
        }
        if (!isHost()) h.clock(m.time);
        break;
      }
      case 'chat': h.say(`${m.name}: ${m.text}`, 'chat'); break;
      case 'full': why = 'The server is full (8 players).'; break;
      case 'refused': why = m.why; break;
    }
  };
  ws.onclose = () => {
    if (net.ws !== ws) return;
    net.ws = null; net.id = 0; net.host = 0; net.dedicated = false; net.peers.clear();
    h.closed(why || (welcomed ? 'Disconnected from the server.' : `Could not reach a server at ${url}.`));
  };
}
export function disconnect() {
  const ws = net.ws;
  net.ws = null; net.id = 0; net.host = 0; net.dedicated = false; net.peers.clear();
  if (ws) { ws.onclose = null; ws.close(); }
}
export function sendState(s: PeerState, time?: number) {
  if (!online() || net.ws?.readyState !== 1) return;
  net.ws.send(JSON.stringify({ t: 'state', ...s, ...(isHost() && time !== undefined ? { time } : {}) }));
}
export function sendChat(text: string) {
  const t = text.trim().slice(0, 200);
  if (!t || !online() || net.ws?.readyState !== 1) return false;
  net.ws.send(JSON.stringify({ t: 'chat', text: t }));
  hooks?.say(`You: ${t}`, 'chat');
  return true;
}
