// GridWorld multiplayer server: a small relay that lets up to 8 players share one world.
// It keeps who is connected and where each one is, sends everybody a snapshot of the others ten times a second, and
// passes chat on. It does not run the world itself (yet): every player's game generates the same world from the seed.
//
// Two modes:
// - dedicated (`createMp(log, {rooms | world, time})`, used by server/main.mjs on a VPS): the server holds many game
//   servers ("rooms"), each with its own name, world seed and clock. The menu lists them; a player joins one or creates
//   a new one. A room's clock runs while anyone is in it and stands still while it is empty (a player in the menu is
//   still in it). Empty rooms are forgotten after `MP.roomTtl` days (the first room, 'main', never).
// - hosted (`createMp(log)`, the game's own dev server via vite.config.ts): one room; the first player to join hosts
//   it: their world seed and clock become everyone's. When the host leaves, the longest-connected player hosts.
// Standalone: `node server/mp.mjs [port]` (default 7777, hosted mode).
//
// Protocol (JSON text frames), client → server:
//   {t:'hello', name, ver, world, time, room?, create?: {name, world}}   first message; `room` picks a dedicated room,
//                                                                          `create` makes one; hosted: world / time for the host
//   {t:'state', p:[x,y,z], yaw, pitch, loc, held, mv, away, cars, ride?, gun?, time?}   cars: the player's own vehicles (net/client.ts PeerCar)   ~10 times a second; time from a hosted room's host only
//   {t:'chat', text}
//   {t:'drop', k, n, c?, p:[x,y,z], loc}   an item put down at your feet (taken out of your own kit first)
//   {t:'take', id}                       pick a lying item up: only the first to ask gets it
//   {t:'wset', ch:[[field, key, value|null], ...]}   changes to the shared world (villages, bridges, chests...: see
//                                                      src/world/share.ts); null deletes
//   {t:'wseed', doc}                     the first player who already played this world brings their world along
// server → client:
//   {t:'welcome', id, host, world, time, players:[{id, name}], dedicated, room:{id, name}}   host 0 on a dedicated server
//   {t:'full'} / {t:'refused', why}
//   {t:'join', id, name} / {t:'leave', id, name} / {t:'host', id}
//   {t:'snap', time, ps:[{id, p, yaw, pitch, loc, held, mv, away, cars}]}  everybody in your room but you
//   {t:'chat', id, name, text}
//   {t:'drop', d:{id, k, n, c?, p, loc, by, at}}   an item now lies there (also to the one who dropped it)
//   {t:'got', d} to the one who took it / {t:'gone', id} to everyone else (or to a taker who came too late)
//   {t:'wset', ch} the others' changes to the shared world / {t:'wdoc', doc} the whole of it (adopt it)
// The welcome also carries `wdoc` (the shared world: {field: {key: value}}) and `wseeded` (whether anyone has brought
// a world to it yet). The shared world is kept with the room (server/main.mjs saves it in its own file).
// The welcome also carries `drops`: everything lying in the room's world. Lying items are kept with the room (saved by
// server/main.mjs) and vanish after `MP.dropTtl` hours.
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import { randomInt } from 'node:crypto';

export const MP = { path: '/mp', port: 7777, max: 8, rate: 100, nameMax: 20, chatMax: 200, roomName: 28, rooms: 12, roomTtl: 14, cars: 8, drops: 300, dropTtl: 6, payload: 4 * 1024 * 1024 };
/** Protocol version: a client with another one is refused (the game shows why). */
export const PROTOCOL = 2;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const DAY = 86400000;

/**
 * The game state of one server: its rooms, their players, worlds and clocks, and the snapshot timer.
 * opts: dedicated with `rooms` ([{id, name, world, time, created?, last?}], the first is 'main') or the old single
 * `world` / `time` (one room 'main' named `name`); none = hosted.
 */
