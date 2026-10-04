import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ G: { hp: 100, dmgFlash: 0 }, proxy: false }));
vi.mock('../src/game', () => state);
vi.mock('../src/world/remote', () => ({ proxied: () => state.proxy }));
import { hurtPlayer, environmentalDamage, setVehicleProtection } from '../src/world/damage';
import { damageCondition, crashDamage, freshParts, health, VEHICLES } from '../src/data/vehicles';
beforeEach(() => { state.G.hp = 100; state.G.dmgFlash = 0; state.proxy = false; setVehicleProtection(() => false, () => {}, n => n / 2); });
describe('one vehicle condition and occupant protection', () => {
  it('routes the entire hit into the vehicle and never spills a lethal hit onto its occupant', () => {
    const p = freshParts('scout'); let occupied = true;
    setVehicleProtection(() => occupied, n => { if (damageCondition(p, n)) occupied = false; });
    hurtPlayer(20); expect(p.hull).toBe(100); expect(state.G.hp).toBe(100);
    hurtPlayer(1000); expect(p.hull).toBe(0); expect(health('scout', p)).toBe(0); expect(state.G.hp).toBe(100);
    hurtPlayer(20); expect(state.G.hp).toBe(90); // later hits after getting out can hurt
  });
  it('protects passengers and forwards hits to their vehicle owner', () => {
    const send = vi.fn(); setVehicleProtection(() => true, send);
    hurtPlayer(30, false); expect(send).toHaveBeenCalledWith(30); expect(state.G.hp).toBe(100);
    environmentalDamage(10); expect(state.G.hp).toBe(100); expect(send).toHaveBeenCalledTimes(1);
  });
  it('does not lend your vehicle protection to a proxied remote player or NPC', () => {
    const hit = vi.fn(); setVehicleProtection(() => true, hit); state.proxy = true;
    hurtPlayer(20); expect(hit).not.toHaveBeenCalled(); expect(state.G.hp).toBe(90);
  });
  it('ignores invalid hits and clamps condition at zero', () => {
    const p = freshParts('mastodon');
    for (const n of [NaN, Infinity, -1, 0]) expect(damageCondition(p, n)).toBe(false);
    expect(p.hull).toBe(VEHICLES.mastodon.hull); expect(damageCondition(p, 1000)).toBe(true);
    expect(damageCondition(p, 10)).toBe(false); expect(p.hull).toBe(0);
  });
  it('only damaging impacts lower condition, symmetrically in reverse', () => {
    expect(crashDamage('scout', 0)).toBe(0); expect(crashDamage('scout', 6)).toBe(0);
    expect(crashDamage('scout', 15)).toBeGreaterThan(0); expect(crashDamage('scout', -15)).toBe(crashDamage('scout', 15));
  });
});
