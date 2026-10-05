// Shared mount/model specification for ancient defences and future player-built variants.
export type TurretMount = 'wall' | 'floor' | 'ceiling';
export interface MountedTurretSpec { id: number; mount: TurretMount; x: number; y: number; z: number; normal: [number, number, number] }
export const MOUNTED_TURRET = {
  range: 24, hp: 32, armour: 0.5, damage: 4, radius: 0.55, progressBase: 1_000_000,
  /** The head turns at most `turn` rad/s, so a running target outpaces it; it fires only once within `aim` rad of you. */
  turn: 1.5, aim: 0.07,
  /** Seconds it must see you (sensor amber) before the first burst. */
  warning: 1.3,
  /** Bursts of `burst` shots `gap` s apart, then `pause` s of quiet; each shot strays up to `spread` rad. */
  burst: 3, gap: 0.14, pause: 2.2, spread: 0.035,
  /** Guns per crashed ship (labyrinths keep up to 3). */
  wreck: 1,
};
