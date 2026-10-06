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
//   {t:'hello', name, ver, world, time, room?, create?: {name, world, key}}   first message; `room` picks a dedicated room,
//                                                                          `create` makes one (`key`: the creator's secret, kept
//                                                                          only as a hash, lets them delete it); hosted: world / time for the host
//   {t:'delroom', ver, room, key}         instead of a hello: delete a room you created (its players are sent away);
//                                          answered {t:'deleted', room} or {t:'refused', why}, then closed
//   {t:'state', p:[x,y,z], yaw, pitch, loc, held, mv, away, cars, ride?, gun?, boat?, time?}   boat: [boat id, u, v, h, seat] aboard one of the boats   cars: the player's own vehicles (net/client.ts PeerCar)   ~10 times a second; time from a hosted room's host only
//   {t:'chat', text}
//   {t:'drop', k, n, c?, p:[x,y,z], loc, auto?}   auto: loot that anyone takes by walking over it (kept `MP.lootTtl` h)
//   (was) {t:'drop', k, n, c?, p:[x,y,z], loc}   an item put down at your feet (taken out of your own kit first)
//   {t:'take', id}                       pick a lying item up: only the first to ask gets it
//   {t:'wset', seq, ch:[[field, key, value|null, baseline], ...]}   changes to the shared world (villages, bridges, chests...: see
//                                                      src/world/share.ts); null deletes
//   {t:'wlock', f:'containers', k, value, req} / {t:'wsave'|'wunlock', f, k, value} reserve / edit / release a container
//   {t:'wseed', doc}                     the first player who already played this world brings their world along
//   {t:'cast', m} / {t:'to', to, m}       the shared foes (src/world/foesync.ts), passed to everyone else in the room /
//                                          to player `to` as m + {from}: m.t one of 'foes' (my foes: where, how hurt),
//                                          'bolt' (one of mine fired), 'fhit' (I hit your foe), 'kill' (your shot killed
//                                          mine), 'hurt' (my foe hurt you)
// server → client:
//   {t:'welcome', id, host, world, time, players:[{id, name}], dedicated, room:{id, name}}   host 0 on a dedicated server
//   {t:'full'} / {t:'refused', why}
//   {t:'join', id, name} / {t:'leave', id, name} / {t:'host', id}
//   {t:'snap', time, ps:[{id, p, yaw, pitch, loc, held, mv, away, cars}]}  everybody in your room but you
//   {t:'chat', id, name, text}
//   {t:'drop', d:{id, k, n, c?, p, loc, by, at}}   an item now lies there (also to the one who dropped it)
//   {t:'got', d} to the one who took it / {t:'gone', id} to everyone else (or to a taker who came too late)
//   {t:'wset', ch, from, seq} ordered changes to everyone, including the writer to the shared world / {t:'wdoc', doc} the whole of it (adopt it)
//   {...m, from} what another player cast or sent you (see 'cast' / 'to')
// The welcome also carries `wdoc` (the shared world: {field: {key: value}}) and `wseeded` (whether anyone has brought
// a world to it yet). The shared world is kept with the room (server/main.mjs saves it in its own file).
// The welcome also carries `drops`: everything lying in the room's world. Lying items are kept with the room (saved by
// server/main.mjs) and vanish after `MP.dropTtl` hours.
import { mergeWorld, mergeProgress } from '../src/net/worlddoc.mjs';
import { WebSocketServer } from 'ws';
import { pathToFileURL } from 'node:url';
import { randomInt, createHash } from 'node:crypto';
import { GateConnections, GATE_TRANSIT_SECONDS } from '../shared/gates.mjs';

export const MP = { path: '/mp', port: 7777, max: 8, rate: 100, nameMax: 20, chatMax: 200, roomName: 28, rooms: 12, roomTtl: 14, cars: 8, drops: 800, dropTtl: 6, lootTtl: 0.5, payload: 4 * 1024 * 1024 };
/** What players may pass to each other through 'cast' (everyone else in the room) and 'to' (one player). */
const RELAY = new Set(['foes', 'bolt', 'fhit', 'kill', 'hurt', 'thit', 'boat', 'row']);
/** Protocol version: a client with another one is refused (the game shows why). */
export const PROTOCOL = 10;

