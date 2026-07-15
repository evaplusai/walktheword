# Edition-1 Loop — Scoreboard

Loop contract: per ADR — implement → **Gate T** (tests) → **Gate V** (verify end-to-end)
→ **Gate G** (judge grade 1–100, adversarial rubric) → loop until **score > 96** → next ADR.
Method: SPARC phases with gates (grounded: `sparc/specification/README.md`); orchestration
pattern per Maestro ADR-004 (`ruflo/v3/@claude-flow/shared/src/plugins/official/maestro-plugin.ts`);
auto-continue pattern per Autopilot ADR-037 (`ruflo/ruflo/docs/adr/ADR-037-AUTOPILOT-CHAT-MODE.md`).

| ADR | Scope | Gate T (tests) | Gate V (verify) | Gate G round 1 | Fixes | Gate G final | Status |
|-----|-------|----------------|-----------------|----------------|-------|--------------|--------|
| ADR-001 | Edition format & static architecture | ✅ 28/28 | ✅ checksum restamped `sha256-e3a0…3750` | **87 FAIL** | ✅ commit 774448e | **98 PASS** | ✅ done |
| ADR-002 | App shell, reading, shelf, Books, teach, notes | ✅ 28/28 (incl. render suite) | ✅ served, 4/4 assets 200 | **81 FAIL** | ✅ commit 774448e | **98 PASS** | ✅ done |
| ADR-003 | Cards, walk, trail, event, thread | ✅ 28/28 | ✅ served | **84 FAIL** | ✅ commit 774448e | **98 PASS** | ✅ done |
| ADR-004 | Unified Search | ✅ 28/28 | ✅ served | **89 FAIL** | ✅ commit 774448e | **98 PASS** | ✅ done |

## Standing open items (declared, not hidden)
- Scripture text is **curator-unverified** (ADR-001): structural integrity is tested
  (anchors verbatim, warrants resolve); a diff against a canonical KJV source is required
  before any public release.
- URL routing / browser back (ADR-002), semantic doorway via rvf-wasm (ADR-004 → Edition 3).

## Judge log

### Round 1 · ADR-001 — 87 FAIL
- (med) `matchMoment` unanchored substring: "ill" matches "hills"/"will", misrouting
  unrelated queries to crisis passages — honesty failure in the doorway.
- (med) `validateEdition` doesn't require anchors (`if (edge.anchor)`) though ADR-001 says
  every edge carries one; test suite has the same hole.
- (med) Test gaps: no checksum tamper test, no anchorless-edge failure test, no malformed
  `parseRef` inputs, no grade-C edge exercised anywhere.
- (low) Event `key.grade` not validated against GRADES.
- (low) `getPassage` silently elides gaps in explicit ranges.
- (low) `mt13-3-witnesses-sower` claim names three witnesses but warrants only Mark.
- (low) Psalm 34:18 route backstory rests on a superscription not included in the edition.

### Round 1 · ADR-004 — 89 FAIL
- (med) Same substring matcher bug, confirmed independently: "kill the lights",
  "billion dollars", "i studied all night" all route to the hard-day moment. The
  space-padding in `matchMoment` is dead code — word-boundary matching was intended,
  never implemented.
- (med) ref-missing copy claims "that page exists in the canon" without a canon-existence
  check ("mt 13 999" → asserts a nonexistent verse exists) — honesty crack.
- (low) `parseRefQuery` doesn't re-trim after punctuation strip: "John, 3. 16;" → none.
- (low) Broad keywords ("father", "mother", "alone") catch question-shaped input;
  breadth not recorded as an ADR limitation.
- (low) Empty query renders "No doors matched" instead of doing nothing.
- (low) No negative tests for keyword false positives — the bug shipped green.

### Round 1 · ADR-002 — 81 FAIL
- (med) Continue recency wrong: key-order `at(-1)` != most recent (proven empirically).
- (med) Doors keyboard-dead (no Enter/Space activation) — core interaction fails WCAG 2.1.1.
- (med) Dialog sheets: no focus management, non-focusable interactive spans.
- (low) `#barBook` stale binding off the reading screen; trail double-escape; state
  mutation before missing-chapter guard; Verify silent failure on non-secure contexts;
  ~26px door tap targets vs Design 02's F8 fix; no notes export despite ADR §6.

### Fix round 1 (commit 774448e)
All 26 round-1 defects addressed: word-boundary keyword matcher + curated list; anchors/
claims/warrants required by validation; warrant arrays; exact-verse return chips via
edge.anchor; verbatim node cards; tradition (grade C) node + edge; timestamp-based
continue; keyboard activation + focus containment; 44px tap targets; data-derived
missing-ref honesty; psalm superscriptions; notes export; 13 new adversarial tests (28 total).

