// Renders the game's 8-bit sound effects (src/audio/synth.ts) into public/sfx/ as WAV files:
//   npx vitest run --config tools/sim.config.ts tools/sfx.sim.ts
// sounds.json and music/music.json are written only when missing, so the owner's own lists are never overwritten.
import { it } from 'vitest';
import { writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { SFX_NAMES, render, toWav, sfxFiles, defaultSoundList, type MusicList } from '../src/audio/synth';

it('renders the sound effects', () => {
  mkdirSync('public/sfx', { recursive: true });
  mkdirSync('public/music', { recursive: true });
  let bytes = 0;
  for (const n of SFX_NAMES) sfxFiles(n).forEach((f, i) => { const w = toWav(render(n, i)); bytes += w.length; writeFileSync('public/sfx/' + f, w); });
  if (!existsSync('public/sfx/sounds.json')) writeFileSync('public/sfx/sounds.json', JSON.stringify(defaultSoundList(), null, 2) + '\n');
  const music: MusicList = { menu: [], world: [], night: [], underground: [], fight: [] };
  if (!existsSync('public/music/music.json')) writeFileSync('public/music/music.json', JSON.stringify(music, null, 2) + '\n');
  console.log(`${SFX_NAMES.length} sounds, ${(bytes / 1024).toFixed(0)} KB`);
});
