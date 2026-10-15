// (0.212) The game's sound effects as tiny 8-bit synthesizer recipes: square, triangle and saw waves, the NES-style
// noise of a 15-bit shift register, pitch sweeps and plain decays, bit-crushed to a few levels. Pure (no DOM, no Web
// Audio): tools/sfx.sim.ts renders every recipe to an 8-bit WAV in public/sfx/ (files the owner may replace with his
// own), and the game (world/sound.ts) renders a recipe itself when its file is missing or will not load.

export type Wave = 'square' | 'tri' | 'saw' | 'noise';
/** One voice: a wave sweeping from f[0] to f[1] Hz (for noise: the shift register's clock) over `d` seconds, starting
 *  at `t`, rising over `a` seconds and fading as (1 - x)^`curve`. */
export interface Voice { w: Wave; f: [number, number]; d: number; t?: number; a?: number; v?: number; curve?: number; duty?: number; vib?: [number, number] }
export interface Sfx { voices: Voice[]; /** amplitude levels left after crushing (16 = 4 bits) */ crush?: number; gain?: number }

export const SFX_RATE = 22050;

/** Every sound the game plays, by name. Footsteps and a few others have variants: rendered with a small detune each. */
export const SFX = {
  // the player's guns and blades
  shot_blaster: { voices: [{ w: 'square', f: [1500, 170], d: 0.22, duty: 0.25, v: 0.7, curve: 1.4 }, { w: 'noise', f: [5000, 1500], d: 0.07, v: 0.45 }] },
  shot_pistol: { voices: [{ w: 'noise', f: [9000, 2200], d: 0.13, v: 0.9, curve: 2 }, { w: 'square', f: [320, 80], d: 0.08, v: 0.5 }] },
  shot_smg: { voices: [{ w: 'noise', f: [12000, 4000], d: 0.075, v: 0.8, curve: 2 }, { w: 'square', f: [420, 150], d: 0.05, v: 0.4 }] },
  shot_shotgun: { voices: [{ w: 'noise', f: [6000, 700], d: 0.38, v: 1, curve: 1.5 }, { w: 'square', f: [130, 40], d: 0.22, v: 0.7 }] },
  shot_rifle: { voices: [{ w: 'noise', f: [11000, 1600], d: 0.2, v: 0.9, curve: 1.8 }, { w: 'square', f: [230, 50], d: 0.18, v: 0.75 }, { w: 'noise', f: [2200, 500], t: 0.06, d: 0.45, v: 0.28 }] },
  dry: { voices: [{ w: 'square', f: [1800, 1800], d: 0.02, v: 0.5 }, { w: 'square', f: [900, 900], t: 0.05, d: 0.02, v: 0.4 }] },
  reload: { voices: [{ w: 'noise', f: [5000, 4000], d: 0.035, v: 0.6 }, { w: 'square', f: [620, 560], t: 0.1, d: 0.035, v: 0.45 }, { w: 'noise', f: [7000, 6000], t: 0.32, d: 0.045, v: 0.6 }, { w: 'square', f: [1050, 980], t: 0.37, d: 0.045, v: 0.45 }] },
  swing: { voices: [{ w: 'noise', f: [1800, 6500], d: 0.17, a: 0.07, v: 0.55, curve: 1.2 }] },
  hit: { voices: [{ w: 'square', f: [520, 190], d: 0.07, v: 0.6 }, { w: 'noise', f: [3200, 1800], d: 0.05, v: 0.5 }] },
  throw: { voices: [{ w: 'noise', f: [900, 2600], d: 0.18, a: 0.06, v: 0.45 }] },
  thud: { voices: [{ w: 'noise', f: [700, 200], d: 0.12, v: 0.7 }, { w: 'tri', f: [160, 70], d: 0.1, v: 0.5 }] },
  hiss: { voices: [{ w: 'noise', f: [6000, 4200], d: 1.0, a: 0.05, v: 0.45 }, { w: 'square', f: [220, 180], d: 0.08, duty: 0.25, v: 0.3 }] },
  ricochet: { voices: [{ w: 'tri', f: [2600, 900], d: 0.2, v: 0.5, vib: [38, 0.05] }, { w: 'noise', f: [5200, 2400], d: 0.06, v: 0.55 }] },
  hurt: { voices: [{ w: 'square', f: [420, 110], d: 0.22, duty: 0.5, v: 0.6, vib: [28, 0.12] }, { w: 'noise', f: [2000, 600], d: 0.12, v: 0.35 }] },
  // the player's body
  step_ground: { voices: [{ w: 'noise', f: [1500, 550], d: 0.075, v: 0.55, curve: 3 }, { w: 'tri', f: [115, 70], d: 0.06, v: 0.55 }] },
  step_hard: { voices: [{ w: 'noise', f: [4200, 2000], d: 0.05, v: 0.5, curve: 3 }, { w: 'square', f: [210, 150], d: 0.035, v: 0.35 }] },
  step_water: { voices: [{ w: 'noise', f: [2400, 5200], d: 0.2, a: 0.02, v: 0.45, curve: 1.5 }, { w: 'noise', f: [800, 600], d: 0.1, v: 0.35 }] },
  jump: { voices: [{ w: 'square', f: [190, 520], d: 0.12, duty: 0.5, v: 0.35 }] },
  land: { voices: [{ w: 'noise', f: [1200, 380], d: 0.11, v: 0.6, curve: 2.5 }, { w: 'tri', f: [95, 50], d: 0.09, v: 0.6 }] },
  // machines
  robot_step: { voices: [{ w: 'square', f: [95, 60], d: 0.11, v: 0.55 }, { w: 'noise', f: [3000, 1400], d: 0.05, v: 0.45, curve: 3 }, { w: 'square', f: [1250, 1150], t: 0.015, d: 0.035, v: 0.2 }] },
  robot_servo: { voices: [{ w: 'saw', f: [280, 520], d: 0.22, a: 0.04, v: 0.2, vib: [40, 0.03] }] },
  robot_shot: { voices: [{ w: 'tri', f: [1900, 280], d: 0.26, v: 0.7, vib: [35, 0.06] }, { w: 'square', f: [950, 140], d: 0.12, duty: 0.125, v: 0.3 }] },
  enemy_shot: { voices: [{ w: 'noise', f: [7000, 1500], d: 0.14, v: 0.8, curve: 2 }, { w: 'square', f: [260, 70], d: 0.1, v: 0.45 }] },
  explosion: { voices: [{ w: 'noise', f: [3200, 140], d: 1.0, v: 1, curve: 1.2 }, { w: 'square', f: [85, 28], d: 0.5, v: 0.6 }] },
  // creatures
  growl_ravager: { voices: [{ w: 'saw', f: [115, 88], d: 0.55, a: 0.06, v: 0.55, vib: [30, 0.15] }, { w: 'noise', f: [420, 380], d: 0.5, a: 0.05, v: 0.35 }] },
  snort_bramble: { voices: [{ w: 'noise', f: [950, 280], d: 0.36, a: 0.05, v: 0.6 }, { w: 'square', f: [72, 52], d: 0.3, v: 0.45 }] },
  squeak_gnawer: { voices: [{ w: 'square', f: [2200, 3100], d: 0.08, duty: 0.25, v: 0.4 }, { w: 'square', f: [2700, 2000], t: 0.1, d: 0.07, duty: 0.25, v: 0.35 }] },
  screech_leechwing: { voices: [{ w: 'saw', f: [1650, 880], d: 0.5, a: 0.03, v: 0.45, vib: [25, 0.08] }, { w: 'noise', f: [5200, 4000], d: 0.3, v: 0.18 }] },
  chirp_skitter: { voices: [{ w: 'square', f: [3000, 4100], d: 0.04, v: 0.3 }, { w: 'square', f: [3200, 4300], t: 0.07, d: 0.04, v: 0.3 }, { w: 'square', f: [2900, 3900], t: 0.14, d: 0.04, v: 0.25 }] },
  // (0.212.1) the world round you
  engine: { voices: [{ w: 'saw', f: [55, 55], d: 0.4, a: 0.001, curve: 0, v: 0.6 }, { w: 'square', f: [110, 110], d: 0.4, a: 0.001, curve: 0, duty: 0.25, v: 0.3 }, { w: 'noise', f: [700, 700], d: 0.4, a: 0.001, curve: 0, v: 0.15 }] },
  cannon: { voices: [{ w: 'noise', f: [4000, 300], d: 0.6, v: 1, curve: 1.3 }, { w: 'square', f: [110, 30], d: 0.35, v: 0.8 }] },
  door: { voices: [{ w: 'saw', f: [320, 190], d: 0.38, a: 0.03, v: 0.4, vib: [18, 0.1] }, { w: 'noise', f: [1500, 500], t: 0.36, d: 0.08, v: 0.55, curve: 2.5 }, { w: 'tri', f: [120, 70], t: 0.36, d: 0.08, v: 0.5 }] },
  chest: { voices: [{ w: 'noise', f: [4500, 3500], d: 0.03, v: 0.5 }, { w: 'square', f: [380, 640], t: 0.04, d: 0.16, duty: 0.25, v: 0.35 }, { w: 'tri', f: [180, 120], t: 0.2, d: 0.08, v: 0.4 }] },
  eat: { voices: [{ w: 'noise', f: [2600, 1400], d: 0.06, v: 0.6, curve: 2 }, { w: 'noise', f: [2400, 1200], t: 0.16, d: 0.06, v: 0.55, curve: 2 }, { w: 'noise', f: [2800, 1300], t: 0.32, d: 0.07, v: 0.5, curve: 2 }] },
  drink: { voices: [{ w: 'tri', f: [380, 820], d: 0.08, v: 0.5 }, { w: 'tri', f: [420, 900], t: 0.13, d: 0.08, v: 0.5 }, { w: 'tri', f: [360, 780], t: 0.26, d: 0.09, v: 0.45 }] },
  thunder: { voices: [{ w: 'noise', f: [1600, 60], d: 2.4, a: 0.03, v: 1, curve: 1.1 }, { w: 'noise', f: [300, 80], t: 0.25, d: 1.8, a: 0.2, v: 0.7, curve: 1.3 }, { w: 'square', f: [55, 30], d: 1.2, v: 0.3 }] },
  coin: { voices: [{ w: 'square', f: [988, 988], d: 0.07, duty: 0.5, v: 0.35 }, { w: 'square', f: [1319, 1319], t: 0.07, d: 0.25, duty: 0.5, v: 0.35 }] },
  levelup: { voices: [523, 659, 784, 1047].map((f, i) => ({ w: 'square' as const, f: [f, f] as [number, number], t: i * 0.09, d: i === 3 ? 0.35 : 0.09, duty: 0.5, v: 0.35 })) },
  chop: { voices: [{ w: 'noise', f: [2600, 900], d: 0.09, v: 0.7, curve: 2 }, { w: 'square', f: [190, 85], d: 0.1, v: 0.6 }] },
  mine: { voices: [{ w: 'square', f: [1750, 1600], d: 0.08, duty: 0.25, v: 0.45 }, { w: 'noise', f: [6000, 2500], d: 0.07, v: 0.6, curve: 2.5 }, { w: 'tri', f: [2600, 2500], t: 0.02, d: 0.2, v: 0.2 }] },
  splash: { voices: [{ w: 'noise', f: [3200, 600], d: 0.5, a: 0.01, v: 0.8, curve: 1.6 }, { w: 'tri', f: [240, 90], d: 0.15, v: 0.4 }] },
  click: { voices: [{ w: 'square', f: [1100, 1100], d: 0.025, duty: 0.5, v: 0.4 }] },
  die_creature: { voices: [{ w: 'saw', f: [460, 70], d: 0.55, a: 0.02, v: 0.55, vib: [22, 0.1] }, { w: 'noise', f: [900, 250], t: 0.4, d: 0.15, v: 0.4 }] },
  die_bandit: { voices: [{ w: 'square', f: [330, 120], d: 0.35, duty: 0.5, v: 0.5, vib: [14, 0.08] }, { w: 'noise', f: [1100, 300], t: 0.3, d: 0.15, v: 0.5, curve: 2 }] },
  hammer: { voices: [{ w: 'square', f: [700, 620], d: 0.05, v: 0.5 }, { w: 'noise', f: [4000, 2000], d: 0.04, v: 0.5, curve: 3 }] },
  // things picked up
  pickup: { voices: [{ w: 'square', f: [660, 660], d: 0.06, duty: 0.5, v: 0.35 }, { w: 'square', f: [880, 880], t: 0.06, d: 0.06, duty: 0.5, v: 0.35 }, { w: 'square', f: [1320, 1320], t: 0.12, d: 0.1, duty: 0.5, v: 0.35 }] },
} satisfies Record<string, Sfx>;
export type SfxName = keyof typeof SFX;
export const SFX_NAMES = Object.keys(SFX) as SfxName[];
/** Sounds rendered in more than one take (a footstep never twice the same). */
export const VARIANTS: Partial<Record<SfxName, number>> = { step_ground: 3, step_hard: 3, step_water: 2, robot_step: 2, shot_smg: 2, chop: 2, mine: 2 };
/** The files of a sound: name.wav, or name_1.wav, name_2.wav... */
export const sfxFiles = (n: SfxName) => { const k = VARIANTS[n] ?? 1; return k === 1 ? [n + '.wav'] : Array.from({ length: k }, (_, i) => `${n}_${i + 1}.wav`); };

