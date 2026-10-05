// Natural extraction landmarks. Scenery is seeded; the oil surface uses one reusable animation buffer.
import * as THREE from 'three';
import { hash, rng } from '../core/rng';
import { ORES, type DepositOre } from '../gen/resource-sites';
import { resourceRock } from '../gen/resource-rocks';
import type { RockShape } from '../gen/rockshape';
import type { Terrain } from '../gen/terrain';
import { PropBatch } from './props';
import { sharedLine } from './props';
import { drawTree } from './trees';
import type { Box } from '../gen/base';

export interface OilMotion { object: THREE.LineSegments; x: number; y: number; z: number; phase: number }
export function naturalResource(pb: PropBatch, T: Terrain, vid: number, kind: 'quarry' | 'mine' | 'lumber', x: number, z: number, rocks: RockShape[], boxes: Box[], ore?: DepositOre) {
  const R = rng(hash(T.world, vid, kind.length, 0xdec051));
  const rock = (dx: number, dz: number, r: number, h: number, colour: number, vein = false) => {
    const xx = x + dx, zz = z + dz, y = T.heightAt(xx, zz) - .12, sides = 6 + Math.floor(R() * 3), rot = R() * 6.283;
    pb.rock(xx, y, zz, r, h, sides, rot, colour); if (vein && ore) pb.vein(xx, y, zz, r, h, sides, rot, ORES[ore].color);
    rocks.push(resourceRock(xx, y, zz, r, h, sides, rot));
  };
  if (kind === 'quarry') {
    // Broad rubble mound, with a clear eastern work apron for the later cutting shed.
    for (let i = 0; i < 23; i++) {
      const a = R() * 6.283, d = Math.sqrt(R()) * 8, r = 1.4 + R() * 2;
      rock(-4 + Math.cos(a) * d, Math.sin(a) * d, r, 2 + (1 - d / 9) * 4 + R(), i % 3 === 0 ? 0xb2b2a3 : 0x88978f);
    }
  } else if (kind === 'mine') {
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283 + R() * .12, d = 7 + R();
      // The northern gap remains clear for a walk-in approach to the shallow bowl.
      if (i === 8 || i === 9) continue;
      rock(Math.cos(a) * d, Math.sin(a) * d, 1.1 + R() * .8, 1.1 + R() * 1.4, 0x89988b, true);
    }
    for (let i = 0; i < 5; i++) rock((R() - .5) * 5, (R() - .5) * 5, .35 + R() * .4, .25 + R() * .25, ore ? ORES[ore].color : 0x89988b, true);
  } else {
    // Timber is standing woodland until a sawmill is commissioned, with an open yard in the middle.
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * 6.283, xx = x + Math.cos(a) * (13 + R() * 2), zz = z + Math.sin(a) * (10 + R() * 2), y = T.heightAt(xx, zz), h = 8 + R() * 4;
      drawTree(pb, { x: xx, y, z: zz, h, r: 2.2, kind: i % 3 === 0 ? 'broad' : 'pine', rot: a, seed: hash(vid, i, T.world), cols: [[xx, zz, .35]] }, 1);
      boxes.push({ b: [xx - .3, y, zz - .3, xx + .3, y + h * .6, zz + .3], slab: false });
    }
  }
}
const OIL_MATERIAL = new THREE.MeshBasicMaterial({ color: 0x08090d, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
export function oilSeep(T: Terrain, vid: number, x: number, z: number): { group: THREE.Group; motion: OilMotion } {
  const group = new THREE.Group(), pb = new PropBatch(), R = rng(hash(T.world, vid, 0x01151)), y = T.heightAt(x, z) + .055, tris: number[] = [];
  for (const [dx, dz, radius] of [[0, 0, 5.5], [-7, 3, 2.6], [6, -4, 3.2]]) {
    const ring = Array.from({ length: 24 }, (_, i) => { const a = i / 24 * 6.283, rr = radius * (.8 + R() * .2); return [x + dx + Math.cos(a) * rr, y, z + dz + Math.sin(a) * rr]; });
    for (let i = 0; i < ring.length; i++) { const j = (i + 1) % ring.length; tris.push(x + dx, y, z + dz, ...ring[i], ...ring[j]); pb.seg(0x626975, ring[i], ring[j]); }
  }
  const shape = new THREE.BufferGeometry(); shape.setAttribute('position', new THREE.Float32BufferAttribute(tris, 3)); group.add(new THREE.Mesh(shape, OIL_MATERIAL), pb.build());
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(192 * 3), 3));
  const object = new THREE.LineSegments(geometry, sharedLine(0x9a97ac)); object.position.set(x, y + .04, z); object.frustumCulled = false; group.add(object);
  return { group, motion: { object, x, y, z, phase: R() * 10 } };
}
export function animateOil(m: OilMotion, time: number) {
  const attr = m.object.geometry.getAttribute('position') as THREE.BufferAttribute, p = attr.array as Float32Array; let i = 0;
  const line = (a: number[], b: number[]) => { p.set(a, i); p.set(b, i + 3); i += 6; };
  for (let b = 0; b < 4; b++) {
    const t = ((time + m.phase + b * .57) % 2.4) / 2.4, r = .15 + t * 1.8, bx = Math.sin(b * 3.1) * 2.6, bz = Math.cos(b * 2.3) * 2;
    for (let j = 0; j < 16; j++) { const a = j / 16 * 6.283, aa = (j + 1) / 16 * 6.283, yy = Math.sin(t * Math.PI) * .25; line([bx + Math.cos(a) * r, yy, bz + Math.sin(a) * r], [bx + Math.cos(aa) * r, yy, bz + Math.sin(aa) * r]); }
  }
  const pulse = Math.pow(Math.max(0, Math.sin((time + m.phase) * 2.1)), 3), h = .3 + pulse * 2.2;
  for (let j = 0; j < 8; j++) { const a = j / 8 * 6.283; line([Math.cos(a) * .17, .05, Math.sin(a) * .17], [Math.cos(a) * .09, h, Math.sin(a) * .09]); }
  for (let j = 0; j < 8; j++) { const t = ((time + j * .19 + m.phase) % 1.3) / 1.3, a = j * 2.4, d = t * 1.8 * pulse, yy = Math.max(.08, (1 - t) * h); line([Math.cos(a) * d, yy, Math.sin(a) * d], [Math.cos(a) * d, yy + .12, Math.sin(a) * d]); }
  attr.needsUpdate = true; m.object.geometry.setDrawRange(0, i / 3);
}
