// Gate T for ADR-001/004 — structural integrity of the edition + search classification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateEdition, getPassage, getVerse, edgesForVerse, walkEdge,
  parseRefQuery, classifyQuery, editionChecksum, GRADES,
  formatRef, missingRefExplanation, edgeWarrants, edgeById
} from '../lib/graph.mjs';

const data = JSON.parse(readFileSync(new URL('../data/edition-1.json', import.meta.url), 'utf8'));

test('edition validates: every edge graded, warranted, anchored verbatim; all refs resolve', () => {
  const errors = validateEdition(data);
  assert.deepEqual(errors, []);
});

test('every grade in the artifact is A, B, or C — explicitness, never truth', () => {
  for (const e of data.edges) assert.ok(GRADES.includes(e.grade), e.id);
});

test('anchor phrases are verbatim substrings of their verses (no paraphrase, PRD §6.2)', () => {
  for (const e of data.edges) {
    if (!e.anchor) continue;
    const [book, ch, v] = e.anchor.ref.split(':');
    const text = getVerse(data, book, ch, v);
    assert.ok(text && text.includes(e.anchor.phrase), `${e.id}: "${e.anchor.phrase}"`);
  }
});

test('passages resolve: verse, range, whole chapter', () => {
  assert.equal(getPassage(data, 'matthew:13:14').verses.length, 1);
  assert.equal(getPassage(data, 'mark:4:3-9').verses.length, 7);
  assert.equal(getPassage(data, 'psalms:121').verses.length, 8);
  assert.equal(getPassage(data, 'matthew:14:1'), null, 'absent chapters return null, never fake text');
});

test('every included chapter is WHOLE, matching canonical KJV verse counts', () => {
  const counts = {
    'matthew:13': 58, 'mark:4': 41, 'luke:8': 56, 'john:3': 36, 'john:12': 50,
    'isaiah:6': 13, 'isaiah:41': 29, 'psalms:34': 22, 'psalms:121': 8,
    'galatians:6': 18, 'hebrews:13': 25, '1peter:1': 25, '2peter:3': 18
  };
  for (const [ref, n] of Object.entries(counts)) {
    assert.equal(getPassage(data, ref).verses.length, n, ref);
  }
});

test('curator-source spot checks: the two corrected misquotes read as the source', () => {
  assert.match(getVerse(data, 'john', 3, 17), /to condemn the world; but that the world through him/);
  assert.match(getVerse(data, '2peter', 3, 16), /as they do also the other scriptures/);
});

test('doors: Matthew 13:14 carries the Isaiah quotation edge; walking lands on the verse itself', () => {
  const edges = edgesForVerse(data, 'matthew', 13, 14);
  assert.equal(edges.length, 1);
  const walked = walkEdge(data, edges[0].id);
  assert.equal(walked.kind, 'passage');
  assert.match(walked.passage.verses[0].t, /Hear ye indeed, but understand not/);
});

test('walking to a node returns the event with its witnesses, unmerged', () => {
  const walked = walkEdge(data, 'mt13-3-witnesses-sower');
  assert.equal(walked.kind, 'event');
  assert.equal(walked.node.witnesses.length, 3);
});

test('reference parser understands how people type addresses', () => {
  assert.equal(parseRefQuery('john 3 16'), 'john:3:16');
  assert.equal(parseRefQuery('Jn 3:16'), 'john:3:16');
  assert.equal(parseRefQuery('mt 13'), 'matthew:13');
  assert.equal(parseRefQuery('1 pet 1 23'), '1peter:1:23');
  assert.equal(parseRefQuery('psalm 121'), 'psalms:121');
  assert.equal(parseRefQuery('my mother is in the hospital'), null);
});

test('one search box, three honest outcomes (ADR-004)', () => {
  assert.equal(classifyQuery(data, 'john 3 16').kind, 'ref');
  assert.equal(classifyQuery(data, 'my mother is in the hospital').kind, 'moment');
  assert.equal(classifyQuery(data, 'who wrote hebrews?').kind, 'question');
  assert.equal(classifyQuery(data, 'xyzzy plugh').kind, 'none');
  assert.equal(classifyQuery(data, 'mt 27').kind, 'ref-missing', 'absent chapter is admitted, not faked');
});

test('moment routes and question cites resolve, with backstory and honest line', () => {
  const moment = classifyQuery(data, 'my mother is in the hospital').moment;
  assert.equal(moment.routes.length, 3);
  for (const r of moment.routes) assert.ok(getPassage(data, r.ref));
  const q = classifyQuery(data, 'who wrote hebrews?').question;
  assert.equal(q.honest, 'The text does not name its author.');
  for (const c of q.cites) assert.ok(getPassage(data, c));
});

test('edition checksum matches the stamped manifest (ADR-001 §3, verify-this-edition)', async () => {
  const sum = await editionChecksum(data);
  assert.equal(data.edition.checksum, sum);
});

