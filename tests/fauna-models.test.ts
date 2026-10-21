import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { FAUNA, FAUNA_IDS, createFaunaModel } from '../src/models/fauna';
import { PL } from '../src/i18n/pl';

describe('reusable natural fauna visual assets', () => {
  for (const id of FAUNA_IDS) it(`${id}: complete anatomy, finite geometry, ground and metric scale`, () => {
    const model = createFaunaModel(id);
    try {
      expect(Object.keys(model.parts).filter(k => k.startsWith('leg.'))).toHaveLength(FAUNA[id].legs);
      expect(Object.keys(model.parts).filter(k => k.startsWith('foot.'))).toHaveLength(FAUNA[id].legs);
      for (const key of ['body', 'neck', 'head', 'jaw', 'tail']) expect(model.parts[key]).toBeInstanceOf(THREE.Group);
      expect(model.parts.jaw.parent).toBe(model.parts.head);
      expect(model.parts.head.parent).toBe(model.parts.neck);
      expect(model.root.scale.toArray()).toEqual([1, 1, 1]);
      const bounds = new THREE.Box3().setFromObject(model.root), size = bounds.getSize(new THREE.Vector3());
      expect(Math.abs(bounds.min.y)).toBeLessThan(.04);
      expect(size.y).toBeGreaterThan(FAUNA[id].height * .9);
      expect(size.y).toBeLessThan(FAUNA[id].height * 1.1);
      if (id !== 'waz-pregowy') {
        expect(size.z).toBeGreaterThan(FAUNA[id].length * .9);
        expect(size.z).toBeLessThan(FAUNA[id].length * 1.1);
      }
      let triangles = 0, lines = 0;
      model.root.traverse(o => {
        if (!(o instanceof THREE.Mesh || o instanceof THREE.LineSegments)) return;
        const p = o.geometry.getAttribute('position');
        expect(Array.from(p.array).every(Number.isFinite)).toBe(true);
        expect(p.count % (o instanceof THREE.Mesh ? 3 : 2)).toBe(0);
        const material = o.material as THREE.Material;
        expect(material.transparent).toBe(false);
        if (o instanceof THREE.Mesh) triangles += p.count / 3; else lines += p.count / 2;
      });
      expect(triangles).toBeGreaterThan(100); expect(triangles).toBeLessThan(6000);
      expect(lines).toBeGreaterThan(50);
    } finally { model.dispose(); }
  });

  it('has precisely three named leg pairs on the horse and none on the snake', () => {
    const horse = createFaunaModel('szescionog'), snake = createFaunaModel('waz-pregowy');
    try {
      for (const row of ['front', 'middle', 'rear']) for (const side of ['left', 'right']) {
        expect(horse.parts[`foot.${row}.${side}`].parent).toBe(horse.parts[`leg.${row}.${side}`]);
      }
      expect(Object.keys(snake.parts).some(k => k.startsWith('leg.'))).toBe(false);
    } finally { horse.dispose(); snake.dispose(); }
  });

  it('keeps the enormous dinosaur and the human-scale bear in distinct real-world proportions', () => {
    const titan = createFaunaModel('koronotytan'), bear = createFaunaModel('grzbietowiec');
    try {
      const giant = new THREE.Box3().setFromObject(titan.root).getSize(new THREE.Vector3());
      const small = new THREE.Box3().setFromObject(bear.root).getSize(new THREE.Vector3());
      expect(giant.y / 1.8).toBeGreaterThan(9.5);
      expect(giant.z).toBeGreaterThan(35); expect(giant.z).toBeLessThan(37);
      expect(giant.y / small.y).toBeGreaterThan(6);
    } finally { titan.dispose(); bear.dispose(); }
  });

  it('moves the nested head with its neck, leaving the tail independent', () => {
    const m = createFaunaModel('koronotytan');
    try {
      const head = m.parts.head.getWorldPosition(new THREE.Vector3()), tail = m.parts.tail.getWorldPosition(new THREE.Vector3());
      m.parts.neck.position.y += 2;
      expect(m.parts.head.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(head.y + 2);
      expect(m.parts.tail.getWorldPosition(new THREE.Vector3()).toArray()).toEqual(tail.toArray());
    } finally { m.dispose(); }
  });

  it('owns resources per instance, and disposes them exactly once without affecting another model', () => {
    const a = createFaunaModel('szescionog'), b = createFaunaModel('szescionog');
    const resources = (root: THREE.Group) => {
      const set = new Set<THREE.BufferGeometry | THREE.Material>();
      root.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
        set.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => set.add(m));
      } }); return set;
    };
    const ar = resources(a.root), br = resources(b.root), spies = [...ar].map(r => vi.spyOn(r, 'dispose'));
    try {
      expect([...ar].some(r => br.has(r))).toBe(false);
      a.parts.head.rotation.x = .5; expect(b.parts.head.rotation.x).toBe(0);
      a.dispose(); a.dispose();
      spies.forEach(s => expect(s).toHaveBeenCalledTimes(1));
      expect(new THREE.Box3().setFromObject(b.root).isEmpty()).toBe(false);
    } finally { a.dispose(); b.dispose(); }
  });

  it('localizes every catalogue field displayed by the gallery', () => {
    for (const asset of Object.values(FAUNA)) for (const key of [asset.name, asset.description, asset.dimensions]) {
      expect(Object.hasOwn(PL, key), key).toBe(true);
    }
  });

  it('exports fresh, never-rendered models with the complete neutral hierarchy and metric dimensions', () => {
    for (const id of FAUNA_IDS) {
      const model = createFaunaModel(id);
      try {
        // Serialize before any bounds query/render can update the original object's matrices.
        const restored = new THREE.ObjectLoader().parse(JSON.parse(JSON.stringify(model.root.toJSON())));
        const expected = new THREE.Box3().setFromObject(model.root), actual = new THREE.Box3().setFromObject(restored);
        expect(actual.min.distanceTo(expected.min)).toBeLessThan(.00001);
        expect(actual.max.distanceTo(expected.max)).toBeLessThan(.00001);
        expect(restored.userData.units).toBe('metres');
        expect(restored.position.length()).toBe(0);
        for (const name of Object.keys(model.parts).filter(n => n !== 'root')) {
          const part = restored.getObjectByName(name)!;
          expect(part, name).toBeDefined();
          expect(part.getWorldPosition(new THREE.Vector3()).distanceTo(model.parts[name].getWorldPosition(new THREE.Vector3()))).toBeLessThan(.00001);
        }
        const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>();
        restored.traverse(o => { if (o instanceof THREE.Mesh || o instanceof THREE.LineSegments) {
          geometries.add(o.geometry); (Array.isArray(o.material) ? o.material : [o.material]).forEach(m => materials.add(m));
        } });
        geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose());
      } finally { model.dispose(); }
    }
  });
});
