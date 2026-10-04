import { gateAddresses } from '../shared/gates.mjs';
import { describe, it, expect, afterEach, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { createMp, PROTOCOL } from '../server/mp.mjs';
import { PROTOCOL as CLIENT_PROTOCOL, serverUrl } from '../src/net/client';

type Msg = { t: string; [k: string]: any };
let http: Server | null = null, mp: ReturnType<typeof createMp> | null = null;
afterEach(() => { mp?.close(); http?.close(); vi.restoreAllMocks(); http = mp = null; });

async function server(opts?: { world?: number; time?: number; rooms?: { id: string; name: string; world: number; time: number }[] }) {
  mp = createMp(() => {}, opts); http = createServer(); mp.attach(http);
  await new Promise<void>((r) => http!.listen(0, r));
  return (http.address() as { port: number }).port;
}
/** A test client: connects, says hello, keeps every message it gets. */
async function client(port: number, hello: object) {
  const ws = new WebSocket(`ws://127.0.0.1:${port}/mp`), got: Msg[] = [];
  ws.on('message', (d) => got.push(JSON.parse(String(d))));
  await new Promise((r) => ws.on('open', r));
  ws.send(JSON.stringify({ t: 'hello', ver: PROTOCOL, ...hello }));
  const wait = async (t: string, n = 1) => { for (let i = 0; i < 400; i++) { if (got.filter((m) => m.t === t).length >= n) return got.filter((m) => m.t === t)[n - 1]; await new Promise((r) => setTimeout(r, 20)); } throw new Error('no ' + t); };
  const until = async (test: (m: Msg) => boolean) => { for (let i = 0; i < 400; i++) { const found = got.find(test); if (found) return found; await new Promise((r) => setTimeout(r, 20)); } throw new Error('no matching message'); };
  return { ws, got, wait, until, send: (m: object) => ws.send(JSON.stringify(m)) };
}

describe('multiplayer server', () => {
  it('the first player hosts: their world and clock are everyone\'s; others see them move and chat', async () => {
    expect(CLIENT_PROTOCOL).toBe(PROTOCOL);
    const port = await server();
    const a = await client(port, { name: 'Ada', world: 4242, time: 900 });
    const wa = await a.wait('welcome');
    expect(wa.host).toBe(wa.id); expect(wa.world).toBe(4242);
    const b = await client(port, { name: 'Ada', world: 1, time: 5 });
    const wb = await b.wait('welcome');
    expect(wb.world).toBe(4242); expect(wb.time).toBe(900); expect(wb.host).toBe(wa.id);
    expect(wb.players.map((p: { name: string }) => p.name)).toEqual(['Ada', 'Ada 2']); // the same name gets a number
    expect((await a.wait('join')).name).toBe('Ada 2');
    a.send({ t: 'state', p: [10, 2, -5], yaw: 1, pitch: 0, loc: 'o', held: 'blaster', mv: true, time: 960, cars: [[0, 5, 1, 6, 0.5, 0, 0, 1, 1], 'junk', [1, 2]] });
    b.send({ t: 'state', p: [0, 0, 0], yaw: 0, pitch: 0, loc: 'o', held: '', mv: false, time: 1 }); // a guest's clock is ignored
    const snap = await b.wait('snap', 2);
    expect(snap.time).toBe(960);
    expect(snap.ps).toEqual([{ id: wa.id, p: [10, 2, -5], yaw: 1, pitch: 0, loc: 'o', held: 'blaster', mv: true, away: false, cars: [[0, 5, 1, 6, 0.5, 0, 0, 1, 1], [1, 2]] }]);
    b.send({ t: 'chat', text: 'hello <b>there</b>' });
    expect((await a.wait('chat')).text).toBe('hello bthere/b');
    // the host leaves: the other player hosts, the world stays
    a.ws.close();
    expect((await b.wait('leave')).id).toBe(wa.id);
    expect((await b.wait('host')).id).toBe(wb.id);
    expect(mp!.state().world).toBe(4242);
    b.ws.close();
  });
  it('refuses another version, and a ninth player', async () => {
    const port = await server();
    const old = await client(port, { ver: 0, name: 'Old' });
    expect((await old.wait('refused')).why).toMatch(/version/);
    const eight = [];
    for (let i = 0; i < 8; i++) { const c = await client(port, { name: 'P' + i, world: 7 }); await c.wait('welcome'); eight.push(c); }
    const ninth = await client(port, { name: 'Late', world: 7 });
    await ninth.wait('full');
    for (const c of eight) c.ws.close();
  });
  it('a dedicated server owns the world and runs the clock: nobody hosts', async () => {
    const port = await server({ world: 777, time: 600 });
    const a = await client(port, { name: 'Ada', world: 1, time: 5 });
    const wa = await a.wait('welcome');
    expect(wa.dedicated).toBe(true); expect(wa.host).toBe(0); expect(wa.world).toBe(777);
    expect(wa.time).toBeGreaterThanOrEqual(600); expect(wa.time).toBeLessThan(601);
    a.send({ t: 'state', p: [1, 2, 3], yaw: 0, pitch: 0, loc: 'o', held: '', mv: false, time: 99999 }); // ignored
    const snap = await a.wait('snap'); // alone, the snapshots still bring the clock
    expect(snap.time).toBeGreaterThanOrEqual(600); expect(snap.time).toBeLessThan(605);
    const b = await client(port, { name: 'Bob', world: 2 });
    expect((await b.wait('welcome')).world).toBe(777);
    a.ws.close();
    await b.wait('leave');
    await new Promise((r) => setTimeout(r, 150));
    expect(b.got.some((m) => m.t === 'host')).toBe(false);
    expect(mp!.state().world).toBe(777);
    b.ws.close();
  });
  it('a dedicated server holds many rooms: list, create, join one; each room its own world, players and clock', async () => {
    const port = await server({ rooms: [{ id: 'main', name: 'Main', world: 11, time: 100 }, { id: 'r2', name: 'Night Shift', world: 22, time: 5000 }] });
    expect(mp!.list().map((r) => [r.id, r.name, r.world, r.online, r.running])).toEqual([['main', 'Main', 11, 0, false], ['r2', 'Night Shift', 22, 0, false]]);
    // an empty room's clock stands still
    const t0 = mp!.list()[1].time; await new Promise((r) => setTimeout(r, 1100)); expect(mp!.list()[1].time).toBe(t0);
    const a = await client(port, { name: 'Ada', room: 'r2' }), wa = await a.wait('welcome');
    expect(wa.room).toEqual({ id: 'r2', name: 'Night Shift' }); expect(wa.world).toBe(22); expect(wa.host).toBe(0);
    const b = await client(port, { name: 'Bob' }), wb = await b.wait('welcome'); // no room: the main one
    expect(wb.world).toBe(11); expect(wb.players.map((p: { name: string }) => p.name)).toEqual(['Bob']);
    // with someone in it a room's clock runs; the rooms do not see each other
    await new Promise((r) => setTimeout(r, 1100));
    expect(mp!.list()[1].time).toBeGreaterThan(5000.9); expect(mp!.list()[1].running).toBe(true);
    a.send({ t: 'state', p: [1, 1, 1], yaw: 0, pitch: 0, loc: 'o', held: '', mv: false, away: true });
    await b.wait('snap', 3); expect(b.got.filter((m) => m.t === 'snap').every((m) => m.ps.length === 0)).toBe(true);
    // create a room (and join it); a taken name is refused
    const c = await client(port, { name: 'Cy', create: { name: 'Cy Base', world: 33 } }), wc = await c.wait('welcome');
    expect(wc.world).toBe(33); expect(wc.room.name).toBe('Cy Base'); expect(mp!.list().length).toBe(3);
    const d = await client(port, { name: 'Di', create: { name: 'cy base' } });
    expect((await d.wait('refused')).why).toMatch(/already/);
    const e = await client(port, { name: 'Ed', room: 'nope' });
    expect((await e.wait('refused')).why).toMatch(/gone/);
    // the room empties: its clock stops where it was
    a.ws.close(); await new Promise((r) => setTimeout(r, 150));
    const stopped = mp!.list()[1].time; await new Promise((r) => setTimeout(r, 1100));
    expect(mp!.list()[1].time).toBe(stopped); expect(mp!.list()[1].running).toBe(false);
    b.ws.close(); c.ws.close();
  });
  it('items put down lie for everyone in the room; only the first to take one gets it; they are kept with the room', async () => {
    const port = await server({ rooms: [{ id: 'main', name: 'Main', world: 11, time: 100 }] });
    const a = await client(port, { name: 'Ada' }), b = await client(port, { name: 'Bob' });
    await a.wait('welcome'); await b.wait('welcome');
    a.send({ t: 'drop', k: 'medkit', n: 2, p: [5, 1, 6], loc: 'o' });
    a.send({ t: 'drop', k: 'lwheel', n: 1, c: 63, p: [7, 1, 6], loc: 'o' });
    const da = await a.wait('drop'), db = await b.wait('drop', 2);
    expect(da.d).toMatchObject({ k: 'medkit', n: 2, p: [5, 1, 6], loc: 'o', by: 'Ada' });
    expect(db.d).toMatchObject({ k: 'lwheel', c: 63 });
    // both ask for the medkits at once: one gets them, the other hears they are gone
    a.send({ t: 'take', id: da.d.id }); b.send({ t: 'take', id: da.d.id });
    await new Promise((r) => setTimeout(r, 200));
    const gots = [...a.got, ...b.got].filter((m) => m.t === 'got');
    expect(gots.length).toBe(1); expect(gots[0].d.k).toBe('medkit');
    expect(mp!.save()[0].drops.map((d) => d.k)).toEqual(['lwheel']);
    // a newcomer sees what lies there; a restart keeps it
    const c = await client(port, { name: 'Cy' }), wc = await c.wait('welcome');
    expect(wc.drops.map((d: { k: string }) => d.k)).toEqual(['lwheel']);
    const kept = mp!.save(); a.ws.close(); b.ws.close(); c.ws.close(); mp!.close(); http!.close();
    const port2 = await server({ rooms: kept }), d = await client(port2, { name: 'Di' });
    expect((await d.wait('welcome')).drops[0]).toMatchObject({ k: 'lwheel', c: 63, by: 'Ada' });
    d.ws.close();
  });
  it('the shared world: the first who played it brings it, changes reach the others, a newcomer gets it all, it is kept', async () => {
    const port = await server({ rooms: [{ id: 'main', name: 'Main', world: 11, time: 100 }] });
    const a = await client(port, { name: 'Ada' }), wa = await a.wait('welcome');
    expect(wa.wdoc).toEqual({}); expect(wa.wseeded).toBe(false);
    a.send({ t: 'wseed', doc: { towns: { '5': { wall: 1 } }, harvest: { 'tree:1:2:3': 50 }, cityGarrisons: { '1:5': { until: 700, hp: { '0': 0, '1': 7 } } } } });
    const b = await client(port, { name: 'Bob' }), wb = await b.wait('welcome');
    expect(wb.wseeded).toBe(true); expect(wb.wdoc.towns['5']).toEqual({ wall: 1 });
    expect(wb.wdoc.cityGarrisons['1:5']).toEqual({ until: 700, hp: { '0': 0, '1': 7 } });
    // a second seed is refused: the latecomer is handed the room's world
    b.send({ t: 'wseed', doc: { towns: {} } });
    expect((await b.wait('wdoc')).doc.towns['5']).toEqual({ wall: 1 });
    // changes reach everyone in server order, including the sender; null deletes
    b.send({ t: 'wset', ch: [['towns', '5', { wall: 2 }], ['harvest', 'tree:1:2:3', null], ['containers', 'chest:x:0', { items: [], gold: 4 }]] });
    const set = await a.wait('wset');
    expect(set.ch).toEqual([['towns', '5', { wall: 2 }], ['harvest', 'tree:1:2:3', null], ['containers', 'chest:x:0', { items: [], gold: 4 }]]);
    expect((await b.wait('wset')).ch).toEqual(set.ch);
    const docs = mp!.dirtyDocs();
    expect(docs[0].doc).toEqual({ towns: { '5': { wall: 2 } }, harvest: {}, containers: { 'chest:x:0': { items: [], gold: 4 } }, cityGarrisons: { '1:5': { until: 700, hp: { '0': 0, '1': 7 } } } });
    expect(mp!.dirtyDocs()).toEqual([]); // nothing new since
    a.ws.close(); b.ws.close(); mp!.close(); http!.close();
    const port2 = await server({ rooms: [{ id: 'main', name: 'Main', world: 11, time: 100, doc: docs[0].doc, seeded: true } as never] }), c = await client(port2, { name: 'Cy' });
    const restored = await c.wait('welcome');
    expect(restored.wdoc.towns['5']).toEqual({ wall: 2 });
    expect(restored.wdoc.cityGarrisons['1:5']).toEqual({ until: 700, hp: { '0': 0, '1': 7 } });
    c.ws.close();
  });
  it('the shared foes: word of them goes to the rest of the room, hits and harm to one player, nothing else passes', async () => {
    const port = await server({ rooms: [{ id: 'main', name: 'Main', world: 11, time: 100 }] });
    const a = await client(port, { name: 'Ada' }), wa = await a.wait('welcome');
    const b = await client(port, { name: 'Bob' }), wb = await b.wait('welcome');
    const c = await client(port, { name: 'Cy' }); await c.wait('welcome');
    a.send({ t: 'cast', m: { t: 'foes', loc: 'o', list: [[1, 0, 'gnawer', 5, 1, 5, 0, 3, 3, 1, 'roam']] } });
    expect((await b.wait('foes')).from).toBe(wa.id);
    expect((await c.wait('foes')).list[0][2]).toBe('gnawer');
    b.send({ t: 'to', to: wa.id, m: { t: 'fhit', nid: 1, dmg: 2 } });
    expect(await a.wait('fhit')).toMatchObject({ nid: 1, dmg: 2, from: wb.id });
    a.send({ t: 'to', to: wb.id, m: { t: 'kill', nid: 1 } });
    await b.wait('kill');
    a.send({ t: 'cast', m: { t: 'wset', ch: [['towns', '1', { wall: 9 }]] } }); // not a foe message: dropped
    a.send({ t: 'cast', m: { t: 'bolt', loc: 'o', p: [0, 1, 0], v: [30, 0, 0], c: 1 } });
    await c.wait('bolt');
    expect(a.got.some((m) => m.t === 'foes' || m.t === 'bolt')).toBe(false); // not back to the sender
    expect(c.got.some((m) => m.t === 'kill' || m.t === 'fhit' || m.t === 'wset')).toBe(false);
    for (const x of [a, b, c]) x.ws.close();
  });
  it('concurrent world writes converge, merge independent properties, and survive hosted reconnects', async () => {
    const port = await server();
    const a = await client(port, { name: 'A', world: 11 }), b = await client(port, { name: 'B', world: 99 });
    await a.wait('welcome'); await b.wait('welcome');
    const base = { wall: 1, farms: 0, stock: { wood: 2, ore: 3 } };
    a.send({ t: 'wseed', doc: { towns: { '5': base } } });
    await a.wait('wdoc'); await b.wait('wdoc');
    a.send({ t: 'wset', seq: 1, ch: [['towns', '5', { ...base, wall: 2, stock: { wood: 4, ore: 3 } }, base]] });
    b.send({ t: 'wset', seq: 1, ch: [['towns', '5', { ...base, farms: 1, stock: { wood: 2, ore: 6 } }, base]] });
    await a.wait('wset', 2); await b.wait('wset', 2);
    expect(a.got.filter((m) => m.t === 'wset')).toEqual(b.got.filter((m) => m.t === 'wset'));
    expect(a.got.filter((m) => m.t === 'wset').at(-1)!.ch[0][2]).toEqual({ wall: 2, farms: 1, stock: { wood: 4, ore: 6 } });
    a.send({ t: 'wset', ch: [['harvest', 'tree', 10]] }); b.send({ t: 'wset', ch: [['harvest', 'tree', 20]] });
    await a.wait('wset', 4); await b.wait('wset', 4);
    expect(a.got.filter((m) => m.t === 'wset').at(-1)).toEqual(b.got.filter((m) => m.t === 'wset').at(-1));
    const c = await client(port, { name: 'C', world: 7 });
    const wc = await c.wait('welcome');
    expect(wc.wdoc.towns['5'].farms).toBe(1);
    a.ws.close(); b.ws.close(); await c.wait('leave', 2);
    await new Promise<void>((r) => { c.ws.once('close', () => r()); c.ws.close(); });
    const d = await client(port, { name: 'A', world: 99 });
    const wd = await d.wait('welcome');
    expect(wd.world).toBe(11); expect(wd.wdoc).toEqual(wc.wdoc); d.ws.close();
  });
  it('simultaneous dungeon progress preserves both opened objects', async () => {
    const port = await server({ world: 11 });
    const a = await client(port, { name: 'A' }), b = await client(port, { name: 'B' });
    await a.wait('welcome'); await b.wait('welcome');
    a.send({ t: 'wset', ch: [['opened', 'dungeon', [1], []]] });
    b.send({ t: 'wset', ch: [['opened', 'dungeon', [2], []]] });
    await a.wait('wset', 2); await b.wait('wset', 2);
    expect(a.got.filter((m) => m.t === 'wset').at(-1)!.ch[0][2].sort()).toEqual([1, 2]);
    expect(a.got.filter((m) => m.t === 'wset')).toEqual(b.got.filter((m) => m.t === 'wset'));
    a.ws.close(); b.ws.close();
  });
  it('shared containers have one editor, reject stale writes, and release locks on disconnect', async () => {
    const port = await server({ world: 11 });
    const a = await client(port, { name: 'A' }), b = await client(port, { name: 'B' });
    await a.wait('welcome'); await b.wait('welcome');
    const box = { items: [{ k: 'medkit', n: 1 }], gold: 4 }, empty = { items: [null], gold: 0 };
    a.send({ t: 'wlock', f: 'containers', k: 'chest:1', req: 1, value: box });
    b.send({ t: 'wlock', f: 'containers', k: 'chest:1', req: 1, value: box });
    const ra = await a.wait('wlock'), rb = await b.wait('wlock');
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const winner = ra.ok ? a : b, loser = ra.ok ? b : a;
    await winner.wait('wset'); await loser.wait('wset');
    loser.send({ t: 'wset', ch: [['containers', 'chest:1', empty, box]] });
    expect((await loser.wait('wset', 2)).ch[0]).toEqual(['containers', 'chest:1', box, true]);
    expect(winner.got.filter((m) => m.t === 'wset')).toHaveLength(1); // a rejected writer cannot roll back the lock holder
    winner.send({ t: 'wsave', f: 'containers', k: 'chest:1', value: empty });
    await loser.wait('wset', 3);
    winner.send({ t: 'wunlock', f: 'containers', k: 'chest:1', value: empty });
    await loser.wait('wset', 4);
    loser.send({ t: 'wset', ch: [['containers', 'chest:1', box, box]] });
    expect((await loser.wait('wset', 5)).ch[0]).toEqual(['containers', 'chest:1', empty, true]);
    loser.send({ t: 'wlock', f: 'containers', k: 'chest:1', req: 2, value: box });
    expect((await loser.wait('wlock', 2)).ok).toBe(true);
    loser.ws.close(); await winner.wait('leave');
    winner.send({ t: 'wlock', f: 'containers', k: 'chest:1', req: 2 });
    expect((await winner.wait('wlock', 2)).ok).toBe(true);
    const c = await client(port, { name: 'C' });
    expect((await c.wait('welcome')).wdoc.containers['chest:1']).toEqual(empty);
    winner.ws.close(); c.ws.close();
  });
  it('shares condition and revokes occupied seats when a vehicle reaches zero', async () => {
    const port = await server({ world: 11 });
    const a = await client(port, { name: 'Owner' }), wa = await a.wait('welcome');
    const b = await client(port, { name: 'Rider' }); await b.wait('welcome');
    const state = { t: 'state', p: [0, 0, 0], loc: 'o' }, car = [0, 5, 1, 6, 0, 0, 0, 1, 1, 0, 65];
    a.send({ ...state, cars: [car], carIds: ['scout-1'] }); await a.wait('seats');
    b.send({ ...state, ride: [wa.id, 0, 1] }); expect((await b.wait('seats')).ride).toEqual([wa.id, 0, 1]);
    const snap = await b.until((m) => m.t === 'snap' && m.ps.some((p: any) => p.id === wa.id));
    expect(snap.ps.find((p: any) => p.id === wa.id).cars[0][10]).toBe(65);
    a.send({ ...state, cars: [[...car.slice(0, 10), 0]], carIds: ['scout-1'] });
    expect((await a.wait('seats', 2)).seats).toEqual([0]); expect((await b.wait('seats', 2)).ride).toBeNull();
    b.send({ ...state, ride: [wa.id, 0, 1] }); expect((await b.wait('seats', 3)).ride).toBeNull();
    a.ws.close(); b.ws.close();
  });
  it('vehicle poses and driver/passenger/gunner seats agree, with only one rider per seat', async () => {
    const port = await server({ world: 11 });
    const a = await client(port, { name: 'Driver' }), wa = await a.wait('welcome');
    const b = await client(port, { name: 'Passenger' }), wb = await b.wait('welcome');
    const c = await client(port, { name: 'Other' }); await c.wait('welcome');
    const car = [0, 5, 1, 6, 0.5, 0, 0, 1, 1, 0], state = { t: 'state', p: [0, 0, 0], loc: 'o' };
    a.send({ ...state, cars: [car], carIds: ['scout-1'] }); await a.wait('seats');
    b.send({ ...state, ride: [wa.id, 0, 1] });
    c.send({ ...state, ride: [wa.id, 0, 1] });
    const rb = await b.wait('seats'), rc = await c.wait('seats');
    expect([rb.ride, rc.ride].filter(Boolean)).toHaveLength(1);
    const passenger = rb.ride ? b : c, other = rb.ride ? c : b;
    expect((await passenger.until((m) => m.t === 'snap' && m.ps.some((p: any) => p.id === wa.id))).ps.find((p: any) => p.id === wa.id).cars[0]).toEqual(car);
    other.send({ ...state, ride: [wa.id, 0, 2], gun: 0.75 });
    expect((await other.wait('seats', 2)).ride).toEqual([wa.id, 0, 2]);
    a.send({ ...state, cars: [[...car.slice(0, 8), 2, 0]], carIds: ['scout-1'] });
    expect((await a.wait('seats', 2)).seats).toEqual([0]); // owner cannot evict an accepted passenger
    a.send({ ...state, cars: [[0, 10, 1, 12, 1, 0, 0, 1, 1, 0.75]], carIds: ['scout-1'] });
    await a.wait('seats', 3);
    const snap = await passenger.until((m) => m.t === 'snap' && m.ps.some((p: any) => p.id === wa.id && p.cars[0][1] === 10) && m.ps.some((p: any) => p.gun === 0.75));
    expect(snap.ps.find((p: any) => p.id === wa.id).cars[0][1]).toBe(10);
    expect(snap.ps.some((p: any) => p.gun === 0.75)).toBe(true);
    // A different car in the same array slot must never inherit the old car's riders.
    a.send({ ...state, cars: [car], carIds: ['scout-2'] });
    expect((await passenger.wait('seats', 2)).ride).toBeNull();
    expect((await other.wait('seats', 3)).ride).toBeNull();
    other.send({ ...state, ride: [wa.id, 0, 0] }); expect((await other.wait('seats', 4)).ride).toBeNull();
    b.send({ ...state, ride: [wa.id, 0, 1] }); await b.wait('seats', 3);
    a.ws.close(); await b.wait('leave');
    expect(b.got.filter((m) => m.t === 'seats').at(-1)!.ride).toBeNull();
    const d = await client(port, { name: 'Late' }); await d.wait('welcome');
    expect((await d.wait('snap')).ps.find((p: any) => p.id === wb.id).ride).toBeUndefined();
    b.ws.close(); c.ws.close(); d.ws.close();
  });
  it('turns what the player typed into a server address', () => {
    const here = { protocol: 'http:', host: '192.168.1.20:5173' };
    expect(serverUrl('', here)).toBe('ws://192.168.1.20:5173/mp');
    expect(serverUrl('10.0.0.5:7777', here)).toBe('ws://10.0.0.5:7777/mp');
    expect(serverUrl('http://example.org:5173', here)).toBe('ws://example.org:5173/mp');
    expect(serverUrl('wss://game.example/x', here)).toBe('wss://game.example/x');
    // behind a portal at a sub-path: the server next to the page
    expect(serverUrl('', { protocol: 'https:', host: 'apps.example.pl', pathname: '/gridworld/' })).toBe('wss://apps.example.pl/gridworld/mp');
    expect(serverUrl('', { protocol: 'https:', host: 'apps.example.pl', pathname: '/gridworld/index.html' })).toBe('wss://apps.example.pl/gridworld/mp');
    expect(serverUrl('', { protocol: 'http:', host: 'h:8517', pathname: '/' })).toBe('ws://h:8517/mp');
  });
});

for (const occupants of [2, 3]) it(`transports a vehicle with ${occupants} players while retaining seats and locking both terminals`, async () => {
  const port = await server({ world: 12345 });
  const owner = await client(port, { name: 'Driver' }), id = (await owner.wait('welcome')).id;
  const riders = [];
  for (let seat = 1; seat < occupants; seat++) { const c = await client(port, { name: 'Rider' + seat }); await c.wait('welcome'); riders.push(c); }
  const state = { t: 'state', loc: 'o', p: [0, 0, 0] }, addresses = gateAddresses(12345);
  owner.send(state); owner.send({ t: 'gdial', gate: 0, symbols: addresses[20], req: 1 });
  const opened = await owner.wait('gdial'); expect(opened.ok).toBe(true); const until = opened.links[0].until;
  const car = [1, 1, 3, 2, 0, 0, 0, 1, 1, .75, 67];
  owner.send({ ...state, cars: [car], carIds: ['loaded-mastodon'] }); await owner.wait('seats');
  for (let i = 0; i < riders.length; i++) { riders[i].send({ ...state, ride: [id, 0, i + 1] }); expect((await riders[i].wait('seats')).ride).toEqual([id, 0, i + 1]); }
  riders[0].send({ t: 'gdial', gate: 20, symbols: addresses[1], req: 1 }); expect((await riders[0].wait('gdial')).ok).toBe(false);
  owner.send({ t: 'gtravel', gate: 0, req: 2, car: { index: 0, id: 'stale-id', pose: car } }); expect((await owner.wait('gtravel')).ok).toBe(false);
  const pose = [...car]; pose.splice(1, 6, 600, 4, 6010, 2, 0, 0);
  owner.send({ t: 'gtravel', gate: 0, req: 3, car: { index: 0, id: 'loaded-mastodon', pose } });
  const departure = await owner.wait('gdepart'); expect(departure.players).toHaveLength(occupants);
  expect(owner.got.filter(m => m.t === 'gtravel')).toHaveLength(1); // No arrival reply or vehicle jump on admission.
  owner.send({ ...state, cars: [[...car.slice(0, 8), 0, 0, 0]], carIds: ['replacement-car'] });
  const during = await riders[0].until(m => m.t === 'snap' && m.links[0]?.inTransit === 1);
  expect(during.ps.find((p: any) => p.id === id).cars[0]).toEqual(car);
  expect((await owner.wait('gtravel', 2)).ok).toBe(true);
  for (let i = 0; i < riders.length; i++) {
    expect(await riders[i].wait('vwarp')).toMatchObject({ carId: 'loaded-mastodon', car: pose, to: 20 });
    const snap = await riders[i].until(m => m.t === 'snap' && m.ps.some((p: any) => p.id === id && p.cars[0][1] === 600));
    expect(snap.ps.find((p: any) => p.id === id).cars[0]).toEqual(pose);
    expect(snap.links[0].until).toBe(until);
    expect(riders[i].got.filter(m => m.t === 'seats').at(-1)!.ride).toEqual([id, 0, i + 1]);
  }
  owner.send({ t: 'gtravel', gate: 20, req: 4, car: { index: 0, id: 'loaded-mastodon', pose: car } }); expect((await owner.wait('gtravel', 3)).ok).toBe(true);
  const late = await client(port, { name: 'Observer' }); const welcome = await late.wait('welcome'); expect(welcome.links).toEqual(opened.links);
  late.send(state); late.send({ t: 'gdial', gate: 20, symbols: addresses[1], req: 1 }); expect((await late.wait('gdial')).ok).toBe(false);
  for (const c of [owner, ...riders, late]) c.ws.close();
});

it('finishes a foot journey admitted in second 44 after the deadline, then releases both terminal locks', async () => {
  let now = 100000; vi.spyOn(Date, 'now').mockImplementation(() => now);
  const port = await server({ world: 12345 }), a = await client(port, { name: 'Walker' }), b = await client(port, { name: 'Observer' });
  await a.wait('welcome'); await b.wait('welcome'); const state = { t: 'state', loc: 'o', p: [0, 0, 0] };
  a.send(state); b.send(state); a.send({ t: 'gdial', gate: 0, symbols: gateAddresses(12345)[20], req: 1 }); expect((await a.wait('gdial')).ok).toBe(true);
  now += 44000; a.send({ t: 'gtravel', gate: 0, req: 2 }); await a.wait('gdepart'); now += 2000;
  b.send({ t: 'gdial', gate: 20, symbols: gateAddresses(12345)[1], req: 1 }); const held = await b.wait('gdial');
  expect(held.ok).toBe(false); expect(held.links[0]).toMatchObject({ a: 0, b: 20, until: 145000, inTransit: 1 });
  b.send({ t: 'gtravel', gate: 20, req: 2 }); expect((await b.wait('gtravel')).ok).toBe(false);
  expect((await a.wait('gtravel')).ok).toBe(true);
  const released = await b.until(m => m.t === 'gates' && m.links.length === 0); expect(released.links).toEqual([]);
  a.ws.close(); b.ws.close();
});
it('cancels a departing vehicle when its owner disconnects and releases the waiting crew', async () => {
  const port = await server({ world: 12345 }), a = await client(port, { name: 'Driver' }), b = await client(port, { name: 'Rider' });
  const id = (await a.wait('welcome')).id; await b.wait('welcome'); const state = { t: 'state', loc: 'o', p: [0, 0, 0] };
  a.send(state); a.send({ t: 'gdial', gate: 0, symbols: gateAddresses(12345)[20], req: 1 }); await a.wait('gdial');
  const car = [1, 0, 0, 0, 0, 0, 0, 1, 1, 0, 100];
  a.send({ ...state, cars: [car], carIds: ['truck'] }); await a.wait('seats'); b.send({ ...state, ride: [id, 0, 1] }); await b.wait('seats');
  a.send({ t: 'gtravel', gate: 0, req: 2, car: { index: 0, id: 'truck', pose: car } }); const departing = await b.wait('gdepart'); a.ws.close();
  expect((await b.wait('gabort')).trip).toBe(departing.trip); expect((await b.wait('seats', 2)).ride).toBeNull();
  const released = await b.until(m => m.t === 'gates' && !m.links[0]?.inTransit); expect(released.links[0].inTransit).toBeUndefined(); b.ws.close();
});
