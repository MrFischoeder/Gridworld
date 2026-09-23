// three.js scene, camera and shared material helpers.
import * as THREE from 'three';

// Match the look of the original (three r128: no colour management, linear output).
THREE.ColorManagement.enabled = false;

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
renderer.domElement.id = 'view';
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.prepend(renderer.domElement);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);
export const fog = new THREE.Fog(0x000000, 3, 46);
scene.fog = fog;
export const camera = new THREE.PerspectiveCamera(75, 1, 0.05, 200);
camera.rotation.order = 'YXZ';
scene.add(camera);

function resize() { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); }
addEventListener('resize', resize); resize();

export const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
export const lineMat = (color: number, extra: THREE.LineBasicMaterialParameters = {}) => new THREE.LineBasicMaterial({ color, ...extra });
/** Additive glowing line material (beams, sparks, pickups). */
export const add = (color: number) => lineMat(color, { blending: THREE.AdditiveBlending, transparent: true });

export const GRID = 0x2fe060, FILL = 0x010d04;
/** Dark fill drawn under wireframe lines so solids hide what is behind them. */
export const fillMat = (color = FILL) => new THREE.MeshBasicMaterial({
  color, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
});

export function circlePts(r: number, n = 32): THREE.Vector3[] {
  const p: THREE.Vector3[] = [];
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2; p.push(V(Math.cos(a) * r, Math.sin(a) * r, 0)); }
  return p;
}
export const edgesOf = (g: THREE.BufferGeometry, m: THREE.Material) => new THREE.LineSegments(new THREE.EdgesGeometry(g), m);
export const linePts = (pts: THREE.Vector3[]) => new THREE.BufferGeometry().setFromPoints(pts);

/** Remove an object and free its geometries (materials are often shared, so they are left alone). */
export function disposeTree(o: THREE.Object3D) {
  o.removeFromParent();
  o.traverse((c) => { const g = (c as THREE.Mesh).geometry; if (g) g.dispose(); });
}
