# Edition 1 — Text Verification Report

Date: 2026-07-15 · Source: `docs/00_bible/bible_kjv.pdf` (curator-provided)
Method: `app/tools/ingest_bible.py` — whole-chapter extraction; editorial headings and
cross-reference lines stripped (a heading is dropped ONLY when it precedes a new verse
number or a parallel-reference line, so verse fragments are never eaten); supplied-word
brackets and Hebrew acrostic markers normalized; 16 split-word artifacts repaired
explicitly in the tool; fail-loud residual scan.

**63 verses identical · 3 verses corrected to source.** All chapters now ship WHOLE from the source (was: excerpts). Verse counts match canonical KJV chapter lengths exactly (13/13 chapters).
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

