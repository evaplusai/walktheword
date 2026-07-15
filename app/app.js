// Walk the Word — app controller (ADR-002/003/004).
// Everything rendered here is edition data, verbatim. Nothing is composed at runtime.
import {
  getBook, getPassage, nodeById, edgeById, walkEdge, classifyQuery,
  validateEdition, editionChecksum, formatRef, missingRefExplanation,
  edgeWarrants, parseRef, applyTranslation
} from './lib/graph.mjs';
import { escapeHtml, chapterHTML } from './lib/render.mjs';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const GRADE_HELP = {
  A: 'Grade A — Stated. The text says this connection in words (a quotation, a superscription, a named presence). A solid line.',
  B: 'Grade B — Textual, unstated. The books share it without saying so (parallel accounts, shared details). A dotted line.',
  C: 'Grade C — Tradition. From outside the text; the canon itself is silent. Always hollow, always dashed.'
};

// ---------- on-device state (ADR-001 §5) ----------
const store = {
  read(key, fallback, s = localStorage) {
    try { return JSON.parse(s.getItem(key)) ?? fallback; } catch { return fallback; }
  },
  write(key, value, s = localStorage) {
    try { s.setItem(key, JSON.stringify(value)); } catch { /* private mode: session-only */ }
  }
};

let edition = null;   // the verified KJV artifact (the graph's substrate)
let overlay = null;    // WEB display layer
let data = null;       // active dataset (edition, or edition with WEB text applied)
let translation = store.read('wtw.translation', null); // 'kjv' | 'web' | null = not chosen
let screen = { type: 'start' };                         // current screen state
let returnTo = null;                                    // {label, screen}
let trail = store.read('wtw.trail', [], sessionStorage);

// ADR-005 §3: a translation is a display layer over the unchanged graph.
function setTranslation(tr) {
  if (tr === 'web' && !overlay) { toast('The WEB layer failed to load — reading the KJV artifact.'); tr = 'kjv'; }
  translation = tr;
  store.write('wtw.translation', tr);
  data = tr === 'web' ? applyTranslation(edition, overlay.books, overlay.translation) : edition;
}

// Short label of the ACTIVE translation — cards must never mislabel WEB text as KJV.
function trLabel() { return translation === 'web' ? 'WEB' : 'KJV'; }

// Most recently read position — by timestamp, not key order (a re-read book keeps its
// original key position in the object, so at(-1) lies about recency).
function lastContinue() {
  const continues = store.read('wtw.continue', {});
  let best = null;
  for (const [book, pos] of Object.entries(continues)) {
    if (!best || (pos.t || 0) > best.pos.t) best = { book, pos: { t: 0, ...pos } };
  }
  return best;
}
function saveContinue(book, chapter, land) {
  const continues = store.read('wtw.continue', {});
  continues[book] = { chapter, land, t: Date.now() };
  store.write('wtw.continue', continues);
}

// ---------- chrome ----------
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3600);
}

let sheetReturnFocus = null;
function closeSheets() {
  const wasOpen = $$('.sheet2.open').length > 0;
  $$('.sheet2').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('on');
  if (wasOpen && sheetReturnFocus && document.contains(sheetReturnFocus)) {
    sheetReturnFocus.focus();
  }
  sheetReturnFocus = null;
}
function openSheet(id) {
  closeSheets();
  sheetReturnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const sheet = $('#' + id);
  sheet.classList.add('open');
  $('#scrim').classList.add('on');
  sheet.focus();
}
// Keep Tab inside an open sheet (simple containment for the role="dialog" sheets).
function containSheetTab(e) {
  const sheet = $('.sheet2.open');
  if (!sheet || e.key !== 'Tab') return;
  const focusables = $$('button, [tabindex="0"], input, [href]', sheet)
    .filter(el => el.offsetParent !== null);
  if (!focusables.length) return;
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet)) {
    e.preventDefault(); last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault(); first.focus();
  }
}

function setBar(book, loc) { $('#barBook').innerHTML = book; $('#barLoc').textContent = loc; }
function setShelf(tab) {
  $$('.shelf .nv').forEach(n => n.classList.toggle('on', n.dataset.nav === tab));
}
function renderReturnChip() {
  $('#retslot').innerHTML = returnTo
    ? `<span class="retchip" id="retchip">← ${escapeHtml(returnTo.label)} <span class="mono">1 tap back</span></span>`
    : '';
  const chip = $('#retchip');
  if (chip) chip.onclick = () => { const to = returnTo.screen; returnTo = null; showScreen(to); };
}
function updateTrailCount() {
  $('#trailCount').textContent = trail.length ? '· ' + trail.length : '';
}