// ---------- adversarial round (judge findings, round 1) ----------

test('checksum detects tampering: one altered word changes the digest', async () => {
  const tampered = JSON.parse(JSON.stringify(data));
  tampered.books[0].chapters['121']['1'] = tampered.books[0].chapters['121']['1'].replace('hills', 'mountains');
  assert.notEqual(await editionChecksum(tampered), data.edition.checksum);
});

test('validation REQUIRES an anchor, a claim, and a warrant on every edge', () => {
  const clone = JSON.parse(JSON.stringify(data));
  delete clone.edges[0].anchor;
  assert.ok(validateEdition(clone).some(e => e.includes('missing anchor')), 'anchorless edge must fail');
  const clone2 = JSON.parse(JSON.stringify(data));
  delete clone2.edges[0].claim;
  assert.ok(validateEdition(clone2).some(e => e.includes('missing claim')));
  const clone3 = JSON.parse(JSON.stringify(data));
  delete clone3.edges[0].warrant;
  assert.ok(validateEdition(clone3).some(e => e.includes('missing warrant')));
});

test('validation checks event key grade (not just divergence and stops)', () => {
  const clone = JSON.parse(JSON.stringify(data));
  const event = clone.nodes.find(n => n.type === 'event');
  event.key.grade = 'Z';
  assert.ok(validateEdition(clone).some(e => e.includes('key grade invalid')));
});

test('keyword matching is word-bounded: no crisis routing on substrings', () => {
  for (const q of ['skilled worker', 'billion dollars', 'will he come back',
                   'i studied all night', 'the hills are steep', 'kill the lights',
                   'he is fearless', 'a pillow fight']) {
    assert.equal(classifyQuery(data, q).kind, 'none', `"${q}" must not match a moment`);
  }
  assert.equal(classifyQuery(data, 'my mother is in the hospital').kind, 'moment');
  assert.equal(classifyQuery(data, 'i am afraid').kind, 'moment');
});

test('reference parser survives punctuation and malformed input', () => {
  assert.equal(parseRefQuery('John, 3. 16;'), 'john:3:16');
  assert.equal(parseRefQuery('MT 13!'), 'matthew:13');
  assert.equal(parseRefQuery(''), null);
  assert.equal(parseRefQuery('3 16'), null, 'numbers without a book are not a ref');
  assert.equal(getPassage(data, 'matthew:13:9-3'), null, 'reversed range is rejected');
});

test('partial ranges are admitted: complete=false, never silently whole', () => {
  const p = getPassage(data, 'matthew:13:50-99'); // beyond the chapter end
  assert.equal(p.complete, false);
  assert.equal(getPassage(data, 'mark:4:3-9').complete, true);
  assert.equal(getPassage(data, 'matthew:13:20-31').complete, true, 'whole chapters have no gaps now');
});

test('grade C exists and walks to a tradition node — hollow, sourced, no page to walk to', () => {
  const cEdge = edgeById(data, 'mt13-2-tradition-bay');
  assert.equal(cEdge.grade, 'C');
  const walked = walkEdge(data, cEdge.id);
  assert.equal(walked.kind, 'tradition');
  assert.ok(walked.node.text && walked.node.source);
});

test('multi-witness claims carry multi-warrants (one receipt per witness)', () => {
  const warrants = edgeWarrants(edgeById(data, 'mt13-3-witnesses-sower'));
  assert.deepEqual(warrants, ['mark:4:3', 'luke:8:5']);
});

test('formatRef renders human references', () => {
  assert.equal(formatRef(data, 'matthew:13:14'), 'Matthew 13:14');
  assert.equal(formatRef(data, 'mark:4:3-9'), 'Mark 4:3–9');
  assert.equal(formatRef(data, 'psalms:121'), 'Psalms 121');
  assert.equal(formatRef(data, 'event:sower'), 'The Sower');
});

test('missing refs get data-derived honesty, no canon-existence claims', () => {
  assert.match(missingRefExplanation(data, 'matthew:13:999'), /verse 999 is not on its page here\. Verses 1–58 are/);
  assert.match(missingRefExplanation(data, 'matthew:27'), /not in this edition slice yet/);
  assert.match(missingRefExplanation(data, 'matthew:99'), /has 28 chapters — there is no chapter 99/);
});

test('psalm superscriptions ship inside verse 1, exactly as the source prints them', () => {
  assert.match(getVerse(data, 'psalms', 121, 1), /^A Song of degrees\. I will lift up mine eyes/);
  assert.match(getVerse(data, 'psalms', 34, 1), /^A Psalm of David, when he changed his behaviour before Abimelech/);
  assert.equal(getPassage(data, 'psalms:121').title, null, 'no separate titles — the source folds them into v1');
});
