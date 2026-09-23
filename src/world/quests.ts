// Quest progress: kills, quest groups in the open world, quest items in ruins and at wrecks, rewards.
import { G, W } from '../game';
import { generateQuest, compass, km, type Quest } from '../gen/quests';
import { boardPeriod } from '../core/time';
import { worldDist, nearX, wrapDx } from '../gen/regions';
import type { CreatureKind } from '../data/creatures';
import { ITEMS, RELIC_KEYS, type ItemKey } from '../data/items';
import { NPC_INFO, type NpcRole } from '../data/npcs';
import { gainXp, saveChar, hasItem, takeOne, giveLoot } from '../character';
import { floorAt } from '../core/voxel';
import { dropPickup } from './loot';
import { V } from './render';
import { OW } from './overworld';
import { spawnQuestGroup } from './creatures';
import { logLine, showToast, $ } from '../ui/hud';
import type { DungeonMap } from '../gen/dungeon';

export const MAX_ACTIVE = 3, OFFERS = 4;

// ---------- the board ----------
/** Fill the board up to OFFERS notices (numbered, so the same world always posts the same notices in order). */
export function boardOffers(): Quest[] {
  const b = G.char.board, T = OW.terrain;
  if (!T) return b.offers;
  while (b.offers.length < OFFERS) {
    const taken = [...G.char.quests, ...b.offers].map((q) => q.item).filter((k): k is ItemKey => !!k);
    b.offers.push(generateQuest(T, b.seq++, taken));
  }
  return b.offers;
}
/**
 * Every BOARD_HOURS game hours new notices go up: the two oldest offers of each posting come down and fresh
 * ones (numbered on from board.seq) take their place. Accepted quests are not touched. Returns true when
 * something changed.
 */
export function refreshBoard(): boolean {
  const b = G.char.board, now = boardPeriod(G.char.time);
  if (b.stamp === undefined || b.stamp > now) { b.stamp = now; return false; } // saves from before the clock
  if (now === b.stamp) return false;
  const n = Math.min(b.offers.length, 2 * (now - b.stamp));
  b.stamp = now; b.offers.splice(0, n); boardOffers();
  return true;
}
export function accept(id: string): string {
  const b = G.char.board, i = b.offers.findIndex((q) => q.id === id);
  if (i < 0) return '';
  if (G.char.quests.length >= MAX_ACTIVE) return `You already carry ${MAX_ACTIVE} tasks. Finish or drop one first.`;
  const q = b.offers.splice(i, 1)[0];
  q.state = q.kind === 'fetch' ? 'talk' : 'active';
  if (q.kind === 'camp') delete G.char.camps[q.place!.campId!]; // word is, they are back
  G.char.quests.push(q); boardOffers(); saveChar();
  return q.kind === 'fetch' ? `Taken. Talk to ${NPC_INFO[q.giver!].name}.` : 'Taken: ' + q.title + '.';
}
export function abandon(id: string): string {
  const q = G.char.quests.find((x) => x.id === id);
  if (!q) return '';
  G.char.quests = G.char.quests.filter((x) => x !== q);
  for (const c of [...W.creatures]) if (c.questId === id) c.questId = undefined;
  saveChar(); return 'Dropped: ' + q.title + '.';
}
function reward(q: Quest) {
  q.state = 'done';
  G.char.quests = G.char.quests.filter((x) => x !== q);
  G.char.gold += q.reward.gold;
  logLine(`+${q.reward.gold} gold`); gainXp(q.reward.xp);
  if (q.kind !== 'bounty' && Math.random() < 0.35) giveLoot(RELIC_KEYS[(Math.random() * RELIC_KEYS.length) | 0]);
  showToast('Quest complete'); saveChar();
}
/** Board-given quests are claimed at the board. */
export function claim(id: string): string {
  const q = G.char.quests.find((x) => x.id === id && x.state === 'ready' && x.kind !== 'fetch');
  if (!q) return '';
  reward(q); return `Reward: ${q.reward.gold} gold and ${q.reward.xp} XP.`;
}

// ---------- talking to residents ----------
export interface QuestTalk { id: string; label: string }
/** Extra dialogue options a resident has because of the player's quests. */
export function questOptions(role: NpcRole): QuestTalk[] {
  const out: QuestTalk[] = [];
  for (const q of G.char.quests) {
    if (q.giver !== role) continue;
    if (q.state === 'talk') out.push({ id: q.id, label: 'About your notice on the board...' });
    if (q.state === 'ready' || (q.state === 'active' && hasItem(q.item!))) out.push({ id: q.id, label: `Here is the ${ITEMS[q.item!].name}.` });
  }
  return out;
}
export function questTalk(id: string): string {
  const q = G.char.quests.find((x) => x.id === id);
  if (!q) return '';
  if (q.state === 'talk') { q.state = 'active'; saveChar(); return q.briefing!; }
  if (q.item && takeOne(q.item)) { reward(q); return `Wonderful, the ${ITEMS[q.item].name}! Here, you earned this: ${q.reward.gold} gold.`; }
  return '';
}

