export declare const GATE_COUNT: number, GATE_SECONDS: number, GATE_TRANSIT_SECONDS: number;
export interface GateLink { a: number; b: number; until: number; inTransit?: number; finishAt?: number }
export declare function gateAddresses(world: number): [number, number, number][];
export declare function addressDestination(world: number, source: number, symbols: readonly number[]): number;
export declare class GateConnections {
  constructor(now?: () => number);
  state(): GateLink[];
  draft(id: number): number[];
  draftState(): { gate: number; symbols: number[] }[];
  setDraft(id: number, symbols: readonly number[]): boolean;
  begin(id: number): { token: number; to: number; finishAt: number } | null;
  finish(token: number): void;
  at(id: number): GateLink | null;
  open(world: number, source: number, symbols: readonly number[]): { ok: false; why: string } | { ok: true; link: GateLink };
}
