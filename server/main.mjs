// GridWorld dedicated server, for a VPS: one Node process that serves the built game (dist/) over http and the
// multiplayer relay (server/mp.mjs) at /mp, on one port. It holds several game servers ("rooms"): the first, 'main',
// named SERVER_NAME on WORLD_SEED (else a rolled seed), and any the players create from the menu, each with its own
// world and clock (running while someone is in it, standing still while it is empty). The rooms and their clocks are
// saved. Players open http://<server>:<port>/ in a browser, pick a server from the list (or create one) and join.
//
//   npm run build && npm run serve          (or: node server/main.mjs)
//
// Settings (environment): PORT (8517), HOST (0.0.0.0), WORLD_SEED (a number; only read the first time, then the
// saved one wins unless FORCE_SEED=1), DATA_DIR (server/data: server.json keeps the seed and the clock),
// SERVER_NAME (the first server's name in the list), DIST (the built game, dist/). Behind a reverse proxy at a sub-path (a portal
// with several apps, e.g. https://example.pl/gridworld/) it works whether the proxy strips the prefix or not.
// GET /mp/info answers {dedicated, name, version, rooms: [{id, name, world, time, online, max, running, players}], and
// the first room's world / online / players} for the game's menu and for checks.
import { createServer } from 'node:http';
import { readFile, writeFile, mkdir, rename, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve, extname, normalize, sep } from 'node:path';
import { randomInt } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createMp, MP } from './mp.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const env = process.env;
const PORT = Number(env.PORT) || 8517, HOST = env.HOST || '0.0.0.0';
const DIST = resolve(env.DIST || join(here, '..', 'dist'));
const DATA = resolve(env.DATA_DIR || join(here, 'data'));
const NAME = (env.SERVER_NAME || 'GridWorld server').slice(0, 40);
const SAVE = join(DATA, 'server.json');
const VERSION = (() => { try { return JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf8')).version; } catch { return '?'; } })();
const log = (m) => console.log(`${new Date().toISOString()} ${m}`);

// the rooms: the saved ones (an older file held only the first room's world and time); the first room's world is
// WORLD_SEED on the first start (or with FORCE_SEED=1), else a fresh roll kept from then on
let saved = null;
try { saved = JSON.parse(await readFile(SAVE, 'utf8')); } catch { /* first start */ }
const seedEnv = Number(env.WORLD_SEED), seedSet = env.WORLD_SEED !== undefined && env.WORLD_SEED !== '' && Number.isFinite(seedEnv);
let rooms = Array.isArray(saved?.rooms) ? saved.rooms : saved ? [{ id: 'main', name: NAME, world: saved.world | 0, time: Number(saved.time) || 0 }] : [];
if (!rooms.length || rooms[0].id !== 'main') rooms.unshift({ id: 'main', name: NAME, world: seedSet ? seedEnv | 0 : randomInt(1, 2 ** 31 - 1), time: 7 * 60 }); // a new world starts at 07:00 of day 1
if (env.FORCE_SEED === '1' && seedSet && rooms[0].world !== (seedEnv | 0)) rooms[0] = { ...rooms[0], world: seedEnv | 0, time: 7 * 60 };
rooms[0].name = NAME; // (the first server's name follows SERVER_NAME)
// each room's shared world (villages, bridges, chests...) lives in its own file: it can grow large
const docFile = (id) => join(DATA, 'world-' + String(id).replace(/[^\w-]/g, '') + '.json');
for (const r of rooms) { try { const w = JSON.parse(await readFile(docFile(r.id), 'utf8')); r.doc = w.doc; r.seeded = w.seeded; } catch { /* none yet */ } }
const mp = createMp((m) => log('[mp] ' + m), { rooms });
const world = rooms[0].world;

async function persist() {
  await mkdir(DATA, { recursive: true });
  const tmp = SAVE + '.tmp', list = mp.save();
  await writeFile(tmp, JSON.stringify({ rooms: list, saved: new Date().toISOString() }, null, 1));
  await rename(tmp, SAVE);
  for (const d of mp.dirtyDocs()) { const f = docFile(d.id); await writeFile(f + '.tmp', JSON.stringify({ doc: d.doc, seeded: d.seeded })); await rename(f + '.tmp', f); }
}
await persist();
const timer = setInterval(() => persist().catch((e) => log('could not save: ' + e.message)), 30000);

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
  '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8', '.wasm': 'application/wasm', '.map': 'application/json',
};
if (!existsSync(join(DIST, 'index.html'))) log(`warning: no game build in ${DIST} (run npm run build); only the relay works`);

const http = createServer(async (req, res) => {
  let url = (req.url || '/').split('?')[0];
  if (url.endsWith(MP.path + '/info')) {
    const s = mp.state(), list = mp.list().map(({ id, name, world, time, online, max, running, players }) => ({ id, name, world, time, online, max, running, players }));
    res.writeHead(200, { 'content-type': 'application/json', 'cache-control': 'no-store', 'access-control-allow-origin': '*' });
    res.end(JSON.stringify({ dedicated: true, name: NAME, world, time: Math.round(s.time), online: s.n, max: MP.max, players: s.names, version: VERSION, rooms: list }));
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
  // static files from dist/, never outside it; unknown paths get the game's page
  let rel;
  try { rel = normalize(decodeURIComponent(url)).replace(/^([/\\])+/, ''); } catch { res.writeHead(400); res.end(); return; }
  let file = resolve(DIST, rel || 'index.html');
  // a proxy that passes /gridworld/assets/x.js on unchanged: try the path without its first part
  if (!existsSync(file) && rel.includes('/')) file = resolve(DIST, rel.slice(rel.indexOf('/') + 1));
  if (file !== DIST && !file.startsWith(DIST + sep)) { res.writeHead(403); res.end(); return; }
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch { file = join(DIST, 'index.html'); }
  try {
    const body = await readFile(file);
    const hashed = file.includes(sep + 'assets' + sep);
    res.writeHead(200, { 'content-type': TYPES[extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
    res.end(req.method === 'HEAD' ? undefined : body);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain' }); res.end('GridWorld server: the game is not built here (npm run build).');
  }
});
mp.attach(http);
http.listen(PORT, HOST, () => log(`GridWorld ${VERSION} dedicated server "${NAME}" on http://${HOST}:${PORT}/ · world ${world} · data in ${DATA}`));

let stopping = false;
async function stop(sig) {
  if (stopping) return;
  stopping = true; log(`${sig}: saving and stopping`);
  clearInterval(timer);
  try { await persist(); } catch (e) { log('could not save: ' + e.message); }
  mp.close(); http.close(); process.exit(0);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop('SIGTERM'));