// ---------- trail (ADR-003 §3) ----------
function pushStep(title, ref, grade, toScreen) {
  trail.push({ title, ref, grade: grade || '', to: toScreen, at: new Date().toISOString().slice(0, 10) });
  store.write('wtw.trail', trail, sessionStorage);
  updateTrailCount();
}

// ---------- screens ----------
function showScreen(s) {
  // Guard before mutating state: never point the app at a screen that can't render.
  if (s.type === 'reading') {
    const book = getBook(data, s.book);
    if (!book || !book.chapters[String(s.chapter)]) {
      toast('That chapter is not in this edition slice.');
      return;
    }
  }
  screen = s;
  closeSheets();
  if (s.type === 'reading') return renderReading(s.book, s.chapter, s.land ?? null);
  if (s.type === 'event') return renderEvent(s.node, s.tab ?? 0, s.compare ?? false);
  if (s.type === 'thread') return renderThread(s.node);
  if (s.type === 'search') return renderSearch(s.q ?? '');
  if (s.type === 'notes') return renderNotes();
  if (s.type === 'teach') return renderTeach();
  if (s.type === 'start') return renderStart();
}

function screenLabel(s) {
  if (s.type === 'start') return 'Choosing where to begin';
  if (s.type === 'reading') {
    const b = getBook(data, s.book);
    return `${b ? b.name : s.book} ${s.chapter}${s.land ? ':' + s.land : ''}`;
  }
  if (s.type === 'event') return nodeById(data, s.node).name + ' (event)';
  if (s.type === 'thread') return nodeById(data, s.node).name + ' (thread)';
  return s.type[0].toUpperCase() + s.type.slice(1);
}

// -- first open (ADR-002 §5)
function renderTeach() {
  setBar('Before you walk', '30 seconds · once');
  setShelf('');
  renderReturnChip();
  $('#view').innerHTML = `
    <p class="bigprompt">Underlined phrases are doors.<br>The line tells you what kind.</p>
    <div class="teach"><div class="row"><span class="chip A" data-grade="A">A</span><h6>Stated</h6></div>
      <p>The text says it in words. <span class="ex">“…the prophecy of Esaias, which saith” —
      Matthew names Isaiah.</span> A <b>solid</b> line.</p></div>
    <div class="teach"><div class="row"><span class="chip B" data-grade="B">B</span><h6>Textual, unstated</h6></div>
      <p>The books share it without saying so. <span class="ex">Matthew, Mark and Luke all tell
      the sower.</span> A <b>dotted</b> line.</p></div>
    <div class="teach"><div class="row"><span class="chip C" data-grade="C">C</span><h6>Tradition</h6></div>
      <p>Outside the text — always hollow. <span class="ex">Peter’s death in Rome — the canon
      itself is silent.</span> A <b>dashed</b> line.</p></div>
    <p class="quiet" style="margin:2px 0 14px">A grade measures how explicit a connection is —
    never whether it is true.</p>
    <button class="btn walk" id="startBtn">Choose where to begin →</button>
    <p class="skipline" id="skipBtn">Skip — every chip re-explains itself when tapped</p>`;
  const start = () => {
    store.write('wtw.taught', 1);
    showScreen({ type: 'start' }); // no preloaded content — the reader chooses (ADR-005)
  };
  $('#startBtn').onclick = start;
  $('#skipBtn').onclick = start;
}

// -- start screen (ADR-005): what this edition carries; the reader chooses everything.
function renderStart() {
  setBar('Walk the Word', `Edition ${data ? data.edition.number : 1} · choose where to begin`);
  setShelf('books');
  renderReturnChip();
  const included = book => Object.keys(book.chapters).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
  const bookRow = book => `
    <div class="startbook">
      <div class="row"><h6>${escapeHtml(book.name)}</h6>
        <span class="quietcap">${included(book).length} of ${book.chaptersTotal} chapter${book.chaptersTotal > 1 ? 's' : ''} in this slice</span></div>
      <div class="bgrid">${included(book).map(c =>
        `<button class="bk" data-chapter="${book.id}:${c}">${c}</button>`).join('')}</div>
    </div>`;
  const ot = data.books.filter(b => b.order < 40).sort((a, b) => a.order - b.order);
  const nt = data.books.filter(b => b.order >= 40).sort((a, b) => a.order - b.order);
  $('#view').innerHTML = `
    <p class="bigprompt">Choose your translation,<br>then open any page.</p>
    <div class="trrow">
      <button class="trcard ${translation === 'kjv' ? 'on' : ''}" data-tr="kjv">
        <b>KJV</b><span>King James Version · public domain · carries the connection doors</span></button>
      ${overlay ? `<button class="trcard ${translation === 'web' ? 'on' : ''}" data-tr="web">
        <b>WEB</b><span>World English Bible · public domain · display layer over the same map</span></button>`
      : '<p class="quiet" style="flex:1;align-self:center">WEB layer unavailable this session — the KJV edition reads fully.</p>'}
    </div>
    ${translation ? `
      <p class="seccap">Old Testament</p>${ot.map(bookRow).join('')}
      <p class="seccap">New Testament</p>${nt.map(bookRow).join('')}
      <p class="quiet" style="margin-top:14px">Edition ${data.edition.number} is one deep slice, complete
      in itself. Later editions grow the map — the text never changes.</p>`
    : '<p class="quiet">Pick a translation to see what this edition carries.</p>'}`;
  $$('#view [data-tr]').forEach(el => el.onclick = () => {
    setTranslation(el.dataset.tr);
    renderStart();
    $(`#view [data-tr="${translation}"]`)?.focus(); // keep keyboard focus on the chosen card
  });
  $$('#view [data-chapter]').forEach(el => el.onclick = () => {
    const [book, chapter] = el.dataset.chapter.split(':');
    showScreen({ type: 'reading', book, chapter: Number(chapter) });
  });
}

