// Presentation timing only: the showcase never advances the saved world's clock.
export const CINEMATIC_SECONDS = 20;
export const CINEMATIC_SHOTS = [
  { start: 0, end: 3, name: 'Gridholm · arrival' },
  { start: 3, end: 6, name: 'Gridholm · beyond the walls' },
  { start: 6, end: 9, name: 'Ancient ruins · forgotten gates' },
  { start: 9, end: 12, name: 'Fallen cities' },
  { start: 12, end: 15, name: 'Rivers · mountain ranges' },
  { start: 15, end: 17, name: 'Machines · outlaws · wild creatures' },
  { start: 17, end: 20, name: 'Convoys · a world to explore' },
] as const;
const clamp = (n: number) => Math.max(0, Math.min(1, n));
export function cinematicFrame(seconds: number) {
  const t = Math.max(0, Math.min(CINEMATIC_SECONDS, seconds));
  const index = CINEMATIC_SHOTS.findIndex(s => t < s.end), shot = index < 0 ? 6 : index;
  const s = CINEMATIC_SHOTS[shot], progress = clamp((t - s.start) / (s.end - s.start));
  const fade = clamp(Math.min(t / .65, (CINEMATIC_SECONDS - t) / .65));
  const cut = shot === 0 ? 1 : clamp((t - s.start) / .16);
  return { shot, progress, veil: 1 - Math.min(fade, cut), title: clamp((t - 12.5) / 2), design: clamp((t - 15) / 1.3), music: clamp((t - 16.6) / 1.3), finished: t >= CINEMATIC_SECONDS };
}
