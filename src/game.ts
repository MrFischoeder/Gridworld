// Shared runtime state. Generators never touch this; they are pure functions of their seeds.
import * as THREE from 'three';
import type { Space, VoxelGrid } from './core/voxel';
import type { Char } from './save';
import type { Door, Stair } from './world/doors';
import type { Drone, Boss, Orb } from './world/enemies';
import type { Chest, Hatch, Crystal, Pickup } from './world/loot';
import type { Npc } from './world/npc';
import type { Creature } from './world/creatures';
import type { Bandit } from './world/bandits';
import type { DungeonMap } from './gen/dungeon';

export interface Stats { maxHp: number; bm: number; mm: number; range: number; rate: number; speed: number }

export interface Trans {
  phase: 'out' | 'in'; t: number; dur: number;
  st: Partial<Stair>;
  pts: THREE.Vector3[];
  yaw0: number; yaw1: number; p0: number; p1: number;
  go?: () => void;
}

export const G = {
  char: null as unknown as Char,
  S: { maxHp: 100, bm: 1, mm: 1, range: 2.6, rate: 0.16, speed: 1 } as Stats,
  hp: 100,
  pos: new THREE.Vector3(), vel: new THREE.Vector3(),
  yaw: 0, pitch: 0, onGround: false,
  /** Collision space of the current location. */
  space: null as unknown as Space,
  /** Voxel grid of the current location (bounds for minimap and floor searches). */
  grid: null as unknown as VoxelGrid,
  map: null as DungeonMap | null,
  /** Terrain height under a point (open world only); -Infinity where a structure's own floor takes over. */
  ground: null as ((x: number, z: number) => number) | null,
  /** Extra solid obstacles that are not voxels (tree trunks). */
  obstacle: null as ((x: number, y: number, z: number, r: number) => boolean) | null,
  mapOpen: false,
  playing: false, packOpen: false, dlgOpen: false, xferOpen: false, consoleOpen: false, firing: false,
  /** Console cheat: full health that never drops. */
  god: false,
  keys: {} as Record<string, boolean>,
  trans: null as Trans | null,
  isTouch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
  touchJump: false,
  stick: { id: null as number | null, x: 0, y: 0, dx: 0, dy: 0 },
  look: { id: null as number | null, x: 0, y: 0 },
  weapon: 0, cooldown: 0, swingT: 0,
  hitFlash: 0, dmgFlash: 0,
};

/** Entities of the currently loaded location. */
export const W = {
  doors: [] as Door[], portals: [] as Stair[], arrivalStair: null as Stair | null,
  chests: [] as Chest[], hatch: null as Hatch | null, crystals: [] as Crystal[], pickups: [] as Pickup[],
  drones: [] as Drone[], bosses: [] as Boss[], orbs: [] as Orb[], creatures: [] as Creature[], bandits: [] as Bandit[], spawnCells: [] as [number, number, number][],
  npcs: [] as Npc[], villageWalk: [] as [number, number][],
  nearChest: null as Chest | null, nearPortal: null as Stair | null, nearLock: null as Door | null,
  nearNpc: null as Npc | null, talkNpc: null as Npc | null,
};


/** Any window that pauses play (backpack, dialogue, container). */
export const uiOpen = () => G.packOpen || G.dlgOpen || G.xferOpen || G.consoleOpen;
