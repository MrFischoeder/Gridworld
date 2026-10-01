// Types for server/mp.mjs (plain JavaScript so Node runs it without a build step).
import type { Server } from 'node:http';
export declare const MP: { path: string; port: number; max: number; rate: number; nameMax: number; chatMax: number };
export declare const PROTOCOL: number;
export declare function createMp(log?: (m: string) => void, opts?: { world?: number; time?: number }): {
  attach(server: Server, path?: string): void;
  close(): void;
  players: Map<number, { id: number; name: string }>;
  dedicated: boolean;
  state(): { hostId: number; world: number | null; time: number; n: number; names: string[] };
};