/** Render one take of a sound: mono samples in [-1, 1] at SFX_RATE. Take i > 0 is detuned a little, by its number. */
export function render(name: SfxName, take = 0): Float32Array<ArrayBuffer> {
  const s: Sfx = SFX[name], det = take ? 1 + ((take * 0.618) % 1 - 0.5) * 0.14 : 1;
  const len = Math.ceil(Math.max(...s.voices.map((v) => (v.t ?? 0) + v.d)) * SFX_RATE) + 1, out = new Float32Array(len);
  for (const [vi, v] of s.voices.entries()) {
    const n0 = Math.floor((v.t ?? 0) * SFX_RATE), n = Math.ceil(v.d * SFX_RATE), vol = v.v ?? 1, a = v.a ?? 0.004, curve = v.curve ?? 1.6, duty = v.duty ?? 0.5;
    let ph = 0, lfsr = 1 + take * 31 + vi * 7, noiseOut = 1;
    for (let i = 0; i < n && n0 + i < len; i++) {
      const x = i / n, time = i / SFX_RATE;
      let f = v.f[0] * Math.pow(v.f[1] / v.f[0], x) * det;
      if (v.vib) f *= 1 + Math.sin(time * 2 * Math.PI * v.vib[0]) * v.vib[1];
      const before = ph; ph += f / SFX_RATE;
      let y: number;
      if (v.w === 'noise') {
        for (let k = Math.floor(before); k < Math.floor(ph); k++) { const bit = (lfsr ^ (lfsr >> 1)) & 1; lfsr = (lfsr >> 1) | (bit << 14); noiseOut = lfsr & 1 ? 1 : -1; }
        y = noiseOut;
      } else {
        const p = ph % 1;
        y = v.w === 'square' ? (p < duty ? 1 : -1) : v.w === 'tri' ? (p < 0.5 ? 4 * p - 1 : 3 - 4 * p) : 2 * p - 1;
      }
      const env = (time < a ? time / a : 1) * Math.pow(1 - x, curve);
      out[n0 + i] += y * env * vol;
    }
  }
  // every sound peaks at the same level (its loudness in the game is the caller's volume), then crushed to 4 bits
  let peak = 0; for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(out[i]));
  const levels = s.crush ?? 16, gain = (s.gain ?? 1) * 0.9 / (peak || 1);
  for (let i = 0; i < len; i++) { const y = Math.max(-1, Math.min(1, out[i] * gain)); out[i] = Math.round(y * levels) / levels; }
  return out;
}

