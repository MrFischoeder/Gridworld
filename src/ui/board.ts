// The notice board window: offers to take, your tasks, rewards to claim.
import { G } from '../game';
import { boardOffers, accept, abandon, claim, MAX_ACTIVE } from '../world/quests';
import { NPC_INFO } from '../data/npcs';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Quest } from '../gen/quests';
import { fmtClock, fmtTime, nextPosting } from '../core/time';
import { boardContracts, acceptOffer, dropContract, describe, dueText } from './contracts';
import { CONTRACT, postingOf } from '../gen/contracts';

const el = { root: $('board'), body: $('boardBody'), msg: $('boardMsg'), close: $('boardClose') };
let open = false;

function mine(q: Quest) {
  const status = q.state === 'talk' ? `Talk to ${NPC_INFO[q.giver!].name}.`
    : q.state === 'ready' ? (q.kind === 'fetch' ? `Bring the item to ${NPC_INFO[q.giver!].name}.` : 'Done! Claim your reward.')
    : q.kind === 'bounty' ? `Progress: ${q.progress ?? 0}/${q.count}`
    : q.kind === 'hunt' ? `Killed ${q.killed ?? 0}/${q.pack!.count}${q.alphaDead ? ', ' + q.pack!.alpha + ' slain' : ''}` : q.kind === 'camp' ? 'Clear the camp.' : 'Under way.';
  const brief = q.kind === 'fetch' && q.state !== 'talk' ? q.briefing! : q.text;
  return `<div class="notice"><b>${q.title}</b><br>${brief}<br><span class="rw">${status} · reward ${q.reward.gold} gold, ${q.reward.xp} XP</span><br>` +
    (q.state === 'ready' && q.kind !== 'fetch' ? `<button class="go" data-claim="${q.id}">Claim reward</button>` : '') +
    `<button data-drop="${q.id}">Drop</button></div>`;
}
function offer(q: Quest, full: boolean) {
  return `<div class="notice"><b>${q.title}</b><br>${q.text}<br><span class="rw">Reward ${q.reward.gold} gold, ${q.reward.xp} XP</span><br>` +
    `<button class="go" data-take="${q.id}" ${full ? 'disabled' : ''}>Take it</button></div>`;
}
/** Delivery work: yours (with how far along), and the notices (Gridholm's own, and orders from the villages round about). */
function deliveries(): string {
  const c = G.char, full = c.contracts.length >= CONTRACT.maxActive, next = (postingOf(c.time) + 1) * CONTRACT.period;
  const mineHtml = c.contracts.map((k) => `<div class="notice">${describe(k)}<br><span class="rw">${k.done}/${k.n} delivered · ${dueText(k.due)} · hand them over at ${k.toName}'s store</span><br><button data-cdrop="${k.id}">Drop</button></div>`).join('');
  const offers = boardContracts().map((o) => `<div class="notice">${describe(o)}<br><span class="rw">deliver ${dueText(o.due)}${o.kind === 'haul' ? ' · the crates are loaded here, at the store and into the trunk of a vehicle by the gates' : ''}</span><br>` +
    `<button class="go" data-ctake="${o.id}" ${full || (o.kind === 'haul' && c.gold < o.deposit) ? 'disabled' : ''}>Take it</button></div>`).join('');
  return `<h3>Deliveries${c.contracts.length ? ` (${c.contracts.length}/${CONTRACT.maxActive})` : ''}</h3>` + mineHtml +
    (offers || '<div class="rw">No delivery work posted just now.</div>') + `<div class="rw" style="margin-top:4px">New delivery notices at ${fmtTime(next)}.</div>`;
}
function render(msg?: string) {
  const qs = G.char.quests, full = qs.length >= MAX_ACTIVE;
  const t = G.char.time;
  el.body.innerHTML = `<div class="rw" style="margin-bottom:6px">${fmtClock(t)} · new notices go up at ${fmtTime(nextPosting(t))}</div>` + (qs.length ? `<h3>Your tasks (${qs.length}/${MAX_ACTIVE})</h3>` + qs.map(mine).join('') : '') +
    '<h3>Notices</h3>' + boardOffers().map((q) => offer(q, full)).join('') + deliveries();
  if (msg !== undefined) el.msg.textContent = msg;
}
el.root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.take) render(accept(b.dataset.take));
  else if (b.dataset.claim) render(claim(b.dataset.claim));
  else if (b.dataset.drop) render(abandon(b.dataset.drop));
  else if (b.dataset.ctake) { const o = boardContracts().find((x) => x.id === b.dataset.ctake); render(o ? acceptOffer(o) : 'That notice is gone.'); }
  else if (b.dataset.cdrop) render(dropContract(b.dataset.cdrop));
});
el.close.onclick = () => closeBoard();

export function openBoard() {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  open = true; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render(''); el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeBoard() {
  if (!open) return;
  open = false; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