const clean = (s, n) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const DAY = 86400000;
/** A creator's secret as the server keeps it (the secret itself is never stored or shown). */
const ownerOf = (key) => (typeof key === 'string' && key.length >= 16 ? createHash('sha256').update(key).digest('hex') : '');
const FIELDS = new Set(['towns', 'market', 'installs', 'bridges', 'bridgeSites', 'piers', 'boats', 'shuttle', 'containers', 'opened', 'unlocked', 'killed', 'harvest', 'camps', 'cityGarrisons', 'caravans', 'claims', 'benches', 'board', 'boards']);
const safeKey = (k) => typeof k === 'string' && !['__proto__', 'constructor', 'prototype'].includes(k);
const worldKey = (f, k) => FIELDS.has(f) && safeKey(k) && !(f === 'containers' && k.startsWith('home:'));
const object = (v) => v && typeof v === 'object' && !Array.isArray(v);
const cleanDoc = (doc) => Object.fromEntries(Object.entries(doc).filter(([f, v]) => FIELDS.has(f) && object(v)).map(([f, v]) => [f, Object.fromEntries(Object.entries(v).filter(([k]) => worldKey(f, k)))]));

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
    const room = { id: r.id, name: clean(r.name, MP.roomName) || 'GridWorld', world: r.world == null ? null : r.world | 0, time0: num(r.time), run: 0, since: 0, players: new Map(), hostId: 0, owner: typeof r.owner === 'string' ? r.owner : '', by: clean(r.by, MP.nameMax), created: r.created ?? Date.now(), last: r.last ?? Date.now(), drops: new Map((Array.isArray(r.drops) ? r.drops : []).map((d) => [d.id, d])), doc: object(r.doc) ? cleanDoc(r.doc) : {}, locks: new Map(), seeded: !!r.seeded, dirty: false };
    room.gates = new GateConnections(); room.trips = new Map();
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
      const room = newRoom({ id, name, world, time: 7 * 60, owner: ownerOf(m.create.key), by: m.name });
      log(`server "${name}" created (world ${world})`);
      return { room };
    }
    const room = rooms.get(typeof m.room === 'string' ? m.room : 'main') ?? null;
    return room ? { room } : { why: 'That server is gone. Pick another from the list.' };
  };

  /** Delete a room for the one who made it: its players are sent away, `opts.removed` drops its files. */
  const deleteRoom = (m) => {
    if (!dedicated) return 'Only a dedicated server keeps a list of servers.';
    const r = rooms.get(typeof m.room === 'string' ? m.room : '');
    if (!r) return 'That server is gone already.';
    if (r.id === 'main') return 'The main server cannot be deleted.';
    if (!r.owner || ownerOf(m.key) !== r.owner) return 'Only the player who created this server can delete it (from the same browser).';
    for (const trip of r.trips.values()) clearTimeout(trip.timer);
    for (const p of r.players.values()) { send(p.ws, { t: 'refused', why: `The server "${r.name}" was deleted by its creator.` }); p.ws.close(); }
    rooms.delete(r.id); opts.removed?.(r.id);
    log(`server "${r.name}" deleted by its creator`);
    return '';
  };

  wss.on('connection', (ws) => {
    let me = null, room = null;
    ws.on('message', (raw) => {
      let m;
      try { m = JSON.parse(String(raw)); } catch { return; }
      if (!m || typeof m.t !== 'string') return;
      if (!me && m.t === 'delroom') {
        const why = m.ver !== PROTOCOL ? `This server runs another version of the game (protocol ${PROTOCOL}, yours ${m.ver}). Reload the page (Ctrl+F5).` : deleteRoom(m);
        send(ws, why ? { t: 'refused', why } : { t: 'deleted', room: String(m.room) }); ws.close(); return;
      }
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
        if (!room.players.size && !dedicated) { room.hostId = me.id; if (room.world === null) { room.world = num(m.world) | 0; room.time0 = num(m.time); } log(`${name} hosts world ${room.world}`); }
        room.players.set(me.id, me); room.last = Date.now(); occupied(room, true);
        send(ws, { t: 'welcome', id: me.id, host: room.hostId, world: room.world, time: clock(room), dedicated, room: { id: room.id, name: room.name }, drops: [...room.drops.values()], wdoc: room.doc, wseeded: room.seeded, links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now(), players: [...room.players.values()].map((p) => ({ id: p.id, name: p.name })) });
        all(room, { t: 'join', id: me.id, name }, me.id);
        log(`${name} joined ${room.name} (${room.players.size}/${MP.max})`);
        return;
      }
      if (m.t === 'gdraft') {
        if (!me.trip && me.st?.loc === 'o' && !me.st.ride && !me.st.cars.some(c => c[8]) && room.gates.setDraft(m.gate, m.symbols)) all(room, { t: 'gates', links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now() });
      } else if (m.t === 'gdial') {
        const result = !me.trip && me.st?.loc === 'o' && !me.st.ride && !me.st.cars.some(c => c[8]) ? room.gates.open(room.world, m.gate, m.symbols) : { ok: false, why: 'Use a gate terminal on foot, on the surface.' };
        const state = { links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now() };
        if (result.ok) all(room, { t: 'gates', ...state });
        send(ws, { t: 'gdial', req: m.req, ...result, ...state });
      } else if (m.t === 'gtravel') {
        let ok = !me.trip && me.st?.loc === 'o' && !me.st.ride;
        const warp = m.car, index = warp?.index, car = me.st?.cars[index];
        if (warp) ok = ok && Number.isInteger(index) && car && me.st.carIds?.[index] === warp.id && !!car[8] && (car[10] ?? 100) > 0 && Array.isArray(warp.pose) && warp.pose.length === 11 && warp.pose.every(n => typeof n === 'number' && Number.isFinite(n)) && warp.pose[0] === car[0];
        else if (ok && me.st.cars.some(c => c[8])) ok = false;
        const accepted = ok ? room.gates.begin(m.gate) : null;
        if (!accepted) { send(ws, { t: 'gtravel', req: m.req, ok: false, why: 'The connection closed or this is not your occupied vehicle.' }); return; }
        const { token, to, finishAt } = accepted;
        const participants = [me, ...[...room.players.values()].filter(p => warp && p.st?.ride?.[0] === me.id && p.st.ride[1] === index)];
        participants.forEach(p => { p.trip = token; });
        all(room, { t: 'gates', links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now() });
        all(room, { t: 'gdepart', trip: token, players: participants.map(p => p.id), finishAt, now: Date.now() });
        const timer = setTimeout(() => {
          if (warp) {
            // Preserve the vehicle and seats; move only after the whole crew's five-second transit.
            const pose = [...car]; for (let i = 1; i <= 6; i++) pose[i] = warp.pose[i];
            me.st.cars[index] = pose; me.st.p = pose.slice(1, 4);
            for (const p of participants) if (p !== me && room.players.has(p.id)) p.st.p = pose.slice(1, 4);
            all(room, { t: 'vwarp', owner: me.id, index, carId: warp.id, car: pose, to, trip: token });
          }
          participants.forEach(p => { delete p.trip; });
          room.trips.delete(token); room.gates.finish(token);
          send(ws, { t: 'gtravel', req: m.req, ok: true, to });
          all(room, { t: 'gates', links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now() });
        }, GATE_TRANSIT_SECONDS * 1000);
        room.trips.set(token, { timer, owner: me.id, participants });
      } else if (m.t === 'state') {
        if (me.trip) return; // Ignore queued movement and seat changes during an accepted transport.
        const previousCars = me.st?.cars, previousIds = me.st?.carIds;
        me.st = { p: Array.isArray(m.p) ? m.p.slice(0, 3).map(num) : [0, 0, 0], yaw: num(m.yaw), pitch: num(m.pitch), loc: clean(m.loc, 80), held: clean(m.held, 24), mv: !!m.mv, away: !!m.away, cars: Array.isArray(m.cars) ? m.cars.slice(0, MP.cars).filter(Array.isArray).map((c) => c.slice(0, 11).map(num)) : [], ride: Array.isArray(m.ride) ? m.ride.slice(0, 3).map(num) : undefined, gun: typeof m.gun === 'number' ? num(m.gun) : undefined, boat: Array.isArray(m.boat) && m.boat.length === 5 ? [clean(String(m.boat[0]), 80), ...m.boat.slice(1).map(num)] : undefined };
        if (Array.isArray(m.carIds)) me.st.carIds = m.carIds.slice(0, MP.cars).map((id) => clean(id, 100));
        // The owner still simulates the vehicle; the server alone grants its seats.
        const seatOK = (car, seat) => car && (car[10] === undefined || car[10] > 0) && Number.isInteger(seat) && seat >= 0 && seat < 3 && (seat !== 2 || !!car[7]);
        const taken = (owner, idx, seat, except) => [...room.players.values()].some((p) => p.id !== except && p.st?.ride?.[0] === owner && p.st.ride[1] === idx && p.st.ride[2] === seat);
        me.st.cars.forEach((car, idx) => {
          const seat = car[8] - 1;
          if (car[8] && (!seatOK(car, seat) || taken(me.id, idx, seat, me.id))) car[8] = 0;
        });
        const r = me.st.ride, owner = r && room.players.get(r[0]), car = owner?.st?.cars[r?.[1]];
        if (r && (me.st.loc !== 'o' || owner?.st?.loc !== 'o' || owner.id === me.id || !Number.isInteger(r[1]) || r[2] < 1 || !seatOK(car, r[2]) || car[8] === r[2] + 1 || taken(r[0], r[1], r[2], me.id) || me.st.cars.some((c) => c[8]))) me.st.ride = undefined;
        if (!me.st.ride || me.st.ride[2] !== 2) me.st.gun = undefined;
        send(ws, { t: 'seats', ride: me.st.ride ?? null, requested: m.ride ?? null, seats: me.st.cars.map((c) => c[8] ?? 0), requestedSeats: Array.isArray(m.cars) ? m.cars.filter(Array.isArray).slice(0, MP.cars).map((c) => c[8] ?? 0) : [] });
        // Removed cars, changed locations and missing cannons revoke the affected riders immediately.
        for (const p of room.players.values()) {
          const ride = p.st?.ride;
          if (!ride || ride[0] !== me.id) continue;
          const c = me.st.cars[ride[1]];
          if (me.st.loc !== 'o' || !seatOK(c, ride[2]) || previousCars?.[ride[1]]?.[0] !== c?.[0] || previousIds?.[ride[1]] !== me.st.carIds?.[ride[1]]) {
            p.st.ride = undefined; p.st.gun = undefined;
            send(p.ws, { t: 'seats', ride: null, requested: ride });
          }
        }
        if (!dedicated && me.id === room.hostId && typeof m.time === 'number') room.time0 = num(m.time);
      } else if (m.t === 'drop') {
        const k = clean(m.k, 24), n = Math.max(1, Math.min(9999, Math.floor(num(m.n))));
        if (!k || !Array.isArray(m.p)) return;
        if (room.drops.size >= MP.drops) { const old = room.drops.keys().next().value; room.drops.delete(old); all(room, { t: 'gone', id: old }); }
        const d = { id: 'd' + (dropSeq++).toString(36) + randomInt(1000, 9999).toString(36), k, n, p: m.p.slice(0, 3).map(num), loc: clean(m.loc, 80), by: me.name, at: Date.now() };
        if (typeof m.c === 'number' && Number.isFinite(m.c)) d.c = m.c;
        if (m.auto) d.auto = true; // loot (kills, felled trees...): taken by walking over it, lies only `MP.lootTtl` h
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
          if (!Array.isArray(c) || !worldKey(c[0], c[1])) continue;
          const [field, key, value, base] = c, f = (room.doc[field] ??= {});
          const lock = room.locks.get(field + ':' + key);
          const stale = field === 'containers' && c.length > 3 && JSON.stringify(base ?? null) !== JSON.stringify(f[key] ?? null);
          if ((!lock || lock === me.id) && !stale) {
            const merge = ['opened', 'unlocked', 'killed'].includes(field) ? mergeProgress : mergeWorld;
            const v = c.length > 3 ? merge(f[key], base, value) : value;
            if (v == null) delete f[key]; else f[key] = v;
            room.seeded = true; room.dirty = true;
          }
          ch.push(stale || (lock && lock !== me.id) ? [field, key, f[key] ?? null, true] : [field, key, f[key] ?? null]);
        }
        // Echo to the writer too: every client observes the same server order, including conflicts.
        send(ws, { t: 'wset', ch, from: me.id, seq: m.seq });
        const accepted = ch.filter((c) => !c[3]);
        if (accepted.length) all(room, { t: 'wset', ch: accepted, from: me.id, seq: m.seq }, me.id);
      } else if (m.t === 'wlock' && worldKey(m.f, m.k) && ['containers', 'towns'].includes(m.f)) {
        const key = m.f + ':' + m.k, holder = room.locks.get(key);
        const ok = !holder || holder === me.id;
        if (ok) {
          room.locks.set(key, me.id);
          const f = (room.doc[m.f] ??= {});
          if (!(m.k in f) && object(m.value)) { f[m.k] = m.value; room.seeded = true; room.dirty = true; }
          all(room, { t: 'wset', ch: [[m.f, m.k, f[m.k] ?? null]], force: true });
        }
        send(ws, { t: 'wlock', req: m.req, ok });
      } else if ((m.t === 'wunlock' || m.t === 'wsave') && worldKey(m.f, m.k)) {
        const key = m.f + ':' + m.k;
        if (room.locks.get(key) !== me.id) return;
        if (object(m.value)) {
          (room.doc[m.f] ??= {})[m.k] = m.value;
          room.seeded = true; room.dirty = true;
          all(room, { t: 'wset', ch: [[m.f, m.k, m.value]], force: true, from: me.id });
        }
        if (m.t === 'wunlock') room.locks.delete(key);
      } else if (m.t === 'wseed' && m.doc && typeof m.doc === 'object') {
        if (room.seeded) send(ws, { t: 'wdoc', doc: room.doc }); // someone was first: take theirs
        else { room.doc = cleanDoc(m.doc); room.seeded = true; room.dirty = true; all(room, { t: 'wdoc', doc: room.doc, from: me.id }); log(`${me.name} brought their world to ${room.name}`); }
      } else if ((m.t === 'cast' || m.t === 'to') && m.m && typeof m.m === 'object' && RELAY.has(m.m.t)) {
        // the shared foes (src/world/foesync.ts): passed on as they are, with who sent them
        const out = { ...m.m, from: me.id };
        if (m.t === 'cast') all(room, out, me.id);
        else { const p = room.players.get(num(m.to)); if (p) send(p.ws, out); }
      } else if (m.t === 'chat') {
        const text = clean(m.text, MP.chatMax);
        if (text) all(room, { t: 'chat', id: me.id, name: me.name, text });
      }
    });
    ws.on('close', () => {
      if (!me) return;
      const trip = room.trips.get(me.trip);
      if (trip?.owner === me.id) {
        const token = me.trip; clearTimeout(trip.timer); room.trips.delete(token); room.gates.finish(token);
        trip.participants.forEach(p => { delete p.trip; });
        all(room, { t: 'gabort', trip: token });
        all(room, { t: 'gates', links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now() });
      }
      room.players.delete(me.id);
      for (const [key, id] of room.locks) if (id === me.id) room.locks.delete(key);
      room.last = Date.now();
      for (const p of room.players.values()) if (p.st?.ride?.[0] === me.id) { const requested = p.st.ride; p.st.ride = undefined; p.st.gun = undefined; send(p.ws, { t: 'seats', ride: null, requested }); }
      all(room, { t: 'leave', id: me.id, name: me.name });
      log(`${me.name} left ${room.name} (${room.players.size}/${MP.max})`);
      if (!room.players.size) occupied(room, false); // nobody left: the room's clock stands still
      if (!dedicated && me.id === room.hostId) { // the longest-connected player hosts now; the world stays
        const next = [...room.players.values()].sort((a, b) => a.joined - b.joined)[0];
        room.hostId = next ? next.id : 0;
        if (next) all(room, { t: 'host', id: room.hostId }); else log('empty: keeping the world for reconnecting players');
      }
    });
  });

  const timer = setInterval(() => {
    for (const room of rooms.values()) {
      if (room.players.size < (dedicated ? 1 : 2)) continue; // alone in a dedicated room the snapshots still carry its clock
      const t = clock(room), states = [...room.players.values()].filter((p) => p.st).map((p) => ({ id: p.id, ...p.st }));
      for (const p of room.players.values()) send(p.ws, { t: 'snap', time: t, links: room.gates.state(), drafts: room.gates.draftState(), now: Date.now(), ps: states.filter((s) => s.id !== p.id) });
    }
  }, MP.rate);
  // empty rooms nobody has come back to are forgotten (never the first one)
  const sweep = setInterval(() => {
    for (const r of rooms.values()) for (const d of [...r.drops.values()]) if (Date.now() - d.at > (d.auto ? MP.lootTtl : MP.dropTtl) * 3600000) { r.drops.delete(d.id); all(r, { t: 'gone', id: d.id }); }
    for (const r of [...rooms.values()]) if (r.id !== 'main' && !r.players.size && Date.now() - r.last > MP.roomTtl * DAY) { rooms.delete(r.id); opts.removed?.(r.id); log(`server "${r.name}" forgotten (empty for ${MP.roomTtl} days)`); }
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
  const close = () => { clearInterval(timer); clearInterval(sweep); for (const r of rooms.values()) { for (const trip of r.trips.values()) clearTimeout(trip.timer); for (const p of r.players.values()) p.ws.terminate(); } wss.close(); };
  /** The rooms as the menu lists them, and as server/main.mjs saves them. */
  const list = () => [...rooms.values()].map((r) => ({ id: r.id, name: r.name, world: r.world, time: Math.round(clock(r)), online: r.players.size, max: MP.max, running: r.players.size > 0, players: [...r.players.values()].map((p) => p.name), by: r.by, created: r.created, last: r.last }));
  /** What server/main.mjs saves: the rooms with their clocks and the items lying in their worlds. */
  const save = () => list().map(({ id, name, world, time, by, created, last }) => ({ id, name, world, time, owner: rooms.get(id).owner, by, created, last, drops: [...rooms.get(id).drops.values()] }));
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
