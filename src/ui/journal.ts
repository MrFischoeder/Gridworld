// (0.230) The journal (J): everything the character has taken on (the elder's step and the side task, the quests,
// the delivery contracts, the escort and the leads), each with a switch for its marker on the map and the compass.
// The switches are personal (Char.hideMarks), so online each player marks only what they want; nothing is sent.
import { G, W } from '../game';
import { $ } from './hud';
import { lockPointer } from './input';
import { markShown, toggleMark, saveChar } from '../character';
import { questStatus, allQuestMarkers, abandon, giverOf, boardName, MAX_ACTIVE } from '../world/quests';
import { allLeadMarkers } from '../world/datacarriers';
import { contractLines } from './contracts';
import { escortLine } from '../world/caravans';
import { tutorialStep, sideStep } from '../gen/settlement';
import { myHomeId } from '../world/rivals';
import { guideLine } from '../world/guide';
import { markId, pruneMarks } from '../gen/journal';
import { wrapDx } from '../gen/regions';
import { km, compass } from '../gen/quests';
import { tl, TL } from '../i18n';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open = false, dropArm = '';

/** The switch of a marker: on, off, or nothing when the entry has no place to mark right now. */
function sw(id: string, marked: Set<string>): string {
  if (!marked.has(id)) return `<span class="jtext" style="white-space:nowrap">${tl('no marker')}</span>`;
  const on = markShown(id);
  return `<button class="buy${on ? '' : ' off'}" data-jm="${id}">${on ? tl('Marked') : tl('Hidden')}</button>`;
}
const row = (text: string, right: string, sub = '') => `<div class="shoprow"><div>${text}${sub ? `<div class="jtext">${sub}</div>` : ''}</div><div style="display:flex;gap:6px">${right}</div></div>`;
const where = (x: number, z: number) => { if (G.char.loc !== 'overworld') return ''; const dx = wrapDx(x - G.pos.x), d = Math.hypot(dx, z - G.pos.z); return d < 25 ? tl(' · right here') : ` · ${km(d)} ${compass(dx, z - G.pos.z)}`; };
const strip = (s: string) => s.replace(/^▸\s*/, '');

function render() {
  const c = G.char, qm = allQuestMarkers(), lm = allLeadMarkers();
  const marked = new Set([...qm.map((m) => m.id), ...lm.map((m) => m.id)]);
  c.hideMarks = pruneMarks(c.hideMarks ?? [], [...marked, ...c.quests.map((q) => markId('q', q.id)), ...c.contracts.map((k) => markId('c', k.id)), ...c.leads.map((l) => markId('l', l)), 'elder', 'side', 'guide']);
  let h = TL`<h2>Journal</h2><div class="role">What you have taken on · switch a marker off and it leaves your map and compass</div>`;
  const home = c.towns[myHomeId()], step = c.guide === 2 ? tutorialStep(home) : null, side = c.guide === 2 ? sideStep(home) : null, gl = guideLine();
  const own: string[] = [];
  if (gl) own.push(row(strip(gl), sw('guide', marked)));
  if (step && step.title !== tl('A thriving settlement')) own.push(row(tl('Elder: ') + step.title, sw('elder', marked)));
  if (side) own.push(row(tl('Side task: ') + side.title, sw('side', marked)));
  if (own.length) h += `<div class="jsec">${tl('The settlement')}</div>` + own.join('');
  h += `<div class="jsec">${TL`Tasks (${c.quests.length}/${MAX_ACTIVE})`}</div>`;
  h += c.quests.length ? c.quests.map((q) => {
    const from = q.giver ? TL`From ${giverOf(q)}` : TL`Posted on ${boardName(q)}`;
    const drop = `<button class="buy off" data-jdrop="${q.id}">${dropArm === q.id ? tl('Sure?') : tl('Give it up')}</button>`;
    return row(strip(questStatus(q)), sw(markId('q', q.id), marked) + drop, `${from} · ${TL`${q.reward.gold} gold, ${q.reward.xp} XP`}<br>${q.text}`);
  }).join('') : `<div class="jtext">${tl('None. The notice boards in the villages have work.')}</div>`;
  const lines = contractLines(), esc = escortLine();
  if (c.contracts.length || esc) {
    h += `<div class="jsec">${tl('Deliveries')}</div>` + c.contracts.map((k, i) => row(strip(lines[i] ?? ''), sw(markId('c', k.id), marked))).join('');
    if (esc) h += row(strip(esc), `<span class="jtext">${tl('the wagons are on the map')}</span>`);
  }
  if (lm.length) h += `<div class="jsec">${tl('Leads')}</div>` + lm.map((m) => row(`<span style="color:${m.c}">${m.short === m.label ? m.label : `${m.short} · ${m.label}`}</span>${where(m.x, m.z)}`, sw(m.id, marked))).join('');
  h += `<div style="display:flex;gap:8px;margin-top:12px"><button class="opt" data-jall="1">${tl('Mark everything')}</button><button class="opt" data-jall="0">${tl('Hide every marker')}</button></div>`;
  h += `<button class="opt" data-jclose="1">${tl('Close (J or Esc)')}</button>`;
  panel().classList.add('wide'); panel().innerHTML = h;
}
/** J: open or close the journal. */
export function toggleJournal() {
  if (journalOpen()) { closeJournal(); return; }
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen || G.mapOpen) return;
  open = true; dropArm = ''; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
  render();
  dlgEl.style.display = 'flex'; if (document.pointerLockElement) document.exitPointerLock();
}
export const journalOpen = () => open && G.dlgOpen && !!panel().querySelector('[data-jclose]'); // another window may have taken the panel since
function closeJournal() { open = false; G.dlgOpen = false; dlgEl.style.display = 'none'; if (!G.isTouch) lockPointer(); }
/** Clicks in the journal; true when handled. */
export function journalClick(t: HTMLElement): boolean {
  if (!journalOpen()) { open = false; return false; }
  const m = t.closest('[data-jm]') as HTMLElement | null, d = t.closest('[data-jdrop]') as HTMLElement | null, a = t.closest('[data-jall]') as HTMLElement | null;
  if (t.closest('[data-jclose]')) { closeJournal(); return true; }
  if (m) { toggleMark(m.dataset.jm!); render(); return true; }
  if (d) { const id = d.dataset.jdrop!; if (dropArm === id) { abandon(id); dropArm = ''; } else dropArm = id; render(); return true; }
  if (a) {
    const ids = [...allQuestMarkers().map((x) => x.id), ...allLeadMarkers().map((x) => x.id)];
    G.char.hideMarks = a.dataset.jall === '1' ? [] : ids; saveChar(); render(); return true;
  }
  return false;
}
