// (0.212) Sound: the 8-bit effects (src/audio/synth.ts) and the owner's own music, through Web Audio.
// Effects come from public/sfx/ (sounds.json names the files of every sound, so the owner can swap in his own WAV,
// MP3 or OGG files); a sound whose file is missing is synthesized here from its recipe instead. Music comes from
// public/music/music.json (lists of files by mood, empty at first). Volumes (master, effects, music) are the player's
// own (localStorage 'gridWorld.audio'), set in the menu's Sound panel (ui/sound.ts).
// Multiplayer: every game plays what it sees itself (its player, the foes it runs or copies, the other players' steps);
// nothing is sent.
import * as THREE from 'three';
import { camera } from './render';
import { G, W } from '../game';
import { net } from '../net/client';
import { SFX_NAMES, SFX_RATE, render, sfxFiles, MUSIC_MOODS, type SfxName, type SoundList, type MusicList } from '../audio/synth';
import { FLYERS, SWIMMERS, type CreatureKind } from '../data/creatures';

export interface Volumes { master: number; sfx: number; music: number; mute: boolean }
const KEY = 'gridWorld.audio';
export const volumes: Volumes = (() => {
  const d: Volumes = { master: 0.8, sfx: 0.8, music: 0.5, mute: false };
  try { return { ...d, ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { return d; }
})();

let ctx: AudioContext | null = null, master: GainNode, sfxBus: GainNode, musicBus: GainNode;
const buffers = new Map<SfxName, AudioBuffer[]>(), listVol = new Map<SfxName, number>();
let loading = false, live = 0;
/** At most this many effects at once (the rest are skipped). */
const MAX_VOICES = 28;

function audio(): AudioContext | null {
  if (ctx) return ctx;
  const AC = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.connect(ctx.destination);
  sfxBus = ctx.createGain(); sfxBus.connect(master);
  musicBus = ctx.createGain(); musicBus.connect(master);
  applyVolumes();
  void loadSounds();
  return ctx;
}
/** Browsers start sound only after the player touches the page: the first key or click wakes it. */
export function initSound() {
  const wake = () => { const c = audio(); if (c && c.state === 'suspended') void c.resume(); };
  for (const ev of ['pointerdown', 'keydown']) addEventListener(ev, wake, { capture: true });
}
export function applyVolumes() {
  if (!ctx) return;
  master.gain.value = volumes.mute ? 0 : volumes.master;
  sfxBus.gain.value = volumes.sfx;
  musicBus.gain.value = volumes.music;
}
export function setVolumes(v: Partial<Volumes>) {
  Object.assign(volumes, v); applyVolumes();
  try { localStorage.setItem(KEY, JSON.stringify(volumes)); } catch { /* private window */ }
}

const synthBuffer = (c: AudioContext, n: SfxName, take: number) => { const s = render(n, take), b = c.createBuffer(1, s.length, SFX_RATE); b.copyToChannel(s, 0); return b; };
async function fetchBuffer(c: AudioContext, url: string): Promise<AudioBuffer | null> {
  try { const r = await fetch(url); if (!r.ok) return null; return await c.decodeAudioData(await r.arrayBuffer()); } catch { return null; }
}
async function loadSounds() {
  if (loading || !ctx) return;
  loading = true;
  const c = ctx;
  for (const n of SFX_NAMES) buffers.set(n, sfxFiles(n).map((_, i) => synthBuffer(c, n, i))); // at once, from the recipes
  let list: SoundList = {};
  try { const r = await fetch('sfx/sounds.json'); if (r.ok) list = await r.json(); } catch { /* none: the recipes stay */ }
  await Promise.all(SFX_NAMES.map(async (n) => {
    const e = list[n]; if (!e) return;
    if (typeof e.vol === 'number') listVol.set(n, e.vol);
    const got = (await Promise.all((e.files ?? []).map((f) => fetchBuffer(c, 'sfx/' + f)))).filter((b): b is AudioBuffer => !!b);
    if (got.length) buffers.set(n, got);
  }));
  void loadMusic();
}

export interface PlayOpts { at?: { x: number; y: number; z: number }; vol?: number; rate?: number; /** random pitch spread */ jitter?: number; /** metres it carries */ far?: number }
const right = new THREE.Vector3(), fwd = new THREE.Vector3();
/** Play a sound, at a point in the world (fainter with distance, panned left / right) or as your own (`at` unset). */
export function play(name: SfxName, o: PlayOpts = {}) {
  const c = ctx;
  if (!c || volumes.mute || live >= MAX_VOICES) return;
  if (c.state !== 'running') { if (c.state === 'suspended') void c.resume(); return; } // put to sleep by the browser: wake it
  const list = buffers.get(name); if (!list?.length) return;
  let vol = (o.vol ?? 1) * (listVol.get(name) ?? 1), pan = 0;
  if (o.at) {
    const dx = o.at.x - camera.position.x, dy = o.at.y - camera.position.y, dz = o.at.z - camera.position.z, d = Math.hypot(dx, dy, dz), far = o.far ?? 60;
    if (d > far) return;
    vol *= Math.pow(1 - d / far, 1.6) / (1 + d * 0.04);
    if (vol < 0.01) return;
    camera.getWorldDirection(fwd); right.crossVectors(fwd, camera.up).normalize();
    pan = d > 0.5 ? Math.max(-1, Math.min(1, (dx * right.x + dz * right.z) / d)) * 0.8 : 0;
  }
  const src = c.createBufferSource(); src.buffer = list[Math.floor(Math.random() * list.length)];
  src.playbackRate.value = (o.rate ?? 1) * (1 + (Math.random() - 0.5) * 2 * (o.jitter ?? 0.04));
  const g = c.createGain(); g.gain.value = vol;
  let tail: AudioNode = g;
  if (pan && c.createStereoPanner) { const p = c.createStereoPanner(); p.pan.value = pan; g.connect(p); tail = p; }
  src.connect(g); tail.connect(sfxBus);
  live++; src.onended = () => { live--; src.disconnect(); };
  src.start();
}

// ---------- footsteps: yours, the other players', and the foes' ----------
/** Metres a step: yours by gait, foes by size. */
const STRIDE = { walk: 1.55, run: 2.1, crouch: 1.0 };
let stepGone = 0, wasGround = true, fallV = 0, lastX = NaN, lastZ = NaN;
/** Your steps, jumps and landings (called on foot, after the move): by the ground really covered, so pushing
 *  against a wall makes no steps. */
export function updateMySteps(dt: number) {
  const moved = Math.hypot(G.pos.x - lastX, G.pos.z - lastZ); lastX = G.pos.x; lastZ = G.pos.z;
  if (!ctx || !G.playing || !(moved < 3)) return; // (a teleport or the first frame)
  const speed = dt > 0 ? moved / dt : 0;
  if (!G.onGround) { fallV = Math.min(fallV, G.vel.y); if (wasGround && G.vel.y > 2) play('jump', { vol: 0.5 }); wasGround = false; return; }
  if (!wasGround) { if (fallV < -4) play('land', { vol: Math.min(1, -fallV / 10) }); stepGone = 0; }
  wasGround = true; fallV = 0;
  if (speed < 0.4) { stepGone = Math.min(stepGone, 0.5); return; }
  stepGone += speed * dt;
  const stride = G.crouch ? STRIDE.crouch : speed > 7 ? STRIDE.run : STRIDE.walk;
  if (stepGone < stride) return;
  stepGone = 0;
  play(surface(G.pos.x, G.pos.y, G.pos.z), { vol: G.crouch ? 0.25 : speed > 7 ? 0.75 : 0.5, jitter: 0.08 });
}
/** What a foot lands on: water, hard (a floor, a dungeon, a city, a voxel place), or the ground. */
function surface(x: number, y: number, z: number): SfxName {
  const w = G.water?.(x, z);
  if (w && w.depth > 0.12) return 'step_water';
  if (G.char.loc === 'dungeon') return 'step_hard';
  if (G.floor && G.floor(x, y + 0.1, z) >= y - 0.15) return 'step_hard';
  const g = G.ground?.(x, z);
  if (g === -Infinity || g === undefined) return 'step_hard';
  return 'step_ground';
}

interface Track { x: number; z: number; gone: number; voice: number; steps: number }
const tracks = new WeakMap<object, Track>(), peerTracks = new Map<number, Track>();
const VOICE: Partial<Record<CreatureKind, SfxName>> = { ravager: 'growl_ravager', bramble: 'snort_bramble', gnawer: 'squeak_gnawer', leechwing: 'screech_leechwing', skitter: 'chirp_skitter' };
const HEAVY = new Set(['sentinel', 'artillery', 'assault']);
function track(o: object, x: number, z: number): [Track, number] {
  let t = tracks.get(o);
  if (!t) { t = { x, z, gone: Math.random(), voice: 2 + Math.random() * 8, steps: 0 }; tracks.set(o, t); return [t, 0]; }
  const d = Math.hypot(x - t.x, z - t.z); t.x = x; t.z = z;
  return [t, d > 4 ? 0 : d]; // a jump (a copy put right) is no walk
}
const near = (x: number, z: number, r: number) => Math.abs(x - camera.position.x) < r && Math.abs(z - camera.position.z) < r;
/** The foes' and the other players' footsteps, machines' clanks and whines, and the creatures' voices. */
export function updateFoeSounds(dt: number) {
  if (!ctx || !G.playing) return;
  for (const r of W.robots) {
    const [t, d] = track(r, r.p.x, r.p.z);
    if (!near(r.p.x, r.p.z, 60)) continue;
    const heavy = HEAVY.has(r.model), stride = heavy ? 2.4 : r.model === 'scout' ? 1.3 : 1.7;
    if (r.model === 'repair') continue; // it hovers
    if ((t.gone += d) >= stride) { t.gone = 0; play('robot_step', { at: r.p, vol: heavy ? 1 : 0.6, rate: heavy ? 0.7 : 1.05, far: heavy ? 70 : 45 }); if (++t.steps % 3 === 0) play('robot_servo', { at: r.p, vol: 0.25, rate: heavy ? 0.8 : 1.1, far: 35 }); }
  }
  for (const b of W.bandits) {
    const [t, d] = track(b, b.p.x, b.p.z);
    if (!near(b.p.x, b.p.z, 40)) continue;
    if ((t.gone += d) >= 1.5) { t.gone = 0; play('step_ground', { at: b.p, vol: 0.45, far: 30, jitter: 0.1 }); }
  }
  for (const c of W.creatures) {
    const [t, d] = track(c, c.p.x, c.p.z);
    if (!near(c.p.x, c.p.z, 70)) continue;
    const ground = !FLYERS.includes(c.kind) && !SWIMMERS.includes(c.kind);
    if (ground && (t.gone += d) >= (c.kind === 'bramble' ? 2.2 : c.kind === 'gnawer' ? 0.9 : 1.4)) {
      t.gone = 0; play('step_ground', { at: c.p, vol: c.kind === 'bramble' ? 0.8 : 0.3, rate: c.kind === 'bramble' ? 0.75 : c.kind === 'gnawer' ? 1.6 : 1.15, far: 30 });
    }
    const v = VOICE[c.kind];
    if (v && (t.voice -= dt * (d / dt > 3 ? 2.5 : 1)) <= 0) { t.voice = 5 + Math.random() * 10; play(v, { at: c.p, vol: 0.8, far: c.kind === 'leechwing' ? 90 : 55, jitter: 0.08 }); }
  }
  const here = net.peers.size ? myLoc() : '';
  for (const [id, p] of net.peers) {
    const s = p.st; if (!s || s.away || s.loc !== here || s.boat || s.ride) { peerTracks.delete(id); continue; }
    const x = s.p[0], z = s.p[2]; let t = peerTracks.get(id);
    if (!t) { peerTracks.set(id, { x, z, gone: 0, voice: 0, steps: 0 }); continue; }
    const d = Math.hypot(x - t.x, z - t.z); t.x = x; t.z = z;
    if (d > 4 || !near(x, z, 40)) continue;
    if ((t.gone += d) >= (s.cr ? STRIDE.crouch : STRIDE.walk)) { t.gone = 0; play(surface(x, s.p[1], z), { at: { x, y: s.p[1], z }, vol: s.cr ? 0.2 : 0.45, far: 30, jitter: 0.08 }); }
  }
}
let myLoc = () => '';
/** world/peers.ts gives where you are (set from main.ts to keep this module free of the peers' imports). */
export function setLocHook(f: () => string) { myLoc = f; }

// ---------- music ----------
let musicList: MusicList | null = null, now: HTMLAudioElement | null = null, nowMood = '', fading: HTMLAudioElement[] = [];
const elGain = new WeakMap<HTMLAudioElement, GainNode>();
async function loadMusic() {
  try { const r = await fetch('music/music.json'); if (r.ok) musicList = await r.json(); } catch { musicList = null; }
}
/** The music's mood now: the menu, a fight, below ground, night or the world. */
export type Mood = (typeof MUSIC_MOODS)[number];
function pickTrack(mood: Mood): string | null {
  if (!musicList) return null;
  const l = (musicList[mood]?.length ? musicList[mood] : musicList.world) ?? [];
  return l.length ? l[Math.floor(Math.random() * l.length)] : null;
}
/** Fade to the mood's music (called every frame; changes only when the mood does or a track ends). */
export function updateMusic(mood: Mood, dt: number) {
  const c = ctx; if (!c || !musicList) return;
  for (const a of [...fading]) { const g = elGain.get(a)!; g.gain.value = Math.max(0, g.gain.value - dt / 2); if (g.gain.value <= 0) { a.pause(); fading.splice(fading.indexOf(a), 1); } }
  if (now) { const g = elGain.get(now)!; g.gain.value = Math.min(1, g.gain.value + dt / 2); }
  if (mood === nowMood && now && !now.ended) return;
  const fileOf = (m: Mood) => { const l = musicList![m]?.length ? m : 'world'; return l; };
  if (now && fileOf(mood) === fileOf(nowMood as Mood) && !now.ended) { nowMood = mood; return; } // the same list: play on
  if (now) { fading.push(now); now = null; }
  nowMood = mood;
  const f = pickTrack(mood); if (!f) return;
  const a = new Audio('music/' + f); a.crossOrigin = 'anonymous'; a.loop = (musicList[fileOf(mood)]?.length ?? 0) <= 1;
  const g = c.createGain(); g.gain.value = 0; elGain.set(a, g);
  c.createMediaElementSource(a).connect(g); g.connect(musicBus);
  void a.play().catch(() => { /* not yet allowed: tried again on the next change */ });
  now = a;
}
/** A list of what is loaded, for the Sound panel. */
export const soundInfo = () => ({ sounds: SFX_NAMES.length, music: musicList ? MUSIC_MOODS.reduce((n, m) => n + (musicList![m]?.length ?? 0), 0) : 0, on: !!ctx && ctx.state === 'running', state: ctx?.state ?? 'none' });

let lastHp = -1, hurtT = 0;
/** Once a frame: the sound of being hit, and the music by mood (the menu, a fight near you, below ground, night). */
export function updateSoundFrame(dt: number) {
  hurtT -= dt;
  if (G.playing && lastHp >= 0 && G.hp < lastHp - 0.5 && hurtT <= 0) { hurtT = 0.3; play('hurt', { vol: Math.min(1, 0.4 + (lastHp - G.hp) / 25) }); }
  lastHp = G.hp;
  if (!ctx) return;
  const hour = Math.floor((G.char.time % 1440) / 60), x = G.pos.x, z = G.pos.z;
  const foeNear = (l: { p: { x: number; z: number } }[]) => l.some((f) => Math.abs(f.p.x - x) < 30 && Math.abs(f.p.z - z) < 30);
  const mood: Mood = !G.playing ? 'menu' : foeNear(W.robots) || foeNear(W.bandits) || foeNear(W.creatures.filter((c) => c.kind !== 'silverfin')) ? 'fight'
    : G.char.loc === 'dungeon' ? 'underground' : hour < 6 || hour >= 20 ? 'night' : 'world';
  updateMusic(mood, dt);
}
