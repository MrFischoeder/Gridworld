import { beforeEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  G: { char: { world: 12345, loc: 'overworld' }, pos: { x: 0, y: 9.25, z: 0 } },
  terrain: { world: 12345, heightAt: () => 9.25 },
}));
vi.mock('../src/game', () => ({ G: state.G }));
vi.mock('../src/world/overworld', () => ({ OW: { terrain: state.terrain } }));
vi.mock('../src/world/render', () => ({ scene: {} }));
vi.mock('../src/world/props', () => ({ PropBatch: class {} }));
vi.mock('../src/world/npc', () => ({ textSprite: vi.fn() }));
import { nearCityEntrance } from '../src/world/cities';
import { citySites } from '../src/gen/cities';
import { cityEntrances } from '../src/gen/citydungeons';
import { WORLD_W } from '../src/gen/regions';
const e = cityEntrances(12345, citySites(12345)[0])[0];
beforeEach(() => { state.G.char.loc = 'overworld'; Object.assign(state.G.pos, { x: e.x, y: 9.25, z: e.z }); });

it('can use a city vault before any city meshes or street tiles have loaded', () => {
  expect(nearCityEntrance()?.id).toBe(e.id);
});
it('shows the entrance from its clear approach and on the wrapped copy of the planet', () => {
  state.G.pos.x += 3.2;
  expect(nearCityEntrance()?.id).toBe(e.id);
  state.G.pos.x += WORLD_W;
  expect(nearCityEntrance()?.id).toBe(e.id);
});
it('requires street level and does not activate on a rooftop above the sign', () => {
  state.G.pos.y += 4;
  expect(nearCityEntrance()).toBeNull();
});
it('does not offer the surface entrance inside its dungeon', () => {
  state.G.char.loc = 'dungeon';
  expect(nearCityEntrance()).toBeNull();
});
