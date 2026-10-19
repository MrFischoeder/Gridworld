// A compact flashlight clamped beneath a barrel, pointing along local -z (viewmodels).
import * as THREE from 'three';
import { lineMat, fillMat } from './render';

export function weaponFlashlight(viewmodel = false) {
  const g = new THREE.Group(), line = lineMat(0xb8d8c8, { fog: !viewmodel }), fill = fillMat(); fill.fog = !viewmodel;
  g.name = 'weaponflashlight';
  const part = (geo: THREE.BufferGeometry, z = 0) => {
    const p = new THREE.Group(); p.add(new THREE.Mesh(geo, fill), new THREE.LineSegments(new THREE.EdgesGeometry(geo), line)); p.position.z = z; g.add(p); return p;
  };
  const tube = new THREE.CylinderGeometry(.023, .023, .17, 8); tube.rotateX(Math.PI / 2); part(tube);
  const head = new THREE.CylinderGeometry(.033, .029, .04, 8); head.rotateX(Math.PI / 2); part(head, -.095);
  const clamp = part(new THREE.BoxGeometry(.065, .025, .035)); clamp.position.y = .027;
  const lens = new THREE.Mesh(new THREE.CircleGeometry(.026, 12), new THREE.MeshBasicMaterial({ color: 0xf1ffff, fog: false, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
  lens.position.z = -.116; lens.name = 'weaponlight-lens'; g.add(lens);
  return { g, lens };
}
