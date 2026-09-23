// Night sky above open-air places: stars and a vector moon.
import * as THREE from 'three';
import { scene, lineMat, V, circlePts, fillMat } from './render';

export const sky = (() => {
  const p: number[] = [];
  for (let i = 0; i < 700; i++) {
    const a = Math.random() * 6.283, e = 0.12 + Math.random() * 1.3, r = 170;
    p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
  const grp = new THREE.Group();
  grp.add(new THREE.Points(g, new THREE.PointsMaterial({ color: 0xbfffd0, size: 1.6, sizeAttenuation: false, fog: false })));
  // The moon disc is solid: it hides the stars behind it (so it sits just inside the star sphere).
  const moonFill = fillMat(0x000000); moonFill.fog = false;
  const moon = new THREE.Group(); moon.add(new THREE.Mesh(new THREE.CircleGeometry(9, 40), moonFill));
  moon.add(new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(circlePts(9, 40)), lineMat(0xd8ffe0, { fog: false })));
  for (let i = -3; i <= 3; i++) { const y = i * 2.4, w = Math.sqrt(Math.max(0, 81 - y * y)); moon.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([V(-w, y, 0), V(w, y, 0)]), lineMat(0x3a7a4a, { fog: false }))); }
  moon.position.set(84, 95, -126).multiplyScalar(160 / 179); moon.scale.setScalar(160 / 179); moon.lookAt(0, 0, 0); grp.add(moon);
  grp.visible = false; scene.add(grp); return grp;
})();
