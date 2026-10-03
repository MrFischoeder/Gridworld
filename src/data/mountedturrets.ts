// Shared mount/model specification for ancient defences and future player-built variants.
export type TurretMount = 'wall' | 'floor' | 'ceiling';
export interface MountedTurretSpec { id: number; mount: TurretMount; x: number; y: number; z: number; normal: [number, number, number] }
export const MOUNTED_TURRET = { range: 24, hp: 32, armour: 0.5, damage: 4, rate: 0.45, warning: 0.8, radius: 0.55, progressBase: 1_000_000 };
