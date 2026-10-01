// GridWorld multiplayer server (stage 1): a small relay that lets up to 8 players share one world.
// The first player to join hosts: their world seed and game clock become everyone's. The server keeps who is
// connected and where each one is, sends everybody a snapshot of the others ten times a second, and passes chat
// on. It does not run the world itself (yet): every player's game generates the same world from the seed.
//
// Two ways to run it:
// - inside the game's dev server (vite.config.ts attaches it at /mp), so whoever starts the game hosts it;
// - on its own: `node server/mp.mjs [port]` (default 7777).
//
// Protocol (JSON text frames), client → server:
//   {t:'hello', name, ver, world, time}       first message; world / time only matter for the first player (the host)
//   {t:'state', p:[x,y,z], yaw, pitch, loc, held, mv, time?}   ~10 times a second; time from the host only
//   {t:'chat', text}
// server → client:
//   {t:'welcome', id, host, world, time, players:[{id, name}]}
//   {t:'full'} / {t:'refused', why}
//   {t:'join', id, name} / {t:'leave', id, name} / {t:'host', id}
//   {t:'snap', time, ps:[{id, p, yaw, pitch, loc, held, mv}]}  everybody but you
//   {t:'chat', id, name, text}
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';

export const MP = { path: '/mp', port: 7777, max: 8, rate: 100, nameMax: 20, chatMax: 200 };
/** Protocol version: a client with another one is refused (the game shows why). */
export const PROTOCOL = 1;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** The game state of one server: its players, the world and clock, and the snapshot timer. */
export function createMp(log = (m) => console.log('[mp] ' + m)) {
  const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
  /** @type {Map<number, {id:number, ws:any, name:string, st:any, joined:number}>} */
  const players = new Map();
  let nextId = 1, hostId = 0, world = null, time = 0;

  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const all = (m, except = 0) => { for (const p of players.values()) if (p.id !== except) send(p.ws, m); };

  wss.on('connection', (ws) => {
    let me = null;
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (!me) {
        if (m.t !== 'hello') return;
        if (m.ver !== PROTOCOL) { send(ws, { t: 'refused', why: `This server runs another version of the game (protocol ${PROTOCOL}, yours ${m.ver}).` }); ws.close(); return; }
        if (players.size >= MP.max) { send(ws, { t: 'full' }); ws.close(); return; }
        let name = clean(m.name, MP.nameMax) || 'Castaway';
        if ([...players.values()].some((p) => p.name === name)) name = `${name} ${nextId}`;
        me = { id: nextId++, ws, name, st: null, joined: Date.now() };
        if (!players.size) { hostId = me.id; world = num(m.world) | 0; time = num(m.time); log(`${name} hosts world ${world}`); }
        players.set(me.id, me);
        send(ws, { t: 'welcome', id: me.id, host: hostId, world, time, players: [...players.values()].map((p) => ({ id: p.id, name: p.name })) });
        all({ t: 'join', id: me.id, name }, me.id);
        log(`${name} joined (${players.size}/${MP.max})`);
        return;
      }
      if (m.t === 'state') {
        me.st = { p: Array.isArray(m.p) ? m.p.slice(0, 3).map(num) : [0, 0, 0], yaw: num(m.yaw), pitch: num(m.pitch), loc: clean(m.loc, 80), held: clean(m.held, 24), mv: !!m.mv };
        if (me.id === hostId && typeof m.time === 'number') time = num(m.time);
      } else if (m.t === 'chat') {
        const text = clean(m.text, MP.chatMax);
        if (text) all({ t: 'chat', id: me.id, name: me.name, text });
      }
    });
    ws.on('close', () => {
      if (!me) return;
      players.delete(me.id);
      all({ t: 'leave', id: me.id, name: me.name });
      log(`${me.name} left (${players.size}/${MP.max})`);
      if (me.id === hostId) { // the longest-connected player hosts now; the world stays
        const next = [...players.values()].sort((a, b) => a.joined - b.joined)[0];
        hostId = next ? next.id : 0;
        if (next) all({ t: 'host', id: hostId }); else { world = null; log('empty: the next player to join hosts'); }
      }
    });
  });

  const timer = setInterval(() => {
    if (players.size < 2) return;
    const states = [...players.values()].filter((p) => p.st).map((p) => ({ id: p.id, ...p.st }));
    for (const p of players.values()) send(p.ws, { t: 'snap', time, ps: states.filter((s) => s.id !== p.id) });
  }, MP.rate);

  /** Take over WebSocket upgrades on `path` of an http(s) server (others, like Vite's own, are left alone). */
  const attach = (server, path = MP.path) => {
    server.on('upgrade', (req, socket, head) => {
      if ((req.url ?? '').split('?')[0] !== path) return;
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
  };
  const close = () => { clearInterval(timer); for (const p of players.values()) p.ws.terminate(); wss.close(); };
  return { attach, close, players, state: () => ({ hostId, world, time, n: players.size }) };
}

/** Run on its own: node server/mp.mjs [port] */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { createServer } = await import('node:http');
  const port = Number(process.argv[2]) || MP.port, mp = createMp(), http = createServer((_, res) => { res.end('GridWorld multiplayer server: connect from the game.'); });
  mp.attach(http);
  http.listen(port, () => console.log(`[mp] GridWorld multiplayer server on port ${port} (path ${MP.path})`));
}
