export declare const GATE_COUNT: number, GATE_SECONDS: number;
export interface GateLink { a: number; b: number; until: number }
export declare function gateAddresses(world: number): [number, number, number][];
export declare function addressDestination(world: number, source: number, symbols: readonly number[]): number;
export declare class GateConnections {
  constructor(now?: () => number);
  state(): GateLink[];
  at(id: number): GateLink | null;
  open(world: number, source: number, symbols: readonly number[]): { ok: false; why: string } | { ok: true; link: GateLink };
}
