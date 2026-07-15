// Gate T for ADR-001/004/006 — structural integrity of the full-canon editions.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  validateEdition, getPassage, getVerse, edgesForVerse, walkEdge,
  parseRefQuery, classifyQuery, editionChecksum, GRADES,
  formatRef, missingRefExplanation, edgeWarrants, edgeById
} from '../lib/graph.mjs';

const data = JSON.parse(readFileSync(new URL('../data/edition-2-kjv.json', import.meta.url), 'utf8'));
const webData = JSON.parse(readFileSync(new URL('../data/edition-2-web.json', import.meta.url), 'utf8'));

// ---------- ADR-006: the whole canon, per edition ----------

test('both editions carry the whole canon: 66 books, 1,189 chapters, 31,102 verses', () => {
  for (const ed of [data, webData]) {
    assert.equal(ed.books.length, 66);
    let chapters = 0, verses = 0;
    for (const b of ed.books) {
      const chs = Object.keys(b.chapters).map(Number).filter(Number.isFinite);
      assert.equal(chs.length, b.chaptersTotal, `${ed.edition.translation} ${b.id}: chapter count`);
      chapters += chs.length;
      for (const vs of Object.values(b.chapters)) verses += Object.keys(vs).length;
    }
    assert.equal(chapters, 1189);
    assert.equal(verses, 31102);
  }
});

test('every chapter is contiguous from verse 1 (no silent holes)', () => {
  for (const ed of [data, webData]) {
    for (const b of ed.books) {
      for (const [ch, vs] of Object.entries(b.chapters)) {
        const nums = Object.keys(vs).map(Number).sort((a, b2) => a - b2);
        assert.equal(nums[0], 1, `${b.id} ${ch}`);
        assert.equal(nums[nums.length - 1], nums.length, `${b.id} ${ch}: contiguity`);
      }
    }
  }
});

test('provenance: each edition records the sha256 of its source PDF', () => {
  assert.match(data.edition.sourcePdf.sha256, /^[0-9a-f]{64}$/);
  assert.match(webData.edition.sourcePdf.sha256, /^[0-9a-f]{64}$/);
  assert.notEqual(data.edition.sourcePdf.sha256, webData.edition.sourcePdf.sha256);
  assert.equal(data.edition.sourcePdf.path, 'docs/00_bible/bible_kjv.pdf');
  assert.equal(webData.edition.sourcePdf.path, 'docs/00_bible/bible_web.pdf');
});

test('the two editions are genuinely different translations over the SAME graph', () => {
  assert.notEqual(getVerse(webData, 'matthew', 13, 3), getVerse(data, 'matthew', 13, 3));
  assert.match(getVerse(webData, 'john', 3, 16), /whoever believes/);
  assert.match(getVerse(data, 'john', 3, 16), /whosoever believeth/);
  assert.deepEqual(webData.edges, data.edges, 'graph identical in both editions');
  assert.deepEqual(webData.moments, data.moments);
});

test('WEB verse omissions are honest: numbered, empty, receipted — never faked', () => {
  for (const [b, c, v] of [['luke', 17, 36], ['acts', 8, 37], ['acts', 15, 34], ['acts', 24, 7]]) {
    assert.equal(webData.books.find(x => x.id === b).chapters[String(c)][String(v)], '', `web ${b} ${c}:${v}`);
    assert.ok(getVerse(data, b, c, v).length > 0, `kjv ${b} ${c}:${v} has text`);
  }
});

test('sample canon spot checks read as the KJV source', () => {
  assert.match(getVerse(data, 'genesis', 1, 1), /^In the beginning God created the heaven and the earth\./);
  assert.match(getVerse(data, 'john', 3, 17), /to condemn the world; but that the world through him/);
  assert.match(getVerse(data, '2peter', 3, 16), /as they do also the other scriptures/);
  assert.match(getVerse(data, 'revelation', 22, 21), /grace of our Lord Jesus Christ/i);
});

// ---------- the graph (unchanged from Edition 1, curator-review-pending) ----------

test('edition validates: every edge graded, warranted, anchored verbatim; all refs resolve', () => {
  assert.deepEqual(validateEdition(data), []);
});

