// Walk the Word — app controller (ADR-002/003/004).
// Everything rendered here is edition data, verbatim. Nothing is composed at runtime.
import {
  getBook, getPassage, nodeById, edgeById, walkEdge, classifyQuery,
  validateEdition, editionChecksum
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

let data = null;
let screen = { type: 'reading', book: 'matthew', chapter: 13 }; // current screen state
let returnTo = null;                                            // {label, screen}
let trail = store.read('wtw.trail', [], sessionStorage);

// ---------- chrome ----------
let toastTimer = null;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), 3600);
}

function closeSheets() {
  $$('.sheet2').forEach(s => s.classList.remove('open'));
  $('#scrim').classList.remove('on');
}
function openSheet(id) {
  closeSheets();
  $('#' + id).classList.add('open');
  $('#scrim').classList.add('on');
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
  screen = s;
  closeSheets();
  if (s.type === 'reading') return renderReading(s.book, s.chapter, s.land ?? null);
  if (s.type === 'event') return renderEvent(s.node, s.tab ?? 0, s.compare ?? false);
  if (s.type === 'thread') return renderThread(s.node);
  if (s.type === 'search') return renderSearch(s.q ?? '');
  if (s.type === 'notes') return renderNotes();
  if (s.type === 'teach') return renderTeach();
}

