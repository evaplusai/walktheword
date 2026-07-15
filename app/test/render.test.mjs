// Gate T for ADR-002 §3 — rendering wraps scripture, never rewrites it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml, verseHTML, chapterHTML } from '../lib/render.mjs';
import { getVerse } from '../lib/graph.mjs';

const data = JSON.parse(readFileSync(new URL('../data/edition-2-kjv.json', import.meta.url), 'utf8'));

test('escapeHtml neutralizes markup', () => {
  assert.equal(escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;');
});

test('Matthew 13:14 renders its grade-A door on the exact quoted phrase', () => {
  const html = verseHTML(data, 'matthew', 13, 14, getVerse(data, 'matthew', 13, 14));
  assert.match(html, /class="cx2 A" data-edge="mt13-14-quotes-isa6-9"/);
  assert.match(html, />the prophecy of Esaias, which saith<\/a>/);
});

test('verse text outside doors is untouched and verbatim', () => {
  const text = getVerse(data, 'matthew', 13, 1);
  const html = verseHTML(data, 'matthew', 13, 1, text);
  assert.ok(html.includes(escapeHtml(text)), 'verse without doors passes through whole');
});

test('chapter renders all verses whole and in order — no gaps in canonical chapters', () => {
  const html = chapterHTML(data, 'matthew', 13);
  const order = [...html.matchAll(/<span class="v">(\d+)<\/span>/g)].map(m => Number(m[1]));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(order.length, 58);
  assert.doesNotMatch(html, /not in this edition slice/);
});

test('gap admission still works for a future partial chapter (synthetic)', () => {
  const mini = { books: [{ id: 'x', name: 'X', chapters: { '1': { '1': 'alpha.', '3': 'gamma.' } } }], edges: [] };
  const html = chapterHTML(mini, 'x', 1);
  assert.match(html, /verses 2–2 not in this edition slice/);
});

test('landing verse is highlighted for walk arrivals', () => {
  const html = chapterHTML(data, 'isaiah', 6, 9);
  assert.match(html, /<span class="land"><span class="v">9<\/span>/);
});

test('psalm superscription opens verse 1 verbatim (source convention; .super stays for future sources)', () => {
  const html = chapterHTML(data, 'psalms', 121);
  assert.match(html, /<span class="v">1<\/span>A Song of degrees\. I will lift up mine eyes/);
  assert.doesNotMatch(html, /class="super"/);
});

test('doors are keyboard-reachable in markup (role=button, tabindex=0)', () => {
  const html = verseHTML(data, 'matthew', 13, 14, getVerse(data, 'matthew', 13, 14));
  assert.match(html, /role="button" tabindex="0"/);
});
