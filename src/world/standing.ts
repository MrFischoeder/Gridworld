// Earning a village's trust at runtime (gen/standing.ts): called wherever you help a village.
import { G } from '../game';
import { findPoi } from '../gen/regions';
import { addTrust, TRUST, TRUST_TIERS, type TrustWhy } from '../gen/standing';
import { logLine, showToast } from '../ui/hud';
import { tl, TL } from '../i18n';

export function earnTrust(villageId: number, why: TrustWhy) {
  const c = G.char, st = (c.towns[villageId] ??= {}), name = findPoi(c.world, villageId)?.name ?? tl('The village');
  const up = addTrust(st, why);
  logLine(TL`${name} trusts you more (+${TRUST[why]}).`);
  if (up >= 0) {
    const t = TRUST_TIERS[up];
    showToast(`${name}: ${t.name}`);
    logLine(TL`You are ${up === 1 ? tl('known') : tl('a ') + t.name.toLowerCase()} in ${name} now: the elder will spare you ${t.crates} crates of what the village makes each day, free.`);
  }
}
