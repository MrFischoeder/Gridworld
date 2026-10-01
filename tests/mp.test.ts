import { describe, it, expect, afterEach } from 'vitest';
import { createServer, type Server } from 'node:http';
import { WebSocket } from 'ws';
import { createMp, PROTOCOL } from '../server/mp.mjs';
import { PROTOCOL as CLIENT_PROTOCOL, serverUrl } from '../src/net/client';

type Msg = { t: string; [k: string]: any };
let http: Server | null = null, mp: ReturnType<typeof createMp> | null = null;
afterEach(() => { mp?.close(); http?.close(); http = mp = null; });

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
  const wait = async (t: string, n = 1) => { for (let i = 0; i < 100; i++) { if (got.filter((m) => m.t === t).length >= n) return got.filter((m) => m.t === t)[n - 1]; await new Promise((r) => setTimeout(r, 20)); } throw new Error('no ' + t); };
  return { ws, got, wait, send: (m: object) => ws.send(JSON.stringify(m)) };
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
    a.send({ t: 'state', p: [10, 2, -5], yaw: 1, pitch: 0, loc: 'o', held: 'blaster', mv: true, time: 960 });
    b.send({ t: 'state', p: [0, 0, 0], yaw: 0, pitch: 0, loc: 'o', held: '', mv: false, time: 1 }); // a guest's clock is ignored
    const snap = await b.wait('snap', 2);
    expect(snap.time).toBe(960);
    expect(snap.ps).toEqual([{ id: wa.id, p: [10, 2, -5], yaw: 1, pitch: 0, loc: 'o', held: 'blaster', mv: true, away: false }]);
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
