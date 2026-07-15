# Edition 1 — Text Verification Report

Date: 2026-07-15 · Source: `docs/00_bible/bible_kjv.pdf` (curator-provided) · Tool: `app/tools/ingest_bible.py`

## Method (including its own audit trail)
- Whole-chapter extraction; editorial headings and cross-reference lines stripped.
  A heading is dropped ONLY when it precedes a new verse number or a cross-ref line —
  the tool's FIRST attempt used a looser heuristic that ate punctuation-free verse
  fragments; the verse-by-verse diff below caught it and it was fixed before shipping.
- Recorded normalizations: supplied-word [brackets] → plain; curly quotes → straight;
  split contractions rejoined; Hebrew acrostic markers stripped; psalm superscriptions
  stay inside verse 1 exactly as the source prints them.
- PDF letter-spacing split-word artifacts: 16 repaired explicitly in the tool +
  21 detected by a corpus-lexicon scan (join is a corpus word, fragment is not) —
  full list in `docs/00_bible/extracted/autorepairs.json`. Round-1 independent judge
  re-extraction found 18 the first scan missed; the scan was strengthened and all are
  now repaired. The SAME scan runs in the test suite against shipped data.

**63 verses identical · 3 verses corrected to source** (1 superscription convention + 2 genuine misquotes). All 13 chapters ship WHOLE (399 verses), counts matching canonical KJV exactly.
## Verse-by-verse: previous from-memory text vs source

### psalms 121:1 — CORRECTED
- memory: I will lift up mine eyes unto the hills, from whence cometh my help.
- source: A Song of degrees. I will lift up mine eyes unto the hills, from whence cometh my help.

### john 3:17 — CORRECTED
- memory: For God sent not his Son into the world to condemn him; but that the world through him might be saved.
- source: For God sent not his Son into the world to condemn the world; but that the world through him might be saved.

### 2peter 3:16 — CORRECTED
- memory: As also in all his epistles, speaking in them of these things; in which are some things hard to be understood, which they that are unlearned and unstable wrest, as they do also unto the other scriptures, unto their own destruction.
- source: As also in all his epistles, speaking in them of these things; in which are some things hard to be understood, which they that are unlearned and unstable wrest, as they do also the other scriptures, unto their own destruction.