// ---------- progress ----------
export function onKill(kind: CreatureKind | 'drone' | 'bandit', questId?: string, alpha = false) {
  let changed = false;
  for (const q of G.char.quests) {
    if (q.state !== 'active') continue;
    if (q.kind === 'bounty' && q.target === kind) {
      q.progress = (q.progress ?? 0) + 1; changed = true;
      if (q.progress >= q.count!) { q.state = 'ready'; showToast('Bounty done'); logLine('Claim it at the notice board.'); }
    }
    if (q.kind === 'hunt' && q.id === questId) {
      if (alpha) q.alphaDead = true; else q.killed = (q.killed ?? 0) + 1;
      changed = true;
      if (alpha) showToast(q.pack!.alpha + ' slain');
      if (q.alphaDead && q.killed! >= q.pack!.count) { q.state = 'ready'; showToast('Hunt complete'); logLine('Report back at the notice board.'); }
    }
  }
  if (changed) saveChar();
}
/** A bandit camp was wiped out. */
export function onCampCleared(campId: number) {
  for (const q of G.char.quests) if (q.kind === 'camp' && q.state === 'active' && q.place?.campId === campId) {
    q.state = 'ready'; showToast('Camp cleared'); logLine('Report back at the notice board.'); saveChar();
  }
}
/** A quest item was picked up. */
export function onPickup(k: ItemKey) {
  for (const q of G.char.quests) if (q.kind === 'fetch' && q.item === k && q.state === 'active') {
    q.state = 'ready'; showToast(ITEMS[k].name + ' found'); logLine(`Bring it to ${NPC_INFO[q.giver!].name}.`); saveChar();
  }
}
const questPickupHere = (k: ItemKey) => W.pickups.some((p) => p.k === k);

/** Open world: bring quest groups and wreck items into being near the player. */
export function syncQuestWorld() {
  if (G.char.loc !== 'overworld') return;
  for (const q of G.char.quests) {
    if (q.state !== 'active') continue;
    if (q.kind === 'hunt' && q.at && worldDist(q.at.x, q.at.z, G.pos.x, G.pos.z) < 160 && !W.creatures.some((c) => c.questId === q.id))
      spawnQuestGroup(q);
    if (q.kind === 'fetch' && q.place?.type === 'wreck' && !hasItem(q.item!) && !questPickupHere(q.item!) && worldDist(q.place.x, q.place.z, G.pos.x, G.pos.z) < 160 && OW.terrain) {
      const x = nearX(q.place.x + 2.5, G.pos.x), z = q.place.z + 2.5;
      dropPickup(V(x, OW.terrain.heightAt(x, z) + 1.5, z), q.item!);
    }
  }
}
/** Dungeon: the item of a ruin errand waits in the first guardian's room of depth 1, sector 0,0. */
export function onDungeonLoaded(map: DungeonMap) {
  const d = G.char.dungeon;
  if (!d || d.depth !== 1 || d.gx !== 0 || d.gz !== 0) return;
  for (const q of G.char.quests) {
    if (q.kind !== 'fetch' || q.state !== 'active' || q.place?.ruinId !== d.ruinId || hasItem(q.item!)) continue;
    const guard = map.bosses.find((b) => b.guard) ?? map.bosses[0], spot = guard ? { x: guard.x + 2, z: guard.z } : map.hatch;
    const f = floorAt(G.space, spot.x, spot.z, G.grid.oy + 1, G.grid.oy + G.grid.ny - 1);
    if (f) dropPickup(V(f[0] + 0.5, f[1] + 1, f[2] + 0.5), q.item!);
  }
}

// ---------- tracker (HUD) and map markers ----------
const trackEl = $('qtrack');
export function questTarget(q: Quest): { x: number; z: number } | null {
  if (q.state === 'ready' || q.state === 'talk') return null;
  if (q.kind === 'hunt') return q.at!;
  if (q.kind === 'camp') return q.place!;
  if (q.kind === 'fetch' && !hasItem(q.item!)) return q.place!;
  return null;
}
let trackT = 0;
export function updateTracker(dt: number) {
  if ((trackT -= dt) > 0) return;
  trackT = 0.4;
  const lines = G.char.quests.map((q) => {
    let s = '▸ ' + q.title;
    if (q.state === 'talk') s += ` — talk to ${NPC_INFO[q.giver!].name}`;
    else if (q.state === 'ready') s += q.kind === 'fetch' ? ` — bring it to ${NPC_INFO[q.giver!].name}` : ' — claim at the board';
    else if (q.kind === 'bounty') s += ` — ${q.progress ?? 0}/${q.count}`;
    else if (q.kind === 'hunt') s += ` — ${q.killed ?? 0}/${q.pack!.count}${q.alphaDead ? '' : ', ' + q.pack!.alpha + ' alive'}`;
    else if (q.kind === 'camp') s += ' — clear it';
    const t = questTarget(q);
    if (t && G.char.loc === 'overworld') { const dx = wrapDx(t.x - G.pos.x), d = Math.hypot(dx, t.z - G.pos.z); s += d < 25 ? ' · right here' : ` · ${km(d)} ${compass(dx, t.z - G.pos.z)}`; }
    else if (t && q.place?.type === 'ruin') s += ' · in the dungeon below';
    return s;
  });
  trackEl.innerHTML = lines.map((l) => `<div>${l}</div>`).join('');
}
export const questMarkers = (): { x: number; z: number; label: string }[] =>
  G.char.quests.map((q) => ({ t: questTarget(q), q })).filter((m) => m.t).map(({ t, q }) => ({ x: nearX(t!.x, G.pos.x), z: t!.z, label: q.kind === 'hunt' ? q.pack!.alpha : q.kind === 'camp' ? q.place!.name : ITEMS[q.item!].name }));
