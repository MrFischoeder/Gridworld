// Gathering raw materials: with a Hatchet in your hands E at a tree chops it, with a Pickaxe in your hands E at a big
// rock breaks stone off it (a tool in the backpack does nothing: E at the tree or rock takes it into your hands first). It is work, not a click: hold E and the hero keeps swinging (a blow every `GATHER.swing` s, the tool
// in both hands in front of the view), a small tree falls after ~6 s, a big one after ~15; let go and the blows so far
// are kept while you stay. Some rocks carry a vein of ore (gen/trees.ts `oreOf`: iron or copper, mostly in the
// mountains), which takes longer and gives ore lumps besides the stones. Felled trees and broken rocks are player
// changes (char.harvest, like picked plants) and come back after a few game days (data/crafting GATHER; a vein later).
import * as THREE from 'three';
import { G } from '../game';
import { GATHER, ROCK_MIN_R } from '../data/crafting';
import { hasItem, saveChar, inHands, takeInHands } from '../character';
import { spendStamina, burn } from './survival';
import { makeNoise } from './noise';
import { burst } from './fx';
import { dropPickup } from './loot';
import { gatherables, gatherKey, rebuildChunkAt, ORE_COLOR, groveGiants, OW } from './overworld';
import { findPoi } from '../gen/regions';
import { projectDone } from '../gen/settlement';
import { TREE_SPAN, type OreKind } from '../gen/trees';
import { logLine } from '../ui/hud';
import { camera } from './render';
import { TOOL_KEYS, toolModel, isToolModel, type ToolKey } from './toolmodels';

export interface Target { kind: 'tree' | 'rock'; key: string; x: number; y: number; z: number; big: boolean; ore?: OreKind; held: boolean;
  /** A giant of a village's great grove (gen/resource-sites.ts): never felled; worked only once the village's lumber camp stands. */
  grove?: { vid: number; camp: boolean; name: string } }
/** Blows landed so far on trees and rocks that still stand (forgotten when you walk away). */
const blows = new Map<string, number>();
const ORE_NAME: Record<OreKind, string> = { iron: 'iron', copper: 'copper' };

/** The tree or rock in reach that the tools you carry can work, if any. */
export function gatherTarget(): Target | null {
  if (G.char.loc !== 'overworld') return null;
  const axe = hasItem('hatchet'), pick = hasItem('pickaxe'), axeH = inHands('hatchet'), pickH = inHands('pickaxe');
  if (!axe && !pick) return null;
  const p = G.pos, { trees, rocks } = gatherables(p.x, p.z);
  let best: Target | null = null, bd = Infinity;
  if (axe) for (const t of trees) for (const [x, z, r] of t.cols) {
    const d = Math.hypot(x - p.x, z - p.z) - r;
    if (d < 1.4 && d < bd && Math.abs(t.y - p.y) < 2) { bd = d; best = { kind: 'tree', key: gatherKey.get(t)!, x, y: t.y, z, big: TREE_SPAN[t.kind] > 0, held: axeH }; }
  }
  if (axe) for (const g of groveGiants(G.char.world, p.x, p.z, 12)) {
    const d = Math.hypot(g.x - p.x, g.z - p.z) - g.r * 1.1, y = OW.terrain?.heightAt(g.x, g.z) ?? p.y;
    if (d < 1.6 && d < bd && Math.abs(y - p.y) < 3) {
      bd = d; const v = findPoi(G.char.world, g.vid);
      best = { kind: 'tree', key: `grove:${g.vid}:${g.i}`, x: g.x - (g.x - p.x) / (d + g.r * 1.1) * g.r, y: p.y, z: g.z - (g.z - p.z) / (d + g.r * 1.1) * g.r, big: true, held: axeH, grove: { vid: g.vid, camp: projectDone(G.char.towns[g.vid], 'lumber'), name: v?.name ?? 'the village' } };
    }
  }
  if (pick) for (const k of rocks) {
    if (k.r < ROCK_MIN_R) continue;
    const d = Math.hypot(k.x - p.x, k.z - p.z) - k.r * 0.8;
    if (d < 1.3 && d < bd && Math.abs(k.y - p.y) < 2) { bd = d; best = { kind: 'rock', key: gatherKey.get(k)!, x: k.x, y: k.y, z: k.z, big: k.r > 1.3, ore: k.ore, held: pickH }; }
  }
  return best;
}
const need = (t: Target) => {
  const n = t.kind === 'tree' ? (t.big ? GATHER.tree.bigHits : GATHER.tree.hits) : (t.big ? GATHER.rock.bigHits : GATHER.rock.hits);
  return t.ore ? Math.round(n * GATHER.ore.hits) : n;
};
const bar = (n: number, of: number) => { const k = Math.round(n / of * 10); return '▮'.repeat(k) + '▯'.repeat(10 - k); };
const toolOf = (t: Target) => (t.kind === 'tree' ? 'hatchet' : 'pickaxe');
export function gatherPrompt(t: Target) {
  if (t.grove && !t.grove.camp) return `A giant of ${t.grove.name}'s great grove: far too big for one axe. Only a lumber camp's crews work it (ask the elder of ${t.grove.name}).`;
  if (!t.held) return `E — take the ${t.kind === 'tree' ? 'hatchet' : 'pickaxe'} in your hands (tools work only from your hands)`;
  const n = blows.get(t.key) ?? 0, what = t.grove ? 'take timber from the giant' : t.kind === 'tree' ? 'chop the tree' : t.ore ? `mine the ${ORE_NAME[t.ore]} vein` : 'break the rock';
  return n || work ? `${work ? (t.kind === 'tree' ? 'Chopping' : 'Mining') : 'Hold E — ' + what} ${bar(n, need(t))} ${n}/${need(t)}` : `Hold E — ${what}`;
}

