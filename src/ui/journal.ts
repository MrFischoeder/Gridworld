// (0.230) The journal (J): everything the character has taken on (the elder's step and the side task, the quests,
// the delivery contracts, the escort and the leads), each with a switch for its marker on the map and the compass.
// The switches are personal (Char.hideMarks), so online each player marks only what they want; nothing is sent.
import { G, W } from '../game';
import { $, showToast } from './hud';
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
import { wrapDx, wrapX } from '../gen/regions';
import { km, compass } from '../gen/quests';
import { tl, TL } from '../i18n';
import { MARKS, MARK_COLORS, addMark, removeMark, renameMark, shareMark, unshareMark, pubKey, type MapMark, type PubMark } from '../gen/mapmarks';
import { canSharePub, mayEdit } from '../world/mapmarks';

const dlgEl = $('dlg'), panel = () => dlgEl.querySelector('.panel') as HTMLElement;
let open = false, dropArm = '', markArm = '';

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
  c.hideMarks = pruneMarks(c.hideMarks ?? [], [...marked, ...c.quests.map((q) => markId('q', q.id)), ...c.contracts.map((k) => markId('c', k.id)), ...c.leads.map((l) => markId('l', l)), ...Object.keys(c.pmarks ?? {}).map(pubKey), 'elder', 'side', 'guide']);
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
  h += marksHTML();
  h += `<div style="display:flex;gap:8px;margin-top:12px"><button class="opt" data-jall="1">${tl('Mark everything')}</button><button class="opt" data-jall="0">${tl('Hide every marker')}</button></div>`;
  h += `<button class="opt" data-jclose="1">${tl('Close (J or Esc)')}</button>`;
  panel().classList.add('wide'); panel().innerHTML = h;
}
/** (0.289) Map markers: the name (typed in place), where it is, shown or hidden, take it away; (0.290) for you alone or for everyone. */
const INPUT = 'width:12em;background:#020e05;color:#9dffb4;border:1px solid #2fe060;font:inherit;padding:1px 4px';
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
function marksHTML(): string {
  const own = G.char.marks ?? [], pub = Object.values(G.char.pmarks ?? {}).filter(Boolean), hidden = G.char.hideMarks ?? [];
  let h = `<div class="jsec">${TL`Map markers (yours ${own.length}/${MARKS.max}, shared ${pub.length})`}</div>`;
  if (!own.length && !pub.length) return h + `<div class="jtext">${tl('None yet. Open the map (M) and press N where you want one (Shift+N: for everyone).')}</div>` + marksButtons();
  const dist = (m: MapMark) => Math.hypot(wrapDx(m.x - G.pos.x), m.z - G.pos.z);
  const all: { m: MapMark; p: PubMark | null }[] = [...own.map((m) => ({ m, p: null })), ...pub.map((p) => ({ m: p as MapMark, p }))].sort((a, b) => dist(a.m) - dist(b.m));
  const share = canSharePub();
  h += all.map(({ m, p }) => {
    const edit = !p || mayEdit(p), flag = `<span style="color:${MARK_COLORS[m.c % MARK_COLORS.length]}">${p ? '◉⚑' : '⚑'}</span> `;
    const name = flag + (edit ? `<input data-jname="${esc(m.id)}" maxlength="${MARKS.name}" value="${esc(m.name)}" style="${INPUT}">` : `<b>${esc(m.name)}</b>`);
    const on = p ? !hidden.includes(pubKey(p.id)) : m.on;
    const who = p ? (p.pid === G.char.pid ? TL`for everyone, yours` : TL`for everyone, from ${esc(p.by)}`) : tl('for you alone');
    let btns = `<button class="buy${on ? '' : ' off'}" data-jmk="${esc(m.id)}">${on ? tl('Shown') : tl('Hidden')}</button>`;
    if (!p && share) btns += `<button class="buy off" data-jmsh="${esc(m.id)}">${tl('Share')}</button>`;
    if (p && edit) btns += `<button class="buy off" data-jmun="${esc(m.id)}">${tl('Only me')}</button>`;
    if (edit) btns += `<button class="buy off" data-jmdel="${esc(m.id)}">${markArm === m.id ? tl('Sure?') : tl('Take away')}</button>`;
    return row(name + `<span class="jtext">${where(m.x, m.z)}</span>`, btns, who);
  }).join('');
  return h + marksButtons();
}
function marksButtons(): string {
  const here = G.char.loc === 'overworld' ? `<button class="opt" data-jmall="here">${tl('Mark where I stand')}</button>` : '';
  return `<div style="display:flex;gap:8px;margin-top:8px">${here}<button class="opt" data-jmall="1">${tl('Show all markers')}</button><button class="opt" data-jmall="0">${tl('Hide all markers')}</button></div>`;
}
dlgEl.addEventListener('change', (e) => { // a marker's name typed in place: kept on Enter or leaving the field
  const t = e.target as HTMLElement;
  if (!(t instanceof HTMLInputElement) || !t.dataset.jname || !journalOpen()) return;
  const id = t.dataset.jname, p = G.char.pmarks?.[id];
  if (p ? mayEdit(p) && renameMark([p], id, t.value) : renameMark(G.char.marks ?? [], id, t.value)) saveChar();
  render();
});
/** J: open or close the journal. */
export function toggleJournal() {
  if (journalOpen()) { closeJournal(); return; }
  if (!G.playing || G.dlgOpen || G.packOpen || G.xferOpen || G.mapOpen) return;
  open = true; dropArm = ''; markArm = ''; G.dlgOpen = true; W.talkNpc = null; G.firing = false; for (const k in G.keys) G.keys[k] = false;
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
  const mk = t.closest('[data-jmk]') as HTMLElement | null, md = t.closest('[data-jmdel]') as HTMLElement | null, ma = t.closest('[data-jmall]') as HTMLElement | null;
  const sh = t.closest('[data-jmsh]') as HTMLElement | null, un = t.closest('[data-jmun]') as HTMLElement | null, pm = (G.char.pmarks ??= {});
  if (mk) {
    const id = mk.dataset.jmk!, m = G.char.marks?.find((k) => k.id === id);
    if (pm[id]) toggleMark(pubKey(id)); else if (m) { m.on = !m.on; saveChar(); }
    render(); return true;
  }
  if (md) {
    const id = md.dataset.jmdel!;
    if (markArm !== id) markArm = id;
    else { markArm = ''; if (pm[id]) { if (mayEdit(pm[id])) delete pm[id]; } else removeMark(G.char.marks ?? [], id); saveChar(); }
    render(); return true;
  }
  if (sh) { // (0.290) yours to everyone
    if (canSharePub() && !shareMark(G.char.marks ??= [], pm, sh.dataset.jmsh!, G.char.name || tl('someone'), G.char.pid, G.char.time)) showToast(tl('The world keeps no more shared markers.'));
    saveChar(); render(); return true;
  }
  if (un) { // (0.290) back to you alone: the others no longer see it
    const p = pm[un.dataset.jmun!];
    if (p && mayEdit(p) && !unshareMark(G.char.marks ??= [], pm, p.id)) showToast(TL`You keep ${MARKS.max} markers at most: take one away first (N on it, or the journal).`);
    saveChar(); render(); return true;
  }
  if (ma) {
    const list = (G.char.marks ??= []), keys = Object.keys(pm).map(pubKey), rest = (G.char.hideMarks ?? []).filter((k) => !keys.includes(k));
    if (ma.dataset.jmall === 'here') addMark(list, wrapX(G.pos.x), G.pos.z, (n) => TL`Marker ${n}`, Object.values(pm).map((p) => p.name));
    else { const on = ma.dataset.jmall === '1'; for (const m of list) m.on = on; G.char.hideMarks = on ? rest : [...rest, ...keys]; }
    saveChar(); render(); return true;
  }
  if (a) {
    const ids = [...allQuestMarkers().map((x) => x.id), ...allLeadMarkers().map((x) => x.id)], pmk = (G.char.hideMarks ?? []).filter((k) => k.startsWith('pm:'));
    G.char.hideMarks = a.dataset.jall === '1' ? pmk : [...pmk, ...ids]; saveChar(); render(); return true;
  }
  return false;
}
