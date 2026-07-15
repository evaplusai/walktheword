// Gate T for ADR-002 §3 — rendering wraps scripture, never rewrites it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { escapeHtml, verseHTML, chapterHTML } from '../lib/render.mjs';
import { getVerse } from '../lib/graph.mjs';

const data = JSON.parse(readFileSync(new URL('../data/edition-1.json', import.meta.url), 'utf8'));

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

test('chapter renders all included verses in order and admits gaps honestly', () => {
  const html = chapterHTML(data, 'matthew', 13);
  const order = [...html.matchAll(/<span class="v">(\d+)<\/span>/g)].map(m => Number(m[1]));
  assert.deepEqual(order, [...order].sort((a, b) => a - b));
  assert.equal(order.length, 25);
  assert.match(html, /verses 24–30 not in this edition slice/);
});

test('landing verse is highlighted for walk arrivals', () => {
  const html = chapterHTML(data, 'isaiah', 6, 9);
  assert.match(html, /<span class="land"><span class="v">9<\/span>/);
});

test('psalm superscriptions render as a distinct title line, before verse 1', () => {
  const html = chapterHTML(data, 'psalms', 121);
  assert.match(html, /^<span class="super">A Song of degrees\.<\/span>/);
});

test('doors are keyboard-reachable in markup (role=button, tabindex=0)', () => {
  const html = verseHTML(data, 'matthew', 13, 14, getVerse(data, 'matthew', 13, 14));
  assert.match(html, /role="button" tabindex="0"/);
});
