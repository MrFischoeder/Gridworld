// Player accounts of a dedicated server: a name, an email address and a password each. The password is never stored,
// only its scrypt hash with a salt of its own; logging in gives the browser a session token (kept by the server only as
// a sha256, for `sessionDays` days, renewed while used). Names and email addresses are unique regardless of letter
// case; you log in with either. Too many wrong passwords from one address lock that address out for a while.
//
// Email (when the server can send mail: `opts.mail`, set up in server/main.mjs from MAIL_FROM and SMTP_* / sendmail):
// a new account must confirm its address with the 6-digit code mailed to it (or the link in the mail, with
// `opts.publicUrl`) before it can play; a forgotten password is reset with a mailed code; an account made before
// email (or without it) can add one later. Codes are kept only as hashes, last `codeMin` minutes and allow `codeTries`
// guesses; mails to one account are spaced `mailGapS` seconds and capped at `mailDay` a day. Without mail an email is
// optional and nothing is confirmed.
// server/main.mjs saves `save()` in DATA_DIR/accounts.json and hands it back to `createAccounts` at start.
import { scrypt, randomBytes, randomInt, createHash, timingSafeEqual } from 'node:crypto';

export const ACCOUNT = {
  nameMin: 2, nameMax: 20, passMin: 6, passMax: 100, emailMax: 120, sessionDays: 60, tries: 5, lockMs: 60_000, perAccount: 3,
  codeMin: 30, codeTries: 5, mailGapS: 60, mailDay: 8,
};
const DAY = 86_400_000;
const keyOf = (name) => String(name).toLowerCase();
const mailOf = (email) => String(email ?? '').trim().toLowerCase();
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
export function emailProblem(email) {
  const e = mailOf(email);
  if (!e) return 'Give your email address.';
  if (e.length > ACCOUNT.emailMax || !/^[^\s@<>()",;]+@[^\s@<>()",;]+\.[^\s@<>()",;]{2,}$/.test(e)) return 'That is not an email address.';
  return '';
}

/**
 * saved: {accounts: [{name, salt, hash, created, last, email?, wait?, next?, code?, mails?}], sessions: [{h, key, until}]};
 * opts.mail(to, subject, text): sends a mail (a Promise; throws when it could not); opts.publicUrl: where the game is
 * (for the link in the mail); opts.title: the server's name in the mails.
 */
export function createAccounts(saved = {}, opts = {}) {
  const mail = typeof opts.mail === 'function' ? opts.mail : null;
  const accounts = new Map();
  for (const a of Array.isArray(saved.accounts) ? saved.accounts : []) if (a && typeof a.name === 'string' && typeof a.hash === 'string') accounts.set(keyOf(a.name), a);
  /** email (lower case) → account key: the confirmed addresses, and the ones waiting to be (a new account's). */
  const byMail = new Map();
  for (const [k, a] of accounts) for (const e of [a.email, a.wait ? a.next : null]) if (e) byMail.set(mailOf(e), k);
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
  /** The account for a name or an email address. */
  const find = (id) => {
    const s = String(id ?? '').trim();
    if (s.includes('@')) { const k = byMail.get(mailOf(s)); return k ? accounts.get(k) : undefined; }
    return accounts.get(keyOf(s));
  };
  const passOk = async (a, pass) => { const k = await hashPass(pass, a ? a.salt : 'no-such-account'); return !!a && timingSafeEqual(k, Buffer.from(a.hash, 'hex')); };
  const logoutAll = (key, keep = '') => { for (const [h, s] of sessions) if (s.key === key && h !== keep) sessions.delete(h); };
  /** May the account be sent another mail now? */
  const mailBlocked = (a) => {
    const now = Date.now(), sent = (a.mails ?? []).filter((t) => now - t < DAY);
    a.mails = sent;
    if (sent.length && now - sent[sent.length - 1] < ACCOUNT.mailGapS * 1000) return `Wait a minute before asking for another email.`;
    if (sent.length >= ACCOUNT.mailDay) return 'Too many emails today. Try again tomorrow.';
    return '';
  };
  /** A fresh code for `why` ('verify' | 'reset'), mailed to `to`; resolves '' or why not. */
  const sendCode = async (a, why, to) => {
    const blocked = mailBlocked(a);
    if (blocked) return blocked;
    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    a.code = { h: sha(keyOf(a.name) + ':' + why + ':' + code), why, until: Date.now() + ACCOUNT.codeMin * 60_000, tries: 0 };
    a.mails.push(Date.now()); dirty = true;
    const title = opts.title || 'GridWorld';
    const link = why === 'verify' && opts.publicUrl ? `\n\nOr open this link:\n${opts.publicUrl.replace(/\/?$/, '/')}mp/verify?n=${encodeURIComponent(keyOf(a.name))}&c=${code}\n` : '\n';
    const text = why === 'verify'
      ? `Hello ${a.name},\n\nyour code to confirm this email address on ${title} is:\n\n    ${code}\n\nType it in the game's Multiplayer panel. It is good for ${ACCOUNT.codeMin} minutes.${link}\nIf you did not make an account, ignore this email.\n`
      : `Hello ${a.name},\n\nyour code to set a new password on ${title} is:\n\n    ${code}\n\nType it in the game's Multiplayer panel with your new password. It is good for ${ACCOUNT.codeMin} minutes.\n\nIf you did not ask for it, ignore this email: your password stays as it is.\n`;
    try { await mail(to, why === 'verify' ? `${title}: confirm your email` : `${title}: reset your password`, text); }
    catch { return 'The server could not send the email. Try again later.'; }
    return '';
  };
  /** Check a mailed code; '' when right (it is used up), else why not. */
  const useCode = (a, why, code) => {
    const c = a?.code;
    if (!c || c.why !== why || c.until < Date.now()) return 'That code has run out. Ask for a new one.';
    if (c.tries >= ACCOUNT.codeTries) return 'Too many wrong codes. Ask for a new one.';
    const h = sha(keyOf(a.name) + ':' + why + ':' + String(code ?? '').trim());
    if (!timingSafeEqual(Buffer.from(h, 'hex'), Buffer.from(c.h, 'hex'))) { c.tries++; dirty = true; return 'Wrong code.'; }
    delete a.code; dirty = true;
    return '';
  };

  return {
    /** Whether this server mails codes (and wants new accounts to confirm their address). */
    mailing: !!mail,
    /**
     * A new account. With mail: {name, wait: true} (a code went to `email`; `verify` lets it in), else {name, token}.
     * {why} when it cannot be made.
     */
    async register(name, pass, email = '') {
      const n = String(name ?? '').trim(), e = mailOf(email);
      const why = nameProblem(n) || passProblem(pass) || (mail || e ? emailProblem(e) : '');
      if (why) return { why };
      if (accounts.has(keyOf(n))) return { why: `The name ${n} is taken. Pick another, or log in if it is yours.` };
      if (e && byMail.has(e)) return { why: 'That email address already has an account. Log in, or reset its password.' };
      const salt = randomBytes(16).toString('hex'), hash = (await hashPass(pass, salt)).toString('hex');
      if (accounts.has(keyOf(n)) || e && byMail.has(e)) return { why: 'Someone was quicker. Try again.' };
      const a = { name: n, salt, hash, created: Date.now(), last: Date.now() };
      if (mail) { a.wait = true; a.next = e; } else if (e) a.email = e;
      accounts.set(keyOf(n), a); if (e) byMail.set(e, keyOf(n));
      dirty = true;
      if (!mail) return { name: n, token: open(keyOf(n)) };
      const sent = await sendCode(a, 'verify', e);
      if (sent) { accounts.delete(keyOf(n)); byMail.delete(e); return { why: sent }; }
      return { name: n, wait: true };
    },
    /** Log in with a name or an email address. {name, token}, {why}, or {why, wait: true} (the email is not confirmed). */
    async login(id, pass, ip = '') {
      if (locked(ip)) return { why: 'Too many wrong passwords. Wait a minute and try again.' };
      const a = find(id);
      // an unknown name still costs a hash, so the answer's timing does not tell which names exist
      if (!(await passOk(a, pass))) { failed(ip); return { why: 'Wrong name or password.' }; }
      fails.delete(ip);
      if (a.wait) return { why: `Confirm your email first: type the code we sent to ${a.next}.`, wait: true, name: a.name };
      a.last = Date.now(); dirty = true;
      return { name: a.name, token: open(keyOf(a.name)) };
    },
    /** Type the mailed code: confirms the address (a new account can play now: {name, token}) or {why}. */
    verify(id, code) {
      const a = find(id) ?? [...accounts.values()].find((x) => x.wait && mailOf(x.next) === mailOf(id));
      if (!a || !a.next) return { why: 'There is nothing to confirm for that account.' };
      const why = useCode(a, 'verify', code);
      if (why) return { why };
      if (a.email && a.email !== a.next) byMail.delete(mailOf(a.email));
      a.email = mailOf(a.next); byMail.set(a.email, keyOf(a.name));
      delete a.next; delete a.wait; a.last = Date.now(); dirty = true;
      return { name: a.name, token: open(keyOf(a.name)) };
    },
    /** Send the confirmation code again (for a new account, with its password). */
    async resend(id, pass, ip = '') {
      if (!mail) return 'This server does not send emails.';
      if (locked(ip)) return 'Too many wrong passwords. Wait a minute and try again.';
      const a = find(id) ?? [...accounts.values()].find((x) => x.wait && mailOf(x.next) === mailOf(id));
      if (!(await passOk(a, pass))) { failed(ip); return 'Wrong name or password.'; }
      if (!a.next) return 'Your email is confirmed already.';
      return sendCode(a, 'verify', a.next);
    },
    /** Add or change the email of the account you are logged in as (a code goes to the new address). */
    async setEmail(token, pass, email, ip = '') {
      if (!mail) return 'This server does not send emails.';
      const me = this.session(token);
      if (!me) return 'Log in again first.';
      const e = mailOf(email), bad = emailProblem(e);
      if (bad) return bad;
      if (byMail.has(e) && byMail.get(e) !== me.key) return 'That email address already has an account.';
      if (locked(ip)) return 'Too many wrong passwords. Wait a minute and try again.';
      const a = accounts.get(me.key);
      if (!(await passOk(a, pass))) { failed(ip); return 'Wrong password.'; }
      a.next = e; dirty = true;
      return sendCode(a, 'verify', e);
    },
    /** Forgot the password: a code to the account's confirmed address. Always '' unless mail is off or too frequent, so it does not tell which addresses have accounts. */
    async forgot(email) {
      if (!mail) return 'This server does not send emails. Ask its owner.';
      const a = find(String(email ?? '').includes('@') ? email : '');
      if (!a || !a.email || mailOf(a.email) !== mailOf(email)) return '';
      const why = await sendCode(a, 'reset', a.email);
      return /could not send/.test(why) ? why : '';
    },
    /** The mailed code and a new password: logs every session out and you in. {name, token} or {why}. */
    async reset(email, code, pass) {
      const bad = passProblem(pass);
      if (bad) return { why: bad };
      const a = find(String(email ?? '').includes('@') ? email : '');
      if (!a || !a.email) return { why: 'Wrong code.' };
      const why = useCode(a, 'reset', code);
      if (why) return { why };
      a.salt = randomBytes(16).toString('hex'); a.hash = (await hashPass(pass, a.salt)).toString('hex');
      logoutAll(keyOf(a.name)); a.last = Date.now(); dirty = true;
      return { name: a.name, token: open(keyOf(a.name)) };
    },
    /** The account a session token belongs to (renewing it), or null. */
    session(token) {
      if (typeof token !== 'string' || token.length < 20) return null;
      const s = sessions.get(sha(token));
      if (!s || s.until < Date.now() || !accounts.has(s.key)) return null;
      const a = accounts.get(s.key);
      if (a.wait) return null;
      if (s.until - Date.now() < (ACCOUNT.sessionDays - 1) * DAY) { s.until = Date.now() + ACCOUNT.sessionDays * DAY; a.last = Date.now(); dirty = true; }
      return { key: s.key, name: a.name };
    },
    /** What the account shows about itself: its confirmed email and one waiting to be. */
    profile(token) {
      const me = this.session(token);
      if (!me) return null;
      const a = accounts.get(me.key);
      return { name: a.name, email: a.email ?? '', next: a.next ?? '' };
    },
    logout(token) { if (typeof token === 'string' && sessions.delete(sha(token))) dirty = true; },
    /** Change the password (logs every other session of the account out); resolves '' or why not. */
    async passwd(token, old, pass, ip = '') {
      const me = this.session(token);
      if (!me) return 'Log in again first.';
      const why = passProblem(pass);
      if (why) return why;
      if (locked(ip)) return 'Too many wrong passwords. Wait a minute and try again.';
      const a = accounts.get(me.key);
      if (!(await passOk(a, old))) { failed(ip); return 'The old password is wrong.'; }
      a.salt = randomBytes(16).toString('hex'); a.hash = (await hashPass(pass, a.salt)).toString('hex');
      logoutAll(me.key, sha(token));
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
      // a new account that never confirmed its address is dropped after a week, freeing its name and email
      for (const [k, a] of accounts) if (a.wait && now - a.created > 7 * DAY) { accounts.delete(k); if (a.next) byMail.delete(mailOf(a.next)); }
      return { accounts: [...accounts.values()], sessions: [...sessions].map(([h, s]) => ({ h, key: s.key, until: s.until })) };
    },
  };
}
export const accountKey = keyOf;
