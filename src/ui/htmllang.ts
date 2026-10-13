// (0.190) The page's own texts (index.html: the menu, panels, key help, placeholders and titles) in the player's
// language. Imported first by main.ts, so it runs before any module fills the page; texts that modules write later
// go through tl / TL themselves. A text node's key is its text with the whitespace collapsed (the same rule
// tests/i18n.test.ts and the extractor use).
import { tl, lang } from '../i18n';

const norm = (s: string) => s.split(/\s+/).filter(Boolean).join(' ');
if (lang !== 'en' && typeof document !== 'undefined') {
  document.documentElement.lang = lang;
  const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = walk.nextNode(); n; n = walk.nextNode()) {
    const p = n.parentElement?.tagName;
    if (p === 'SCRIPT' || p === 'STYLE') continue;
    const raw = n.nodeValue ?? '', k = norm(raw);
    if (!k) continue;
    const t = tl(k);
    if (t !== k) n.nodeValue = (raw.match(/^\s*/)![0]) + t + (raw.match(/\s*$/)![0]);
  }
  for (const el of document.querySelectorAll<HTMLElement>('[placeholder],[title],[aria-label]')) {
    for (const a of ['placeholder', 'title', 'aria-label']) {
      const v = el.getAttribute(a);
      if (v) el.setAttribute(a, tl(v.trim()));
    }
  }
  document.title = tl(document.title);
}
