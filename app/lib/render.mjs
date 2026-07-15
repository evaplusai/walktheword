// Walk the Word — pure rendering helpers (ADR-002 §3).
// Scripture text is escaped verbatim; door markup wraps phrases, never rewrites them.
import { edgesForVerse } from './graph.mjs';

export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// One verse → HTML with its doors. Grade shape lives in CSS (A solid / B dotted / C dashed).
export function verseHTML(data, bookId, chapter, verse, text) {
  let html = escapeHtml(text);
  for (const edge of edgesForVerse(data, bookId, chapter, verse)) {
    const phrase = escapeHtml(edge.anchor.phrase);
    if (html.includes(phrase)) {
      html = html.replace(
        phrase,
        `<a class="cx2 ${edge.grade}" data-edge="${escapeHtml(edge.id)}" role="button" tabindex="0">${phrase}</a>`
      );
    }
  }
  return `<span class="v">${verse}</span>${html} `;
}

// A whole chapter, in order, with an optional highlighted landing verse.
// Superscriptions (psalm titles) render first — they are ancient testimony, kept visibly
// distinct from the verse text (PRD §4.5, §6.3).
export function chapterHTML(data, bookId, chapter, highlightVerse = null) {
  const book = data.books.find(b => b.id === bookId);
  const ch = book && book.chapters[String(chapter)];
  if (!ch) return '';
  const nums = Object.keys(ch).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const title = book.titles && book.titles[String(chapter)];
  let out = title ? `<span class="super">${escapeHtml(title)}</span>` : '';
  let prev = null;
  for (const v of nums) {
    if (prev !== null && v !== prev + 1) {
      out += `<span class="gap">· · · verses ${prev + 1}–${v - 1} not in this edition slice · · ·</span>`;
    }
    const body = verseHTML(data, bookId, chapter, v, ch[String(v)]);
    out += highlightVerse === v ? `<span class="land">${body}</span>` : body;
    prev = v;
  }
  return out;
}
