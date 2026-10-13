import { progressive, projectDone } from '../gen/settlement';
// The notice board window: offers to take, your tasks, rewards to claim.
import { G } from '../game';
import { boardOffers, accept, abandon, claim, giverOf, townOf, boardName, MAX_ACTIVE } from '../world/quests';
import { villageHere } from '../world/overworld';
import type { Poi } from '../gen/regions';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Quest } from '../gen/quests';
import { fmtClock, fmtTime, nextPosting } from '../core/time';
import { boardContracts, acceptOffer, dropContract, describe, dueText } from './contracts';
import { CONTRACT, postingOf } from '../gen/contracts';
import { tl, TL } from '../i18n';

const el = { root: $('board'), body: $('boardBody'), msg: $('boardMsg'), close: $('boardClose') };
let open = false, here: Poi | undefined;

function mine(q: Quest) {
  const at = q.townName ? TL` in ${q.townName}` : '', mineHere = townOf(q) === here?.id;
  const status = q.state === 'talk' ? TL`Talk to ${giverOf(q)}${at}.`
    : q.state === 'ready' ? (q.kind === 'fetch' ? TL`Bring the item to ${giverOf(q)}${at}.` : mineHere ? tl('Done! Claim your reward.') : TL`Done! Claim your reward at ${boardName(q)}.`)
    : q.kind === 'resource' ? TL`Bring ${q.count} items from your backpack to this board.`
    : q.kind === 'bounty' ? TL`Progress: ${q.progress ?? 0}/${q.count}`
    : q.kind === 'hunt' ? TL`Killed ${q.killed ?? 0}/${q.pack!.count}${q.alphaDead ? ', ' + q.pack!.alpha + ' slain' : ''}` : q.kind === 'camp' ? tl('Clear the camp.') : tl('Under way.');
  const brief = q.kind === 'fetch' && q.state !== 'talk' ? q.briefing! : q.text;
  return TL`<div class="notice"><b>${q.title}</b><br>${brief}<br><span class="rw">${status} · reward ${q.reward.gold} gold, ${q.reward.xp} XP</span><br>` +
    ((q.state === 'ready' || q.kind === 'resource') && q.kind !== 'fetch' && mineHere ? TL`<button class="go" data-claim="${q.id}">Claim reward</button>` : '') +
    TL`<button data-drop="${q.id}">Drop</button></div>`;
}
function offer(q: Quest, full: boolean) {
  return TL`<div class="notice"><b>${q.title}</b><br>${q.text}<br><span class="rw">Reward ${q.reward.gold} gold, ${q.reward.xp} XP</span><br>` +
    TL`<button class="go" data-take="${q.id}" ${full ? 'disabled' : ''}>Take it</button></div>`;
}
/** Delivery work: yours (with how far along), and the notices (Gridholm's own, and orders from the villages round about). */
function deliveries(): string {
  const c = G.char, full = c.contracts.length >= CONTRACT.maxActive, next = (postingOf(c.time) + 1) * CONTRACT.period;
  const mineHtml = c.contracts.map((k) => TL`<div class="notice">${describe(k)}<br><span class="rw">${k.done}/${k.n} delivered · ${dueText(k.due)} · hand them over at ${k.toName}'s store</span><br><button data-cdrop="${k.id}">Drop</button></div>`).join('');
  const offers = boardContracts(here).map((o) => `<div class="notice">${describe(o)}<br><span class="rw">deliver ${dueText(o.due)}${o.kind === 'haul' ? tl(' · the crates are loaded here, at the store and into the trunk of a vehicle by the gates') : ''}</span><br>` +
    TL`<button class="go" data-ctake="${o.id}" ${full || (o.kind === 'haul' && c.gold < o.deposit) ? 'disabled' : ''}>Take it</button></div>`).join('');
  return TL`<h3>Deliveries${c.contracts.length ? ` (${c.contracts.length}/${CONTRACT.maxActive})` : ''}</h3>` + mineHtml +
    (offers || tl('<div class="rw">No delivery work posted just now.</div>')) + TL`<div class="rw" style="margin-top:4px">New delivery notices at ${fmtTime(next)}.</div>`;
}
function render(msg?: string) {
  const qs = G.char.quests, full = qs.length >= MAX_ACTIVE;
  const t = G.char.time;
  el.body.innerHTML = TL`<div class="rw" style="margin-bottom:6px">${fmtClock(t)} · new notices go up at ${fmtTime(nextPosting(t))}</div>` + (qs.length ? TL`<h3>Your tasks (${qs.length}/${MAX_ACTIVE})</h3>` + qs.map(mine).join('') : '') +
    `<h3>${here?.name ?? 'Gridholm'} notices</h3>` + boardOffers(here).map((q) => offer(q, full)).join('') + (!progressive(G.char.towns[here!.id]) || projectDone(G.char.towns[here!.id], 'warehouse') ? deliveries() : tl('<div class="rw">Main development tutorial: speak to the village elder. Long-distance delivery work opens with the vehicle warehouse.</div>'));
  if (msg !== undefined) el.msg.textContent = msg;
}
el.root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.take) render(accept(b.dataset.take, here));
  else if (b.dataset.claim) render(claim(b.dataset.claim, here));
  else if (b.dataset.drop) render(abandon(b.dataset.drop));
  else if (b.dataset.ctake) { const o = boardContracts(here).find((x) => x.id === b.dataset.ctake); render(o ? acceptOffer(o) : tl('That notice is gone.')); }
  else if (b.dataset.cdrop) render(dropContract(b.dataset.cdrop));
});
el.close.onclick = () => closeBoard();

export function openBoard() {
  if (!G.playing || G.xferOpen || G.packOpen || G.dlgOpen) return;
  here = villageHere(G.pos.x, G.pos.z);
  open = true; G.xferOpen = true; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render(''); el.root.style.display = 'flex';
  if (document.pointerLockElement) document.exitPointerLock();
}
export function closeBoard() {
  if (!open) return;
  open = false; G.xferOpen = false; el.root.style.display = 'none';
  if (!G.isTouch) lockPointer();
}
