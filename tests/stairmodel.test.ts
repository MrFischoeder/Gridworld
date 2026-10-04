import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
vi.hoisted(() => {
  vi.stubGlobal('window', {}); vi.stubGlobal('navigator', { maxTouchPoints: 0 });
  vi.stubGlobal('document', { createElement: () => ({ width: 512, height: 96, getContext: () => ({ fillRect() {}, strokeRect() {}, fillText() {} }) }) });
});
vi.mock('../src/world/render', () => ({ scene: new THREE.Scene(), V: (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z), circlePts: () => [new THREE.Vector3(), new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 1, 0)], lineMat: (color: number) => new THREE.LineBasicMaterial({ color }), fillMat: () => new THREE.MeshBasicMaterial() }));
vi.mock('../src/world/player', () => ({ EYE: 1.55 }));
vi.mock('../src/character', () => ({ progressHas: () => false, progress: () => [], saveChar: () => {}, takeOne: () => true }));
vi.mock('../src/world/fx', () => ({ burst: () => {} }));
vi.mock('../src/ui/hud', () => ({ logLine: () => {}, showToast: () => {}, el: {} }));
import { makeStair, disposeStair } from '../src/world/doors';
import type { PortalSpec } from '../src/gen/stairs';
import { DIRV, type Dir } from '../src/core/rng';

describe('batched stair visuals match physics', () => {
  for (const dir of ['N', 'E', 'S', 'W'] as Dir[]) it(`aligns ${dir} stairs at an elevated doorway with two draw objects`, () => {
    const axis = DIRV[dir][0] ? 'x' : 'z', p: PortalSpec = { key: 'V', dir, axis, m: 13, c: -7, up: true, y0: 17 };
    const st = makeStair(p, { ...p, cx: axis === 'x' ? 13.5 : -6.5, cz: axis === 'z' ? 13.5 : -6.5, y0: 17, locked: false, stair: true, cells: [] }, 0, 'UP', 'stairs up', () => {});
    st.door.g.updateMatrixWorld(true);
    const actual = new THREE.Box3().setFromObject(st.stepModel), expected = new THREE.Box3();
    for (const b of st.steps) { expected.expandByPoint(new THREE.Vector3(b.x, b.y, b.z)); expected.expandByPoint(new THREE.Vector3(b.x + b.w, b.y + b.h, b.z + b.d)); }
    expect(actual.min.distanceTo(expected.min)).toBeLessThan(1e-5); expect(actual.max.distanceTo(expected.max)).toBeLessThan(1e-5);
    expect(st.stepModel.children).toHaveLength(2);
    const triangles = (st.stepModel.children[0] as THREE.Mesh).geometry.getAttribute('position').count / 3;
    expect(triangles).toBe(330);
    expect((st.stepModel.children[1] as THREE.LineSegments).geometry.getAttribute('position').count / 2).toBe(396);
    disposeStair(st); st.door.g.removeFromParent();
  });
});
