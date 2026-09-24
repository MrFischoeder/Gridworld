// Gathering raw materials: with a Hatchet in the backpack E at a tree chops it (a few blows fell it and the logs
// drop), with a Pickaxe E at a big rock breaks stone off it until it falls apart. Felled trees and broken rocks
// are player changes (char.harvest, like picked plants) and come back after a few game days (data/crafting GATHER).
import * as THREE from 'three';
import { G } from '../game';
import { GATHER, ROCK_MIN_R } from '../data/crafting';
import { hasItem, saveChar } from '../character';
import { spendStamina, burn } from './survival';
import { makeNoise } from './noise';
import { burst } from './fx';
import { dropPickup } from './loot';
import { gatherables, gatherKey, rebuildChunkAt } from './overworld';
import { TREE_SPAN } from '../gen/trees';
import { logLine } from '../ui/hud';

export interface Target { kind: 'tree' | 'rock'; key: string; x: number; y: number; z: number; big: boolean }
/** Blows landed so far on trees and rocks that still stand (forgotten when you walk away). */
const blows = new Map<string, number>();
let lastBlow = 0;

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
    if (d < 1.3 && d < bd && Math.abs(k.y - p.y) < 2) { bd = d; best = { kind: 'rock', key: gatherKey.get(k)!, x: k.x, y: k.y, z: k.z, big: k.r > 1.3 }; }
  }
  return best;
}
const need = (t: Target) => (t.kind === 'tree' ? (t.big ? GATHER.tree.bigHits : GATHER.tree.hits) : (t.big ? GATHER.rock.bigHits : GATHER.rock.hits));
export function gatherPrompt(t: Target) {
  const n = blows.get(t.key) ?? 0;
  return `E — ${t.kind === 'tree' ? 'chop the tree' : 'break the rock'}${n ? ` (${n}/${need(t)})` : ''}`;
}

/** One blow of the hatchet or the pickaxe. */
export function strike(t: Target) {
  if (performance.now() - lastBlow < 450) return;
  const g = GATHER[t.kind];
  if (!spendStamina(g.stamina)) { logLine('You are too tired to swing.'); return; }
  lastBlow = performance.now();
  burn(g.kcal);
  const at = new THREE.Vector3(t.x, t.y + (t.kind === 'tree' ? 1.1 : 0.5), t.z);
  burst(at, t.kind === 'tree' ? 0xb8b060 : 0xc8c8b0, 8, 0.5);
  makeNoise(at, g.noise);
  const n = (blows.get(t.key) ?? 0) + 1;
  if (n < need(t)) { blows.set(t.key, n); return; }
  // down it goes: the tree falls, the rock splits; the materials drop around it
  blows.delete(t.key);
  G.char.harvest[t.key] = G.char.time;
  const k = t.kind === 'tree' ? 'log' : 'stone', count = t.kind === 'tree' ? (t.big ? GATHER.tree.bigLogs : GATHER.tree.logs) : (t.big ? GATHER.rock.bigStones : GATHER.rock.stones);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * 6.283, d = 0.8 + Math.random() * 1.2;
    dropPickup(new THREE.Vector3(t.x + Math.cos(a) * d, t.y + 0.6, t.z + Math.sin(a) * d), k);
  }
  burst(at, t.kind === 'tree' ? 0xb8b060 : 0xc8c8b0, 30, 1.2);
  logLine(t.kind === 'tree' ? `Timber! ${count} logs.` : `The rock splits: ${count} stones.`);
  rebuildChunkAt(t.x, t.z);
  saveChar();
}
