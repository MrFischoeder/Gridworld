import { beforeEach, describe, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({
  online: false, net: { id: 1 }, G: { char: { towns: { '5': { hold: { log: 30 } } } } },
  lock: vi.fn(), unlock: vi.fn(), toast: vi.fn(),
}));
vi.mock('../src/game', () => ({ G: state.G }));
vi.mock('../src/net/client', () => ({ online: () => state.online, net: state.net, lockTown: state.lock, unlockTown: state.unlock }));
vi.mock('../src/ui/hud', () => ({ showToast: state.toast }));
import { withTownStock } from '../src/ui/stock';

beforeEach(() => { vi.clearAllMocks(); state.online = false; state.net.id = 1; state.G.char.towns['5'] = { hold: { log: 30 } }; });
describe('village-stock transactions', () => {
  it('runs offline actions immediately without a server reservation', async () => {
    const action = vi.fn(); expect(await withTownStock(5, action)).toBe(true);
    expect(action).toHaveBeenCalledOnce(); expect(state.lock).not.toHaveBeenCalled();
  });
  it('waits for authoritative stock before charging materials and publishes exactly the result', async () => {
    state.online = true; let grant!: (value: boolean) => void;
    state.lock.mockImplementation(() => new Promise<boolean>((resolve) => { grant = resolve; }));
    const action = vi.fn(() => { state.G.char.towns['5'].hold.log -= 6; });
    const pending = withTownStock(5, action); expect(action).not.toHaveBeenCalled();
    state.G.char.towns['5'] = { hold: { log: 10 } }; grant(true);
    expect(await pending).toBe(true); expect(state.G.char.towns['5'].hold.log).toBe(4);
    expect(state.unlock).toHaveBeenCalledWith('5', { hold: { log: 4 } });
  });
  it('does not change a backpack or vehicle cargo when another builder holds the stock', async () => {
    state.online = true; state.lock.mockResolvedValue(false);
    const cargo = { log: 6 }, action = vi.fn(() => { cargo.log = 0; });
    expect(await withTownStock(5, action)).toBe(false);
    expect(cargo.log).toBe(6); expect(action).not.toHaveBeenCalled(); expect(state.unlock).not.toHaveBeenCalled();
  });
  it('never applies an earlier connection grant to a new connection', async () => {
    state.online = true;
    state.lock.mockImplementation(async () => { state.net.id = 2; return true; });
    const action = vi.fn(); expect(await withTownStock(5, action)).toBe(false);
    expect(action).not.toHaveBeenCalled(); expect(state.unlock).not.toHaveBeenCalled();
  });
});