// ---------- the work: hold E, a blow every swing ----------
let work: { key: string; t: number; landed: boolean } | null = null;
export const working = () => !!work;
let onChange: () => void = () => {};
/** The weapon goes away while you work (world/weapons.ts refreshes on this). */
export function onWorkChange(f: () => void) { onChange = f; }

// the tool in your hands, in front of the view (solid models from world/toolmodels.ts): a hatchet or a pickaxe swung
// down at each blow, any other hand tool held at rest
const tool = new THREE.Group(), GRIP = 0x9dffb4;
const models = Object.fromEntries(TOOL_KEYS.map((k) => { const m = toolModel(k, GRIP, 0xd8d8c0); m.visible = false; tool.add(m); return [k, m]; })) as Record<ToolKey, THREE.Group>;
const showTool = (k: ToolKey | null) => { for (const t of TOOL_KEYS) models[t].visible = t === k; };
const pivot = new THREE.Group(); pivot.add(tool); pivot.position.set(0.16, -0.3, -0.3); pivot.visible = false; camera.add(pivot);

function stop() { if (!work) return; work = null; pivot.visible = false; onChange(); }
/** When a tool held in the hands may be shown in front of the view (set by world/level.ts: not driving, not in a boat,
 * not swimming or climbing). */
let toolShown = () => true;
export function setToolRule(f: () => boolean) { toolShown = f; }
/** A hatchet or pickaxe in your hands, at rest in front of the view while you are not working. */
function restPose() {
  const h = G.char.hands[0]?.k, on = isToolModel(h) && G.playing && toolShown();
  pivot.visible = on;
  if (!on) return;
  showTool(h);
  pivot.rotation.set(0.12, 0.3, -0.35); pivot.position.set(0.28, -0.36, -0.22);
}
/** E pressed at a tree or rock: start working it (the blows land while E is held). */
export function strike(t: Target) {
  if (t.grove && !t.grove.camp) { logLine(gatherPrompt(t)); return; }
  if (!t.held) { const m = takeInHands(toolOf(t)); if (m) logLine(m); return; }
  if (work?.key === t.key) return;
  work = { key: t.key, t: 0, landed: false };
  showTool(t.kind === 'tree' ? 'hatchet' : 'pickaxe');
  pivot.visible = true; onChange();
}
/** Every frame (world/interact.ts) with the target in reach, if any: swing while E is held. */
export function updateGather(dt: number, t: Target | null) {
  if (!work) { restPose(); return; }
  if (!t || !t.held || t.key !== work.key || !G.keys.KeyE || !G.playing || G.dlgOpen) { stop(); return; }
  // wind up over the shoulder, then the blow; the blow lands at the bottom of the swing
  work.t += dt / GATHER.swing;
  const ph = work.t % 1, raise = ph < 0.7 ? ph / 0.7 : 1 - (ph - 0.7) / 0.3;
  pivot.rotation.x = -0.55 + raise * 1.75; pivot.rotation.z = -0.3 - raise * 0.2;
  pivot.position.y = -0.3 + raise * 0.1;
  if (ph >= 0.95 && !work.landed) { work.landed = true; blow(t); }
  if (ph < 0.95) work.landed = false;
}