### Round 1 · ADR-003 — 84 FAIL
- (med) Return chip doesn't name the exact verse you left (Design 02: "← Matthew 13:14");
  uses `screenLabel(from)` so it reads "← Matthew 13" on a fresh chapter, or a *stale*
  "← Matthew 13:31" if you'd landed there earlier; `edge.anchor.ref` is available and
  unused. Returning drops at chapter top, losing the reader's place.
- (med) Node-destination cards show composed app copy instead of verbatim edition text —
  against ADR-003 §1 and PRD §5 ("target passage in the scripture's own words").
- (low) `escapeHtml` applied before persisting to the trail → double-escape on render.
- (low) `showScreen` mutates state before missing-chapter early-return; `openCard` would
  throw on unresolvable edge.to.
- (low) Passage cards truncate to 2 verses with no ellipsis while advertising full range;
  warrant ref renders as "Matthew 13 14".
- ✅ Cleared by adversarial trace: trail is sessionStorage-only, no double-count on
  delegated listeners, no harmonization, aligned phrases verbatim in all three witnesses.

## Cycle 2 — text verification (curator sources) — gates T/V ✅, judging
Curator provided canonical sources (`docs/00_bible/bible_{kjv,web}.pdf`). All from-memory
scripture replaced via `app/tools/ingest_bible.py`: 13 whole chapters, 399 verses, counts
matching canonical KJV exactly. Diff vs memory: 63 identical · 3 corrected (Ps 121:1
superscription convention + **2 genuine misquotes: John 3:17 "condemn him"→"condemn the
world", 2 Peter 3:16 extra "unto"**). First extraction attempt ate punctuation-free verse
fragments via the heading heuristic — caught by the diff itself, fixed (headings only
strip when preceding a verse number or cross-ref line). WEB overlay written
(`app/data/web-overlay-1.json`), UI toggle → backlog. Tests 31/31. Honesty flag CLOSED
pending judge grade >96.

## Cycle 1 verdict — COMPLETE ✅
All four ADRs implemented, tested, verified, and judged **>96** after one fix round:
**ADR-001: 87→98 · ADR-002: 81→98 · ADR-003: 84→98 · ADR-004: 89→98.**
26 round-1 defects fixed; 9 residual low-severity findings recorded below as the
**Edition-1.1 follow-up backlog** (next loop cycle — judged code is not patched
post-verdict; changes re-enter through the loop).

### Follow-up backlog (Edition 1.1 cycle)
1. Validate duplicate node ids (forkability guard). — graph.mjs
2. Parse verse-range queries ("mt 13:3-9"). — graph.mjs
3. Guard stale event/thread node ids in showScreen. — app.js
4. De-duplicate alignTap id if aligned phrases recur. — app.js
5. Derive moment-walk trail labels from the moment's label. — app.js
6. Keyword variants ("hard-day", "my heart is broken"). — edition data
7. Teach-screen keyboard parity (chips + skip focusable). — app.js
8. Re-focus first content element after walking (focus currently drops to body). — app.js
9. Tune door tap-zone bleed (~3-4px into adjacent lines). — index.html
Plus standing: canonical KJV diff before public release; URL routing (Edition 2);
rvf-wasm semantic doorway (Edition 3).

### Round 2 · ADR-002 — 98 PASS ✅
All nine round-1 defects verified fixed, including the re-render-while-open Books path.
Residuals are the backlog items 7–9 above.

### Round 2 · ADR-004 — 98 PASS ✅
All six round-1 defects verified fixed; regex-injection, unicode, and precedence probes
produced no wrong or dishonest routing. Residual (low, follow-up backlog):
- Trail label for moment walks is hardcoded ("a route for a hard day") — derive from
  the moment's label before a second moment ships.
- Phrase keywords need cheap variants ("hard-day", "my heart is broken") — data-side.

### Round 2 · ADR-003 — 98 PASS ✅
All six round-1 defects verified fixed; tradition card judged constitution-clean.
Residual (low, latent-only, follow-up backlog):
- `showScreen` doesn't guard stale event/thread node ids from an old session's trail.
- `id="alignTap"` would duplicate if an aligned phrase recurred within one witness.

### Round 2 · ADR-001 — 98 PASS ✅
All round-1 defects verified fixed in code. Residual (low, follow-up backlog):
- `validateEdition` doesn't check duplicate NODE ids (edge ids are checked).
- `parseRefQuery` can't parse verse ranges ("mt 13:3-9" → none).
