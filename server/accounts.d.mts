// Types for server/accounts.mjs (plain JavaScript so Node runs it without a build step).
export declare const ACCOUNT: { nameMin: number; nameMax: number; passMin: number; passMax: number; emailMax: number; sessionDays: number; tries: number; lockMs: number; perAccount: number; codeMin: number; codeTries: number; mailGapS: number; mailDay: number };
export declare function nameProblem(name: string): string;
export declare function passProblem(pass: string): string;
export declare function emailProblem(email: string): string;
export declare function accountKey(name: string): string;
export interface SavedAccount { name: string; salt: string; hash: string; created: number; last: number; email?: string; next?: string; wait?: boolean; code?: { h: string; why: string; until: number; tries: number }; mails?: number[] }
export interface SavedAccounts { accounts?: SavedAccount[]; sessions?: { h: string; key: string; until: number }[] }
export interface Auth { name?: string; token?: string; why?: string; wait?: boolean }
export interface Accounts {
  mailing: boolean;
  register(name: string, pass: string, email?: string): Promise<Auth>;
  login(id: string, pass: string, ip?: string): Promise<Auth>;
  verify(id: string, code: string): Auth;
  resend(id: string, pass: string, ip?: string): Promise<string>;
  setEmail(token: string, pass: string, email: string, ip?: string): Promise<string>;
  forgot(email: string): Promise<string>;
  reset(email: string, code: string, pass: string): Promise<Auth>;
  session(token: string): { key: string; name: string } | null;
  profile(token: string): { name: string; email: string; next: string } | null;
  logout(token: string): void;
  passwd(token: string, old: string, pass: string, ip?: string): Promise<string>;
  has(name: string): boolean;
  count(): number;
  dirty(): boolean;
  save(): SavedAccounts;
}
export declare function createAccounts(saved?: SavedAccounts, opts?: { mail?: (to: string, subject: string, text: string) => Promise<unknown>; publicUrl?: string; title?: string }): Accounts;
