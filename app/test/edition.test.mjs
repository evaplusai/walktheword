// Gate T for ADR-001/004 — structural integrity of the edition + search classification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateEdition, getPassage, getVerse, edgesForVerse, walkEdge,
  parseRefQuery, classifyQuery, editionChecksum, GRADES
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
