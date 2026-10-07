// Multiplayer in the menu and on screen (stage 1): host or join a game, who is online, and the chat (T).
// Hosting: the game's own server (start-gry.bat) carries the multiplayer server at /mp, so "Host a game" connects
// to it and the host's world and clock become everyone's. Joining: friends open the host's address in their
// browser (http://<host's IP>:5173) and press Join, or type the address of a server here.
// A joining hero moves to the host's world; the save from before is kept and "Back to my own world" restores it.
// A dedicated server (server/main.mjs on a VPS) serves the game itself and holds several game servers ("rooms"):
// opened from it, the menu lists them (name, players, running or paused) with a Join button each, and makes a new one
// (a name, the hero's own world or a fresh one). Nobody hosts: each room's world and clock are its own; the clock
// runs while anyone is in the room (also in the menu: you stay in the game, the others see you "in menu"). A build made with VITE_MP_SERVER
// set (e.g. wss://game.example.com/mp) offers that server in the address field.
// On a dedicated server every player has an account (a name and a password, server/accounts.mjs): the menu logs in or
// makes one, keeps only the session token the server gave (`gridWorld.mpAuth`, per server), and the server names you
// by your account. A server you created shows Close server in the list: closing it sends its players away for good.
import { joinWorld } from '../world/share';
import { G } from '../game';
import { $, logLine } from './hud';
import { saveChar } from '../character';
import { connect, disconnect, deleteRoom, account, logout, changePassword, net, online, isHost, sendChat, serverUrl, serverInfo, type ServerInfo, type RoomInfo } from '../net/client';
import { clearPeers, peerColor } from '../world/peers';
import { lockPointer } from './input';
import { SAVE_KEY } from '../save';

/** Where the hero's own save waits while they play in someone else's world. */
const SOLO_KEY = SAVE_KEY + '.solo';
export interface MpHooks {
  /** Move the hero to the host's world (as "Roll a new world", keeping the character). */
  switchWorld(seed: number): void;
  /** Redraw the world you are in from the save (after taking the server's state of it). */
  reloadWorld(): void;
}

const box = $('mpBox'), addr = $<HTMLInputElement>('mpAddr'), status = $('mpStatus'), list = $('mpList');
const hostBtn = $<HTMLButtonElement>('mpHost'), joinBtn = $<HTMLButtonElement>('mpJoin'), leaveBtn = $<HTMLButtonElement>('mpLeave'), backBtn = $<HTMLButtonElement>('mpBack');
const chatLog = $('chatlog'), chatIn = $<HTMLInputElement>('chatIn'), badge = $('mpBadge');
const acctEl = $('mpAcct'), acctIn = $('mpAcctIn'), acctOn = $('mpAcctOn'), who = $('mpWho'), userIn = $<HTMLInputElement>('mpUser'), passIn = $<HTMLInputElement>('mpPass');
const pwdForm = $('mpPwdForm'), oldIn = $<HTMLInputElement>('mpOld'), newPassIn = $<HTMLInputElement>('mpNewPass');
const roomsEl = $('mpRooms'), newEl = $('mpNew'), newName = $<HTMLInputElement>('mpNewName'), mine = $<HTMLInputElement>('mpMine'), createBtn = $<HTMLButtonElement>('mpCreate');
let hooks: MpHooks | null = null, connecting = false;
/** The dedicated server this page came from, if any. */
let ded: ServerInfo | null = null;
const DEFAULT_SERVER = (import.meta.env.VITE_MP_SERVER as string | undefined) ?? '';

