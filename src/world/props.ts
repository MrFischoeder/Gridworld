// Batched wireframe props with dark fills (roofs, tree crowns). Many props share one fill mesh and one line mesh.
import * as THREE from 'three';
import { lineMat, fillMat } from './render';

export class PropBatch {
  tri: number[] = [];
  /** Line segments grouped by colour. */
  lines = new Map<number, number[]>();

  seg(color: number, a: number[], b: number[]) {
    let l = this.lines.get(color); if (!l) this.lines.set(color, (l = []));
    l.push(a[0], a[1], a[2], b[0], b[1], b[2]);
  }
  face(...pts: number[][]) { for (let i = 1; i + 1 < pts.length; i++) this.tri.push(...pts[0], ...pts[i], ...pts[i + 1]); }

  /** Gabled roof over a box footprint: ridge along the longer side, rafters every quarter. */
  gableRoof(x0: number, z0: number, x1: number, z1: number, top: number, rise: number, color: number) {
    const rh = top + rise, along = x1 - x0 >= z1 - z0;
    const r0 = along ? [x0, rh, (z0 + z1) / 2] : [(x0 + x1) / 2, rh, z0], r1 = along ? [x1, rh, (z0 + z1) / 2] : [(x0 + x1) / 2, rh, z1];
    const c00 = [x0, top, z0], c10 = [x1, top, z0], c01 = [x0, top, z1], c11 = [x1, top, z1];
    this.seg(color, r0, r1);
    for (const c of [c00, c10, c01, c11]) this.seg(color, c, (along ? c[0] === x0 : c[2] === z0) ? r0 : r1);
    for (let t = 0.25; t < 1; t += 0.25) {
      const a = [r0[0] + (r1[0] - r0[0]) * t, rh, r0[2] + (r1[2] - r0[2]) * t];
      if (along) { this.seg(color, [a[0], top, z0], a); this.seg(color, [a[0], top, z1], a); }
      else { this.seg(color, [x0, top, a[2]], a); this.seg(color, [x1, top, a[2]], a); }
    }
    if (along) { this.face(c00, c10, r1, r0); this.face(c01, c11, r1, r0); this.face(c00, c01, r0); this.face(c10, c11, r1); }
    else { this.face(c00, c01, r1, r0); this.face(c10, c11, r1, r0); this.face(c00, c10, r0); this.face(c01, c11, r1); }
  }

  /** Cone crown: 8 sides, base ring, a mid ring at 45% height. */
  cone(cx: number, y: number, cz: number, r: number, h: number, color: number, sides = 8) {
    const top = [cx, y + h, cz], centre = [cx, y, cz];
    for (let i = 0; i < sides; i++) {
      const a = i / sides * 6.283, b = (i + 1) / sides * 6.283;
      const p1 = [cx + Math.cos(a) * r, y, cz + Math.sin(a) * r], p2 = [cx + Math.cos(b) * r, y, cz + Math.sin(b) * r];
      this.seg(color, p1, top); this.seg(color, p1, p2);
      const m = (p: number[]) => [p[0] + (top[0] - p[0]) * 0.45, p[1] + (top[1] - p[1]) * 0.45, p[2] + (top[2] - p[2]) * 0.45];
      this.seg(color, m(p1), m(p2));
      this.face(p1, p2, top); this.face(centre, p2, p1);
    }
  }

  /** Vertical box (tree trunk) with lines on its edges. */
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, color: number) {
    const c = (x: number, y: number, z: number) => [x, y, z];
    const b = [c(x0, y0, z0), c(x1, y0, z0), c(x1, y0, z1), c(x0, y0, z1)], t = b.map((p) => [p[0], y1, p[2]]);
    for (let i = 0; i < 4; i++) {
      const j = (i + 1) % 4;
      this.seg(color, b[i], b[j]); this.seg(color, t[i], t[j]); this.seg(color, b[i], t[i]);
      this.face(b[i], b[j], t[j], t[i]);
    }
    this.face(t[0], t[1], t[2], t[3]);
  }

  build(): THREE.Group {
    const g = new THREE.Group();
    if (this.tri.length) {
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.Float32BufferAttribute(this.tri, 3));
      g.add(new THREE.Mesh(fg, fillMat()));
    }
    for (const [color, pts] of this.lines) {
      const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
      g.add(new THREE.LineSegments(lg, lineMat(color)));
    }
    return g;
  }
}
