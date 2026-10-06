// The opening film's timing (pure): which shot plays when, how far along it is, the cuts, the flash of the meteor
// strike and the closing title. Presentation only: the showcase never advances the saved world's clock.
export const CINEMATIC_SECONDS = 48;
/** The shots in order: a title and a line for the caption in the lower third. */
export const CINEMATIC_SHOTS = [
  { start: 0, end: 4, name: 'SV-9 Kestrel', line: 'A survey ship, far from home' },
  { start: 4, end: 7.5, name: 'Impact', line: 'A meteor storm tears her apart' },
  { start: 7.5, end: 10.5, name: 'Stranded', line: 'The pilot did not make it. You did.' },
  { start: 10.5, end: 13.5, name: 'Gridholm', line: 'A walled village on the edge of the wilds' },
  { start: 13.5, end: 16.5, name: 'Build', line: 'Farms, works and walls rise by your hand' },
  { start: 16.5, end: 19.5, name: 'Ancient gates', line: 'Wake the old rings and cross the world' },
  { start: 19.5, end: 22.5, name: 'The Watchers', line: 'Stone faces older than memory' },
  { start: 22.5, end: 25.5, name: 'Dead cities', line: 'The machines still guard the ruins' },
  { start: 25.5, end: 29.5, name: 'Fight', line: 'Robots, outlaws and beasts of the wild' },
  { start: 29.5, end: 32.5, name: 'Convoys', line: 'Guard the caravans on the open road' },
  { start: 32.5, end: 35.5, name: 'Open seas', line: 'Build docks and ships, sail past the coast' },
  { start: 35.5, end: 38.5, name: 'Storms', line: 'Rivers, ranges and weather that bites' },
  { start: 38.5, end: 42.5, name: 'The Chariot', line: 'Rebuild the ship of the Ancients. Go home.' },
  { start: 42.5, end: 48, name: '', line: '' },
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
/** When the meteor strikes (a white flash). */
export const STRIKE = 4.6;
export function cinematicFrame(seconds: number) {
  const t = Math.max(0, Math.min(CINEMATIC_SECONDS, seconds)), last = CINEMATIC_SHOTS.length - 1;
  const index = CINEMATIC_SHOTS.findIndex(s => t < s.end), shot = index < 0 ? last : index;
  const s = CINEMATIC_SHOTS[shot], progress = clamp((t - s.start) / (s.end - s.start));
  const fade = clamp(Math.min(t / .65, (CINEMATIC_SECONDS - t) / .65));
  const cut = shot === 0 ? 1 : clamp((t - s.start) / .16);
  // the caption comes in after the cut and goes before the next one
  const caption = s.name ? clamp(Math.min((t - s.start - .25) / .35, (s.end - t - .1) / .3)) : 0;
  const flash = clamp(1 - Math.abs(t - STRIKE) / .35);
  return {
    shot, progress, veil: 1 - Math.min(fade, cut), caption, flash,
    title: clamp((t - 43.4) / 1.6), design: clamp((t - 45.2) / 1.1), music: clamp((t - 46.2) / 1.1), finished: t >= CINEMATIC_SECONDS,
  };
}
