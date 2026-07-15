# ADR-006: Full-Canon Editions, Rebuilt Directly from the Source PDFs

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Supersedes | ADR-001 §2 (edition = one slice), the edition-1 data files |
| Derived from | curator directive 2026-07-15: "erase all data you entered, use the pdf file to create new data per each edition, everything starts over, do not introduce any data from other places, fully loaded" |

## Decision

1. **All previously generated scripture data is erased** — `edition-1.json`, the WEB
   overlay, every extracted intermediate and cache. Nothing from prior extraction runs
   is reused; extraction re-reads the PDFs the curator placed on 2026-07-15.
2. **One complete edition per translation.** `app/data/edition-2-kjv.json` and
   `app/data/edition-2-web.json` each carry **all 66 books, all 1,189 chapters**,
   extracted by `app/tools/ingest_bible.py` from `docs/00_bible/bible_kjv.pdf` /
   `bible_web.pdf` respectively — the ONLY text sources. Each manifest records the
   **SHA-256 of its source PDF** (provenance) and its own artifact checksum
   ("Verify this edition" verifies the edition actually being read).
3. **The connection map is a separate curator layer** (`curator/graph.json`): the graded
   edges, event/thread nodes, moments, and questions from Edition 1 — carried forward
   because they passed three judged cycles, but flagged **curator-review-pending**: the
   claims, moment backstories, and question copy are curator-editable metadata, not
   scripture. Both edition files embed the same graph; anchors bind to KJV wording.
4. **Extraction quality gates carry over** (they are properties of the tool, not the
   data): fragment-safe heading strip, recorded normalizations, explicit repairs,
   corpus-lexicon + single-letter + bigram split detection, fail-loud residue scan,
   canonical structure checks (66 books; every chapter's verses contiguous from 1;
   per-book chapter counts must equal the canonical count).
5. **Nothing preloaded** (ADR-005 upheld): start screen → explicit translation choice →
   the full book list. A navigation audit accompanies this ADR (ADR-007).

## Gates
Tests (canon counts, both editions, per-edition checksums, split scans) → serve →
independent judge (PDF re-extraction sampling across the whole canon) — loop until >96.
