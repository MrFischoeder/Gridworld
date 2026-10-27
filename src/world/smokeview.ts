// (0.264.1) Whether something solid (a building, wall, ruin, city block, a structure's voxels) stands between the eye and
// a smoke column's middle: far columns are drawn without depth testing, so this decides when they are hidden.
import * as THREE from 'three';
import { rayWorld } from './player';
import { camera } from './render';

const SMOKE_RAY = 450; // structures are only loaded this near
const o = new THREE.Vector3(), d = new THREE.Vector3();
export function viewBlocked(mid: THREE.Vector3): boolean {
  o.copy(camera.position); d.subVectors(mid, o);
  const L = d.length(); if (L < 8) return false;
  d.divideScalar(L);
  const reach = Math.min(L - 4, SMOKE_RAY);
  return rayWorld(o, d, reach) < reach - 1;
}
