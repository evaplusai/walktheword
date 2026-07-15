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

## Cycle 4 verdict — COMPLETE ✅ (round 3: **97 PASS**, path 67 → 91 → 97)
Full canon verified: judge's independent PDF re-extraction confirms both editions
word-perfect (structure 66/1189/31102, provenance, checksums, cross-canon samples,
6,080 heading receipts swept with zero scripture-in-receipts, zero glued headings,
routing traces clean incl. teach-then-deep-link and URL-never-lies). Round-3 low
residuals: pre-boot hashchange race (guarded post-verdict — one line, self-recovering
before the fix) and the acknowledged audit blindness to mid-list truncations (root cause
removed; class covered by regressions + judge's endswith method, documented in ADR-006).

## Cycle 4 — round 2 verdict: 91 FAIL → fix round 2 → regrading
Judge round 2: all round-1 defects verified fixed (leak list gone word-by-word, routing
traces pass live incl. teach-then-deep-link) — but the heading fix REGRESSED 3 WEB verses:
lines ending in a closing quote ("…THE KING OF THE JEWS.”") were dropped as headings,
truncating Matthew 16:11, 27:37, Revelation 1:11. Fixed: closing quotes join the
ends-with-punctuation exemption; all 3 verses restored word-perfect and regression-tested;
invalid-link double-render and lying-URL nits fixed; receipt counts corrected
(3040 KJV / 3040 WEB dropped-heading receipts).

## Cycle 4 — round 1 verdict: 67 FAIL → fix round → regrading
Judge round 1 (independent whole-canon re-derivation: structure/provenance/checksums/48-verse
sample/receipted-joins all VERIFIED clean) found: (high) ~31 section headings per edition
glued into verse ends (punctuation-bearing titles evaded the heading rule); (high) async
hashchange broke the teach flow and fresh-device deep links; (med) Ps-119 stanza-marker
leakage; (med) blank app on invalid deep link; (med) crash on bogus event/thread hash;
(low) double WEB fetch, stale copy. ALL FIXED: three-layer receipted heading strip
(+ the fix round itself caught and fixed two of its own overreaches: name-list verses
eaten, "LORD." eaten by the bare all-caps rule — both restored, regression-tested);
echo-compare hashchange guard; teach has its own hash; deep links queue through teaching;
invalid links fall back honestly; in-flight WEB fetch memo; terminal-punctuation audit
receipts. Tests 38/38.

## Cycle 4 — ADR-006/007: full-canon rebuild + navigation — gates T/V ✅, judging
Curator directive: erase everything generated, rebuild per-edition from the source PDFs
only, fully loaded, fix navigation. Done: all prior data deleted; two complete editions
(66 books / 1,189 chapters / 31,102 verses EACH — exact canonical KJV count, matched
independently by both PDFs) extracted fresh with source-PDF sha256 provenance in each
manifest; ~1,950 + 1,753 receipted split-word repairs corpus-wide; WEB's 4 omitted verses
receipted (Lk 17:36, Acts 8:37/15:34/24:7); graph moved to curator/graph.json
(review-pending). Navigation: URL hash routing (browser back/forward + deep links),
lazy WEB load, start-screen accordion, verify-per-active-edition, all-66-book search
aliases. Tests 36/36.

## Cycle 3 verdict — COMPLETE ✅ (ADR-005: 78 → **97 PASS**)
Round 1 (78): 8 defects incl. two high — WEB-mode Verify falsely reported mismatch;
fresh readers could land in text with no translation chosen. All fixed (commit 344b5d5);
judge re-traced both attack paths and confirmed closed. Round-2 residuals (all low) to
the Edition-1.1 backlog: search-preview quotes render before the adoption gate; a failed
overlay fetch permanently overwrites a stored WEB choice; translation switch clears
open search results; Books sheet still shows WEB button when overlay is down (guarded);
boot/adoption gates untested (browser-only code).

## Cycle 3 — ADR-005: start screen & translation choice — gates T/V ✅, judging
Curator feedback: Matthew 13 was preloaded (a wireframe example promoted by accident).
Fix: start screen — explicit translation choice (KJV / WEB, both from curator sources,
WEB wired in as a display layer over the unchanged graph) → the loaded books/chapters,
honestly captioned ("1 of 28 chapters in this slice", no walls of disabled cells) → the
reader opens any page. Resume returns only to a place the reader chose. 37/37 tests.

## Cycle 2 verdict — COMPLETE ✅ (round 5: **97 PASS**)
**71 → 88 → 85 → 96 → 97.** Scripture text verified by independent 798-verse PDF
re-extraction: verbatim modulo exactly 40 recorded, individually verified repairs; zero
false-positive joins; exported lexicon/bigram counts byte-exact vs the judge's independent
rebuild; 36/36 tests green. Round-5 low nits (report line-splice, test-side
undefined-skip semantics) fixed post-verdict as trivial doc/test changes — shipped
scripture text untouched since the round-4-verified bytes.

## Cycle 2 — round 4 verdict: 96 FAIL → paperwork fix → regrading
TEXT FULLY VERIFIED: judge's independent 798-verse re-diff = verbatim modulo exactly the
40 recorded repairs, zero false positives, exhaustive low-threshold bigram probe found no
residual splits. Remaining defects were documentation: stale report counts/claims, missing
round-3 scoreboard entry, bigram rule absent test-side. Fixed: report regenerated with
full round 1–4 audit trail and dynamic counts; per-pair corpus bigram counts exported so
the test scan now includes the bigram rule identically; this entry added.

## Cycle 2 — round 3 verdict: 85 FAIL → fix round 3
Judge round 3: two residuals of the both-fragments-common class — KJV Jn 12:49 "Fat her"
("fat" and "her" both common words) and WEB Jn 3:23 "be cause". Fix: the judge-suggested
join-vs-bigram frequency test (joined ≥50 corpus uses, adjacent pair ≤2, ratio ≥100) with
guards preserving legitimate pairs — "a live coal" (Isa 6:6, in our own slice) verified
untouched. Both residuals caught by the detector; receipt-vs-reality test added (every
autorepair verified applied in shipped data); 36/36 green.

## Cycle 2 — round 2 verdict: 88 FAIL → fix round 2 → regrading
Judge round 2: all 18 round-1 artifacts verified repaired, no false-positive joins — but
ONE residual survived (WEB Isa 41:9 "corner s,"): the corpus lexicon counted standalone
"s" as a common word because the full PDF text is itself polluted with split artifacts.
Fix: contraction-normalize the corpus before building the lexicon; treat any standalone
letter except a/I/O as always-a-fragment; export FULL-count lexicons so the test scan is
byte-identical to the ingest scan; honest wording in the test header ("statistical net,
not a proof — the authoritative receipt is the judge's independent re-extraction diff").
22 lexicon joins + 16 explicit repairs; 34/34 tests green.

## Cycle 2 — round 1 verdict: 71 FAIL → fix round → regrading
Independent judge re-extracted all 798 verses: extraction fidelity confirmed EXCEPT
18 residual split-word artifacts ("ca me", "Chris t,", "Ya hweh") that the naive
single-letter scan missed. Fix: corpus-lexicon split detection (join is a corpus word,
fragment is not; ratio threshold), 37 total recorded repairs, lexicons exported, and the
SAME scan now runs in the test suite against shipped data (34/34 green) — corruption can
never pass green again.

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
