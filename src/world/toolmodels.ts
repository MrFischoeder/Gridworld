// Solid models of the hand tools (data/items.ts HAND_TOOLS): a dark fill under coloured edges, so nothing shows through
// them. One builder for both uses: in your hands in front of the view (world/gather.ts) and lying on the ground
// (world/pickmodels.ts). Model frame: the grip at the origin, the handle along -z, the head's spread along y.
import * as THREE from 'three';
import { fillMat } from './render';
import type { ItemKey } from '../data/items';

export const TOOL_KEYS = ['hatchet', 'pickaxe', 'hammer', 'saw', 'screwdriver', 'pliers', 'welder', 'torch', 'shovel'] as const;
export type ToolKey = typeof TOOL_KEYS[number];
export const isToolModel = (k: ItemKey | undefined): k is ToolKey => !!k && (TOOL_KEYS as readonly string[]).includes(k);

const fill = fillMat();
const lines = new Map<number, THREE.LineBasicMaterial>();
const lm = (c: number) => { let m = lines.get(c); if (!m) { m = new THREE.LineBasicMaterial({ color: c }); lines.set(c, m); } return m; };

/** A solid piece: the fill and its edges, placed and turned. */
function piece(g: THREE.Group, geo: THREE.BufferGeometry, c: number, x: number, y: number, z: number, rx = 0, ry = 0, rz = 0) {
  const o = new THREE.Group(); o.position.set(x, y, z); o.rotation.set(rx, ry, rz);
  o.add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), lm(c)));
  g.add(o); return o;
}
/** A flat outline (in the y/z plane, points as [y, z]) given thickness along x. */
function slab(pts: [number, number][], t: number): THREE.BufferGeometry {
  const s = new THREE.Shape(pts.map(([y, z]) => new THREE.Vector2(z, y)));
  const geo = new THREE.ExtrudeGeometry(s, { depth: t, bevelEnabled: false });
  geo.translate(0, 0, -t / 2); geo.rotateY(-Math.PI / 2); // shape x → model z, shape y → model y, extrusion → model x
  return geo;
}
const box = (w: number, h: number, d: number) => new THREE.BoxGeometry(w, h, d);
const rod = (r0: number, r1: number, len: number, n = 6) => { const g = new THREE.CylinderGeometry(r1, r0, len, n); g.rotateX(-Math.PI / 2); return g; }; // along -z: r0 at the near end

/** The tool k in the model frame, with its wood (grip) and steel colours. */
export function toolModel(k: ToolKey, wood: number, steel: number): THREE.Group {
  const g = new THREE.Group();
  switch (k) {
    case 'hatchet':
      piece(g, box(0.035, 0.04, 0.62), wood, 0, 0, -0.31);
      piece(g, slab([[0.02, -0.53], [-0.02, -0.53], [-0.03, -0.6], [-0.16, -0.66], [-0.16, -0.5], [-0.03, -0.56]], 0.03), steel, 0, 0, 0); // the edge down, into the blow
      break;
    case 'pickaxe':
      piece(g, box(0.035, 0.04, 0.64), wood, 0, 0, -0.32);
      piece(g, box(0.05, 0.08, 0.06), steel, 0, 0, -0.62);
      piece(g, (() => { const c = new THREE.CylinderGeometry(0.006, 0.028, 0.24, 5); return c; })(), steel, 0, 0.16, -0.62);
      piece(g, (() => { const c = new THREE.CylinderGeometry(0.028, 0.012, 0.2, 5); return c; })(), steel, 0, -0.14, -0.62);
      break;
    case 'hammer':
      piece(g, box(0.03, 0.035, 0.38), wood, 0, 0, -0.19);
      piece(g, box(0.05, 0.15, 0.055), steel, 0, 0.02, -0.39);
      break;
    case 'saw':
      piece(g, box(0.04, 0.1, 0.12), wood, 0, 0.02, -0.04);
      piece(g, slab([[0.05, -0.1], [-0.05, -0.1], [-0.02, -0.5], [0.05, -0.5]], 0.006), steel, 0, 0, 0);
      break;
    case 'screwdriver':
      piece(g, rod(0.022, 0.018, 0.12), wood, 0, 0, -0.06);
      piece(g, rod(0.005, 0.004, 0.16, 5), steel, 0, 0, -0.2);
      break;
    case 'pliers':
      piece(g, box(0.02, 0.018, 0.14), wood, 0, 0.022, -0.07, 0.18, 0, 0);
      piece(g, box(0.02, 0.018, 0.14), wood, 0, -0.022, -0.07, -0.18, 0, 0);
      piece(g, box(0.022, 0.03, 0.09), steel, 0, 0, -0.18);
      break;
    case 'welder':
      piece(g, box(0.05, 0.1, 0.05), wood, 0, -0.03, -0.02);
      piece(g, box(0.07, 0.07, 0.2), steel, 0, 0.02, -0.12);
      piece(g, rod(0.016, 0.01, 0.14), steel, 0, 0.03, -0.29);
      break;
    case 'torch':
      piece(g, rod(0.02, 0.018, 0.2), wood, 0, 0, -0.1);
      piece(g, rod(0.009, 0.007, 0.22, 5), steel, 0, 0, -0.31);
      piece(g, rod(0.012, 0.006, 0.06, 5), steel, 0, 0.02, -0.44, 0.5, 0, 0);
      break;
    case 'shovel':
      piece(g, box(0.1, 0.03, 0.04), wood, 0, 0, 0.02);
      piece(g, box(0.03, 0.035, 0.9), wood, 0, 0, -0.45);
      piece(g, slab([[0.12, -0.88], [-0.12, -0.88], [-0.11, -1.1], [0, -1.17], [0.11, -1.1]], 0.02), steel, 0, 0, 0);
      break;
  }
  return g;
}

/** The tool lying flat on the ground (the head's spread along world z, the handle along x, centred). */
export function lyingTool(k: ToolKey, wood: number, steel: number): THREE.Group {
  const m = toolModel(k, wood, steel), box3 = new THREE.Box3().setFromObject(m);
  const g = new THREE.Group(), inner = new THREE.Group(); inner.add(m);
  // model x (the thin side) → up, model y → world z, model z → world x
  inner.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(1, 0, 0)));
  const mid = (box3.min.z + box3.max.z) / 2, half = Math.max(0.015, (box3.max.x - box3.min.x) / 2);
  inner.position.set(-mid, half, 0);
  g.add(inner);
  return g;
}
