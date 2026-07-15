# ADR-008: Universal Verse Actions — Every Verse Is Tappable, Honestly

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-006, ADR-007 |
| Derived from | curator feedback 2026-07-15: "nothing is clickable on the text, the text is loaded but no action available" |

## Context

Edition 2 carries the whole canon but the graded map is still Edition-1 sized
(5 connections, KJV-anchored, all in Matthew 13) — by constitution: no connection ships
without a curator-graded warrant (PRD §6). So 1,188 of 1,189 chapters had zero
interactivity, and WEB had none anywhere. Correct data, broken experience.

## Decision

1. **Tap any verse → the verse card** (bottom sheet), graph-independent:
   - the verse quoted, with its human reference;
   - **Copy link** — the ADR-007 deep link (`#/read/book/ch/v`);
   - **Note here** — one dated line anchored to THIS verse (on-device notebook);
   - **Read in WEB/KJV** — the same verse in the other translation (the translation
     layer is itself a graph-free connection);
   - any graded doors anchored in the verse, each opening its connection card;
   - when there are none, an honest line: the map is Edition-1 scope and grows by
     curated editions — never auto-generated links.
2. **Verse-level door fallback**: when a door's KJV anchor phrase does not occur in the
   displayed text (WEB), the verse NUMBER carries the door — same grade shape/color
   vocabulary (A solid / B dotted / C dashed underline). The map is now walkable from
   both translations.
3. Doors keep priority: tapping a dotted phrase opens its connection card, not the
   verse card.
4. Keyboard note: doors remain focusable; verse spans are pointer/touch targets only
   (176 tab stops per psalm would wreck keyboard navigation). The keyboard/AT path:
   **a single-verse reference in Search opens the verse card directly** (implemented in
   `doSearch`; the card's controls are all focusable buttons/inputs). Recorded trade-off.

## The real fix beyond UI

The map itself must grow — that is curator work (PRD §8: ingestion alone is
insufficient; candidates require grading and warrants). A curator-workbench cycle
(candidate extraction → human grading → next edition) is the standing next step.