// -- reading (ADR-002 §3)
function renderReading(bookId, chapter, land = null) {
  // ADR-005 §1: power paths that bypass the start screen adopt KJV, persist, announce.
  if (!translation) {
    setTranslation('kjv');
    toast('Reading the KJV — the edition’s substrate. Switch to WEB anytime in Books.');
  }
  const book = getBook(data, bookId);
  setBar(`${escapeHtml(book.name)}<span class="caret">⌄</span>`, `Ch ${chapter}`);
  setShelf('books');
  renderReturnChip();
  $('#view').innerHTML = `<p class="scripture">${chapterHTML(data, bookId, chapter, land)}</p>` +
    (translation === 'web' ? `<p class="quiet" style="margin-top:18px">WEB is a display layer over the
      same map (PRD §7). Edition 1's connection doors are anchored in the KJV wording —
      switch to KJV in Books to walk them.</p>` : '') +
    (book.partial ? `<p class="quiet" style="margin-top:18px">Edition 1 slice — ${escapeHtml(book.name)} grows in later editions. The scripture text itself never changes; only the map around it.</p>` : '');
  saveContinue(bookId, chapter, land);
  if (land) $('.land')?.scrollIntoView({ block: 'center' });
  else $('#view').scrollTop = 0;
}

// -- connection card (ADR-003 §1): grade → verbatim target → warrant receipt → one verb.
// The target quote is ALWAYS the scripture's own words — never composed copy.
function passageQuoteHTML(p) {
  // All verses, gaps admitted; long targets truncate with an honest count.
  const MAX = 4;
  const shown = p.verses.slice(0, MAX);
  let quote = '';
  let prev = null;
  for (const v of shown) {
    if (prev !== null && v.v !== prev + 1) quote += ' · · · ';
    quote += escapeHtml(v.t) + ' ';
    prev = v.v;
  }
  const rest = p.verses.length - shown.length;
  return `<div class="target"><div class="ref">${escapeHtml(formatRef(data, `${p.book}:${p.chapter}:${p.verses[0].v}${p.verses.length > 1 ? '-' + p.verses[p.verses.length - 1].v : ''}`))} · ${trLabel()}${p.complete === false ? ' · partially in this edition' : ''}</div>
    <p>${quote.trim()}${rest > 0 ? ` <span class="quiet">… ${rest} more verse${rest > 1 ? 's' : ''} on the page.</span>` : ''}</p></div>`;
}

