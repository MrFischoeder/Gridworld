// The notice board window: offers to take, your tasks, rewards to claim.
import { G } from '../game';
import { boardOffers, accept, abandon, claim, MAX_ACTIVE } from '../world/quests';
import { NPC_INFO } from '../data/npcs';
import { $ } from './hud';
import { lockPointer } from './input';
import type { Quest } from '../gen/quests';

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
function render(msg?: string) {
  const qs = G.char.quests, full = qs.length >= MAX_ACTIVE;
  el.body.innerHTML = (qs.length ? `<h3>Your tasks (${qs.length}/${MAX_ACTIVE})</h3>` + qs.map(mine).join('') : '') +
    '<h3>Notices</h3>' + boardOffers().map((q) => offer(q, full)).join('');
  if (msg !== undefined) el.msg.textContent = msg;
}
el.root.addEventListener('click', (e) => {
  const b = (e.target as HTMLElement).closest<HTMLButtonElement>('button');
  if (!b) return;
  if (b.dataset.take) render(accept(b.dataset.take));
  else if (b.dataset.claim) render(claim(b.dataset.claim));
  else if (b.dataset.drop) render(abandon(b.dataset.drop));
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