/** An 8-bit mono PCM WAV of the samples. */
export function toWav(samples: Float32Array, rate = SFX_RATE): Uint8Array {
  const n = samples.length, b = new Uint8Array(44 + n), d = new DataView(b.buffer);
  const str = (o: number, s: string) => { for (let i = 0; i < s.length; i++) b[o + i] = s.charCodeAt(i); };
  str(0, 'RIFF'); d.setUint32(4, 36 + n, true); str(8, 'WAVE'); str(12, 'fmt ');
  d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true); d.setUint32(24, rate, true); d.setUint32(28, rate, true); d.setUint16(32, 1, true); d.setUint16(34, 8, true);
  str(36, 'data'); d.setUint32(40, n, true);
  for (let i = 0; i < n; i++) b[44 + i] = Math.max(0, Math.min(255, Math.round(128 + samples[i] * 127)));
  return b;
}

/** The sound list the game reads (public/sfx/sounds.json): every name → its files (wav, mp3 or ogg; several = one at
 *  random) and a volume. The owner edits it to swap in his own sounds. */
export interface SoundList { [name: string]: { files: string[]; vol?: number } }
export const defaultSoundList = (): SoundList => Object.fromEntries(SFX_NAMES.map((n) => [n, { files: sfxFiles(n), vol: 1 }]));

/** Music (public/music/music.json): lists of files by mood; the game plays one at random, fading between moods. An
 *  empty list falls back to 'world'; with every list empty there is no music. */
export interface MusicList { menu: string[]; world: string[]; night: string[]; underground: string[]; fight: string[] }
export const MUSIC_MOODS: (keyof MusicList)[] = ['menu', 'world', 'night', 'underground', 'fight'];
