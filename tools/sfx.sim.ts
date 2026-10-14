// Renders the game's 8-bit sound effects (src/audio/synth.ts) into public/sfx/ as WAV files:
//   npx vitest run --config tools/sim.config.ts tools/sfx.sim.ts
// sounds.json keeps the owner's entries (new sounds are added to it); music/music.json is written only when missing.
import { it } from 'vitest';
import { writeFileSync, readFileSync, mkdirSync, existsSync } from 'node:fs';
import { SFX_NAMES, render, toWav, sfxFiles, defaultSoundList, type MusicList } from '../src/audio/synth';

it('renders the sound effects', () => {
  mkdirSync('public/sfx', { recursive: true });
  mkdirSync('public/music', { recursive: true });
  let bytes = 0;
  for (const n of SFX_NAMES) sfxFiles(n).forEach((f, i) => { const w = toWav(render(n, i)); bytes += w.length; writeFileSync('public/sfx/' + f, w); });
  // the owner's list stays as he left it; sounds added since are appended to it
  const list = existsSync('public/sfx/sounds.json') ? { ...defaultSoundList(), ...JSON.parse(readFileSync('public/sfx/sounds.json', 'utf8')) } : defaultSoundList();
  writeFileSync('public/sfx/sounds.json', JSON.stringify(list, null, 2) + '\n');
  const music: MusicList = { menu: [], world: [], night: [], underground: [], fight: [] };
  if (!existsSync('public/music/music.json')) writeFileSync('public/music/music.json', JSON.stringify(music, null, 2) + '\n');
  console.log(`${SFX_NAMES.length} sounds, ${(bytes / 1024).toFixed(0)} KB`);
});
