// (0.196.0) Check the server's mail before players need it:
//   sudo /opt/gridworld-node/bin/node /opt/gridworld/server/mailtest.mjs you@example.pl
// Reads /etc/gridworld.env (or the file in GRIDWORLD_ENV) like the service does, connects to the mail server, says
// what is wrong if it cannot, and sends a test mail to the address given.
import { readFileSync } from 'node:fs';
import { makeMailer, parseEnv, adminsOf } from './mail.mjs';

const file = process.env.GRIDWORLD_ENV || '/etc/gridworld.env';
let env = { ...process.env };
try { env = { ...parseEnv(readFileSync(file, 'utf8')), ...env }; console.log(`settings from ${file}`); } catch { console.log(`(no ${file}: only the environment)`); }
const to = process.argv[2];
if (!to || !to.includes('@')) { console.log('Give the address to send a test mail to: node server/mailtest.mjs you@example.pl'); process.exit(1); }
console.log(`admins: ${adminsOf(env).join(', ') || '(none: ADMINS is not set)'}`);
const send = await makeMailer(env);
if (!send) { console.log('Mail is off: set MAIL_FROM and SMTP_HOST (or MAIL_SENDMAIL=1) in ' + file); process.exit(1); }
try { await send.verify(); console.log('the mail server answered and took the login'); }
catch (e) { console.log('could not log in to the mail server: ' + e.message); console.log('check SMTP_HOST, SMTP_PORT (587 or 465 with SMTP_SECURE=1), SMTP_USER, SMTP_PASS; a self-signed certificate: SMTP_INSECURE=1'); process.exit(1); }
try { await send(to, 'GridWorld: test mail', `This is a test from the GridWorld server.\nIf you can read it, the codes for new accounts and forgotten passwords will arrive too.\n`); console.log(`sent to ${to}: look in the inbox (and in spam)`); }
catch (e) { console.log('sending failed: ' + e.message); process.exit(1); }