function openCard(edgeId) {
  const edge = edgeById(data, edgeId);
  const walked = edge && walkEdge(data, edgeId);
  if (!walked) { toast('This door does not resolve in this edition — report it via Corrections.'); return; }
  let targetHTML = '';
  let walkLabel = 'Walk →';
  let walkable = true;
  if (walked.kind === 'passage') {
    targetHTML = passageQuoteHTML(walked.passage);
    walkLabel = `Walk to ${escapeHtml(walked.passage.bookName)} ${walked.passage.chapter} →`;
  } else if (walked.kind === 'event') {
    // Verbatim: each witness's own opening words, side by side, unmerged.
    targetHTML = `<div class="target"><div class="ref">${escapeHtml(walked.node.name)} · ${walked.node.witnesses.length} witnesses · each in its own words</div>
      ${walked.node.witnesses.map(w => {
        const wp = getPassage(data, w.ref);
        return `<p style="margin-bottom:6px"><span class="quiet">${escapeHtml(wp.bookName)}:</span> “${escapeHtml(walked.node.aligned[w.book])}…”</p>`;
      }).join('')}</div>`;
    walkLabel = 'See the witnesses →';
  } else if (walked.kind === 'thread') {
    const first = getPassage(data, walked.node.stops[0].ref);
    targetHTML = `<div class="target"><div class="ref">${escapeHtml(walked.node.name)} · thread · ${walked.node.stops.length} stops · first stop ${escapeHtml(formatRef(data, walked.node.stops[0].ref))}</div>
      <p>“${escapeHtml(first.verses[0].t)}”</p></div>`;
    walkLabel = 'Follow the thread →';
  } else if (walked.kind === 'tradition') {
    targetHTML = `<div class="target"><div class="ref">Tradition — outside the text · always hollow</div>
      <p style="font-family:var(--sans);font-size:13.5px">${escapeHtml(walked.node.text)}</p>
      <p class="quiet" style="margin-top:8px">${escapeHtml(walked.node.source)}.</p></div>`;
    walkable = false; // tradition has no page to walk to — it lives outside the text
  }
  const warrants = edgeWarrants(edge);
  const warrantHTML = warrants.map(w => {
    const wp = getPassage(data, w);
    const t = wp ? wp.verses[0].t : '';
    return `<u data-warrant="${escapeHtml(w)}" role="button" tabindex="0">${escapeHtml(formatRef(data, w))} — “${escapeHtml(t.slice(0, 70))}${t.length > 70 ? '…' : ''}”</u>`;
  }).join('<br>');
  $('#sh-card').innerHTML = `
    <div class="grab"></div>
    <div class="rel"><span class="chip ${edge.grade}" data-grade="${edge.grade}" role="button" tabindex="0">${edge.grade}</span><b>${escapeHtml(edge.claim)}</b></div>
    ${targetHTML}
    <p class="warrant">Warrant${warrants.length > 1 ? 's' : ''}: ${warrantHTML}</p>
    <div class="actions">
      <button class="btn" id="stayBtn">${walkable ? 'Stay here' : 'Close — the text says only what it says'}</button>
      ${walkable ? `<button class="btn walk" id="walkBtn">${walkLabel}</button>` : ''}
    </div>`;
  $('#stayBtn').onclick = closeSheets;
  const wb = $('#walkBtn');
  if (wb) wb.onclick = () => doWalk(edge, walked);
  openSheet('sh-card');
}

function doWalk(edge, walked) {
  // The origin is the DOOR's exact verse (edge.anchor), not the screen's stale state —
  // "← Matthew 13:14", and returning re-lands on that verse (ADR-003 §3, Design 02 F2).
  const from = { ...screen };
  let fromLabel = screenLabel(from);
  if (edge.anchor && from.type === 'reading') {
    const a = parseRef(edge.anchor.ref);
    if (a && a.book === from.book && a.chapter === from.chapter) {
      from.land = a.verseStart;
      fromLabel = formatRef(data, edge.anchor.ref);
    }
  }
  let toScreen;
  if (walked.kind === 'passage') {
    const p = walked.passage;
    toScreen = { type: 'reading', book: p.book, chapter: p.chapter, land: p.verses[0].v };
  } else if (walked.kind === 'event') {
    toScreen = { type: 'event', node: walked.node.id };
  } else {
    toScreen = { type: 'thread', node: walked.node.id };
  }
  pushStep(`${fromLabel} → ${screenLabel(toScreen)}`, edge.claim, edge.grade, toScreen);
  returnTo = { label: fromLabel, screen: from };
  showScreen(toScreen);
}

