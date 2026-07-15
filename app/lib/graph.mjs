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

// Resolve a ref to { book, chapter, verses: [{v, t}] } or null if absent from the edition.
export function getPassage(data, ref) {
  const p = parseRef(ref);
  if (!p) return null;
  const book = getBook(data, p.book);
  if (!book) return null;
  const ch = book.chapters[String(p.chapter)];
  if (!ch) return null;
  const nums = Object.keys(ch).map(Number).sort((a, b) => a - b);
  const start = p.verseStart == null ? nums[0] : p.verseStart;
  const end = p.verseStart == null ? nums[nums.length - 1] : p.verseEnd;
  const verses = nums
    .filter(v => v >= start && v <= end)
    .map(v => ({ v, t: ch[String(v)] }));
  if (p.verseStart != null && verses.length === 0) return null;
  return { book: book.id, bookName: book.name, chapter: p.chapter, verses };
}

// True when a ref (verse, range, chapter) or node id resolves inside this edition.
export function resolves(data, refOrId) {
  if (refOrId.includes(':') && !parseRef(refOrId)) {
    return nodeById(data, refOrId) !== null;
  }
  if (nodeById(data, refOrId)) return true;
  const passage = getPassage(data, refOrId);
  return passage !== null && passage.verses.length > 0;
}

// Edges anchored on a specific verse.
export function edgesForVerse(data, bookId, chapter, verse) {
  const ref = `${bookId}:${chapter}:${verse}`;
  return data.edges.filter(e => e.anchor && e.anchor.ref === ref);
}

// Walk an edge: returns its destination as a passage or node.
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
  const norm = q.trim().toLowerCase().replace(/[.,;]/g, ' ').replace(/\s+/g, ' ');
  const m = /^([1-3]?\s?[a-z]+)\s*(\d+)?(?:[\s:]+(\d+))?$/.exec(norm);
  if (!m) return null;
  const rawBook = m[1].replace(/\s+/g, '');
  let bookId = null;
  for (const [id, aliases] of Object.entries(BOOK_ALIASES)) {
    if (aliases.some(a => a.replace(/\s+/g, '') === rawBook)) { bookId = id; break; }
  }
  if (!bookId || !m[2]) return null;
  return m[3] ? `${bookId}:${m[2]}:${m[3]}` : `${bookId}:${m[2]}`;
}

export function matchMoment(data, q) {
  const norm = ` ${q.trim().toLowerCase()} `;
  for (const moment of data.moments) {
    if (moment.keywords.some(k => norm.includes(k.toLowerCase()))) return moment;
  }
  return null;
}

export function matchQuestion(data, q) {
  const norm = q.trim().toLowerCase();
  for (const question of data.questions) {
    if (question.keywords.some(k => norm.includes(k.toLowerCase()))) return question;
  }
  return null;
}

// One box, three honest outcomes: ref jump, moment routes, cited answer — else none.
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

// ---------- integrity (ADR-001) ----------

export function validateEdition(data) {
  const errors = [];
  const seenEdges = new Set();
  for (const edge of data.edges) {
    if (seenEdges.has(edge.id)) errors.push(`duplicate edge id ${edge.id}`);
    seenEdges.add(edge.id);
    if (!GRADES.includes(edge.grade)) errors.push(`edge ${edge.id}: bad grade "${edge.grade}"`);
    if (!edge.warrant) errors.push(`edge ${edge.id}: missing warrant`);
    else if (!resolves(data, edge.warrant)) errors.push(`edge ${edge.id}: warrant ${edge.warrant} does not resolve`);
    if (!resolves(data, edge.from)) errors.push(`edge ${edge.id}: from ${edge.from} does not resolve`);
    if (!resolves(data, edge.to)) errors.push(`edge ${edge.id}: to ${edge.to} does not resolve`);
    if (!edge.claim) errors.push(`edge ${edge.id}: missing claim`);
    if (edge.anchor) {
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
      }
      if (node.divergence && !GRADES.includes(node.divergence.grade)) {
        errors.push(`event ${node.id}: divergence grade invalid`);
      }
      if (node.divergence && !resolves(data, node.divergence.ref)) {
        errors.push(`event ${node.id}: divergence ref does not resolve`);
      }
      if (node.key && !resolves(data, node.key.ref)) {
        errors.push(`event ${node.id}: key ref does not resolve`);
      }
    }
    if (node.type === 'thread') {
      for (const stop of node.stops) {
        if (!GRADES.includes(stop.grade)) errors.push(`thread ${node.id}: stop ${stop.ref} bad grade`);
        if (!resolves(data, stop.ref)) errors.push(`thread ${node.id}: stop ${stop.ref} does not resolve`);
      }
    }
  }
  for (const moment of data.moments) {
    for (const route of moment.routes) {
      if (!resolves(data, route.ref)) errors.push(`moment ${moment.id}: route ${route.ref} does not resolve`);
      if (!route.why) errors.push(`moment ${moment.id}: route ${route.ref} missing backstory`);
    }
  }
  for (const question of data.questions) {
    for (const cite of question.cites) {
      if (!resolves(data, cite)) errors.push(`question ${question.id}: cite ${cite} does not resolve`);
    }
    if (!question.honest) errors.push(`question ${question.id}: missing honest line`);
  }
  return errors;
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

// digestHex: async sha-256 that works in Node (node:crypto) and browsers (crypto.subtle).
export async function editionChecksum(data) {
  const payload = canonicalPayload(data);
  if (typeof window === 'undefined' || !globalThis.crypto?.subtle) {
    const { createHash } = await import('node:crypto');
    return 'sha256-' + createHash('sha256').update(payload, 'utf8').digest('hex');
  }
  const bytes = new TextEncoder().encode(payload);
  const digest = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return 'sha256-' + [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}
