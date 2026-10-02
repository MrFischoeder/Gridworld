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
import { joinWorld } from '../world/share';
import { G } from '../game';
import { $, logLine } from './hud';
import { saveChar } from '../character';
import { connect, disconnect, net, online, isHost, sendChat, serverUrl, serverInfo, type ServerInfo, type RoomInfo } from '../net/client';
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
const roomsEl = $('mpRooms'), newEl = $('mpNew'), newName = $<HTMLInputElement>('mpNewName'), mine = $<HTMLInputElement>('mpMine'), createBtn = $<HTMLButtonElement>('mpCreate');
let hooks: MpHooks | null = null, connecting = false;
/** The dedicated server this page came from, if any. */
let ded: ServerInfo | null = null;
const DEFAULT_SERVER = (import.meta.env.VITE_MP_SERVER as string | undefined) ?? '';

const solo = () => { try { return localStorage.getItem(SOLO_KEY); } catch { return null; } };
/** The rooms of the dedicated server: a row each with a Join button (the one you are in marked). */
function roomRows(): string {
  if (!ded?.rooms?.length) return '';
  const here = net.room?.id;
  return ded.rooms.map((r: RoomInfo) => {
    const you = online() && r.id === here, n = you ? net.peers.size + 1 : r.online;
    const state = n ? `<span class="dot">●</span> ${n}/${r.max} playing` : '<span class="dot off">○</span> paused';
    const who = you ? 'you are here' : r.players.length ? r.players.map(esc).join(', ') : 'empty';
    const btn = you ? '' : `<button data-room="${esc(r.id)}"${connecting ? ' disabled' : ''}>${online() ? 'Move here' : 'Join'}</button>`;
    return `<div class="room${you ? ' here' : ''}"><b>${esc(r.name)}</b><span>${state}</span><span class="who">${who} · world ${r.world}</span>${btn}</div>`;
  }).join('');
}
function render() {
  const on = online(), rooms = !!ded?.rooms?.length;
  hostBtn.style.display = on || connecting || ded ? 'none' : '';
  joinBtn.style.display = on || connecting || rooms ? 'none' : '';
  joinBtn.textContent = ded ? 'Join the server' : 'Join';
  roomsEl.innerHTML = roomRows();
  newEl.style.display = rooms && !connecting ? '' : 'none';
  addr.parentElement!.style.display = ded ? 'none' : '';
  leaveBtn.style.display = on ? '' : 'none';
  addr.disabled = on || connecting;
  backBtn.style.display = !on && solo() ? '' : 'none';
  if (on) {
    status.textContent = net.dedicated
      ? `You are on ${net.room?.name ?? ded?.name ?? 'the server'}. It keeps running while you are in the menu · T to chat`
      : `Connected to ${net.address.replace(/^wss?:\/\//, '').replace(/\/mp$/, '')} · ${isHost() ? 'you host the game' : 'in the host\'s world'} · T to chat`;
    list.innerHTML = [`<span style="color:#${peerColor(net.id).toString(16).padStart(6, '0')}">${esc(G.char.name || 'You')} (you)${isHost() ? ' ★' : ''}</span>`,
      ...[...net.peers.values()].map((p) => `<span style="color:#${peerColor(p.id).toString(16).padStart(6, '0')}">${esc(p.name)}${p.id === net.host ? ' ★' : ''}</span>`)].join(' · ');
  } else {
    list.textContent = '';
    if (rooms && !connecting) status.textContent = 'Pick a server and press Join, or create your own. A server pauses while nobody is on it.';
    else if (ded && !connecting) status.textContent = `${ded.name} · ${ded.online}/${ded.max} online${ded.players.length ? ': ' + ded.players.join(', ') : ''} · press Join the server.`;
  }
  badge.style.display = on ? '' : 'none';
  badge.textContent = `● ${net.peers.size + 1} online`;
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
  if (!G.char.name) { status.textContent = 'Name your hero first.'; return; }
  if (online()) { disconnect(); clearPeers(); } // moving to another server
  connecting = true; status.textContent = 'Connecting…'; render();
  connect(url, { name: G.char.name, world: G.char.world, time: G.char.time, room, create }, {
    welcome(world, time, host, dedicated) {
      connecting = false;
      if (!host && world !== G.char.world) {
        // into the host's world: the hero's own save waits (once) to be restored with "Back to my own world"
        try { if (!solo()) localStorage.setItem(SOLO_KEY, JSON.stringify(G.char)); } catch { /* storage full or blocked */ }
        G.char.time = time;
        joinWorld(); // the server's shared world (villages, bridges, chests...) replaces the copy in your save
        hooks?.switchWorld(world);
        say(`You have come to the ${dedicated ? 'server' : 'host'}\'s world. Your own save waits for you: "Back to my own world" in the menu.`, 'info');
      } else {
        if (!host) G.char.time = time;
        if (joinWorld()) hooks?.reloadWorld(); // the same world, but the server's state of it
      }
      say(host ? 'You host the game: others can join you now.' : dedicated ? `Joined ${net.room?.name ?? ded?.name ?? 'the server'}.` : 'Joined the game.', 'info');
      saveChar(); look();
    },
    say,
    clock(time) { if (Math.abs(G.char.time - time) > 3) G.char.time = time; }, // the host's clock is everyone's
    closed(why) { connecting = false; clearPeers(); say(why, 'error'); look(); },
  });
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
    const b = (e.target as HTMLElement).closest('[data-room]') as HTMLElement | null;
    if (b) start(serverUrl('', location), b.dataset.room);
  };
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
  backBtn.onclick = () => {
    const s = solo();
    if (!s || online()) return;
    try { localStorage.setItem(SAVE_KEY, s); localStorage.removeItem(SOLO_KEY); } catch { return; }
    location.reload(); // the cleanest way back: load the own save from scratch
  };
  chatIn.onkeydown = (e) => {
    e.stopPropagation();
    if (e.code === 'Enter') { sendChat(chatIn.value); closeChat(); }
    if (e.code === 'Escape') closeChat();
  };
  box.style.display = '';
  render();
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