// -- event view (ADR-003 §4)
function renderEvent(nodeId, tab = 0, compare = false) {
  const node = nodeById(data, nodeId);
  setBar(escapeHtml(node.name), `Event · ${node.witnesses.length} witnesses`);
  setShelf('books');
  renderReturnChip();
  const w = node.witnesses[tab];
  const p = getPassage(data, w.ref);
  const alignedPhrase = node.aligned[w.book];
  let body = p.verses.map(v => {
    let t = escapeHtml(v.t);
    const ap = escapeHtml(alignedPhrase);
    if (t.includes(ap)) t = t.replace(ap, `<span class="aligned2" id="alignTap" role="button" tabindex="0">${ap}</span>`);
    return `<span class="v">${v.v}</span>${t} `;
  }).join('');
  const others = node.witnesses.filter((_, i) => i !== tab).map(o => {
    const op = getPassage(data, o.ref);
    return `<div class="row"><span class="who">${escapeHtml(op.bookName)} ${op.chapter}:${op.verses[0].v}</span>
      <p>“${escapeHtml(node.aligned[o.book])}…”</p></div>`;
  }).join('');
  const kp = getPassage(data, node.key.ref);
  $('#view').innerHTML = `
    <div class="tabs">${node.witnesses.map((wit, i) =>
      `<span class="${i === tab ? 'on' : ''}" data-tab="${i}">${escapeHtml(getBook(data, wit.book).name)}</span>`).join('')}</div>
    <p class="scripture" style="font-size:15.5px">${body}</p>
    <p class="quiet" style="margin-top:8px">Tap the tinted phrase to hear the other witnesses.</p>
    ${compare ? `<div class="cmp"><p class="cap">The same moment, each voice</p>${others}</div>` : ''}
    <div class="divergence"><span class="chip ${node.divergence.grade}" data-grade="${node.divergence.grade}" role="button" tabindex="0">${node.divergence.grade}</span>
      ${escapeHtml(node.divergence.text)} <a class="cx2 B" data-goto="${escapeHtml(node.divergence.ref)}" role="button" tabindex="0">Shown, graded, unresolved.</a></div>
    <p class="keyline"><span class="chip ${node.key.grade}" data-grade="${node.key.grade}" role="button" tabindex="0">${node.key.grade}</span>
      ${escapeHtml(node.key.label)}: <a data-goto="${escapeHtml(node.key.ref)}" role="button" tabindex="0">“${escapeHtml(node.key.phrase)}” — ${escapeHtml(kp.bookName)} ${kp.chapter}:${kp.verses[0].v}</a></p>`;
  $$('#view .tabs span').forEach(t =>
    t.onclick = () => showScreen({ ...screen, tab: Number(t.dataset.tab), compare: false }));
  const align = $('#alignTap');
  if (align) align.onclick = () => showScreen({ ...screen, compare: !compare });
}

// -- thread view (ADR-003 §4)
function renderThread(nodeId) {
  const node = nodeById(data, nodeId);
  setBar(escapeHtml(node.name), `Thread · ${node.stops.length} stops`);
  setShelf('books');
  renderReturnChip();
  $('#view').innerHTML = `<ol class="arc">${node.stops.map(stop => {
    const p = getPassage(data, stop.ref);
    return `<li><span class="dot ${stop.grade}"></span>
      <h5>${escapeHtml(stop.label)}</h5>
      <span class="ref">${escapeHtml(p.bookName)} ${p.chapter}:${p.verses[0].v} · Grade ${stop.grade}${stop.note ? ' — ' + escapeHtml(stop.note) : ''}</span>
      <p data-goto="${escapeHtml(stop.ref)}" role="button" tabindex="0">“${escapeHtml(p.verses[0].t)}”</p></li>`;
  }).join('')}</ol>`;
}

// -- search (ADR-004)
function renderSearch(q = '') {
  setBar('Search', 'Bounded to the text');
  setShelf('search');
  renderReturnChip();
  $('#view').innerHTML = `
    <div class="door">
      <p class="prompt">What is happening —<br>or what do you want to know?</p>
      <div class="srow"><input id="sInput" type="search" autocomplete="off"
        placeholder="a feeling, a question, or “mt 13”" value="${escapeHtml(q)}">
        <button class="btn" id="sGo">Open</button></div>
      <p class="routesonly">Search only opens doors. It never writes answers.</p>
      <div class="sugrow">
        <span class="sug" role="button" tabindex="0">my mother is in the hospital</span>
        <span class="sug" role="button" tabindex="0">who wrote Hebrews?</span>
        <span class="sug" role="button" tabindex="0">john 3 16</span>
      </div>
      <div id="sRes"></div>
    </div>`;
  const run = () => doSearch($('#sInput').value);
  $('#sGo').onclick = run;
  $('#sInput').onkeydown = e => { if (e.key === 'Enter') run(); };
  $$('.sug').forEach(s => s.onclick = () => { $('#sInput').value = s.textContent; run(); });
  if (q) doSearch(q);
}

