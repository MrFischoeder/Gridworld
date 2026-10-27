import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { SFX_NAMES, render, toWav, sfxFiles, MUSIC_MOODS, SFX_RATE } from '../src/audio/synth';

describe('0.212: the 8-bit sound effects', () => {
  it('renders every sound: short, loud enough, never clipping', () => {
    for (const n of SFX_NAMES) {
      const s = render(n);
      expect(s.length / SFX_RATE).toBeLessThan(n === 'impact' ? 3.6 : n === 'thunder' ? 2.6 : n === 'howl_ravager' ? 1.8 : 1.2); // thunder rolls on, a howl carries
      let peak = 0; for (const v of s) peak = Math.max(peak, Math.abs(v));
      expect(peak).toBeGreaterThan(0.1);
      expect(peak).toBeLessThanOrEqual(1);
    }
  });
  it('the same recipe and take always give the same sound; takes differ', () => {
    expect(render('step_ground', 1)).toEqual(render('step_ground', 1));
    expect(render('step_ground', 1)).not.toEqual(render('step_ground', 2));
  });
  it('writes a valid 8-bit WAV', () => {
    const w = toWav(render('pickup')), d = new DataView(w.buffer);
    expect(String.fromCharCode(...w.slice(0, 4))).toBe('RIFF');
    expect(d.getUint16(34, true)).toBe(8);
    expect(d.getUint32(24, true)).toBe(SFX_RATE);
    expect(d.getUint32(40, true)).toBe(w.length - 44);
  });
  it('ships a file for every sound and lists every sound', () => {
    const list = JSON.parse(readFileSync('public/sfx/sounds.json', 'utf8'));
    for (const n of SFX_NAMES) {
      expect(list[n]?.files?.length).toBeGreaterThan(0);
      for (const f of sfxFiles(n)) expect(existsSync('public/sfx/' + f)).toBe(true);
    }
    const music = JSON.parse(readFileSync('public/music/music.json', 'utf8'));
    for (const m of MUSIC_MOODS) expect(Array.isArray(music[m])).toBe(true);
  });
});
