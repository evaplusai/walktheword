// Gate for cycle-2 text verification: the SAME corpus-lexicon split-word scan the
// ingest tool runs, executed against the SHIPPED data on every test run — extraction
// corruption ("ca me", "Chris t,") can never pass the suite green again.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edition = JSON.parse(readFileSync(new URL('../data/edition-1.json', import.meta.url), 'utf8'));
const overlay = JSON.parse(readFileSync(new URL('../data/web-overlay-1.json', import.meta.url), 'utf8'));
const lexKJV = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/lexicon-kjv.json', import.meta.url), 'utf8'));
const lexWEB = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/lexicon-web.json', import.meta.url), 'utf8'));

const STRIP = /^[.,;:?!()'"]+|[.,;:?!()'"]+$/g;

function splitSuspects(verseMaps, lex) {
  const suspects = [];
  for (const [bookId, chapters] of Object.entries(verseMaps)) {
    for (const [ch, verses] of Object.entries(chapters)) {
      for (const [v, t] of Object.entries(verses)) {
        const toks = t.split(/\s+/);
        for (let i = 0; i < toks.length - 1; i++) {
          const a = toks[i].replace(STRIP, '').toLowerCase();
          const z = toks[i + 1].replace(STRIP, '').toLowerCase();
          if (!/^[a-z]+$/.test(a) || !/^[a-z]+$/.test(z)) continue;
          if (/[.,;:?!()'"]$/.test(toks[i])) continue; // fragments never end with punctuation
          const joined = lex[a + z] || 0;
          const frag = Math.max(2, Math.floor(joined / 10));
          if (joined >= 3 && ((lex[a] || 0) <= frag || (lex[z] || 0) <= frag)) {
            suspects.push(`${bookId} ${ch}:${v} "${toks[i]} ${toks[i + 1]}"`);
          }
        }
      }
    }
  }
  return suspects;
}

test('KJV edition text carries no split-word extraction artifacts', () => {
  const verseMaps = Object.fromEntries(edition.books.map(b => [b.id, b.chapters]));
  assert.deepEqual(splitSuspects(verseMaps, lexKJV), []);
});

test('WEB overlay text carries no split-word extraction artifacts', () => {
  assert.deepEqual(splitSuspects(overlay.books, lexWEB), []);
});

test('no residual Hebrew acrostic markers, [Online] fragments, or double spaces', () => {
  const all = JSON.stringify(edition.books) + JSON.stringify(overlay.books);
  assert.doesNotMatch(all, /[֐-׿]/, 'Hebrew characters');
  assert.doesNotMatch(all, /\[Online\]/);
  assert.ok(!all.includes('  '), 'double spaces');
});
