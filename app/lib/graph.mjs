// Walk the Word — edition graph access (ADR-001)
// Pure functions over the edition artifact. No dependencies, runs in browser and Node.

export const GRADES = ['A', 'B', 'C'];

const BOOK_ALIASES = {
  matthew: ['matthew', 'matt', 'mt'],
  mark: ['mark', 'mk', 'mr'],
  luke: ['luke', 'lk', 'lu'],
  john: ['john', 'jn', 'joh'],
  psalms: ['psalms', 'psalm', 'ps', 'psa'],
  isaiah: ['isaiah', 'isa', 'is'],
  galatians: ['galatians', 'gal'],
  hebrews: ['hebrews', 'heb'],
  '1peter': ['1peter', '1 peter', '1pet', '1 pet', '1pe'],
  '2peter': ['2peter', '2 peter', '2pet', '2 pet', '2pe']
};

// ---------- lookup ----------

export function getBook(data, bookId) {
  return data.books.find(b => b.id === bookId) || null;
}

export function getVerse(data, bookId, chapter, verse) {
  const book = getBook(data, bookId);
  const ch = book && book.chapters[String(chapter)];
  return (ch && ch[String(verse)]) || null;
}

export function nodeById(data, id) {
  return data.nodes.find(n => n.id === id) || null;
}

export function edgeById(data, id) {
  return data.edges.find(e => e.id === id) || null;
}

export function chapterVerseNums(book, chapter) {
  const ch = book.chapters[String(chapter)];
  if (!ch) return [];
  return Object.keys(ch).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
}

// A ref is "book:ch", "book:ch:v", or "book:ch:v1-v2".
export function parseRef(ref) {
  const m = /^([a-z0-9]+):(\d+)(?::(\d+)(?:-(\d+))?)?$/.exec(ref);
  if (!m) return null;
  return {
    book: m[1],
    chapter: Number(m[2]),
    verseStart: m[3] ? Number(m[3]) : null,
    verseEnd: m[4] ? Number(m[4]) : (m[3] ? Number(m[3]) : null)
  };
}

// Resolve a ref to { book, bookName, chapter, verses, complete, title } or null.
// `complete` is false when an explicit range is only partially covered by the edition —
// callers must show gaps honestly, never present a partial range as whole (ADR-001).
export function getPassage(data, ref) {
  const p = parseRef(ref);
  if (!p) return null;
  const book = getBook(data, p.book);
  if (!book) return null;
  const nums = chapterVerseNums(book, p.chapter);
  if (!nums.length) return null;
  const start = p.verseStart == null ? nums[0] : p.verseStart;
  const end = p.verseStart == null ? nums[nums.length - 1] : p.verseEnd;
  if (end < start) return null;
  const ch = book.chapters[String(p.chapter)];
  const verses = nums.filter(v => v >= start && v <= end).map(v => ({ v, t: ch[String(v)] }));
  if (p.verseStart != null && verses.length === 0) return null;
  const complete = p.verseStart == null
    ? true
    : verses.length === (end - start + 1);
  return {
    book: book.id,
    bookName: book.name,
    chapter: p.chapter,
    verses,
    complete,
    title: (book.titles && book.titles[String(p.chapter)]) || null
  };
}

// True when a ref (verse, range, chapter) or node id resolves inside this edition.
export function resolves(data, refOrId) {
  if (nodeById(data, refOrId)) return true;
  const passage = getPassage(data, refOrId);
  return passage !== null && passage.verses.length > 0;
}

// "matthew:13:14" → "Matthew 13:14" · "mark:4:3-9" → "Mark 4:3–9" · node id → node name.
export function formatRef(data, refOrId) {
  const node = nodeById(data, refOrId);
  if (node) return node.name;
  const p = parseRef(refOrId);
  if (!p) return refOrId;
  const book = getBook(data, p.book);
  const name = book ? book.name : p.book;
  if (p.verseStart == null) return `${name} ${p.chapter}`;
  return p.verseEnd !== p.verseStart
    ? `${name} ${p.chapter}:${p.verseStart}–${p.verseEnd}`
    : `${name} ${p.chapter}:${p.verseStart}`;
}

// Edges anchored on a specific verse.
export function edgesForVerse(data, bookId, chapter, verse) {
  const ref = `${bookId}:${chapter}:${verse}`;
  return data.edges.filter(e => e.anchor && e.anchor.ref === ref);
}

// Every edge's warrant, normalized to a non-empty array of refs.
export function edgeWarrants(edge) {
  return edge.warrant == null ? [] : [].concat(edge.warrant);
}