function doSearch(q) {
  if (!q || !q.trim()) { $('#sInput')?.focus(); return; }
  const res = classifyQuery(data, q);
  const out = $('#sRes');
  if (res.kind === 'ref') {
    const p = getPassage(data, res.ref);
    const from = { type: 'search', q };
    returnTo = { label: 'Search', screen: from };
    pushStep(`Search → ${p.bookName} ${p.chapter}`, 'Jumped by reference', '', { type: 'reading', book: p.book, chapter: p.chapter, land: p.verses.length === 1 ? p.verses[0].v : null });
    showScreen({ type: 'reading', book: p.book, chapter: p.chapter, land: p.verses.length === 1 ? p.verses[0].v : null });
    return;
  }
  if (res.kind === 'moment') {
    out.innerHTML = `<p class="modecap">${escapeHtml(res.moment.label)}</p>` +
      res.moment.routes.map(route => {
        const p = getPassage(data, route.ref);
        return `<div class="dest"><div class="ref"><span>${escapeHtml(p.bookName)} ${p.chapter}${p.verses.length === 1 ? ':' + p.verses[0].v : ' · whole psalm'}</span>
          <span class="go" data-route="${escapeHtml(route.ref)}" role="button" tabindex="0">Walk →</span></div>
          <p>“${escapeHtml(p.verses[0].t)}”</p>
          <p class="why">${escapeHtml(route.why)}</p></div>`;
      }).join('');
    $$('[data-route]', out).forEach(el => el.onclick = () => {
      const p = getPassage(data, el.dataset.route);
      returnTo = { label: 'Search', screen: { type: 'search', q } };
      pushStep(`Search → ${p.bookName} ${p.chapter}`, 'Walked · a route for a hard day', '', { type: 'reading', book: p.book, chapter: p.chapter, land: p.verses.length === 1 ? p.verses[0].v : null });
      showScreen({ type: 'reading', book: p.book, chapter: p.chapter, land: p.verses.length === 1 ? p.verses[0].v : null });
    });
    return;
  }
  if (res.kind === 'question') {
    out.innerHTML = `<div class="honest"><p>${escapeHtml(res.question.honest)}</p></div>
      <p class="modecap">What the text does say</p>` +
      res.question.cites.map(cite => {
        const p = getPassage(data, cite);
        return `<div class="cite"><div class="ref">${escapeHtml(p.bookName)} ${p.chapter}:${p.verses[0].v}${p.verses.length > 1 ? '–' + p.verses[p.verses.length - 1].v : ''}</div>
          <p>“${p.verses.map(v => escapeHtml(v.t)).join(' ')}”</p></div>`;
      }).join('') +
      `<p class="openq"><span class="chip C" data-grade="C">C</span> ${escapeHtml(res.question.open)}</p>`;
    return;
  }
  if (res.kind === 'ref-missing') {
    // Data-derived honesty only: say exactly what this edition carries, claim nothing more.
    out.innerHTML = `<div class="honest"><p>${escapeHtml(missingRefExplanation(data, res.ref))}</p></div>`;
    return;
  }
  out.innerHTML = `<div class="honest"><p>No doors matched those words.</p></div>
    <p class="quiet">Try a reference (“mt 13”, “john 3 16”), a question, or say what is
    happening in your own words. This box never writes answers, so it will never guess.</p>`;
}

// -- notes (ADR-002 §6)
function renderNotes() {
  setBar('My notebook', 'This device only');
  setShelf('notes');
  renderReturnChip();
  const notes = store.read('wtw.notes', []);
  $('#view').innerHTML = `
    <div class="lock">🔒<span><b>Stored on this device only.</b> No account, no sync, no server.
    Not even the curator can read these.</span></div>
    <div class="srow"><input id="noteInput" maxlength="200" autocomplete="off"
      placeholder="One dated line…"><button class="btn" id="noteBtn">Keep</button></div>
    <p class="quiet" style="margin:0 0 10px">Attaches to your last reading position.</p>
    <div id="noteList">${notes.slice().reverse().map(n =>
      `<div class="entry"><div class="when"><span>${escapeHtml(n.when)}</span><span>${escapeHtml(n.ref)}</span></div>
       <p>${escapeHtml(n.text)}</p></div>`).join('') || '<p class="quiet">Nothing yet. One line at a time.</p>'}</div>
    ${notes.length ? '<button class="btn" id="noteExport" style="margin-top:16px">Copy all — your notebook is yours</button>' : ''}`;
  const keep = () => {
    const text = $('#noteInput').value.trim();
    if (!text) return;
    const last = lastContinue();
    const ref = last ? `${getBook(data, last.book).name} ${last.pos.chapter}${last.pos.land ? ':' + last.pos.land : ''}` : 'Edition 1';
    notes.push({ when: new Date().toISOString().slice(0, 10), ref, text });
    store.write('wtw.notes', notes);
    renderNotes();
  };
  $('#noteBtn').onclick = keep;
  $('#noteInput').onkeydown = e => { if (e.key === 'Enter') keep(); };
  const exp = $('#noteExport');
  if (exp) exp.onclick = async () => {
    const text = notes.map(n => `${n.when} · ${n.ref}\n${n.text}`).join('\n\n');
    try { await navigator.clipboard.writeText(text); toast('Copied. Your notes, in plain text, yours to keep anywhere.'); }
    catch { toast('Copy failed — select the entries by hand; they are plain text on this page.'); }
  };
}

