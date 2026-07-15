// Gate for cycle-2 text verification: the same corpus-lexicon split-word scan the
// ingest tool runs (same full-count lexicons, same thresholds), executed against the
// SHIPPED data on every test run. It catches the artifact classes found so far
// ("ca me", "Chris t,", "corner s") — a statistical net, not a proof of perfection;
// the authoritative receipt is the judge's independent PDF re-extraction diff.
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
          const singles = ['a', 'i', 'o']; // the only legitimate standalone letters
          const aFrag = (lex[a] || 0) <= frag || (a.length === 1 && !singles.includes(a));
          const zFrag = (lex[z] || 0) <= frag || (z.length === 1 && !singles.includes(z));
          if (joined >= 3 && (aFrag || zFrag)) {
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
