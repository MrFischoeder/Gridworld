// Player accounts of a dedicated server: a name and a password each. The password is never stored, only its scrypt
// hash with a salt of its own; logging in gives the browser a session token (kept by the server only as a sha256, for
// `SESSION_DAYS` days, renewed while used). A name is unique regardless of letter case. Too many wrong passwords from
// one address lock that address out for a while.
// server/main.mjs saves `save()` in DATA_DIR/accounts.json and hands it back to `createAccounts` at start.
import { scrypt, randomBytes, createHash, timingSafeEqual } from 'node:crypto';

export const ACCOUNT = { nameMin: 2, nameMax: 20, passMin: 6, passMax: 100, sessionDays: 60, tries: 5, lockMs: 60_000, perAccount: 3 };
const DAY = 86_400_000;
const keyOf = (name) => String(name).toLowerCase();
const sha = (s) => createHash('sha256').update(s).digest('hex');
const hashPass = (pass, salt) => new Promise((ok, fail) => scrypt(String(pass).normalize('NFKC'), salt, 64, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? fail(e) : ok(k))));
/** A name may hold letters, digits, spaces, dots, dashes and underscores, and starts with a letter or a digit. */
export function nameProblem(name) {
  const n = String(name ?? '').trim();
  if (n.length < ACCOUNT.nameMin || n.length > ACCOUNT.nameMax) return `A name has ${ACCOUNT.nameMin} to ${ACCOUNT.nameMax} characters.`;
  if (!/^[\p{L}\p{N}][\p{L}\p{N} ._-]*$/u.test(n)) return 'A name may hold letters, digits, spaces, dots, dashes and underscores.';
  return '';
}
export function passProblem(pass) {
  const p = String(pass ?? '');
  if (p.length < ACCOUNT.passMin) return `A password needs at least ${ACCOUNT.passMin} characters.`;
  if (p.length > ACCOUNT.passMax) return 'That password is too long.';
  return '';
}

/** saved: {accounts: [{name, salt, hash, created, last}], sessions: [{h, key, until}]} (or nothing). */
export function createAccounts(saved = {}) {
  /** @type {Map<string, {name: string, salt: string, hash: string, created: number, last: number}>} */
  const accounts = new Map();
  for (const a of Array.isArray(saved.accounts) ? saved.accounts : []) if (a && typeof a.name === 'string' && typeof a.hash === 'string') accounts.set(keyOf(a.name), a);
  /** sha256(token) → {key, until} */
  const sessions = new Map();
  for (const s of Array.isArray(saved.sessions) ? saved.sessions : []) if (s && accounts.has(s.key) && s.until > Date.now()) sessions.set(s.h, { key: s.key, until: s.until });
  /** Failed logins per address: {n, until}. */
  const fails = new Map();
  let dirty = false;

  const open = (key) => {
    const token = randomBytes(32).toString('base64url');
    sessions.set(sha(token), { key, until: Date.now() + ACCOUNT.sessionDays * DAY });
    dirty = true;
    return token;
  };
  const locked = (ip) => { const f = fails.get(ip); return !!f && f.until > Date.now(); };
  const failed = (ip) => {
    const f = fails.get(ip) ?? { n: 0, until: 0 };
    f.n++; if (f.n >= ACCOUNT.tries) { f.until = Date.now() + ACCOUNT.lockMs; f.n = 0; }
    fails.set(ip, f);
  };

  return {
    /** A new account; resolves {name, token} or {why}. */
    async register(name, pass) {
      const n = String(name ?? '').trim(), why = nameProblem(n) || passProblem(pass);
      if (why) return { why };
      if (accounts.has(keyOf(n))) return { why: `The name ${n} is taken. Pick another, or log in if it is yours.` };
      const salt = randomBytes(16).toString('hex'), hash = (await hashPass(pass, salt)).toString('hex');
      if (accounts.has(keyOf(n))) return { why: `The name ${n} is taken.` }; // (someone was quicker while hashing)
      accounts.set(keyOf(n), { name: n, salt, hash, created: Date.now(), last: Date.now() });
      dirty = true;
      return { name: n, token: open(keyOf(n)) };
    },
    /** Resolves {name, token} or {why}; `ip` counts the failures. */
    async login(name, pass, ip = '') {
      if (locked(ip)) return { why: 'Too many wrong passwords. Wait a minute and try again.' };
      const a = accounts.get(keyOf(String(name ?? '').trim()));
      // an unknown name still costs a hash, so the answer's timing does not tell which names exist
      const k = await hashPass(pass, a ? a.salt : 'no-such-account');
      if (!a || !timingSafeEqual(k, Buffer.from(a.hash, 'hex'))) { failed(ip); return { why: 'Wrong name or password.' }; }
      fails.delete(ip); a.last = Date.now(); dirty = true;
      return { name: a.name, token: open(keyOf(a.name)) };
    },
    /** The account a session token belongs to (renewing it), or null. */
    session(token) {
      if (typeof token !== 'string' || token.length < 20) return null;
      const s = sessions.get(sha(token));
      if (!s || s.until < Date.now() || !accounts.has(s.key)) return null;
      const a = accounts.get(s.key);
      if (s.until - Date.now() < (ACCOUNT.sessionDays - 1) * DAY) { s.until = Date.now() + ACCOUNT.sessionDays * DAY; a.last = Date.now(); dirty = true; }
      return { key: s.key, name: a.name };
    },
    logout(token) { if (typeof token === 'string' && sessions.delete(sha(token))) dirty = true; },
    /** Change the password (logs every other session of the account out); resolves '' or why not. */
    async passwd(token, old, pass, ip = '') {
      const me = this.session(token);
      if (!me) return 'Log in again first.';
      const why = passProblem(pass);
      if (why) return why;
      if (locked(ip)) return 'Too many wrong passwords. Wait a minute and try again.';
      const a = accounts.get(me.key), k = await hashPass(old, a.salt);
      if (!timingSafeEqual(k, Buffer.from(a.hash, 'hex'))) { failed(ip); return 'The old password is wrong.'; }
      a.salt = randomBytes(16).toString('hex'); a.hash = (await hashPass(pass, a.salt)).toString('hex');
      const mine = sha(token);
      for (const [h, s] of sessions) if (s.key === me.key && h !== mine) sessions.delete(h);
      dirty = true;
      return '';
    },
    has: (name) => accounts.has(keyOf(name)),
    count: () => accounts.size,
    /** What to save, and whether anything changed since the last call. */
    dirty: () => { const d = dirty; dirty = false; return d; },
    save() {
      const now = Date.now();
      for (const [h, s] of sessions) if (s.until < now) sessions.delete(h);
      return { accounts: [...accounts.values()], sessions: [...sessions].map(([h, s]) => ({ h, key: s.key, until: s.until })) };
    },
  };
}
export const accountKey = keyOf;
