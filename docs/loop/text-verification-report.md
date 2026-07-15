# Edition 1 — Text Verification Report

Date: 2026-07-15 · Sources: `docs/00_bible/bible_{kjv,web}.pdf` (curator-provided) · Tool: `app/tools/ingest_bible.py`

## Verdict (round 4 of independent judging)
An independent judge re-extracted all 798 verses (399 KJV + 399 WEB) from the PDFs and
diffed word-by-word against the shipped JSON: **798/798 verbatim** modulo exactly the
**40 recorded repairs** (16 explicit + 11 KJV / 13 WEB lexicon-detected joins,
receipt: `docs/00_bible/extracted/autorepairs.json`), each verified as a genuine PDF
letter-spacing split restored to the printed word. Zero false-positive joins;
legitimate phrases ("a live coal", "pass over", "up on") preserved.

## Method
- Whole-chapter extraction; editorial headings and cross-reference lines stripped
  (a heading is dropped ONLY when it precedes a new verse number or a cross-ref line).
- Recorded normalizations: supplied-word [brackets] → plain; curly quotes → straight;
  split contractions rejoined; Hebrew acrostic markers stripped; psalm superscriptions
  stay inside verse 1 exactly as the source prints them.
- Split-word artifact detection, hardened across four judge rounds:
  corpus-lexicon fragment test (round 1: fixed 18 judge-found splits like "ca me",
  "Chris t"), contraction-normalized lexicon + single-letter fragment rule (round 2:
  fixed "corner s"), join-vs-bigram frequency test (round 3: fixed "Fat her",
  "be cause" — the both-fragments-common class).
- The full scan — lexicon rules AND the bigram rule (via exported per-pair corpus
  bigram counts) — runs in the test suite against shipped data
  (`app/test/textquality.test.mjs`). It is a statistical net, not a proof; the
  authoritative receipt is the judge's independent re-extraction diff above.

## Audit trail (nothing hidden)
- First extraction attempt: heading heuristic ate punctuation-free verse fragments —
  caught by the memory-diff below, fixed before shipping.
- Judge round 1 (71): 18 residual splits missed by a naive single-letter scan.
- Judge round 2 (88): 1 residual ("corner s") — corpus pollution blinded the scan.
- Judge round 3 (85): 2 residuals ("Fat her", "be cause") — both-fragments-common
  class; judge-suggested bigram test implemented.
- Judge round 4 (96): text fully clean; remaining findings were in this report itself,
**63 verses identical · 3 corrected** (1 superscription convention + 2 genuine misquotes: John 3:17, 2 Peter 3:16). All 13 chapters ship whole (399 verses), counts matching canonical KJV exactly.
  fixed in this revision.

## Verse-by-verse: previous from-memory text vs curator source

### psalms 121:1 — CORRECTED
- memory: I will lift up mine eyes unto the hills, from whence cometh my help.
- source: A Song of degrees. I will lift up mine eyes unto the hills, from whence cometh my help.

### john 3:17 — CORRECTED
- memory: For God sent not his Son into the world to condemn him; but that the world through him might be saved.
- source: For God sent not his Son into the world to condemn the world; but that the world through him might be saved.

### 2peter 3:16 — CORRECTED
- memory: As also in all his epistles, speaking in them of these things; in which are some things hard to be understood, which they that are unlearned and unstable wrest, as they do also unto the other scriptures, unto their own destruction.
- source: As also in all his epistles, speaking in them of these things; in which are some things hard to be understood, which they that are unlearned and unstable wrest, as they do also the other scriptures, unto their own destruction.

