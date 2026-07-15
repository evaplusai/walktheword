// Gate for cycle-2 text verification: the same corpus-lexicon split-word scan the
// ingest tool runs (same full-count lexicons, same thresholds), executed against the
// SHIPPED data on every test run. It catches the artifact classes found so far
// ("ca me", "Chris t,", "corner s") — a statistical net, not a proof of perfection;
// the authoritative receipt is the judge's independent PDF re-extraction diff.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const edition = JSON.parse(readFileSync(new URL('../data/edition-2-kjv.json', import.meta.url), 'utf8'));
const overlay = JSON.parse(readFileSync(new URL('../data/edition-2-web.json', import.meta.url), 'utf8'));
const lexKJV = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/lexicon-kjv.json', import.meta.url), 'utf8'));
const lexWEB = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/lexicon-web.json', import.meta.url), 'utf8'));
const bigKJV = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/bigrams-kjv.json', import.meta.url), 'utf8'));
const bigWEB = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/bigrams-web.json', import.meta.url), 'utf8'));

const STRIP = /^[.,;:?!()'"]+|[.,;:?!()'"]+$/g;

function splitSuspects(verseMaps, lex, bigrams) {
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
            continue;
          }
          // both-fragments-common class ("fat her" -> father) via exported corpus
          // bigram counts. A pair ABSENT from the export counts as 0 — identical to the
          // ingest-side semantics — so any hand-edit to scripture data that introduces a
          // new suspicious pair fails loudly (editions are immutable; that's a feature).
          const bc = bigrams[`${a} ${z}`] ?? 0;
          if (a.length >= 2 && z.length >= 2
              && joined >= 50 && bc <= 2 && Math.floor(joined / Math.max(1, bc)) >= 100) {
            suspects.push(`${bookId} ${ch}:${v} "${toks[i]} ${toks[i + 1]}" (bigram)`);
          }
        }
      }
    }
  }
  return suspects;
}

test('KJV edition text carries no split-word extraction artifacts', () => {
  const verseMaps = Object.fromEntries(edition.books.map(b => [b.id, b.chapters]));
  assert.deepEqual(splitSuspects(verseMaps, lexKJV, bigKJV), []);
});

test('WEB overlay text carries no split-word extraction artifacts', () => {
  assert.deepEqual(splitSuspects(Object.fromEntries(overlay.books.map(b => [b.id, b.chapters])), lexWEB, bigWEB), []);
});

test('every recorded auto-repair is applied in shipped data (receipt ↔ reality)', () => {
  const repairs = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/autorepairs.json', import.meta.url), 'utf8'));
  const shipped = { kjv: Object.fromEntries(edition.books.map(b => [b.id, b.chapters])), web: Object.fromEntries(overlay.books.map(b => [b.id, b.chapters])) };
  for (const tr of ['kjv', 'web']) {
    const joins = repairs[tr];
    for (const { ref, from, to } of joins) {
      const [book, chv] = ref.split(' ');
      const [ch, v] = chv.split(':');
      const text = shipped[tr][book][ch][v];
      assert.ok(!text.includes(from), `${tr} ${ref}: split "${from}" still shipped`);
      assert.ok(text.includes(to), `${tr} ${ref}: repaired form "${to}" missing`);
    }
  }
});

test('regressions for judge-found both-fragments-common splits (rounds 2–3)', () => {
  const kjv = Object.fromEntries(edition.books.map(b => [b.id, b.chapters]));
  assert.match(kjv.john['12']['49'], /the Father which sent me/);
  assert.match(overlay.books.find(b => b.id === 'john').chapters['3']['23'], /because there was much water/);
  assert.match(overlay.books.find(b => b.id === 'isaiah').chapters['41']['9'], /called from its corners/);
  assert.match(kjv.isaiah['6']['6'], /a live coal/, 'legitimate pair must never be joined');
});

test('cycle-4 judge regressions: section headings do not leak into verse ends', () => {
  const kjv = Object.fromEntries(edition.books.map(b => [b.id, b.chapters]));
  const web = Object.fromEntries(overlay.books.map(b => [b.id, b.chapters]));
  assert.match(kjv.exodus['7']['13'], /as the LORD had said\.$/);
  assert.doesNotMatch(kjv.genesis['29']['30'], /Reuben, Simeon, Levi, and Judah$/);
  assert.doesNotMatch(kjv['1kings']['16']['28'], /Jezebel$/);
  assert.match(kjv.proverbs['22']['16'], /come to want\.$/);
  assert.match(kjv.exodus['1']['3'], /^Issachar, Zebulun, and Benjamin,$/, 'name-list VERSE preserved');
  assert.match(kjv.exodus['29']['24'], /before the LORD\.$/, '"LORD." not eaten by acrostic rule');
  assert.match(kjv.psalms['119']['1'], /^ALEPH\. Blessed/, 'KJV inline stanza marker kept as printed');
  assert.match(web.psalms['119']['160'], /endures forever\.$/, 'WEB stanza heading stripped');
  assert.doesNotMatch(web.psalms['119']['16'], /GIMEL$/);
});

test('round-2 judge regressions: quoted-speech verse lines are never dropped as headings', () => {
  const web = Object.fromEntries(overlay.books.map(b => [b.id, b.chapters]));
  assert.match(web.matthew['16']['11'], /the Pharisees and Sadducees\."$/);
  assert.match(web.matthew['27']['37'], /THE KING OF THE JEWS\."$/);
  assert.match(web.revelation['1']['11'], /and to Laodicea\."$/);
});

test('every verse ends with punctuation, or is on the receipted audit list', () => {
  const repairs = JSON.parse(readFileSync(new URL('../../docs/00_bible/extracted/autorepairs.json', import.meta.url), 'utf8'));
  const shippedMaps = { kjv: Object.fromEntries(edition.books.map(b => [b.id, b.chapters])), web: Object.fromEntries(overlay.books.map(b => [b.id, b.chapters])) };
  for (const tr of ['kjv', 'web']) {
    const allowed = new Set(repairs[`${tr}-unterminated-verses`]);
    const bad = [];
    for (const [b, chs] of Object.entries(shippedMaps[tr])) {
      for (const [c, vs] of Object.entries(chs)) {
        for (const [v, t] of Object.entries(vs)) {
          if (t && !/[.,;:!?'")’”—-]$/.test(t) && !allowed.has(`${b} ${c}:${v}`)) {
            bad.push(`${tr} ${b} ${c}:${v}`);
          }
        }
      }
    }
    assert.deepEqual(bad, [], `${tr}: unreceipted unterminated verses`);
  }
});

test('no residual Hebrew acrostic markers, [Online] fragments, or double spaces', () => {
  const all = JSON.stringify(edition.books) + JSON.stringify(overlay.books);
  assert.doesNotMatch(all, /[֐-׿]/, 'Hebrew characters');
  assert.doesNotMatch(all, /\[Online\]/);
  assert.ok(!all.includes('  '), 'double spaces');
});
