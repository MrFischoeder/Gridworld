// (0.207) The dungeon editor's 3D view: the level's voxels as the game meshes them (core/meshing), seen from outside.
// Faces point into the rooms, so from above the ceilings fall away and the rooms read like a cut-away model. Drag to
// turn it, wheel to come closer. Its own small three.js scene, apart from the game's renderer.
import * as THREE from 'three';
import { VoxelGrid } from '../core/voxel';
import { meshVoxels } from '../core/meshing';
import type { DungeonMap } from '../gen/dungeon';

const GRID = 0x2fe060, FILL = 0x010d04;
export class Preview {
  private renderer: THREE.WebGLRenderer; private scene = new THREE.Scene(); private camera = new THREE.PerspectiveCamera(50, 1, 0.5, 2000);
  private group: THREE.Group | null = null; private target = new THREE.Vector3();
  private az = 0.7; private el = 0.95; private dist = 90;
  constructor(public cv: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    this.scene.background = new THREE.Color(0x000000);
    let drag: [number, number] | null = null;
    cv.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY]; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => {
      if (!drag) return;
      this.az -= (e.clientX - drag[0]) * 0.01; this.el = Math.max(0.1, Math.min(1.5, this.el + (e.clientY - drag[1]) * 0.01));
      drag = [e.clientX, e.clientY]; this.render();
    });
    cv.addEventListener('pointerup', () => { drag = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); this.dist = Math.max(8, Math.min(900, this.dist * (e.deltaY > 0 ? 1.12 : 0.89))); this.render(); }, { passive: false });
  }
  show(map: DungeonMap | null) {
    if (this.group) { this.scene.remove(this.group); this.group.traverse((o) => { (o as THREE.Mesh).geometry?.dispose(); }); this.group = null; }
    if (!map || !map.ops.some((o) => o.op === 'room')) { this.render(); return; }
    const grid = VoxelGrid.fromOps(map.ops), m = meshVoxels(grid, Infinity, { floor: 4, wall: 4 });
    const g = new THREE.Group();
    const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(m.tri, 3));
    g.add(new THREE.Mesh(fg, new THREE.MeshBasicMaterial({ color: FILL, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(m.lines, 3));
    g.add(new THREE.LineSegments(lg, new THREE.LineBasicMaterial({ color: GRID })));
    const dot = (x: number, y: number, z: number, c: number, s = 0.8) => { const b = new THREE.Mesh(new THREE.OctahedronGeometry(s), new THREE.MeshBasicMaterial({ color: c })); b.position.set(x, y, z); g.add(b); };
    for (const c of map.chests) dot(c.x + 0.5, 0.6, c.z + 0.5, 0xffd060, 0.5);
    for (const b of map.bosses) dot(b.x, 1.6, b.z, 0xff6a4a, 1.1);
    for (const r of map.guards ?? []) dot(r.x + 0.5, 1.2, r.z + 0.5, 0xffb347, 0.7);
    for (const c of map.crystals) dot(c.x + 0.5, 0.4, c.z + 0.5, 0xb6ff3a, 0.35);
    dot(map.spawn[0], map.spawn[1] + 0.8, map.spawn[2], 0x5cc8ff, 0.5);
    this.group = g; this.scene.add(g);
    this.target.set(grid.ox + grid.nx / 2, grid.oy + 2, grid.oz + grid.nz / 2);
    this.dist = Math.max(30, Math.max(grid.nx, grid.nz) * 1.1);
    this.render();
  }
  render() {
    const w = this.cv.clientWidth || 300, hh = this.cv.clientHeight || 220;
    this.renderer.setPixelRatio(Math.min(2, devicePixelRatio)); this.renderer.setSize(w, hh, false);
    this.camera.aspect = w / hh; this.camera.updateProjectionMatrix();
    const c = Math.cos(this.el);
    this.camera.position.set(this.target.x + Math.sin(this.az) * c * this.dist, this.target.y + Math.sin(this.el) * this.dist, this.target.z + Math.cos(this.az) * c * this.dist);
    this.camera.lookAt(this.target);
    this.renderer.render(this.scene, this.camera);
  }
}