// -- books sheet (ADR-002 §4)
function openBooks(expanded = screen.book || 'matthew') {
  const last = lastContinue();
  const ot = data.books.filter(b => b.order < 40).sort((a, b) => a.order - b.order);
  const nt = data.books.filter(b => b.order >= 40).sort((a, b) => a.order - b.order);
  const grid = books => books.map(b =>
    `<button class="bk ${b.id === expanded ? 'on' : ''}" data-book="${b.id}">${escapeHtml(b.name)}</button>`).join('');
  const exp = getBook(data, expanded);
  let chaptersHTML = '';
  if (exp) {
    // Only what's loaded — an honest caption replaces a wall of dead cells (ADR-005).
    const included = Object.keys(exp.chapters).map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    const cells = included.map(c =>
      `<button class="bk ${screen.type === 'reading' && screen.book === exp.id && screen.chapter === c ? 'on' : ''}" data-chapter="${exp.id}:${c}">${c}</button>`);
    chaptersHTML = `<p class="seccap">${escapeHtml(exp.name)} · ${included.length} of ${exp.chaptersTotal} chapters in this slice</p><div class="bgrid">${cells.join('')}</div>`;
  }
  $('#sh-books').innerHTML = `
    <div class="grab"></div>
    <p class="cap">Books · two taps to anywhere</p>
    <div class="bgrid" style="margin-bottom:10px">
      <button class="bk ${translation === 'kjv' ? 'on' : ''}" data-tr="kjv">KJV</button>
      <button class="bk ${translation === 'web' ? 'on' : ''}" data-tr="web">WEB</button>
      <span class="quietcap" style="align-self:center">translation — a display layer, same map</span>
    </div>
    ${last ? `<div class="controw" role="button" tabindex="0" data-chapter="${last.book}:${last.pos.chapter}${last.pos.land ? ':' + last.pos.land : ''}">
      <span>Continue · <b>${escapeHtml(getBook(data, last.book).name)} ${last.pos.chapter}${last.pos.land ? ':' + last.pos.land : ''}</b></span>
      <span class="mono">Resume →</span></div>` : ''}
    <p class="seccap">Old Testament</p><div class="bgrid">${grid(ot)}</div>
    <p class="seccap">New Testament</p><div class="bgrid">${grid(nt)}</div>
    ${chaptersHTML}
    <div class="edrow">
      <span id="edChangelog" role="button" tabindex="0">Edition ${data.edition.number} · what changed</span>
      <span id="edVerify" role="button" tabindex="0">Verify this edition</span>
      <span id="edCorrections" role="button" tabindex="0">Corrections</span>
    </div>`;
  $$('#sh-books [data-tr]').forEach(el => el.onclick = () => {
    setTranslation(el.dataset.tr);
    showScreen({ ...screen }); // re-render WHATEVER is behind the sheet in the new translation
    openBooks(expanded);       // then re-open the sheet with the new active state
  });
  $$('#sh-books [data-book]').forEach(el => el.onclick = () => openBooks(el.dataset.book));
  $$('#sh-books [data-chapter]').forEach(el => el.onclick = () => {
    const [book, chapter, land] = el.dataset.chapter.split(':');
    returnTo = null;
    showScreen({ type: 'reading', book, chapter: Number(chapter), land: land ? Number(land) : null });
  });
  $('#edChangelog').onclick = () => toast(data.edition.changelog[0]);
  $('#edCorrections').onclick = () => toast(`Corrections: ${data.edition.corrections} — fixes arrive in the next numbered edition, never as silent edits.`);
  $('#edVerify').onclick = async () => {
    try {
      // ADR-005 §3: verify ALWAYS checks the KJV edition artifact — the graph's substrate.
      const sum = await editionChecksum(edition);
      toast(sum === edition.edition.checksum
        ? `✓ Verified. This artifact matches its published checksum (${sum.slice(0, 18)}…).`
        : '✗ Checksum mismatch — this copy differs from the published edition.');
    } catch (err) {
      toast(`Could not verify here: ${err.message} You can also hash data/edition-1.json yourself — the method is in ADR-001.`);
    }
  };
  openSheet('sh-books');
}

// -- trail sheet (ADR-003 §3)
function openTrail() {
  const steps = trail.map((s, i) =>
    `<li><span class="dot ${s.grade}"></span><span class="ret" data-step="${i}" role="button" tabindex="0">Return</span>
     <h5>${escapeHtml(s.title)}</h5><span class="ref">${escapeHtml(s.ref)}</span></li>`).join('');
  $('#sh-trail').innerHTML = `
    <div class="grab"></div>
    <p class="cap">Your trail · this session · stays on this device</p>
    <ol class="arc">${steps}
      <li><span class="dot here"></span><h5>${escapeHtml(screenLabel(screen))} — you are here</h5>
      <span class="ref">Right now</span></li></ol>
    <p class="quiet" style="margin-top:14px">Clears with the session ·
      <u id="keepWalk" style="cursor:pointer;color:var(--lamp-ink)" role="button" tabindex="0">keep this walk in Notes</u></p>`;
  $$('#sh-trail [data-step]').forEach(el => el.onclick = () => {
    returnTo = null;
    showScreen(trail[Number(el.dataset.step)].to);
  });
  $('#keepWalk').onclick = () => {
    if (!trail.length) { toast('No steps walked yet this session.'); return; }
    const notes = store.read('wtw.notes', []);
    notes.push({
      when: new Date().toISOString().slice(0, 10),
      ref: 'Walk · ' + trail.length + ' steps',
      text: trail.map(s => s.title).join(' · ')
    });
    store.write('wtw.notes', notes);
    toast('Kept. One dated line in your notebook — on this device only.');
  };
  openSheet('sh-trail');
}