export function createMp(log = (m) => console.log('[mp] ' + m), opts = {}) {
  const dedicated = Array.isArray(opts.rooms) || typeof opts.world === 'number';
  const wss = new WebSocketServer({ noServer: true, maxPayload: MP.payload });
  /** @type {Map<string, any>} */
  const rooms = new Map();
  let nextId = 1, dropSeq = 1;
  const newRoom = (r) => {
    const room = { id: r.id, name: clean(r.name, MP.roomName) || 'GridWorld', world: r.world == null ? null : r.world | 0, time0: num(r.time), run: 0, since: 0, players: new Map(), hostId: 0, created: r.created ?? Date.now(), last: r.last ?? Date.now(), drops: new Map((Array.isArray(r.drops) ? r.drops : []).map((d) => [d.id, d])), doc: r.doc && typeof r.doc === 'object' ? r.doc : {}, seeded: !!r.seeded, dirty: false };
    rooms.set(room.id, room);
    return room;
  };
  if (dedicated) {
    const list = Array.isArray(opts.rooms) && opts.rooms.length ? opts.rooms : [{ id: 'main', name: opts.name ?? 'GridWorld server', world: opts.world, time: opts.time }];
    for (const r of list) newRoom(r);
  } else newRoom({ id: 'lan', name: 'LAN game', world: null, time: 0 });
  /** A room's game clock: a dedicated room's runs while someone is in it; a hosted room's is the host's. */
  const clock = (room) => (dedicated ? room.time0 + (room.run + (room.since ? Date.now() - room.since : 0)) / 1000 : room.time0);
  const occupied = (room, on) => { // start / stop a dedicated room's clock
    if (!dedicated) return;
    if (on && !room.since) room.since = Date.now();
    if (!on && room.since) { room.run += Date.now() - room.since; room.since = 0; }
  };

  const send = (ws, m) => { if (ws.readyState === 1) ws.send(JSON.stringify(m)); };
  const all = (room, m, except = 0) => { for (const p of room.players.values()) if (p.id !== except) send(p.ws, m); };

  const pickRoom = (m) => {
    if (!dedicated) return { room: rooms.get('lan') };
    if (m.create && typeof m.create === 'object') {
      const name = clean(m.create.name, MP.roomName);
      if (!name) return { why: 'Give the new server a name.' };
      if ([...rooms.values()].some((r) => r.name.toLowerCase() === name.toLowerCase())) return { why: `There is already a server called ${name}.` };
      if (rooms.size >= MP.rooms) return { why: `This machine already holds ${MP.rooms} servers. Join one of them.` };
      const world = Number.isFinite(m.create.world) ? m.create.world | 0 : randomInt(1, 2 ** 31 - 1);
      let id; do id = 'r' + randomInt(100000, 999999); while (rooms.has(id));
      const room = newRoom({ id, name, world, time: 7 * 60 });
      log(`server "${name}" created (world ${world})`);
      return { room };
    }
    const room = rooms.get(typeof m.room === 'string' ? m.room : 'main') ?? null;
    return room ? { room } : { why: 'That server is gone. Pick another from the list.' };
  };

  wss.on('connection', (ws) => {
    let me = null, room = null;
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (!me) {
        if (m.t !== 'hello') return;
        if (m.ver !== PROTOCOL) { send(ws, { t: 'refused', why: `This server runs another version of the game (protocol ${PROTOCOL}, yours ${m.ver}). Reload the page (Ctrl+F5).` }); ws.close(); return; }
        const got = pickRoom(m);
        if (!got.room) { send(ws, { t: 'refused', why: got.why }); ws.close(); return; }
        room = got.room;
        if (room.players.size >= MP.max) { send(ws, { t: 'full' }); ws.close(); return; }
        let name = clean(m.name, MP.nameMax) || 'Castaway';
        if ([...room.players.values()].some((p) => p.name === name)) name = `${name} ${nextId}`;
        me = { id: nextId++, ws, name, st: null, joined: Date.now() };
        if (!room.players.size && !dedicated) { room.hostId = me.id; room.world = num(m.world) | 0; room.time0 = num(m.time); log(`${name} hosts world ${room.world}`); }
        room.players.set(me.id, me); room.last = Date.now(); occupied(room, true);
        send(ws, { t: 'welcome', id: me.id, host: room.hostId, world: room.world, time: clock(room), dedicated, room: { id: room.id, name: room.name }, drops: [...room.drops.values()], wdoc: room.doc, wseeded: room.seeded, players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name })) });
        all(room, { t: 'join', id: me.id, name }, me.id);
        log(`${name} joined ${room.name} (${room.players.size}/${MP.max})`);
        return;
      }
      if (m.t === 'state') {
        me.st = { p: Array.isArray(m.p) ? m.p.slice(0, 3).map(num) : [0, 0, 0], yaw: num(m.yaw), pitch: num(m.pitch), loc: clean(m.loc, 80), held: clean(m.held, 24), mv: !!m.mv, away: !!m.away, cars: Array.isArray(m.cars) ? m.cars.slice(0, MP.cars).filter(Array.isArray).map((c) => c.slice(0, 10).map(num)) : [], ride: Array.isArray(m.ride) ? m.ride.slice(0, 3).map(num) : undefined, gun: typeof m.gun === 'number' ? num(m.gun) : undefined };
        if (!dedicated && me.id === room.hostId && typeof m.time === 'number') room.time0 = num(m.time);
      } else if (m.t === 'drop') {
        const k = clean(m.k, 24), n = Math.max(1, Math.min(9999, Math.floor(num(m.n))));
        if (!k || !Array.isArray(m.p)) return;
        if (room.drops.size >= MP.drops) { const old = room.drops.keys().next().value; room.drops.delete(old); all(room, { t: 'gone', id: old }); }
        const d = { id: 'd' + (dropSeq++).toString(36) + randomInt(1000, 9999).toString(36), k, n, p: m.p.slice(0, 3).map(num), loc: clean(m.loc, 80), by: me.name, at: Date.now() };
        if (typeof m.c === 'number' && Number.isFinite(m.c)) d.c = m.c;
        room.drops.set(d.id, d);
        all(room, { t: 'drop', d });
      } else if (m.t === 'take') {
        const d = room.drops.get(String(m.id));
        if (!d) { send(ws, { t: 'gone', id: String(m.id) }); return; } // someone was quicker
        room.drops.delete(d.id);
        send(ws, { t: 'got', d });
        all(room, { t: 'gone', id: d.id }, me.id);
      } else if (m.t === 'wset' && Array.isArray(m.ch)) {
        const ch = [];
        for (const c of m.ch) {
          if (!Array.isArray(c) || typeof c[0] !== 'string' || typeof c[1] !== 'string') continue;
          const f = (room.doc[c[0]] ??= {});
          if (c[2] === null || c[2] === undefined) delete f[c[1]]; else f[c[1]] = c[2];
          ch.push([c[0], c[1], c[2] ?? null]);
        }
        if (ch.length) { room.seeded = true; room.dirty = true; all(room, { t: 'wset', ch }, me.id); }
      } else if (m.t === 'wseed' && m.doc && typeof m.doc === 'object') {
        if (room.seeded) send(ws, { t: 'wdoc', doc: room.doc }); // someone was first: take theirs
        else { room.doc = m.doc; room.seeded = true; room.dirty = true; all(room, { t: 'wdoc', doc: room.doc }, me.id); log(`${me.name} brought their world to ${room.name}`); }
      } else if (m.t === 'chat') {
        const text = clean(m.text, MP.chatMax);
        if (text) all(room, { t: 'chat', id: me.id, name: me.name, text });
      }
    });
    ws.on('close', () => {
      if (!me) return;
      room.players.delete(me.id); room.last = Date.now();
      all(room, { t: 'leave', id: me.id, name: me.name });
      log(`${me.name} left ${room.name} (${room.players.size}/${MP.max})`);
      if (!room.players.size) occupied(room, false); // nobody left: the room's clock stands still
      if (!dedicated && me.id === room.hostId) { // the longest-connected player hosts now; the world stays
        const next = [...room.players.values()].sort((a, b) => a.joined - b.joined)[0];
        room.hostId = next ? next.id : 0;
        if (next) all(room, { t: 'host', id: room.hostId }); else { room.world = null; room.drops.clear(); room.doc = {}; room.seeded = false; log('empty: the next player to join hosts'); }
      }
    });
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.players.size < (dedicated ? 1 : 2)) continue; // alone in a dedicated room the snapshots still carry its clock
      const t = clock(room), states = [...room.players.values()].filter((p) => p.st).map((p) => ({ id: p.id, ...p.st }));
      for (const p of room.players.values()) send(p.ws, { t: 'snap', time: t, ps: states.filter((s) => s.id !== p.id) });
    }
  }, MP.rate);
  // empty rooms nobody has come back to are forgotten (never the first one)
  const sweep = setInterval(() => {
    for (const r of rooms.values()) for (const d of [...r.drops.values()]) if (Date.now() - d.at > MP.dropTtl * 3600000) { r.drops.delete(d.id); all(r, { t: 'gone', id: d.id }); }
    for (const r of [...rooms.values()]) if (r.id !== 'main' && !r.players.size && Date.now() - r.last > MP.roomTtl * DAY) { rooms.delete(r.id); log(`server "${r.name}" forgotten (empty for ${MP.roomTtl} days)`); }
  }, 60000);

  /** Take over WebSocket upgrades on `path` of an http(s) server (others, like Vite's own, are left alone);
   * also on <prefix>`path`, for a reverse proxy that passes a sub-path (/gridworld/mp) on unchanged. */
  const attach = (server, path = MP.path) => {
    server.on('upgrade', (req, socket, head) => {
      const p = (req.url ?? '').split('?')[0];
      if (p !== path && !p.endsWith(path)) return;
      wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
    });
  };
  const close = () => { clearInterval(timer); clearInterval(sweep); for (const r of rooms.values()) for (const p of r.players.values()) p.ws.terminate(); wss.close(); };
  /** The rooms as the menu lists them, and as server/main.mjs saves them. */
  const list = () => [...rooms.values()].map((r) => ({ id: r.id, name: r.name, world: r.world, time: Math.round(clock(r)), online: r.players.size, max: MP.max, running: r.players.size > 0, players: [...r.players.values()].map((p) => p.name), created: r.created, last: r.last }));
  /** What server/main.mjs saves: the rooms with their clocks and the items lying in their worlds. */
  const save = () => list().map(({ id, name, world, time, created, last }) => ({ id, name, world, time, created, last, drops: [...rooms.get(id).drops.values()] }));
  /** The rooms' shared worlds that changed since the last call (server/main.mjs writes each to its own file). */
  const dirtyDocs = () => [...rooms.values()].filter((r) => r.dirty).map((r) => { r.dirty = false; return { id: r.id, doc: r.doc, seeded: r.seeded }; });
  const first = () => rooms.values().next().value;
  return {
    attach, close, dedicated, list, save, dirtyDocs,
    get players() { return first().players; },
    state: () => { const r = first(); return { hostId: r.hostId, world: r.world, time: clock(r), n: r.players.size, names: [...r.players.values()].map((p) => p.name) }; },
  };
}

/** Run on its own: node server/mp.mjs [port] */
if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { createServer } = await import('node:http');
  const port = Number(process.argv[2]) || MP.port, mp = createMp(), http = createServer((_, res) => { res.end('GridWorld multiplayer server: connect from the game.'); });
  mp.attach(http);
  http.listen(port, () => console.log(`[mp] GridWorld multiplayer server on port ${port} (path ${MP.path})`));
}
