// Workbenches set up in the wilds from a Workbench Kit (saved in char.benches, drawn when you are near).
// E at one opens the crafting window (ui/craft.ts) for the plain 'bench' recipes; you can pack it up again.
import * as THREE from 'three';
import { scene, GRID } from './render';
import { G } from '../game';
import { PropBatch } from './props';
import { takeOne, addItem, saveChar } from '../character';
import { logLine } from '../ui/hud';
import { OW, groundAt } from './overworld';
import { nearX } from '../gen/regions';
import type { Char } from '../save';

export type Bench = Char['benches'][number];
const MAX_BENCHES = 3, WOOD = 0xb8b060;
const drawn = new Map<Bench, THREE.Group>();

/** A sturdy table with a vice and a rack of tools, drawn at the bench's spot. */
function model(b: Bench, x: number): THREE.Group {
  const pb = new PropBatch(), y = b.y, c = Math.cos(b.yaw), s = Math.sin(b.yaw);
  const P = (u: number, h: number, v: number) => [x + u * c - v * s, y + h, b.z + u * s + v * c];
  const quad = (u0: number, v0: number, u1: number, v1: number, h0: number, h1: number) =>
    pb.solid8([P(u0, h0, v0), P(u1, h0, v0), P(u1, h0, v1), P(u0, h0, v1)], [P(u0, h1, v0), P(u1, h1, v0), P(u1, h1, v1), P(u0, h1, v1)], WOOD);
  quad(-0.9, -0.4, 0.9, 0.4, 0.82, 0.92); // the top
  for (const [u, v] of [[-0.8, -0.3], [0.8, -0.3], [-0.8, 0.3], [0.8, 0.3]]) quad(u - 0.05, v - 0.05, u + 0.05, v + 0.05, 0, 0.82);
  quad(-0.8, -0.3, 0.8, 0.3, 0.25, 0.3); // the shelf
  quad(0.55, -0.35, 0.8, -0.15, 0.92, 1.08); // the vice
  pb.line(GRID, P(-0.85, 0.92, 0.38), P(-0.85, 1.6, 0.38), P(0.85, 1.6, 0.38), P(0.85, 0.92, 0.38)); // tool rack
  for (const u of [-0.5, -0.1, 0.3]) pb.line(GRID, P(u, 1.55, 0.36), P(u, 1.15, 0.36));
  return pb.build();
}

/** Draw the benches within reach, drop far ones (called now and then). */
export function syncBenches() {
  const p = G.pos, want = new Set<Bench>();
  if (G.char.loc === 'overworld') for (const b of G.char.benches) if (Math.hypot(nearX(b.x, p.x) - p.x, b.z - p.z) < 160) want.add(b);
  for (const [b, g] of drawn) if (!want.has(b) || Math.abs(g.userData.x - nearX(b.x, p.x)) > 1) { scene.remove(g); g.traverse((o) => (o as THREE.Mesh).geometry?.dispose()); drawn.delete(b); }
  for (const b of want) if (!drawn.has(b)) { const x = nearX(b.x, p.x), g = model(b, x); g.userData.x = x; scene.add(g); drawn.set(b, g); }
}
export function clearBenches() { for (const g of drawn.values()) scene.remove(g); drawn.clear(); }

/** Use a Workbench Kit: set the bench up a step ahead of you. */
export function placeBench(): boolean {
  if (G.char.loc !== 'overworld' || !OW.terrain) { logLine('Set it up outdoors.'); return false; }
  if (G.char.benches.length >= MAX_BENCHES) { logLine(`You already have ${MAX_BENCHES} workbenches out there. Pack one up first.`); return false; }
  const x = G.pos.x - Math.sin(G.yaw) * 1.8, z = G.pos.z - Math.cos(G.yaw) * 1.8, y = groundAt(x, z);
  if (!isFinite(y) || Math.abs(y - G.pos.y) > 1.2 || OW.terrain.water(x, z)) { logLine('No level spot for the bench here.'); return false; }
  if (!takeOne('benchkit')) return false;
  G.char.benches.push({ x, y, z, yaw: -G.yaw }); saveChar(); syncBenches();
  logLine('You unfold the workbench. E at it to craft.');
  return true;
}
/** A bench within reach. */
export function nearBench(): Bench | null {
  const p = G.pos;
  if (G.char.loc !== 'overworld') return null;
  return G.char.benches.find((b) => Math.hypot(nearX(b.x, p.x) - p.x, b.z - p.z) < 2 && Math.abs(b.y - p.y) < 1.5) ?? null;
}
/** Fold the bench back into a kit. Returns an error message or ''. */
export function packBench(b: Bench): string {
  if (!addItem('benchkit')) return 'No room in your backpack for the kit (20 L).';
  G.char.benches.splice(G.char.benches.indexOf(b), 1); saveChar(); syncBenches();
  return '';
}
