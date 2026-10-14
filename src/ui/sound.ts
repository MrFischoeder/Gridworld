// (0.212) The menu's Sound panel: master, effects and music volume, mute, a test sound, and where the sounds and the
// music live (public/sfx/sounds.json, public/music/music.json). The volumes are the player's own (world/sound.ts).
import { tl, TL } from '../i18n';
import { volumes, setVolumes, play, soundInfo } from '../world/sound';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const box = $('soundBox');
const sliders: [string, 'master' | 'sfx' | 'music'][] = [['volMaster', 'master'], ['volSfx', 'sfx'], ['volMusic', 'music']];

function show() {
  for (const [id, k] of sliders) {
    const r = $<HTMLInputElement>(id); r.value = String(Math.round(volumes[k] * 100));
    (r.nextElementSibling as HTMLElement).textContent = r.value + '%';
  }
  $<HTMLInputElement>('volMute').checked = volumes.mute;
  const i = soundInfo();
  $('sndInfo').innerHTML = (i.on ? TL`Sound is on (${i.rate} Hz); ${i.played} sounds played so far.` : i.state === 'none' ? tl('This browser has no Web Audio: no sound.') : tl('Sound is asleep: click anywhere on the page to wake it.')) + '<br>'
    + TL`${i.sounds} sound effects (8-bit), files in the sfx folder; the list sfx/sounds.json says which file each sound plays.` + '<br>'
    + (i.music ? TL`Music: ${i.music} tracks listed in music/music.json.` : tl('No music yet: put your tracks (mp3 or ogg) in the music folder and list them in music/music.json (menu, world, night, underground, fight).'));
}
export function showSoundBox(on = box.style.display === 'none') {
  box.style.display = on ? '' : 'none';
  if (on) show();
}
for (const [id, k] of sliders) $<HTMLInputElement>(id).addEventListener('input', (e) => { setVolumes({ [k]: +(e.target as HTMLInputElement).value / 100 }); show(); });
$<HTMLInputElement>('volMute').addEventListener('change', (e) => { setVolumes({ mute: (e.target as HTMLInputElement).checked }); show(); });
$('sndTest').addEventListener('click', () => { play('shot_blaster'); setTimeout(() => play('step_ground'), 350); setTimeout(() => play('pickup'), 700); setTimeout(show, 50); });
$('soundOpen').addEventListener('click', () => showSoundBox());
$('soundClose').addEventListener('click', () => showSoundBox(false));
