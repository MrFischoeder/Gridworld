// Types for server/mp.mjs (plain JavaScript so Node runs it without a build step).
import type { Server } from 'node:http';
import type { Accounts } from './accounts.mjs';
export declare const MP: { path: string; port: number; max: number; rate: number; nameMax: number; chatMax: number; roomName: number; rooms: number; roomTtl: number; cars: number; drops: number; dropTtl: number; payload: number; maps: number };
export declare const FEATURES: string[];
export declare const PROTOCOL: number;
export interface DropRow { id: string; k: string; n: number; c?: number; p: number[]; loc: string; by: string; at: number }
export interface RoomSeed { id: string; name: string; world: number; time: number; owner?: string; by?: string; created?: number; last?: number; drops?: DropRow[]; doc?: Record<string, Record<string, unknown>>; seeded?: boolean; mode?: 'coop' | 'rivals'; slots?: Record<string, number>; maps?: RoomMaps | null }
/** (15) The map editor's files a room plays on. */
export interface RoomMaps { world: Record<string, unknown>; villages: Record<string, Record<string, unknown>>; dungeons: Record<string, Record<string, unknown>> }
export interface RoomRow { id: string; name: string; world: number; time: number; online: number; max: number; running: boolean; players: string[]; by: string; mode: 'coop' | 'rivals'; map?: string; created: number; last: number }
export declare function createMp(log?: (m: string) => void, opts?: { world?: number; time?: number; name?: string; rooms?: RoomSeed[]; removed?: (id: string) => void; accounts?: Accounts; accountsChanged?: () => void; admins?: string[] }): {
  attach(server: Server, path?: string): void;
  close(): void;
  players: Map<number, { id: number; name: string }>;
  dedicated: boolean;
  accounts: Accounts | null;
  list(): RoomRow[];
  save(): (RoomSeed & { drops: DropRow[] })[];
  dirtyDocs(): { id: string; doc: Record<string, Record<string, unknown>>; seeded: boolean }[];
  state(): { hostId: number; world: number | null; time: number; n: number; names: string[] };
};
