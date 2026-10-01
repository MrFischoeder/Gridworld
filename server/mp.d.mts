// Types for server/mp.mjs (plain JavaScript so Node runs it without a build step).
import type { Server } from 'node:http';
export declare const MP: { path: string; port: number; max: number; rate: number; nameMax: number; chatMax: number; roomName: number; rooms: number; roomTtl: number };
export declare const PROTOCOL: number;
export interface RoomSeed { id: string; name: string; world: number; time: number; created?: number; last?: number }
export interface RoomRow { id: string; name: string; world: number; time: number; online: number; max: number; running: boolean; players: string[]; created: number; last: number }
export declare function createMp(log?: (m: string) => void, opts?: { world?: number; time?: number; name?: string; rooms?: RoomSeed[] }): {
  attach(server: Server, path?: string): void;
  close(): void;
  players: Map<number, { id: number; name: string }>;
  dedicated: boolean;
  list(): RoomRow[];
  state(): { hostId: number; world: number | null; time: number; n: number; names: string[] };
};
