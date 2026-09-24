// Gathering raw materials: with a Hatchet in the backpack E at a tree chops it, with a Pickaxe E at a big rock breaks
// stone off it. It is work, not a click: hold E and the hero keeps swinging (a blow every `GATHER.swing` s, the tool
// in both hands in front of the view), a small tree falls after ~6 s, a big one after ~15; let go and the blows so far
// are kept while you stay. Some rocks carry a vein of ore (gen/trees.ts `oreOf`: iron or copper, mostly in the
// mountains), which takes longer and gives ore lumps besides the stones. Felled trees and broken rocks are player
// changes (char.harvest, like picked plants) and come back after a few game days (data/crafting GATHER; a vein later).
import * as THREE from 'three';
import { G } from '../game';
import { GATHER, ROCK_MIN_R } from '../data/crafting';
import { hasItem, saveChar } from '../character';
import { spendStamina, burn } from './survival';
import { makeNoise } from './noise';
import { burst } from './fx';
import { dropPickup } from './loot';
import { gatherables, gatherKey, rebuildChunkAt, ORE_COLOR } from './overworld';
import { TREE_SPAN, type OreKind } from '../gen/trees';
import { logLine } from '../ui/hud';
import { camera, lineMat } from './render';

export interface Target { kind: 'tree' | 'rock'; key: string; x: number; y: number; z: number; big: boolean; ore?: OreKind }
/** Blows landed so far on trees and rocks that still stand (forgotten when you walk away). */
const blows = new Map<string, number>();
const ORE_NAME: Record<OreKind, string> = { iron: 'iron', copper: 'copper' };

/** The tree or rock in reach that the tools you carry can work, if any. */
export function gatherTarget(): Target | null {
  if (G.char.loc !== 'overworld') return null;
  const axe = hasItem('hatchet'), pick = hasItem('pickaxe');
  if (!axe && !pick) return null;
  const p = G.pos, { trees, rocks } = gatherables(p.x, p.z);
  let best: Target | null = null, bd = Infinity;
  if (axe) for (const t of trees) for (const [x, z, r] of t.cols) {
    const d = Math.hypot(x - p.x, z - p.z) - r;
    if (d < 1.4 && d < bd && Math.abs(t.y - p.y) < 2) { bd = d; best = { kind: 'tree', key: gatherKey.get(t)!, x, y: t.y, z, big: TREE_SPAN[t.kind] > 0 }; }
  }
  if (pick) for (const k of rocks) {
    if (k.r < ROCK_MIN_R) continue;
    const d = Math.hypot(k.x - p.x, k.z - p.z) - k.r * 0.8;
    if (d < 1.3 && d < bd && Math.abs(k.y - p.y) < 2) { bd = d; best = { kind: 'rock', key: gatherKey.get(k)!, x: k.x, y: k.y, z: k.z, big: k.r > 1.3, ore: k.ore }; }
  }
  return best;
}
const need = (t: Target) => {
  const n = t.kind === 'tree' ? (t.big ? GATHER.tree.bigHits : GATHER.tree.hits) : (t.big ? GATHER.rock.bigHits : GATHER.rock.hits);
  return t.ore ? Math.round(n * GATHER.ore.hits) : n;
};
const bar = (n: number, of: number) => { const k = Math.round(n / of * 10); return '▮'.repeat(k) + '▯'.repeat(10 - k); };
export function gatherPrompt(t: Target) {
  const n = blows.get(t.key) ?? 0, what = t.kind === 'tree' ? 'chop the tree' : t.ore ? `mine the ${ORE_NAME[t.ore]} vein` : 'break the rock';
  return n || work ? `${work ? (t.kind === 'tree' ? 'Chopping' : 'Mining') : 'Hold E — ' + what} ${bar(n, need(t))} ${n}/${need(t)}` : `Hold E — ${what}`;
}

// ---------- the work: hold E, a blow every swing ----------
let work: { key: string; t: number; landed: boolean } | null = null;
export const working = () => !!work;
let onChange: () => void = () => {};
/** The weapon goes away while you work (world/weapons.ts refreshes on this). */
export function onWorkChange(f: () => void) { onChange = f; }

// the tool in both hands, in front of the view: a hatchet or a pickaxe, swung down at each blow
const tool = new THREE.Group(), GRIP = 0x9dffb4;
const handle = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.035, 0.035, 0.62)), lineMat(GRIP));
handle.position.z = -0.31; tool.add(handle);
const axeHead = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.03, 0.16, 0.12)), lineMat(0xd8d8c0));
axeHead.position.set(0, 0.07, -0.58); tool.add(axeHead);
const pickHead = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.CylinderGeometry(0.018, 0.035, 0.44, 5)), lineMat(0xd8d8c0));
pickHead.position.set(0, 0, -0.6); tool.add(pickHead);
for (const zz of [-0.06, -0.2]) { const h = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(0.05, 0.04, 0.08)), lineMat(GRIP)); h.position.set(0, -0.03, zz); tool.add(h); }
const pivot = new THREE.Group(); pivot.add(tool); pivot.position.set(0.16, -0.3, -0.3); pivot.visible = false; camera.add(pivot);

function stop() { if (!work) return; work = null; pivot.visible = false; onChange(); }
/** E pressed at a tree or rock: start working it (the blows land while E is held). */
export function strike(t: Target) {
  if (work?.key === t.key) return;
  work = { key: t.key, t: 0, landed: false };
  axeHead.visible = t.kind === 'tree'; pickHead.visible = t.kind === 'rock';
  pivot.visible = true; onChange();
}
/** Every frame (world/interact.ts) with the target in reach, if any: swing while E is held. */
export function updateGather(dt: number, t: Target | null) {
  if (!work) return;
  if (!t || t.key !== work.key || !G.keys.KeyE || !G.playing || G.dlgOpen) { stop(); return; }
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
  // down it goes: the tree falls, the rock splits; the materials drop around it
  blows.delete(t.key); stop();
  // a vein weathers out again slower: its harvest time is set ahead by the difference
  G.char.harvest[t.key] = G.char.time + (t.ore ? GATHER.ore.regrow - GATHER.rock.regrow : 0);
  const k = t.kind === 'tree' ? 'log' : 'stone', count = t.kind === 'tree' ? (t.big ? GATHER.tree.bigLogs : GATHER.tree.logs) : (t.big ? GATHER.rock.bigStones : GATHER.rock.stones);
  const drop = (item: Parameters<typeof dropPickup>[1]) => { const a = Math.random() * 6.283, d = 0.8 + Math.random() * 1.2; dropPickup(new THREE.Vector3(t.x + Math.cos(a) * d, t.y + 0.6, t.z + Math.sin(a) * d), item); };
  for (let i = 0; i < count; i++) drop(k);
  const lumps = t.ore ? (t.big ? GATHER.ore.bigLumps : GATHER.ore.lumps) : 0;
  for (let i = 0; i < lumps; i++) drop(t.ore === 'iron' ? 'ironO' : 'copperO');
  burst(at, t.kind === 'tree' ? 0xb8b060 : t.ore ? ORE_COLOR[t.ore] : 0xc8c8b0, 30, 1.2);
  logLine(t.kind === 'tree' ? `Timber! ${count} logs.` : t.ore ? `The vein gives: ${lumps} lumps of ${ORE_NAME[t.ore]} ore and ${count} stones.` : `The rock splits: ${count} stones.`);
  rebuildChunkAt(t.x, t.z);
  saveChar();
}
