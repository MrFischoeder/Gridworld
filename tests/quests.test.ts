import { describe, it, expect } from 'vitest';
import { generateQuest, describeSpot, compass, boardPay, type QuestTown } from '../src/gen/quests';
import { Terrain } from '../src/gen/terrain';
import { findPoi, allVillages, worldDist, wrapDx } from '../src/gen/regions';
import { regionVehicle } from '../src/gen/vehicles';
import { hash } from '../src/core/rng';

const WORLDS = Array.from({ length: 20 }, (_, i) => hash(77, i));

describe('notice board quests', () => {
  it('are deterministic per world and counter', () => {
    for (const w of WORLDS) for (let n = 0; n < 6; n++) expect(generateQuest(new Terrain(w), n)).toEqual(generateQuest(new Terrain(w), n));
  });
  it('describe places that match the generated world', () => {
    const kinds = new Set<string>();
    for (const w of WORLDS) {
      const t = new Terrain(w);
      for (let n = 0; n < 12; n++) {
        const q = generateQuest(t, n);
        kinds.add(q.kind);
        if (q.kind === 'hunt') {
          const { at, pack } = q;
          const spot = describeSpot(t, at!.x, at!.z);
          expect(spot.where).toBe(at!.where);
          expect(spot.kind).toBe(pack!.kind);
          expect(q.text).toContain(compass(at!.x, at!.z));
          if (at!.where === 'in a valley') expect(t.heightAt(at!.x, at!.z)).toBeLessThan(8);
          if (at!.where === 'on the hills') expect(t.heightAt(at!.x, at!.z)).toBeGreaterThan(17);
          if (at!.where === 'in the forest') expect(t.forest(at!.x, at!.z)).toBeGreaterThan(0.45);
        }
        if (q.kind === 'camp') {
          const p = findPoi(w, q.place!.campId!)!;
          expect(p.type).toBe('camp');
          expect(p.name).toBe(q.place!.name);
          expect(q.text).toContain(compass(p.x, p.z));
        }
        if (q.kind === 'fetch') {
          const p = q.place!;
          if (p.type === 'ruin') expect(findPoi(w, p.ruinId!)?.name).toBe(p.name);
          else {
            const [, rx, rz] = p.vehicleId!.split(':').map(Number);
            const v = regionVehicle(t, rx, rz)!;
            expect([v.x, v.z]).toEqual([p.x, p.z]);
          }
          expect(q.briefing).toContain(compass(p.x, p.z));
        }
      }
    }
    expect([...kinds].sort()).toEqual(['bounty', 'camp', 'fetch', 'hunt']);
  });
  it('other villages post their own notices, measured from the village', () => {
    const kinds = new Set<string>();
    for (const w of WORLDS.slice(0, 8)) {
      const t = new Terrain(w), v = allVillages(w)[3];
      const town: QuestTown = { id: v.id, name: v.name, x: v.x, z: v.z, home: false, pay: boardPay(2), names: { elder: 'Elder Test' } };
      for (let n = 0; n < 8; n++) {
        const q = generateQuest(t, n, [], town);
        kinds.add(q.kind);
        expect(q).toEqual(generateQuest(t, n, [], town));
        expect(q.id).toBe(`q${v.id}.${n}`);
        expect(q.town).toBe(v.id);
        expect(q.giver).not.toBe('dealer');
        expect(q.text).not.toContain('Gridholm');
        const p = q.kind === 'hunt' ? q.at! : q.place;
        if (p) {
          expect(worldDist(p.x, p.z, v.x, v.z)).toBeLessThan(2000);
          if (q.kind !== 'bounty') expect(q.briefing ?? q.text).toContain(compass(wrapDx(p.x - v.x), p.z - v.z));
        }
        if (q.kind === 'fetch' && q.giver === 'elder') expect(q.giverName).toBe('Elder Test');
      }
      expect(generateQuest(t, 0, [], town)).not.toEqual(generateQuest(t, 0));
    }
    expect(kinds.size).toBeGreaterThan(2);
  });
});
