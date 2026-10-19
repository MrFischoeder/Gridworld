// Seven outlined triangles: five tongues of fire and two rising embers. Shared by held and wall torches.
import * as THREE from 'three';

const material = new THREE.LineBasicMaterial({ vertexColors: true, fog: false, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
const edges = [0, 1, 1, 2, 2, 0];
export class VectorFlame extends THREE.LineSegments<THREE.BufferGeometry, THREE.LineBasicMaterial> {
  constructor(height = .4, private readonly phase = 0) {
    const geometry = new THREE.BufferGeometry();
    for (const key of ['position', 'color']) geometry.setAttribute(key, new THREE.BufferAttribute(new Float32Array(7 * 6 * 3), 3).setUsage(THREE.DynamicDrawUsage));
    super(geometry, material);
    this.name = 'flame'; this.scale.setScalar(height);
    // A fixed bound includes the swaying tips and embers; no geometry or material is rebuilt per frame.
    geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .65, 0), .9);
    this.animate(0);
  }
  animate(time: number) {
    const p = this.geometry.getAttribute('position'), c = this.geometry.getAttribute('color'), t = time + this.phase;
    for (let i = 0; i < 7; i++) {
      const ember = i >= 5, a = i * 2.399, beat = t * (8.5 + i * 1.7) + i * 2.1;
      const pulse = .5 + .5 * Math.sin(beat + Math.sin(t * 4.3 + i));
      const rise = ember ? ((t * .8 + i * .47) % 1 + 1) % 1 : 0;
      const bx = i === 0 ? 0 : Math.cos(a) * (ember ? .12 + rise * .25 : .11), bz = i === 0 ? 0 : Math.sin(a) * .11;
      const y = ember ? .65 + rise * .7 : .03 + (i % 2) * .04;
      const w = ember ? .025 * (1 - rise) : (i === 0 ? .15 : .09) * (.7 + pulse * .5);
      const h = ember ? .09 : (i === 0 ? .85 : .45 + (i % 3) * .12) * (.75 + pulse * .4);
      const sway = Math.sin(t * 6.7 + i * 1.8) * (ember ? .06 : .1);
      const bright = ember ? (1 - rise) * pulse : i === 0 ? .8 + pulse * .2 : .25 + pulse * .75;
      for (let j = 0; j < 6; j++) {
        const v = edges[j], side = v === 0 ? -w : v === 1 ? w : sway, top = v === 2, n = i * 6 + j;
        p.setXYZ(n, bx + Math.cos(a) * side, y + (top ? h : 0), bz + Math.sin(a) * side);
        c.setXYZ(n, bright, bright * (i % 2 === 0 ? .73 : .36), bright * .07);
      }
    }
    p.needsUpdate = true; c.needsUpdate = true;
  }
}
