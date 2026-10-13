// (0.196.0) The server's mail, shared by server/main.mjs and the mail test (server/mailtest.mjs): MAIL_FROM plus either
// SMTP_HOST (SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS) or MAIL_SENDMAIL=1 (the machine's own sendmail / postfix,
// SENDMAIL_PATH). Returns null when mail is not set up, else send(to, subject, text) → a promise.
export async function makeMailer(env, log = console.log) {
  if (!env.MAIL_FROM || !(env.SMTP_HOST || env.MAIL_SENDMAIL === '1')) return null;
  const { createTransport } = (await import('nodemailer')).default;
  const port = Number(env.SMTP_PORT) || 587;
  const transport = env.SMTP_HOST
    ? createTransport({ host: env.SMTP_HOST, port, secure: env.SMTP_SECURE === '1' || port === 465, auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' } : undefined,
      // a mail server on the same VPS often has a certificate for its own name only: SMTP_INSECURE=1 accepts it
      tls: env.SMTP_INSECURE === '1' ? { rejectUnauthorized: false } : undefined })
    : createTransport({ sendmail: true, newline: 'unix', path: env.SENDMAIL_PATH || '/usr/sbin/sendmail' });
  log(`mail on: from ${env.MAIL_FROM} via ${env.SMTP_HOST ? `SMTP ${env.SMTP_HOST}:${port}` : 'sendmail'}`);
  const send = (to, subject, text) => transport.sendMail({ from: env.MAIL_FROM, to, subject, text }).catch((e) => { log('mail failed: ' + e.message); throw e; });
  send.verify = () => (env.SMTP_HOST ? transport.verify() : Promise.resolve(true));
  return send;
}
/** KEY=VALUE lines of an env file (as systemd reads /etc/gridworld.env): # comments, optional quotes. */
export function parseEnv(text) {
  const out = {};
  for (const line of text.split('\n')) {
    const m = /^\s*([A-Z_][A-Z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m) continue;
    let v = m[2];
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[m[1]] = v;
  }
  return out;
}
/** ADMINS: account names (comma separated) that may close any player's server. */
export const adminsOf = (env) => String(env.ADMINS ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