function screenLabel(s) {
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
    <button class="btn walk" id="startBtn">Open Matthew 13 →</button>
    <p class="skipline" id="skipBtn">Skip — every chip re-explains itself when tapped</p>`;
  const start = () => {
    store.write('wtw.taught', 1);
    showScreen({ type: 'reading', book: 'matthew', chapter: 13 });
  };
  $('#startBtn').onclick = start;
  $('#skipBtn').onclick = start;
}

// -- reading (ADR-002 §3)
function renderReading(bookId, chapter, land = null) {
  const book = getBook(data, bookId);
  const ch = book && book.chapters[String(chapter)];
  if (!ch) { toast('That chapter is not in this edition slice.'); return; }
  setBar(`${escapeHtml(book.name)}<span class="caret">⌄</span>`, `Ch ${chapter}`);
  setShelf('books');
  renderReturnChip();
  $('#view').innerHTML = `<p class="scripture">${chapterHTML(data, bookId, chapter, land)}</p>` +
    (book.partial ? `<p class="quiet" style="margin-top:18px">Edition 1 slice — ${escapeHtml(book.name)} grows in later editions. The scripture text itself never changes; only the map around it.</p>` : '');
  $('#barBook').onclick = () => openBooks(bookId);
  const continues = store.read('wtw.continue', {});
  continues[bookId] = { chapter, land };
  store.write('wtw.continue', continues);
  if (land) $('.land')?.scrollIntoView({ block: 'center' });
  else $('#view').scrollTop = 0;
}

// -- connection card (ADR-003 §1)
function openCard(edgeId) {
  const edge = edgeById(data, edgeId);
  if (!edge) return;
  const walked = walkEdge(data, edgeId);
  let targetHTML = '';
  let walkLabel = 'Walk →';
  if (walked.kind === 'passage') {
    const p = walked.passage;
    targetHTML = `<div class="target"><div class="ref">${escapeHtml(p.bookName)} ${p.chapter}:${p.verses[0].v}${p.verses.length > 1 ? '–' + p.verses[p.verses.length - 1].v : ''} · KJV</div>
      <p>${p.verses.slice(0, 2).map(v => escapeHtml(v.t)).join(' ')}</p></div>`;
    walkLabel = `Walk to ${escapeHtml(p.bookName)} ${p.chapter} →`;
  } else if (walked.kind === 'event') {
    targetHTML = `<div class="target"><div class="ref">${escapeHtml(walked.node.name)} · ${walked.node.witnesses.length} witnesses</div>
      <p>Each gospel tells it in its own voice — parallel, unmerged, differences kept.</p></div>`;
    walkLabel = 'See the witnesses →';
  } else if (walked.kind === 'thread') {
    targetHTML = `<div class="target"><div class="ref">${escapeHtml(walked.node.name)} · thread · ${walked.node.stops.length} stops</div>
      <p>One image followed across the canon, in canonical order.</p></div>`;
    walkLabel = 'Follow the thread →';
  }
  const wp = getPassage(data, edge.warrant);
  const warrantText = wp ? wp.verses[0].t : '';
  $('#sh-card').innerHTML = `
    <div class="grab"></div>
    <div class="rel"><span class="chip ${edge.grade}" data-grade="${edge.grade}">${edge.grade}</span><b>${escapeHtml(edge.claim)}</b></div>
    ${targetHTML}
    <p class="warrant">Warrant: <u data-warrant="${escapeHtml(edge.warrant)}">${escapeHtml(edge.warrant.replace(/:/g, ' ').replace(/^\w/, c => c.toUpperCase()))} — “${escapeHtml(warrantText.slice(0, 80))}${warrantText.length > 80 ? '…' : ''}”</u></p>
    <div class="actions">
      <button class="btn" id="stayBtn">Stay here</button>
      <button class="btn walk" id="walkBtn">${walkLabel}</button>
    </div>`;
  $('#stayBtn').onclick = closeSheets;
  $('#walkBtn').onclick = () => doWalk(edge, walked);
  openSheet('sh-card');
}

function doWalk(edge, walked) {
  const from = { ...screen };
  const fromLabel = screenLabel(from);
  let toScreen;
  if (walked.kind === 'passage') {
    const p = walked.passage;
    toScreen = { type: 'reading', book: p.book, chapter: p.chapter, land: p.verses[0].v };
  } else if (walked.kind === 'event') {
    toScreen = { type: 'event', node: walked.node.id };
  } else {
    toScreen = { type: 'thread', node: walked.node.id };
  }
  pushStep(`${fromLabel} → ${screenLabel(toScreen)}`, escapeHtml(edge.claim), edge.grade, toScreen);
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
    if (t.includes(ap)) t = t.replace(ap, `<span class="aligned2" id="alignTap">${ap}</span>`);
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
    <div class="divergence"><span class="chip ${node.divergence.grade}" data-grade="${node.divergence.grade}">${node.divergence.grade}</span>
      ${escapeHtml(node.divergence.text)} <a class="cx2 B" data-goto="${escapeHtml(node.divergence.ref)}">Shown, graded, unresolved.</a></div>
    <p class="keyline"><span class="chip ${node.key.grade}" data-grade="${node.key.grade}">${node.key.grade}</span>
      ${escapeHtml(node.key.label)}: <a data-goto="${escapeHtml(node.key.ref)}">“${escapeHtml(node.key.phrase)}” — ${escapeHtml(kp.bookName)} ${kp.chapter}:${kp.verses[0].v}</a></p>`;
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
      <p data-goto="${escapeHtml(stop.ref)}">“${escapeHtml(p.verses[0].t)}”</p></li>`;
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
        <span class="sug">my mother is in the hospital</span>
        <span class="sug">who wrote Hebrews?</span>
        <span class="sug">john 3 16</span>
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
          <span class="go" data-route="${escapeHtml(route.ref)}">Walk →</span></div>
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
    out.innerHTML = `<div class="honest"><p>That page exists in the canon but is not in this
      edition slice yet.</p></div><p class="quiet">Edition 1 carries Matthew 13, the Sower
      witnesses, the seed thread, and their destinations. Later editions grow the map;
      the text itself never changes.</p>`;
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
       <p>${escapeHtml(n.text)}</p></div>`).join('') || '<p class="quiet">Nothing yet. One line at a time.</p>'}</div>`;
  $('#noteBtn').onclick = () => {
    const text = $('#noteInput').value.trim();
    if (!text) return;
    const continues = store.read('wtw.continue', {});
    const last = Object.entries(continues).at(-1);
    const ref = last ? `${getBook(data, last[0]).name} ${last[1].chapter}${last[1].land ? ':' + last[1].land : ''}` : 'Edition 1';
    notes.push({ when: new Date().toISOString().slice(0, 10), ref, text });
    store.write('wtw.notes', notes);
    renderNotes();
  };
}

// -- books sheet (ADR-002 §4)
function openBooks(expanded = screen.book) {
  const continues = store.read('wtw.continue', {});
  const lastEntries = Object.entries(continues);
  const last = lastEntries.at(-1);
  const ot = data.books.filter(b => b.order < 40).sort((a, b) => a.order - b.order);
  const nt = data.books.filter(b => b.order >= 40).sort((a, b) => a.order - b.order);
  const grid = books => books.map(b =>
    `<button class="bk ${b.id === expanded ? 'on' : ''}" data-book="${b.id}">${escapeHtml(b.name)}</button>`).join('');
  const exp = getBook(data, expanded);
  let chaptersHTML = '';
  if (exp) {
    const included = new Set(Object.keys(exp.chapters).map(Number));
    const cells = [];
    for (let c = 1; c <= exp.chaptersTotal; c++) {
      cells.push(included.has(c)
        ? `<button class="bk ${screen.type === 'reading' && screen.book === exp.id && screen.chapter === c ? 'on' : ''}" data-chapter="${exp.id}:${c}">${c}</button>`
        : `<button class="bk faint" data-missing="1">${c}</button>`);
    }
    chaptersHTML = `<p class="seccap">${escapeHtml(exp.name)} · ${exp.chaptersTotal} chapters</p><div class="bgrid">${cells.join('')}</div>`;
  }
  $('#sh-books').innerHTML = `
    <div class="grab"></div>
    <p class="cap">Books · two taps to anywhere</p>
    ${last ? `<div class="controw" data-chapter="${last[0]}:${last[1].chapter}">
      <span>Continue · <b>${escapeHtml(getBook(data, last[0]).name)} ${last[1].chapter}${last[1].land ? ':' + last[1].land : ''}</b></span>
      <span class="mono">Resume →</span></div>` : ''}
    <p class="seccap">Old Testament</p><div class="bgrid">${grid(ot)}</div>
    <p class="seccap">New Testament</p><div class="bgrid">${grid(nt)}</div>
    ${chaptersHTML}
    <div class="edrow">
      <span id="edChangelog">Edition ${data.edition.number} · what changed</span>
      <span id="edVerify">Verify this edition</span>
      <span id="edCorrections">Corrections</span>
    </div>`;
  $$('#sh-books [data-book]').forEach(el => el.onclick = () => openBooks(el.dataset.book));
  $$('#sh-books [data-chapter]').forEach(el => el.onclick = () => {
    const [book, chapter] = el.dataset.chapter.split(':');
    returnTo = null;
    showScreen({ type: 'reading', book, chapter: Number(chapter) });
  });
  $$('#sh-books [data-missing]').forEach(el => el.onclick = () =>
    toast('Not in this edition slice. Each edition is complete in itself; the map grows edition by edition — the text never changes.'));
  $('#edChangelog').onclick = () => toast(data.edition.changelog[0]);
  $('#edCorrections').onclick = () => toast(`Corrections: ${data.edition.corrections} — fixes arrive in the next numbered edition, never as silent edits.`);
  $('#edVerify').onclick = async () => {
    const sum = await editionChecksum(data);
    toast(sum === data.edition.checksum
      ? `✓ Verified. This artifact matches its published checksum (${sum.slice(0, 18)}…).`
      : '✗ Checksum mismatch — this copy differs from the published edition.');
  };
  openSheet('sh-books');
}

// -- trail sheet (ADR-003 §3)
function openTrail() {
  const steps = trail.map((s, i) =>
    `<li><span class="dot ${s.grade}"></span><span class="ret" data-step="${i}">Return</span>
     <h5>${escapeHtml(s.title)}</h5><span class="ref">${escapeHtml(s.ref)}</span></li>`).join('');
  $('#sh-trail').innerHTML = `
    <div class="grab"></div>
    <p class="cap">Your trail · this session · stays on this device</p>
    <ol class="arc">${steps}
      <li><span class="dot here"></span><h5>${escapeHtml(screenLabel(screen))} — you are here</h5>
      <span class="ref">Right now</span></li></ol>
    <p class="quiet" style="margin-top:14px">Clears with the session ·
      <u id="keepWalk" style="cursor:pointer;color:var(--lamp-ink)">keep this walk in Notes</u></p>`;
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
  const res = await fetch('./data/edition-1.json');
  data = await res.json();
  const problems = validateEdition(data);
  if (problems.length) console.warn('Edition integrity problems:', problems);
  $('#edMark').textContent = 'Ed ' + data.edition.number;
  wire();
  updateTrailCount();
  if (!store.read('wtw.taught', 0)) { showScreen({ type: 'teach' }); return; }
  const continues = store.read('wtw.continue', {});
  const last = Object.entries(continues).at(-1);
  showScreen(last
    ? { type: 'reading', book: last[0], chapter: last[1].chapter }
    : { type: 'reading', book: 'matthew', chapter: 13 });
}

boot().catch(err => {
  $('#view').innerHTML = `<div class="honest"><p>The edition failed to load.</p></div>
    <p class="quiet">${escapeHtml(String(err))} — the artifact is plain JSON at
    <a href="./data/edition-1.json">data/edition-1.json</a>.</p>`;
});