test('every grade in the artifact is A, B, or C — explicitness, never truth', () => {
  for (const e of data.edges) assert.ok(GRADES.includes(e.grade), e.id);
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

test('grade C exists and walks to a tradition node — hollow, sourced, no page to walk to', () => {
  const walked = walkEdge(data, 'mt13-2-tradition-bay');
  assert.equal(walked.kind, 'tradition');
  assert.ok(walked.node.text && walked.node.source);
});

test('multi-witness claims carry multi-warrants (one receipt per witness)', () => {
  assert.deepEqual(edgeWarrants(edgeById(data, 'mt13-3-witnesses-sower')), ['mark:4:3', 'luke:8:5']);
});

// ---------- search over the whole canon (ADR-004) ----------

test('reference parser understands all 66 books', () => {
  assert.equal(parseRefQuery('gen 1 1'), 'genesis:1:1');
  assert.equal(parseRefQuery('song of solomon 2'), 'songofsolomon:2');
  assert.equal(parseRefQuery('1 chron 29'), '1chronicles:29');
  assert.equal(parseRefQuery('rev 22 21'), 'revelation:22:21');
  assert.equal(parseRefQuery('john 3 16'), 'john:3:16');
  assert.equal(parseRefQuery('3 jn 1 4'), '3john:1:4');
  assert.equal(parseRefQuery('my mother is in the hospital'), null);
});

test('one search box, three honest outcomes', () => {
  assert.equal(classifyQuery(data, 'gen 1').kind, 'ref');
  assert.equal(classifyQuery(data, 'my mother is in the hospital').kind, 'moment');
  assert.equal(classifyQuery(data, 'who wrote hebrews?').kind, 'question');
  assert.equal(classifyQuery(data, 'xyzzy plugh').kind, 'none');
  assert.equal(classifyQuery(data, 'mt 999').kind, 'ref-missing');
  assert.equal(classifyQuery(webData, 'rev 22 21').kind, 'ref', 'search works over the WEB edition');
});

test('keyword matching stays word-bounded across the whole canon', () => {
  for (const q of ['skilled worker', 'billion dollars', 'will he come back', 'the hills are steep']) {
    assert.equal(classifyQuery(data, q).kind, 'none', q);
  }
});

test('missing refs get data-derived honesty', () => {
  assert.match(missingRefExplanation(data, 'matthew:13:999'), /verse 999 is not on its page here\. Verses 1–58 are/);
  assert.match(missingRefExplanation(data, 'matthew:99'), /has 28 chapters — there is no chapter 99/);
  const mini = { books: [{ id: 'matthew', name: 'Matthew', order: 40, chaptersTotal: 28, chapters: { '13': { '1': 'x.' } } }], nodes: [], edges: [], moments: [], questions: [] };
  assert.match(missingRefExplanation(mini, 'matthew:27'), /not in this edition slice yet/, 'slice branch stays for future partial editions');
});

test('moment routes and question cites resolve in BOTH editions, with backstory', () => {
  for (const ed of [data, webData]) {
    const moment = classifyQuery(ed, 'my mother is in the hospital').moment;
    for (const r of moment.routes) { assert.ok(getPassage(ed, r.ref)); assert.ok(r.why); }
    const q = classifyQuery(ed, 'who wrote hebrews?').question;
    for (const c of q.cites) assert.ok(getPassage(ed, c));
  }
});

// ---------- mechanics ----------

test('passages resolve: verse, range, whole chapter; absent chapters return null', () => {
  assert.equal(getPassage(data, 'psalms:119').verses.length, 176);
  assert.equal(getPassage(data, 'mark:4:3-9').verses.length, 7);
  assert.equal(getPassage(data, 'matthew:29:1'), null, 'no chapter 29 — null, never fake text');
  assert.equal(getPassage(data, 'matthew:13:9-3'), null, 'reversed range rejected');
});

test('psalm superscriptions ship inside verse 1, exactly as each source prints them', () => {
  assert.match(getVerse(data, 'psalms', 121, 1), /^A Song of degrees\./);
  assert.match(getVerse(data, 'psalms', 34, 1), /Abimelech/);
  assert.ok(getVerse(webData, 'psalms', 121, 1).length > 0);
});

test('formatRef renders human references', () => {
  assert.equal(formatRef(data, 'matthew:13:14'), 'Matthew 13:14');
  assert.equal(formatRef(data, 'songofsolomon:2:1'), 'Song of Solomon 2:1');
  assert.equal(formatRef(data, 'event:sower'), 'The Sower');
});

test('each edition checksum matches its stamped manifest, and they differ', async () => {
  assert.equal(await editionChecksum(data), data.edition.checksum);
  assert.equal(await editionChecksum(webData), webData.edition.checksum);
  assert.notEqual(data.edition.checksum, webData.edition.checksum);
});

test('checksum detects tampering: one altered word changes the digest', async () => {
  const tampered = JSON.parse(JSON.stringify(data));
  tampered.books[0].chapters['1']['1'] = tampered.books[0].chapters['1']['1'].replace('beginning', 'start');
  assert.notEqual(await editionChecksum(tampered), data.edition.checksum);
});

test('validation REQUIRES anchor, claim, warrant on every edge; key grades checked', () => {
  const clone = JSON.parse(JSON.stringify(data));
  delete clone.edges[0].anchor;
  assert.ok(validateEdition(clone).some(e => e.includes('missing anchor')));
  const clone2 = JSON.parse(JSON.stringify(data));
  clone2.nodes.find(n => n.type === 'event').key.grade = 'Z';
  assert.ok(validateEdition(clone2).some(e => e.includes('key grade invalid')));
});