// ---------- global wiring ----------
function wire() {
  $('#scrim').onclick = closeSheets;
  $$('.shelf .nv').forEach(btn => btn.onclick = () => {
    const nav = btn.dataset.nav;
    if (nav === 'books') openBooks();
    else if (nav === 'trail') openTrail();
    else if (nav === 'search') { returnTo = null; showScreen({ type: 'search' }); }
    else if (nav === 'notes') { returnTo = null; showScreen({ type: 'notes' }); }
  });
  $('#edMark').onclick = () => openBooks();
  // Header title: the second road to Books, live on EVERY screen, pre-opened to
  // where you are (or your last reading position elsewhere). Bound once, never stale.
  $('#barBook').onclick = () => {
    if (screen.type === 'teach') return; // teaching screen: one job, no detours
    const at = screen.type === 'reading' ? screen.book : (lastContinue()?.book || 'matthew');
    openBooks(at);
  };
  // Keyboard activation for every interactive element, wherever it renders:
  // Enter/Space on role="button" (doors, chips, routes, trail returns) acts like a tap.
  document.addEventListener('keydown', e => {
    containSheetTab(e);
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target.closest?.('[role="button"], .cx2, [data-grade], [data-goto], [data-warrant], [data-route], [data-step], .sug, .go, .ret');
    if (el && el.tagName !== 'BUTTON' && el.tagName !== 'INPUT') {
      e.preventDefault();
      el.click();
    }
  });
  // Delegated: doors, grade chips, goto links — wherever they render.
  document.addEventListener('click', e => {
    const door = e.target.closest('[data-edge]');
    if (door) { openCard(door.dataset.edge); return; }
    const chip = e.target.closest('[data-grade]');
    if (chip) { toast(GRADE_HELP[chip.dataset.grade]); return; }
    const goto = e.target.closest('[data-goto]');
    if (goto) {
      const p = getPassage(data, goto.dataset.goto);
      if (!p) return;
      const from = { ...screen };
      returnTo = { label: screenLabel(from), screen: from };
      pushStep(`${screenLabel(from)} → ${p.bookName} ${p.chapter}`, 'Walked into book context', '', { type: 'reading', book: p.book, chapter: p.chapter, land: p.verses[0].v });
      showScreen({ type: 'reading', book: p.book, chapter: p.chapter, land: p.verses[0].v });
      return;
    }
    const warrant = e.target.closest('[data-warrant]');
    if (warrant) {
      const p = getPassage(data, warrant.dataset.warrant);
      if (p) toast(`Warrant — ${p.bookName} ${p.chapter}:${p.verses[0].v}: “${p.verses[0].t}”`);
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheets(); });
}

// ---------- boot ----------
async function boot() {
  const edRes = await fetch('./data/edition-1.json');
  if (!edRes.ok) throw new Error(`edition-1.json: HTTP ${edRes.status}`);
  edition = await edRes.json();
  // The WEB layer is optional: if it fails, the KJV edition still reads fully.
  try {
    const ovRes = await fetch('./data/web-overlay-1.json');
    overlay = ovRes.ok ? await ovRes.json() : null;
  } catch { overlay = null; }
  if (!overlay) console.warn('WEB overlay unavailable — KJV only this session.');
  const problems = validateEdition(edition);
  if (problems.length) console.warn('Edition integrity problems:', problems);
  data = edition;
  if (translation) setTranslation(translation);
  $('#edMark').textContent = 'Ed ' + edition.edition.number;
  wire();
  updateTrailCount();
  if (!store.read('wtw.taught', 0)) { showScreen({ type: 'teach' }); return; }
  const last = lastContinue();
  // No preloaded content (ADR-005): resume only a place the reader chose; else choose.
  showScreen(translation && last
    ? { type: 'reading', book: last.book, chapter: last.pos.chapter, land: last.pos.land ?? null }
    : { type: 'start' });
}

boot().catch(err => {
  $('#view').innerHTML = `<div class="honest"><p>The edition failed to load.</p></div>
    <p class="quiet">${escapeHtml(String(err))} — the artifact is plain JSON at
    <a href="./data/edition-1.json">data/edition-1.json</a>.</p>`;
});