// Walk an edge: returns its destination as a passage or node (event/thread/tradition).
export function walkEdge(data, edgeId) {
  const edge = edgeById(data, edgeId);
  if (!edge) return null;
  const node = nodeById(data, edge.to);
  if (node) return { kind: node.type, node, edge };
  const passage = getPassage(data, edge.to);
  return passage ? { kind: 'passage', passage, edge } : null;
}

// ---------- search classification (ADR-004) ----------

export function parseRefQuery(q) {
  const norm = q.trim().toLowerCase()
    .replace(/[.,;:!?]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const m = /^([1-3]? ?[a-z]+) (\d+)(?: (\d+))?$/.exec(norm);
  if (!m) return null;
  const rawBook = m[1].replace(/\s+/g, '');
  let bookId = null;
  for (const [id, aliases] of Object.entries(BOOK_ALIASES)) {
    if (aliases.some(a => a.replace(/\s+/g, '') === rawBook)) { bookId = id; break; }
  }
  if (!bookId) return null;
  return m[3] ? `${bookId}:${m[2]}:${m[3]}` : `${bookId}:${m[2]}`;
}

// Word-boundary keyword match: "ill" must NOT fire inside "hills", "died" not in "studied".
function hasKeyword(text, phrase) {
  const esc = phrase.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${esc}([^a-z0-9]|$)`).test(text);
}

export function matchMoment(data, q) {
  const norm = q.trim().toLowerCase();
  for (const moment of data.moments) {
    if (moment.keywords.some(k => hasKeyword(norm, k))) return moment;
  }
  return null;
}

export function matchQuestion(data, q) {
  const norm = q.trim().toLowerCase();
  for (const question of data.questions) {
    if (question.keywords.some(k => hasKeyword(norm, k))) return question;
  }
  return null;
}

// One box, three honest outcomes: ref jump, cited answer, moment routes — else none.
export function classifyQuery(data, q) {
  if (!q || !q.trim()) return { kind: 'none' };
  const ref = parseRefQuery(q);
  if (ref && resolves(data, ref)) return { kind: 'ref', ref };
  const question = matchQuestion(data, q);
  if (question) return { kind: 'question', question };
  const moment = matchMoment(data, q);
  if (moment) return { kind: 'moment', moment };
  if (ref) return { kind: 'ref-missing', ref };
  return { kind: 'none' };
}

// Compress verse numbers to a human range list: [1,2,3,7,9,10] → "1–3, 7, 9–10".
function verseRanges(nums) {
  const parts = [];
  let start = nums[0], prev = nums[0];
  for (const n of nums.slice(1).concat([Infinity])) {
    if (n !== prev + 1) {
      parts.push(start === prev ? String(start) : `${start}–${prev}`);
      start = n;
    }
    prev = n;
  }
  return parts.join(', ');
}

// Honest, data-derived explanation for a ref this edition cannot show.
// Never claims canon existence beyond what the artifact itself records (ADR-004 §1).
export function missingRefExplanation(data, ref) {
  const p = parseRef(ref);
  const book = p && getBook(data, p.book);
  if (!book) return 'No book by that name is in this edition.';
  const nums = chapterVerseNums(book, p.chapter);
  if (nums.length && p.verseStart != null) {
    return `${book.name} ${p.chapter} is in this edition, but verse ${p.verseStart} is not on its page here. Verses ${verseRanges(nums)} are.`;
  }
  if (p.chapter >= 1 && p.chapter <= book.chaptersTotal) {
    const carried = Object.keys(book.chapters).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    return `${book.name} ${p.chapter} is not in this edition slice yet. This edition carries ${book.name} ${carried.join(', ')}. The map grows edition by edition; the text never changes.`;
  }
  return `${book.name} has ${book.chaptersTotal} chapters — there is no chapter ${p.chapter}.`;
}

// ---------- integrity (ADR-001) ----------

export function validateEdition(data) {
  const errors = [];
  const seenEdges = new Set();
  for (const edge of data.edges) {
    if (seenEdges.has(edge.id)) errors.push(`duplicate edge id ${edge.id}`);
    seenEdges.add(edge.id);
    if (!GRADES.includes(edge.grade)) errors.push(`edge ${edge.id}: bad grade "${edge.grade}"`);
    const warrants = edgeWarrants(edge);
    if (!warrants.length) errors.push(`edge ${edge.id}: missing warrant`);
    for (const w of warrants) {
      if (!resolves(data, w)) errors.push(`edge ${edge.id}: warrant ${w} does not resolve`);
    }
    if (!resolves(data, edge.from)) errors.push(`edge ${edge.id}: from ${edge.from} does not resolve`);
    if (!resolves(data, edge.to)) errors.push(`edge ${edge.id}: to ${edge.to} does not resolve`);
    if (!edge.claim) errors.push(`edge ${edge.id}: missing claim`);
    if (!edge.anchor || !edge.anchor.ref || !edge.anchor.phrase) {
      errors.push(`edge ${edge.id}: missing anchor — every edge is a door (ADR-001 §2)`);
    } else {
      const p = parseRef(edge.anchor.ref);
      const text = p && getVerse(data, p.book, p.chapter, p.verseStart);
      if (!text) errors.push(`edge ${edge.id}: anchor ref ${edge.anchor.ref} does not resolve`);
      else if (!text.includes(edge.anchor.phrase)) {
        errors.push(`edge ${edge.id}: anchor phrase not verbatim in ${edge.anchor.ref}`);
      }
    }
  }
  for (const node of data.nodes) {
    if (node.type === 'event') {
      for (const w of node.witnesses) {
        if (!resolves(data, w.ref)) errors.push(`event ${node.id}: witness ${w.ref} does not resolve`);
        else if (getPassage(data, w.ref).complete === false) {
          errors.push(`event ${node.id}: witness ${w.ref} range only partially covered`);
        }
      }
      if (node.divergence) {
        if (!GRADES.includes(node.divergence.grade)) errors.push(`event ${node.id}: divergence grade invalid`);
        if (!resolves(data, node.divergence.ref)) errors.push(`event ${node.id}: divergence ref does not resolve`);
      }
      if (node.key) {
        if (!GRADES.includes(node.key.grade)) errors.push(`event ${node.id}: key grade invalid`);
        if (!resolves(data, node.key.ref)) errors.push(`event ${node.id}: key ref does not resolve`);
      }
    }
    if (node.type === 'thread') {
      for (const stop of node.stops) {
        if (!GRADES.includes(stop.grade)) errors.push(`thread ${node.id}: stop ${stop.ref} bad grade`);
        if (!resolves(data, stop.ref)) errors.push(`thread ${node.id}: stop ${stop.ref} does not resolve`);
      }
    }
    if (node.type === 'tradition') {
      if (!node.text) errors.push(`tradition ${node.id}: missing text`);
      if (!node.source) errors.push(`tradition ${node.id}: missing source label`);
    }
  }
  for (const moment of data.moments) {
    if (!moment.keywords || !moment.keywords.length) errors.push(`moment ${moment.id}: no keywords`);
    for (const route of moment.routes) {
      if (!resolves(data, route.ref)) errors.push(`moment ${moment.id}: route ${route.ref} does not resolve`);
      else if (getPassage(data, route.ref).complete === false) {
        errors.push(`moment ${moment.id}: route ${route.ref} range only partially covered`);
      }
      if (!route.why) errors.push(`moment ${moment.id}: route ${route.ref} missing backstory`);
    }
  }
  for (const question of data.questions) {
    for (const cite of question.cites) {
      if (!resolves(data, cite)) errors.push(`question ${question.id}: cite ${cite} does not resolve`);
      else if (getPassage(data, cite).complete === false) {
        errors.push(`question ${question.id}: cite ${cite} range only partially covered`);
      }
    }
    if (!question.honest) errors.push(`question ${question.id}: missing honest line`);
  }
  return errors;
}

// ---------- translations (ADR-005 §3) ----------

// A translation is a display layer over the unchanged graph (PRD §7): same books,
// same edges, same grades — only the verse text swaps.
export function applyTranslation(edition, overlayBooks, translationLabel) {
  const clone = JSON.parse(JSON.stringify(edition));
  for (const book of clone.books) {
    if (overlayBooks[book.id]) book.chapters = overlayBooks[book.id];
  }
  clone.edition.translation = translationLabel;
  return clone;
}

// ---------- checksum (ADR-001 §3) ----------

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map(k => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

export function canonicalPayload(data) {
  const clone = JSON.parse(JSON.stringify(data));
  delete clone.edition.checksum;
  return stableStringify(clone);
}

// sha-256 in Node (node:crypto) and browsers (crypto.subtle). In a browser without a
// secure context, throws a clear error — the caller must tell the skeptic honestly.
export async function editionChecksum(data) {
  const payload = canonicalPayload(data);
  const isBrowser = typeof window !== 'undefined';
  if (!isBrowser) {
    const { createHash } = await import('node:crypto');
    return 'sha256-' + createHash('sha256').update(payload, 'utf8').digest('hex');
  }
  if (!globalThis.crypto?.subtle) {
    throw new Error('Verification needs a secure context (https or localhost).');
  }
  const bytes = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256-' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
