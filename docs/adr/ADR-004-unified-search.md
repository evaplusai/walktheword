# ADR-004: Unified Search — Reference Jump, Moment Routes, Cited Answers

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-001 |
| Derived from | PRD §5 (moment view, ask the archive), §11 (doorway problem) · Design 02 F5 fix |

## Decision

1. **One input** (the Search tab). `classifyQuery` (in `app/lib/graph.mjs`, tested)
   routes to three honest outcomes:
   - **Reference** ("mt 13", "john 3 16") → jump to the page. A reference to a chapter
     outside the edition slice is *admitted* ("not in this edition"), never faked.
   - **Situation** (keyword match against curator-set moments) → route cards: passage
     verbatim + curator backstory, each with *Walk*. The acknowledging line
     ("Sounds like a hard day — places to stand") is fixed curator copy in the artifact.
   - **Question** (keyword match against curator-set questions) → the honest line
     ("The text does not name its author."), cited passages verbatim, and the open-question
     note with its hollow C chip.
2. **The promise is printed on the door**: "Search only opens doors. It never writes
   answers." — user-visible copy, architecturally true (there is no generation path;
   the app ships no model and calls no API).
3. **Edition 1 matching is keyword-based** — deliberately simple and fully inspectable.
   The PRD's semantic doorway (on-device vector search, `@ruvector/rvf-wasm` per the
   architecture doc) is the Edition 3 upgrade; the routing-only contract stays identical,
   so the swap changes recall, not behavior. Recorded here so it is a decision, not drift.
4. **No-match is honest**: "No doors matched" plus the suggestion to try a reference —
   never a fallback answer.

## Open items

- Semantic matching (rvf-wasm) — Edition 3, per PRD §5 open design question.
- Multi-moment corpus growth is pure data work (no code change).