const solo = () => { try { return localStorage.getItem(SOLO_KEY); } catch { return null; } };
/** This browser's secret for the servers it creates: the server keeps only its hash and deletes a server for it. */
const KEY_STORE = 'gridWorld.mpKey', MINE_STORE = 'gridWorld.mpRooms';
function mpKey(): string {
  try {
    let k = localStorage.getItem(KEY_STORE);
    if (!k || k.length < 16) { k = Array.from(crypto.getRandomValues(new Uint8Array(18)), (b) => b.toString(16).padStart(2, '0')).join(''); localStorage.setItem(KEY_STORE, k); }
    return k;
  } catch { return ''; }
}
/** The servers this browser created (ids), so the list offers to delete them. */
const myRooms = (): string[] => { try { const v = JSON.parse(localStorage.getItem(MINE_STORE) ?? '[]'); return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []; } catch { return []; } };
const setMine = (ids: string[]) => { try { localStorage.setItem(MINE_STORE, JSON.stringify(ids.slice(-30))); } catch { /* storage blocked */ } };
/** Your account on the page's dedicated server: the name and the session token it gave (the password is never kept). */
const AUTH_STORE = 'gridWorld.mpAuth';
type Auth = { name: string; token: string };
const here = () => serverUrl('', location);
function auths(): Record<string, Auth> { try { const v = JSON.parse(localStorage.getItem(AUTH_STORE) ?? '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } }
const auth = (): Auth | null => { const a = auths()[here()]; return a && typeof a.token === 'string' && typeof a.name === 'string' ? a : null; };
function setAuth(a: Auth | null) {
  const all = auths();
  if (a) all[here()] = a; else delete all[here()];
  try { localStorage.setItem(AUTH_STORE, JSON.stringify(all)); } catch { /* storage blocked */ }
}
/** Does this server want an account, and are you logged in? */
const accounts = () => !!ded?.accounts;
const loggedIn = () => !accounts() || !!auth();
let busy = false;
/** A server is yours to close: made by your account (or, before accounts, from this browser). */
const yours = (r: RoomInfo) => r.id !== 'main' && (!!auth() && (r.by ?? '').toLowerCase() === auth()!.name.toLowerCase() || myRooms().includes(r.id));
/** A Delete button asks twice: the id armed by the first click. */
let armed = '', deleting = '';
/** A message for the status line that outlasts the next render for a few seconds. */
let note = '';
const tell = (t: string) => { note = t; setTimeout(() => { if (note === t) { note = ''; render(); } }, 6000); };
/** The multiplayer panel is opened from the menu's Multiplayer button (and stays open while online). */
let shown = false, listener: () => void = () => {};
export function showMpBox(on = !shown) { shown = on; render(); if (on) look(); }
export const mpShown = () => shown || online();
/** The menu relabels its buttons when the connection changes. */
export const onMpChange = (f: () => void) => { listener = f; };
/** The rooms of the dedicated server: a row each with a Join button (the one you are in marked). */
function roomRows(): string {
  if (!ded?.rooms?.length) return '';
  const at = net.room?.id;
  return ded.rooms.map((r: RoomInfo) => {
    const you = online() && r.id === at, n = you ? net.peers.size + 1 : r.online;
    const state = n ? `<span class="dot">●</span> ${n}/${r.max} playing` : '<span class="dot off">○</span> paused';
    const who = you ? 'you are here' : r.players.length ? r.players.map(esc).join(', ') : 'empty';
    const btn = you ? '' : `<button data-room="${esc(r.id)}"${connecting || !loggedIn() ? ' disabled' : ''}>${online() ? 'Move here' : 'Join'}</button>`;
    const del = !you && yours(r)
      ? `<button class="del${armed === r.id ? ' armed' : ''}" data-del="${esc(r.id)}"${deleting ? ' disabled' : ''}>${deleting === r.id ? 'Closing…' : armed === r.id ? (r.online ? `Close it? ${r.online} playing` : 'Sure? Close it') : 'Close server'}</button>` : '';
    const by = r.by ? ` · made by ${esc(r.by)}` : '';
    return `<div class="room${you ? ' here' : ''}${del ? ' mine' : ''}"><b>${esc(r.name)}</b><span>${state}</span><span class="who">${who} · world ${r.world}${by}</span>${btn}${del}</div>`;
  }).join('');
}
function render() {
  const on = online(), rooms = !!ded?.rooms?.length;
  hostBtn.style.display = on || connecting || ded ? 'none' : '';
  joinBtn.style.display = on || connecting || rooms ? 'none' : '';
  joinBtn.textContent = ded ? 'Join the server' : 'Join';
  roomsEl.innerHTML = roomRows();
  newEl.style.display = rooms && !connecting && loggedIn() ? '' : 'none';
  // the account box (dedicated servers): log in / make one, or who you are with a way out
  const a = auth();
  acctEl.style.display = accounts() && !on ? '' : 'none';
  acctIn.style.display = a ? 'none' : '';
  acctOn.style.display = a ? '' : 'none';
  if (a) who.innerHTML = `Logged in as <b>${esc(a.name)}</b>`;
  for (const b of acctEl.querySelectorAll('button')) (b as HTMLButtonElement).disabled = busy;
  addr.parentElement!.style.display = ded ? 'none' : '';
  leaveBtn.style.display = on ? '' : 'none';
  addr.disabled = on || connecting;
  backBtn.style.display = !on && solo() ? '' : 'none';
  if (on) {
    status.textContent = net.dedicated
      ? `You are on ${net.room?.name ?? ded?.name ?? 'the server'}. It keeps running while you are in the menu · T to chat`
      : `Connected to ${net.address.replace(/^wss?:\/\//, '').replace(/\/mp$/, '')} · ${isHost() ? 'you host the game' : 'in the host\'s world'} · T to chat`;
    list.innerHTML = [`<span style="color:#${peerColor(net.id).toString(16).padStart(6, '0')}">${esc(net.name || G.char.name || 'You')} (you)${isHost() ? ' ★' : ''}</span>`,
      ...[...net.peers.values()].map((p) => `<span style="color:#${peerColor(p.id).toString(16).padStart(6, '0')}">${esc(p.name)}${p.id === net.host ? ' ★' : ''}</span>`)].join(' · ');
  } else {
    list.textContent = '';
    if (note) status.textContent = note;
    else if (accounts() && !auth() && !connecting) status.textContent = 'Log in, or make an account (a name and a password) to play here. Your name is yours alone on this server.';
    else if (rooms && !connecting) status.textContent = 'Pick a server and press Join, or create your own (you can close it later). A server pauses while nobody is on it.';
    else if (ded && !connecting) status.textContent = `${ded.name} · ${ded.online}/${ded.max} online${ded.players.length ? ': ' + ded.players.join(', ') : ''} · press Join the server.`;
  }
  box.style.display = mpShown() ? '' : 'none';
  badge.style.display = on ? '' : 'none';
  badge.textContent = `● ${net.peers.size + 1} online`;
  listener();
}
const esc = (s: string) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));

/** A line in the chat box (fades after a while) and in the log. */
function say(text: string, kind: 'chat' | 'info' | 'error') {
  const d = document.createElement('div');
  d.className = 'chat ' + kind; d.textContent = text;
  chatLog.appendChild(d);
  while (chatLog.childElementCount > 8) chatLog.firstElementChild!.remove();
  setTimeout(() => d.classList.add('old'), 12000);
  if (kind !== 'chat') logLine(text);
  render();
}

function start(url: string, room?: string, create?: { name: string; world?: number }) {
  if (accounts() && !auth()) { status.textContent = 'Log in first.'; userIn.focus(); return; }
  if (!accounts() && !G.char.name) { status.textContent = 'Name your hero first.'; return; }
  if (online()) { disconnect(); clearPeers(); } // moving to another server
  connecting = true; status.textContent = 'Connecting…'; render();
  connect(url, { name: auth()?.name ?? G.char.name, world: G.char.world, time: G.char.time, token: auth()?.token, room, create }, {
    welcome(world, time, host, dedicated) {
      connecting = false;
      if (world !== G.char.world) {
        // into the host's world: the hero's own save waits (once) to be restored with "Back to my own world"
        try { if (!solo()) localStorage.setItem(SOLO_KEY, JSON.stringify(G.char)); } catch { /* storage full or blocked */ }
        G.char.time = time;
        hooks?.switchWorld(world);
        if (joinWorld()) hooks?.reloadWorld(); // apply after switching, which resets dungeon progress
        say(`You have come to the ${dedicated ? 'server' : 'host'}\'s world. Your own save waits for you: Single player in the menu takes you back to it.`, 'info');
      } else {
        G.char.time = time;
        if (joinWorld()) hooks?.reloadWorld(); // the same world, but the server's state of it
      }
      say(host ? 'You host the game: others can join you now.' : dedicated ? `Joined ${net.room?.name ?? ded?.name ?? 'the server'}.` : 'Joined the game.', 'info');
      saveChar(); look();
    },
    say,
    clock(time) { if (Math.abs(G.char.time - time) > 3) G.char.time = time; }, // the host's clock is everyone's
    closed(why) {
      connecting = false; clearPeers();
      if (net.needAuth) { setAuth(null); tell('Your login has run out: log in again.'); } // the session is gone (expired, or the password changed)
      say(why, 'error'); look();
    },
  });
}
/** Delete a server this browser created: the first click arms the button, the second deletes it. */
async function remove(id: string) {
  if (deleting) return;
  if (armed !== id) { armed = id; render(); setTimeout(() => { if (armed === id) { armed = ''; render(); } }, 5000); return; }
  armed = ''; deleting = id; render();
  const name = ded?.rooms?.find((r) => r.id === id)?.name ?? 'The server';
  const why = await deleteRoom(serverUrl('', location), id, auth()?.token ?? '', myRooms().includes(id) ? mpKey() : undefined);
  deleting = '';
  if (!why || /gone/.test(why)) { setMine(myRooms().filter((x) => x !== id)); tell(`${name} is closed.`); }
  else tell(why);
  if (ded?.rooms && !why) ded.rooms = ded.rooms.filter((r) => r.id !== id);
  render(); look();
}
/** Log in or make an account with what is in the two fields. */
async function signIn(how: 'login' | 'register') {
  const name = userIn.value.trim(), pass = passIn.value;
  if (!name || !pass) { tell('Type your account name and password.'); (name ? passIn : userIn).focus(); render(); return; }
  busy = true; status.textContent = how === 'login' ? 'Logging in…' : 'Making your account…'; render();
  const r = await account(here(), how, name, pass);
  busy = false;
  if (r.token && r.name) { setAuth({ name: r.name, token: r.token }); passIn.value = ''; tell(how === 'login' ? `Welcome back, ${r.name}.` : `Account ${r.name} made. Remember your password: nobody can read it back.`); }
  else tell(r.why ?? 'That did not work.');
  render();
}
async function signOut() {
  const a = auth();
  if (online()) { disconnect(); clearPeers(); }
  setAuth(null); pwdForm.style.display = 'none';
  if (a) void logout(here(), a.token);
  tell('Logged out.'); render();
}
async function savePassword() {
  const a = auth();
  if (!a) return;
  if (!oldIn.value || !newPassIn.value) { tell('Type the old and the new password.'); render(); return; }
  busy = true; render();
  const why = await changePassword(here(), a.token, oldIn.value, newPassIn.value);
  busy = false; oldIn.value = ''; newPassIn.value = '';
  if (!why) { pwdForm.style.display = 'none'; tell('Password changed. Other browsers logged in as you are logged out.'); }
  else tell(why);
  render();
}
/** Ask the page's dedicated server for its rooms (the menu's list). */
let look = () => {};

export function initMp(h: MpHooks) {
  hooks = h;
  addr.placeholder = location.host || 'host:5173';
  if (DEFAULT_SERVER && !addr.value) addr.value = DEFAULT_SERVER;
  look = () => { serverInfo().then((i) => { ded = i; render(); }); };
  if (/^https?:$/.test(location.protocol)) { look(); setInterval(() => { if (ded && !G.playing) look(); }, 5000); } // the list stays fresh while the menu is up
  roomsEl.onclick = (e) => {
    const d = (e.target as HTMLElement).closest('[data-del]') as HTMLElement | null;
    if (d) { void remove(d.dataset.del!); return; }
    const b = (e.target as HTMLElement).closest('[data-room]') as HTMLElement | null;
    if (b) start(serverUrl('', location), b.dataset.room);
  };
  for (const i of [userIn, passIn, oldIn, newPassIn]) i.onkeydown = (e) => { e.stopPropagation(); };
  passIn.onkeydown = (e) => { e.stopPropagation(); if (e.code === 'Enter') void signIn('login'); };
  newPassIn.onkeydown = (e) => { e.stopPropagation(); if (e.code === 'Enter') void savePassword(); };
  $('mpLogin').onclick = () => void signIn('login');
  $('mpRegister').onclick = () => void signIn('register');
  $('mpLogout').onclick = () => void signOut();
  $('mpPwd').onclick = () => { pwdForm.style.display = pwdForm.style.display === 'none' ? '' : 'none'; if (pwdForm.style.display === '') oldIn.focus(); };
  $('mpPwdCancel').onclick = () => { pwdForm.style.display = 'none'; oldIn.value = ''; newPassIn.value = ''; };
  $('mpPwdSave').onclick = () => void savePassword();
  newName.onkeydown = (e) => { e.stopPropagation(); if (e.code === 'Enter') createBtn.click(); };
  createBtn.onclick = () => {
    const name = newName.value.trim();
    if (!name) { status.textContent = 'Give the new server a name first.'; newName.focus(); return; }
    start(serverUrl('', location), undefined, { name, world: mine.checked ? G.char.world : undefined });
    newName.value = '';
  };
  addr.onkeydown = (e) => e.stopPropagation();
  hostBtn.onclick = () => {
    if (!/^https?:$/.test(location.protocol) || !location.host) { status.textContent = 'To host, start the game with start-gry.bat (it runs the server).'; return; }
    start(serverUrl('', location));
  };
  joinBtn.onclick = () => {
    try { start(serverUrl(ded ? '' : addr.value, location)); } catch { status.textContent = 'That is not a server address. Try 192.168.1.20:5173.'; }
  };
  leaveBtn.onclick = () => { disconnect(); clearPeers(); say('You left the game.', 'info'); look(); render(); };
  backBtn.onclick = () => backToOwnWorld();
  chatIn.onkeydown = (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') { sendChat(chatIn.value); closeChat(); }
    if (e.code === 'Escape') closeChat();
  };
  $('mpClose').onclick = () => showMpBox(false);
  render();
}
/** Is the hero's own save waiting (they joined someone else's world)? */
export const soloWaiting = () => !!solo();
/** Restore the hero's own save and reload into the menu. */
export function backToOwnWorld() {
  const s = solo();
  if (!s || online()) return;
  try { localStorage.setItem(SAVE_KEY, s); localStorage.removeItem(SOLO_KEY); } catch { return; }
  try { sessionStorage.setItem('gridWorld.noFilm', '1'); } catch { /* storage blocked */ } // straight to the menu, no opening film
  G.playing = false; // no 'leave the page?' question (ui/input.ts)
  location.reload(); // the cleanest way back: load the own save from scratch
}
/** T while playing online: type a chat line. */
export function openChat() {
  if (!online() || G.chatOpen) return;
  G.chatOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  chatIn.style.display = 'block'; chatIn.value = '';
  if (document.pointerLockElement) document.exitPointerLock();
  setTimeout(() => chatIn.focus(), 0);
}
function closeChat() {
  if (!G.chatOpen) return;
  G.chatOpen = false; chatIn.style.display = 'none'; chatIn.blur();
  if (G.playing && !G.isTouch) lockPointer();
}
/** May the world be changed from the menu? Not while in someone's game. */
export const mpLocked = () => online();
export const refreshMp = render;
