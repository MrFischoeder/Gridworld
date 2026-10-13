// (0.190) The game is bilingual (the owner's standing rule): every player-visible text in the code goes through
// tl('...') or TL`...` and has a Polish entry in src/i18n/pl.ts, and so does every text of index.html.
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { PL } from '../src/i18n/pl';
import { keyOf } from '../src/i18n';

const files = (d: string): string[] => readdirSync(d).flatMap((f) => {
  const p = join(d, f);
  return statSync(p).isDirectory() ? (p.endsWith('i18n') ? [] : files(p)) : p.endsWith('.ts') && !p.endsWith('.d.ts') && !p.endsWith('i18n.ts') ? [p] : [];
});
const ESC: Record<string, string> = { n: '\n', t: '\t', r: '\r' };
const unescape = (s: string) => s.replace(/\\(.)/g, (_, c: string) => ESC[c] ?? c);

/** Skips a string or template starting at i; returns the index after it. */
function skipQuoted(s: string, i: number): number {
  const q = s[i];
  if (q === '`') return template(s, i)[1];
  for (let j = i + 1; j < s.length; j++) { if (s[j] === '\\') j++; else if (s[j] === q) return j + 1; }
  return s.length;
}
/** Skips a ${ ... } expression from i (just after '${'); returns the index after the closing brace. */
function expr(s: string, i: number): number {
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === "'" || c === '"' || c === '`') { j = skipQuoted(s, j) - 1; continue; }
    if (c === '{') depth++;
    else if (c === '}') { if (depth === 0) return j + 1; depth--; }
  }
  return s.length;
}
/** A template starting at the backtick i: its static parts and the index after it. */
function template(s: string, i: number): [string[], number] {
  const parts: string[] = []; let cur = '';
  for (let j = i + 1; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { cur += s.slice(j, j + 2); j++; continue; }
    if (c === '`') { parts.push(cur); return [parts, j + 1]; }
    if (c === '$' && s[j + 1] === '{') { parts.push(cur); cur = ''; j = expr(s, j + 2) - 1; continue; }
    cur += c;
  }
  return [parts, s.length];
}
function keysOf(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/\btl\((['"])((?:\\.|(?!\1).)*)\1\)/g)) out.push(unescape(m[2]));
  for (const m of src.matchAll(/\bTL`/g)) out.push(keyOf(template(src, m.index! + 2)[0].map(unescape)));
  return out;
}
const htmlKeys = (h: string): string[] => {
  const body = h.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/g, '');
  const out: string[] = [];
  for (const m of body.matchAll(/\b(?:placeholder|title|aria-label)="([^"]*)"/g)) if (/[A-Za-z]{2,}/.test(m[1])) out.push(m[1].trim());
  for (const m of body.replace(/<[^>]*>/g, '\u0000').split('\u0000')) {
    const t = m.split(/\s+/).filter(Boolean).join(' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    if (/[A-Za-z]{2,}/.test(t)) out.push(t);
  }
  return out;
};

describe('two languages', () => {
  const keys = new Map<string, string>();
  for (const f of files('src')) for (const k of keysOf(readFileSync(f, 'utf8'))) if (!keys.has(k)) keys.set(k, f);
  for (const k of htmlKeys(readFileSync('index.html', 'utf8'))) if (!keys.has(k)) keys.set(k, 'index.html');

  it('every text has its Polish', () => {
    const missing = [...keys].filter(([k]) => !Object.hasOwn(PL, k)).map(([k, f]) => `${f}: ${JSON.stringify(k)}`);
    expect(missing).toEqual([]);
  });
  it('the Polish keeps the placeholders and the markup', () => {
    const bad: string[] = [];
    for (const [k, v] of Object.entries(PL)) {
      const num = (s: string) => new Set(s.match(/\{\d+\}/g) ?? []);
      const named = (s: string) => [...new Set(s.match(/\{[a-zA-Z]+\}/g) ?? [])].sort().join();
      const tags = (s: string) => (s.match(/<[^>]+>/g) ?? []).sort().join();
      if ([...num(v)].some((x) => !num(k).has(x)) || named(k) !== named(v) || tags(k) !== tags(v)) bad.push(k);
    }
    expect(bad).toEqual([]);
  });
});
