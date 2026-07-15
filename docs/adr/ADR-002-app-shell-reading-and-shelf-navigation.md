# ADR-002: App Shell — Reading View & Shelf Navigation

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-001 |
| Derived from | PRD §5, §6.5, §7 · Design 02 (`docs/03_design/hx-review-v2-proposal.html`) |

## Decision

1. **One static page** (`app/index.html` + `app/app.js` + `app/lib/*.mjs`), mobile-first
   paper layout using the Design 01/02 tokens. No framework, no build step — the whole
   product is inspectable by view-source (supports PRD §10 "traceable by a skeptic").
2. **The shelf** (Design 02 F1 fix): persistent bottom bar with four plain words —
   **Books · Trail · Search · Notes** — plus the quiet `Ed 1` mark. No other chrome.
3. **Reading view**: a chapter rendered whole and in order; connection anchors become
   doors — **A solid / B dotted / C dashed** underlines (shape + color, Design 02 F4 fix).
   Verse text comes verbatim from the edition artifact; door markup wraps, never rewrites
   (rendering is a pure function in `app/lib/render.mjs`, covered by tests).
4. **Books sheet**: book → chapter, two taps to anywhere in the edition; chapters outside
   the Edition-1 slice are shown disabled with an honest note (never fake text). Continue
   row restores last position per book (`localStorage["wtw.continue"]`). The edition plate
   (number, changelog, corrections, **Verify this edition** — recomputes the ADR-001
   checksum in the browser via `crypto.subtle`) lives at the bottom of this sheet.
5. **First-open teaching** (Design 02 F3 fix): one screen, three grades in plain words,
   skippable, `localStorage["wtw.taught"]`; every grade chip anywhere replays its one-line
   meaning forever after.
6. **Notes**: private notebook — one dated line, attached to the current position,
   `localStorage["wtw.notes"]`, on-device only (PRD §4.5); export = the user's own copy.

## Open items

- URL/hash routing (browser back button, deep links) — deferred to Edition 2 ADR; the
  return chip + trail cover in-app back.
- Offline packaging (service worker) — deferred; the artifact is already cache-friendly.
