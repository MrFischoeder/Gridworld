import { beforeEach, describe, expect, it, vi } from 'vitest';
import { newChar } from '../src/save';
const state = vi.hoisted(() => ({
  G: { char: null as any, playing: true, xferOpen: false, packOpen: false, dlgOpen: false, firing: false, keys: {}, isTouch: true },
  elements: new Map<string, any>(), active: new Set<string>(), online: false, net: { id: 1 },
  lock: vi.fn(), unlock: vi.fn(), save: vi.fn(), toast: vi.fn(),
}));
vi.mock('../src/game', () => ({ G: state.G }));
vi.mock('../src/net/client', () => ({
  online: () => state.online, net: state.net, activeContainers: state.active,
  lockContainer: state.lock, unlockContainer: state.unlock, saveContainer: state.save,
}));
vi.mock('../src/ui/hud', () => ({
  $: (id: string) => {
    if (!state.elements.has(id)) state.elements.set(id, { style: {}, innerHTML: '', textContent: '', addEventListener(_t: string, fn: any) { this.click = fn; } });
    return state.elements.get(id);
  }, showToast: state.toast,
}));
vi.mock('../src/character', () => ({ calcStats: vi.fn(), saveChar: vi.fn(), stowHeld: vi.fn(), handsChanged: vi.fn(), packVol: () => 1000 }));
vi.mock('../src/ui/input', () => ({ lockPointer: vi.fn() }));
vi.mock('../src/ui/slots', () => ({ slotHTML: () => '', bindSlots: vi.fn(), itemInfo: () => '', parseId: (s: string) => s.split(':'), loadText: () => '' }));
import { openTransfer, closeTransfer } from '../src/ui/transfer';
const clickGold = () => state.elements.get('xfer').click({ target: { closest: () => true } });
beforeEach(() => {
  closeTransfer(); vi.clearAllMocks(); state.active.clear(); state.online = false; state.net.id = 1;
  state.G.char = newChar(); state.G.playing = true; state.G.xferOpen = false;
  vi.stubGlobal('document', { pointerLockElement: null });
});
const spec = (box: any) => ({ title: 'Chest', subtitle: '', boxLabel: 'Chest', box });
describe('shared container transfer UI', () => {
  it('keeps offline and personal-house transfers synchronous and local', async () => {
    const box = { items: [], gold: 10 }, gold = state.G.char.gold;
    await openTransfer(spec(box)); clickGold();
    expect(state.G.char.gold).toBe(gold + 10); expect(box.gold).toBe(0);
    expect(state.lock).not.toHaveBeenCalled(); expect(state.save).not.toHaveBeenCalled();
    closeTransfer(); state.online = true; state.G.char.containers['home:chest'] = box;
    await openTransfer(spec(box)); expect(state.lock).not.toHaveBeenCalled();
  });
  it('waits for the server lock and uses current contents before crediting gold', async () => {
    state.online = true;
    const box = { items: [], gold: 10 }; state.G.char.containers.chest = box;
    let grant!: (ok: boolean) => void;
    state.lock.mockImplementation(() => new Promise<boolean>((resolve) => { grant = resolve; }));
    const opening = openTransfer(spec(box));
    expect(state.G.xferOpen).toBe(false);
    box.gold = 3; state.active.add('chest'); grant(true); await opening;
    const before = state.G.char.gold; clickGold();
    expect(state.G.char.gold).toBe(before + 3); expect(state.save).toHaveBeenCalledWith('chest', box);
    closeTransfer(); expect(state.unlock).toHaveBeenCalledWith('chest', box);
  });
  it('a denied lock cannot open the chest or change the inventory', async () => {
    state.online = true; const box = { items: [], gold: 10 }; state.G.char.containers.chest = box;
    state.lock.mockResolvedValue(false); const before = structuredClone(state.G.char);
    await openTransfer(spec(box)); expect(state.G.xferOpen).toBe(false);
    expect(state.G.char).toEqual(before); expect(state.toast).toHaveBeenCalled();
  });
  it('an old transfer closes without taking anything after disconnect/reconnect', async () => {
    state.online = true; const box = { items: [], gold: 10 }; state.G.char.containers.chest = box;
    state.lock.mockImplementation(async () => { state.active.add('chest'); return true; });
    await openTransfer(spec(box)); state.active.clear(); state.net.id = 2;
    const gold = state.G.char.gold; clickGold();
    expect(state.G.xferOpen).toBe(false); expect(state.G.char.gold).toBe(gold); expect(box.gold).toBe(10);
    expect(state.save).not.toHaveBeenCalled(); expect(state.unlock).not.toHaveBeenCalled();
  });
});
