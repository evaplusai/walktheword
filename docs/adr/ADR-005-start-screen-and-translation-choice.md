# ADR-005: Start Screen & Translation Choice — No Preloaded Content

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-001, ADR-002 |
| Supersedes | ADR-002 boot behavior (auto-landing in Matthew 13) |
| Derived from | curator feedback 2026-07-15: "no preloaded content — all editions on the choice, select initially" |

## Context

The app booted straight into Matthew 13 — the wireframes' *example* passage promoted by
accident into a product default. An edition must present **what it carries** and let the
reader choose; nothing is "the" starting passage (PRD §3: "start anywhere, follow edges").

## Decision

1. **Start screen** replaces any default landing. After first-open teaching (unchanged),
   the reader sees, in order:
   - **Translation choice** — one card per loaded translation (Edition 1: KJV and WEB,
     both extracted from the curator's sources). Explicit tap required; the choice
     persists (`localStorage["wtw.translation"]`) and is switchable any time from the
     Books sheet.
   - **The loaded content** — every included book with its included chapters, honestly
     labeled ("Matthew — 1 of 28 chapters in this slice"). Tapping a chapter starts
     reading. No passage is preselected.
2. **Returning readers** resume their own last position (Continue) — that is the
   reader's choice remembered, not preloaded content. With no history, the start screen
   shows again.
3. **WEB is a display layer over the unchanged graph** (PRD §7). Edition 1's connection
   anchors are KJV-phrase-bound, so inline doors render only where the anchor phrase
   exists in the displayed text; in WEB mode the reading view says so honestly and points
   to the KJV toggle. Search (references, moments, questions) quotes the active
   translation. **Verify this edition** always verifies the KJV edition artifact
   (the graph's substrate).
4. **Open item:** verse-level door fallback for translations whose wording diverges from
   the anchor phrase (doors attach to the verse, not the phrase) — Edition 2.

## Gates
Tests (translation application, both-resolve, no-default-landing logic) → serve →
judge grade >96.