/** One blow of the hatchet or the pickaxe. */
function blow(t: Target) {
  const g = GATHER[t.kind];
  if (!spendStamina(g.stamina)) { logLine('You are too tired to swing. Catch your breath.'); stop(); return; }
  burn(g.kcal);
  const at = new THREE.Vector3(t.x, t.y + (t.kind === 'tree' ? 1.1 : 0.5), t.z);
  burst(at, t.kind === 'tree' ? 0xb8b060 : t.ore ? ORE_COLOR[t.ore] : 0xc8c8b0, 8, 0.5);
  makeNoise(at, g.noise);
  const n = (blows.get(t.key) ?? 0) + 1;
  if (n < need(t)) { blows.set(t.key, n); return; }
  blows.delete(t.key); stop();
  if (t.grove) { // a giant of the great grove gives its logs and stands as before: it never runs out
    for (let i = 0; i < GATHER.tree.bigLogs; i++) { const a = Math.random() * 6.283, d = 1 + Math.random() * 1.5; dropPickup(new THREE.Vector3(t.x + Math.cos(a) * d, t.y + 0.6, t.z + Math.sin(a) * d), 'log'); }
    burst(at, 0xb8b060, 30, 1.2);
    logLine(`The giant gives ${GATHER.tree.bigLogs} logs and stands as tall as before. Saw them into planks before they are any use for building.`);
    saveChar(); return;
  }
  // down it goes: the tree falls, the rock splits; the materials drop around it
  // a vein weathers out again slower: its harvest time is set ahead by the difference
  G.char.harvest[t.key] = G.char.time + (t.ore ? GATHER.ore.regrow - GATHER.rock.regrow : 0);
  const k = t.kind === 'tree' ? 'log' : 'stone', count = t.kind === 'tree' ? (t.big ? GATHER.tree.bigLogs : GATHER.tree.logs) : (t.big ? GATHER.rock.bigStones : GATHER.rock.stones);
  const drop = (item: Parameters<typeof dropPickup>[1]) => { const a = Math.random() * 6.283, d = 0.8 + Math.random() * 1.2; dropPickup(new THREE.Vector3(t.x + Math.cos(a) * d, t.y + 0.6, t.z + Math.sin(a) * d), item); };
  for (let i = 0; i < count; i++) drop(k);
  const lumps = t.ore ? (t.big ? GATHER.ore.bigLumps : GATHER.ore.lumps) : 0;
  for (let i = 0; i < lumps; i++) drop(t.ore === 'iron' ? 'ironO' : 'copperO');
  burst(at, t.kind === 'tree' ? 0xb8b060 : t.ore ? ORE_COLOR[t.ore] : 0xc8c8b0, 30, 1.2);
  logLine(t.kind === 'tree' ? `Timber! ${count} logs: saw them into planks to build with.` : t.ore ? `The vein gives: ${lumps} lumps of ${ORE_NAME[t.ore]} ore and ${count} stones.` : `The rock splits: ${count} stones.`);
  rebuildChunkAt(t.x, t.z);
  saveChar();
}
