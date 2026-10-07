// Types for server/accounts.mjs (plain JavaScript so Node runs it without a build step).
export declare const ACCOUNT: { nameMin: number; nameMax: number; passMin: number; passMax: number; sessionDays: number; tries: number; lockMs: number; perAccount: number };
export declare function nameProblem(name: string): string;
export declare function passProblem(pass: string): string;
export declare function accountKey(name: string): string;
export interface SavedAccounts { accounts?: { name: string; salt: string; hash: string; created: number; last: number }[]; sessions?: { h: string; key: string; until: number }[] }
export interface Accounts {
  register(name: string, pass: string): Promise<{ name?: string; token?: string; why?: string }>;
  login(name: string, pass: string, ip?: string): Promise<{ name?: string; token?: string; why?: string }>;
  session(token: string): { key: string; name: string } | null;
  logout(token: string): void;
  passwd(token: string, old: string, pass: string, ip?: string): Promise<string>;
  has(name: string): boolean;
  count(): number;
  dirty(): boolean;
  save(): SavedAccounts;
}
export declare function createAccounts(saved?: SavedAccounts): Accounts;
