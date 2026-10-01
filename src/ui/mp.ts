// Multiplayer in the menu and on screen (stage 1): host or join a game, who is online, and the chat (T).
// Hosting: the game's own server (start-gry.bat) carries the multiplayer server at /mp, so "Host a game" connects
// to it and the host's world and clock become everyone's. Joining: friends open the host's address in their
// browser (http://<host's IP>:5173) and press Join, or type the address of a server here.
// A joining hero moves to the host's world; the save from before is kept and "Back to my own world" restores it.
// A dedicated server (server/main.mjs on a VPS) serves the game itself: opened from it, the menu offers only
// "Join the server" (nobody hosts: the world and the clock are the server's). A build made with VITE_MP_SERVER
// set (e.g. wss://game.example.com/mp) offers that server in the address field.
import { G } from '../game';
import { $, logLine } from './hud';
import { saveChar } from '../character';
import { connect, disconnect, net, online, isHost, sendChat, serverUrl, serverInfo, type ServerInfo } from '../net/client';
import { clearPeers, peerColor } from '../world/peers';
import { lockPointer } from './input';
import { SAVE_KEY } from '../save';

/** Where the hero's own save waits while they play in someone else's world. */
const SOLO_KEY = SAVE_KEY + '.solo';
export interface MpHooks {
  /** Move the hero to the host's world (as "Roll a new world", keeping the character). */
  switchWorld(seed: number): void;
}

const box = $('mpBox'), addr = $<HTMLInputElement>('mpAddr'), status = $('mpStatus'), list = $('mpList');
const hostBtn = $<HTMLButtonElement>('mpHost'), joinBtn = $<HTMLButtonElement>('mpJoin'), leaveBtn = $<HTMLButtonElement>('mpLeave'), backBtn = $<HTMLButtonElement>('mpBack');
const chatLog = $('chatlog'), chatIn = $<HTMLInputElement>('chatIn'), badge = $('mpBadge');
let hooks: MpHooks | null = null, connecting = false;
/** The dedicated server this page came from, if any. */
let ded: ServerInfo | null = null;
const DEFAULT_SERVER = (import.meta.env.VITE_MP_SERVER as string | undefined) ?? '';

const solo = () => { try { return localStorage.getItem(SOLO_KEY); } catch { return null; } };
function render() {
  const on = online();
  hostBtn.style.display = on || connecting || ded ? 'none' : '';
  joinBtn.style.display = on || connecting ? 'none' : '';
  joinBtn.textContent = ded ? 'Join the server' : 'Join';
  addr.parentElement!.style.display = ded ? 'none' : '';
  leaveBtn.style.display = on ? '' : 'none';
  addr.disabled = on || connecting;
  backBtn.style.display = !on && solo() ? '' : 'none';
  if (on) {
    status.textContent = `Connected to ${ded?.name ?? net.address.replace(/^wss?:\/\//, '').replace(/\/mp$/, '')} · ${net.dedicated ? 'the server\'s world' : isHost() ? 'you host the game' : 'in the host\'s world'} · T to chat`;
    list.innerHTML = [`<span style="color:#${peerColor(net.id).toString(16).padStart(6, '0')}">${esc(G.char.name || 'You')} (you)${isHost() ? ' ★' : ''}</span>`,
      ...[...net.peers.values()].map((p) => `<span style="color:#${peerColor(p.id).toString(16).padStart(6, '0')}">${esc(p.name)}${p.id === net.host ? ' ★' : ''}</span>`)].join(' · ');
  } else {
    list.textContent = '';
    if (ded && !connecting) status.textContent = `${ded.name} · ${ded.online}/${ded.max} online${ded.players.length ? ': ' + ded.players.join(', ') : ''} · press Join the server.`;
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

function start(url: string) {
  if (!G.char.name) { status.textContent = 'Name your hero first.'; return; }
  connecting = true; status.textContent = 'Connecting…'; render();
  connect(url, { name: G.char.name, world: G.char.world, time: G.char.time }, {
    welcome(world, time, host, dedicated) {
      connecting = false;
      if (!host && world !== G.char.world) {
        // into the host's world: the hero's own save waits (once) to be restored with "Back to my own world"
        try { if (!solo()) localStorage.setItem(SOLO_KEY, JSON.stringify(G.char)); } catch { /* storage full or blocked */ }
        G.char.time = time;
        hooks?.switchWorld(world);
        say(`You have come to the ${dedicated ? 'server' : 'host'}\'s world. Your own save waits for you: "Back to my own world" in the menu.`, 'info');
      } else if (!host) G.char.time = time;
      say(host ? 'You host the game: others can join you now.' : dedicated ? `Joined ${ded?.name ?? 'the server'}.` : 'Joined the game.', 'info');
      saveChar();
    },
    say,
    clock(time) { if (Math.abs(G.char.time - time) > 3) G.char.time = time; }, // the host's clock is everyone's
    closed(why) { connecting = false; clearPeers(); say(why, 'error'); render(); },
  });
}

export function initMp(h: MpHooks) {
  hooks = h;
  addr.placeholder = location.host || 'host:5173';
  if (DEFAULT_SERVER && !addr.value) addr.value = DEFAULT_SERVER;
  const look = () => serverInfo().then((i) => { ded = i; if (!online()) render(); });
  if (/^https?:$/.test(location.protocol)) { look(); setInterval(() => { if (ded && !online() && !G.playing) look(); }, 10000); }
  addr.onkeydown = (e) => e.stopPropagation();
  hostBtn.onclick = () => {
    if (!/^https?:$/.test(location.protocol) || !location.host) { status.textContent = 'To host, start the game with start-gry.bat (it runs the server).'; return; }
    start(serverUrl('', location));
  };
  joinBtn.onclick = () => {
    try { start(serverUrl(ded ? '' : addr.value, location)); } catch { status.textContent = 'That is not a server address. Try 192.168.1.20:5173.'; }
  };
  leaveBtn.onclick = () => { disconnect(); clearPeers(); say('You left the game.', 'info'); render(); };
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
