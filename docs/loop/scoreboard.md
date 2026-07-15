# Edition-1 Loop — Scoreboard

Loop contract: per ADR — implement → **Gate T** (tests) → **Gate V** (verify end-to-end)
→ **Gate G** (judge grade 1–100, adversarial rubric) → loop until **score > 96** → next ADR.
Method: SPARC phases with gates (grounded: `sparc/specification/README.md`); orchestration
pattern per Maestro ADR-004 (`ruflo/v3/@claude-flow/shared/src/plugins/official/maestro-plugin.ts`);
auto-continue pattern per Autopilot ADR-037 (`ruflo/ruflo/docs/adr/ADR-037-AUTOPILOT-CHAT-MODE.md`).

| ADR | Scope | Gate T (tests) | Gate V (verify) | Gate G round 1 | Fixes | Gate G final | Status |
|-----|-------|----------------|-----------------|----------------|-------|--------------|--------|
| ADR-001 | Edition format & static architecture | ✅ 10/10 | ✅ checksum stamped `sha256-2a75…af62c` | **87 FAIL** | queued | — | fix round |
| ADR-002 | App shell, reading, shelf, Books, teach, notes | ✅ 15/15 (incl. render suite) | ✅ served, 4/4 assets 200 | pending | — | — | judging |
| ADR-003 | Cards, walk, trail, event, thread | ✅ (walk/edge tests) | ✅ served | **84 FAIL** | queued | — | fix round |
| ADR-004 | Unified Search | ✅ (classifier tests) | ✅ served | **89 FAIL** | queued | — | fix round |

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
