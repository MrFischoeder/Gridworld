// Visual assets only. No world, browser, simulation or shared material imports.
import * as THREE from 'three';

export type Point = [number, number, number];
export interface Section { p: Point; width: number; depth: number }
export const INK = 0xffb347;
export const ACCENT = 0xffd58a;

/** Polygon sections perpendicular to a continuous anatomical centreline. */
export function sections(path: Section[], sides = 8): Point[][] {
  return path.map((s, i) => {
    const before = path[Math.max(0, i - 1)].p, after = path[Math.min(path.length - 1, i + 1)].p;
    const tangent = new THREE.Vector3(...after).sub(new THREE.Vector3(...before)).normalize();
    const reference = Math.abs(tangent.y) > .9 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
    const x = reference.cross(tangent).normalize(), y = tangent.clone().cross(x).normalize();
    return Array.from({ length: sides }, (_, j) => {
      const a = j * Math.PI * 2 / sides;
      return new THREE.Vector3(...s.p).addScaledVector(x, Math.cos(a) * s.width)
        .addScaledVector(y, Math.sin(a) * s.depth).toArray() as Point;
    });
  });
}

/** Separate face and edge buffers: triangulation diagonals never become visible lines. */
export class Shape {
  faces: number[] = [];
  edges = new Map<number, number[]>();
  face(...points: Point[]) {
    for (let i = 1; i + 1 < points.length; i++) this.faces.push(...points[0], ...points[i], ...points[i + 1]);
  }
  stroke(points: Point[], color = INK) {
    let buffer = this.edges.get(color);
    if (!buffer) this.edges.set(color, buffer = []);
    for (let i = 1; i < points.length; i++) buffer.push(...points[i - 1], ...points[i]);
  }
  surface(rings: Point[][], ringEvery = 1, edgeEvery = 2) {
    const n = rings[0].length;
    for (let i = 0; i < rings.length; i++) {
      if (i % ringEvery === 0 || i === rings.length - 1) this.stroke([...rings[i], rings[i][0]]);
      if (!i) continue;
      for (let j = 0; j < n; j++) {
        const k = (j + 1) % n;
        this.face(rings[i - 1][j], rings[i - 1][k], rings[i][k], rings[i][j]);
        if (j % edgeEvery === 0) this.stroke([rings[i - 1][j], rings[i][j]]);
      }
    }
    this.face(...rings[0]); this.face(...rings[rings.length - 1]);
  }
  tube(path: Section[], sides = 8, ringEvery = 1, edgeEvery = 2) {
    this.surface(sections(path, sides), ringEvery, edgeEvery);
  }
  oval(at: Point, size: Point, sides = 8) {
    const profile = [[-1, .025], [-.75, .65], [-.35, .94], [.2, 1], [.65, .76], [1, .025]];
    this.tube(profile.map(([z, radius]) => ({
      p: [at[0], at[1], at[2] + z * size[2]], width: size[0] * radius, depth: size[1] * radius,
    })), sides, 2);
  }
  thorn(at: Point, direction: Point, length: number, width: number) {
    const tip = new THREE.Vector3(...direction).normalize().multiplyScalar(length).add(new THREE.Vector3(...at));
    this.tube([{ p: at, width, depth: width * .6 }, { p: tip.toArray() as Point, width: .002, depth: .002 }], 4, 1, 1);
  }
  /** A thin biological crest/fur tuft, with a filled front and back. */
  fin(points: Point[], thickness = .025) {
    const a = points.map(p => [p[0] - thickness, p[1], p[2]] as Point);
    const b = points.map(p => [p[0] + thickness, p[1], p[2]] as Point);
    this.face(...a); this.face(...b);
    for (let i = 0; i < a.length; i++) {
      const j = (i + 1) % a.length;
      this.face(a[i], a[j], b[j], b[i]);
    }
    this.stroke([...a, a[0]]); this.stroke([...b, b[0]]);
  }
}

export interface FaunaModel {
  /** Ground root: metres, Y up, +Z forward. No automatic offset or scene registration. */
  root: THREE.Group;
  /** Stable joint/part names, including the root. Every value belongs to this instance. */
  parts: Readonly<Record<string, THREE.Group>>;
  /** Dispose once the caller has removed root from its scene. Idempotent. */
  dispose(): void;
}

export class ModelBuilder {
  readonly root = new THREE.Group();
  readonly parts: Record<string, THREE.Group> = {};
  private shapes: { shape: Shape; group: THREE.Group }[] = [];
  constructor(id: string) {
    this.root.name = id; this.root.userData = { assetId: id, units: 'metres', up: '+Y', forward: '+Z' };
    this.parts.root = this.root;
  }
  part(name: string, at: Point = [0, 0, 0], parent = this.root) {
    if (this.parts[name]) throw new Error(`Duplicate fauna part: ${name}`);
    const group = new THREE.Group(), shape = new Shape();
    group.name = name; group.position.set(...at); parent.add(group);
    this.parts[name] = group; this.shapes.push({ shape, group });
    return { group, shape };
  }
  finish(): FaunaModel {
    const fill = new THREE.MeshBasicMaterial({ color: 0x080b04, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 });
    const materials = new Map<number, THREE.LineBasicMaterial>(), geometries: THREE.BufferGeometry[] = [];
    const geometry = (points: number[]) => {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
      g.computeBoundingSphere(); geometries.push(g); return g;
    };
    for (const { shape, group } of this.shapes) {
      if (shape.faces.length) group.add(new THREE.Mesh(geometry(shape.faces), fill));
      for (const [color, points] of shape.edges) {
        let material = materials.get(color);
        if (!material) { material = new THREE.LineBasicMaterial({ color }); materials.set(color, material); }
        group.add(new THREE.LineSegments(geometry(points), material));
      }
    }
    // Object3D.toJSON serializes local matrices. Fresh assets must be exportable before their first render.
    this.root.updateMatrixWorld(true);
    let disposed = false;
    return { root: this.root, parts: Object.freeze({ ...this.parts }), dispose() {
      if (disposed) return;
      disposed = true; geometries.forEach(g => g.dispose()); fill.dispose(); materials.forEach(m => m.dispose());
    } };
  }
}

/** Small almond outline on a skull's side, not a luminous spherical sensor. */
export function eye(s: Shape, side: number, x: number, y: number, z: number, size = .08) {
  s.stroke([[side * x, y, z - size], [side * (x + .018), y + size * .4, z],
    [side * x, y, z + size], [side * (x + .018), y - size * .4, z], [side * x, y, z - size]], ACCENT);
}

export function leg(b: ModelBuilder, name: string, hip: Point, knee: Point, foot: Point, width: number, hoof = false, toes = 3) {
  const limb = b.part(`leg.${name}`, hip);
  limb.shape.tube([{ p: [0, 0, 0], width, depth: width * 1.1 },
    { p: knee, width: width * .7, depth: width * .75 },
    { p: foot, width: width * .48, depth: width * .6 }]);
  const paw = b.part(`foot.${name}`, foot, limb.group);
  if (hoof) {
    for (const side of [-1, 1]) paw.shape.oval([side * width * .3, 0, .04], [width * .28, .1, width * .8], 6);
  } else {
    paw.shape.oval([0, 0, width * .25], [width * 1.05, .1, width * 1.35]);
    for (let i = 0; i < toes; i++) paw.shape.thorn([(i - (toes - 1) / 2) * width * .4, -.015, width * 1.15], [0, -.15, 1], width * .65, width * .1);
  }
  return limb.group;
}
