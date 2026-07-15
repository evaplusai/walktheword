// Walk the Word — pure rendering helpers (ADR-002 §3).
// Scripture text is escaped verbatim; door markup wraps phrases, never rewrites them.
import { edgesForVerse } from './graph.mjs';

export function escapeHtml(s) {
  return String(s)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
}

// One verse → HTML with its doors. Grade shape lives in CSS (A solid / B dotted / C dashed).
// The whole verse is a tap target for the universal verse card (ADR-008); doors inside it
// take priority. When a door's anchor phrase is absent from the displayed text (another
// translation's wording), the VERSE NUMBER carries the door — same grade vocabulary.
export function verseHTML(data, bookId, chapter, verse, text) {
  let html = escapeHtml(text);
  const numberDoors = [];
  for (const edge of edgesForVerse(data, bookId, chapter, verse)) {
    const phrase = escapeHtml(edge.anchor.phrase);
    if (html.includes(phrase)) {
      html = html.replace(
        phrase,
        `<a class="cx2 ${edge.grade}" data-edge="${escapeHtml(edge.id)}" role="button" tabindex="0">${phrase}</a>`
      );
    } else {
      numberDoors.push(edge);
    }
  }
  const vnum = numberDoors.length
    ? `<a class="cx2 ${numberDoors[0].grade}" data-edge="${escapeHtml(numberDoors[0].id)}" role="button" tabindex="0"><span class="v">${verse}</span></a>`
    : `<span class="v">${verse}</span>`;
  return `<span class="vs" data-verse="${bookId}:${chapter}:${verse}">${vnum}${html}</span> `;
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
    let body = verseHTML(data, bookId, chapter, v, ch[String(v)]);
    if (highlightVerse === v) body = body.replace('class="vs"', 'class="vs land"');
    out += body;
    prev = v;
  }
  return out;
}
