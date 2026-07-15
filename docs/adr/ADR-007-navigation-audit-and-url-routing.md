# ADR-007: Navigation Audit & URL Routing

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-005, ADR-006 |
| Derived from | curator directive: "check all menus and navigation … check where you miss navigation between screens" |

## Audit findings

1. **Browser back button was dead** — the single biggest missing navigation. Screens had
   no URLs: no back, no forward, no deep links, no sharing a passage.
2. Editions load: with two full 4.3 MB editions, loading both at boot doubles startup
   weight for readers who never switch.
3. Start screen with 66 books needed structure (a flat 1,189-chapter wall is unusable).
4. Verified intact: shelf reaches Books/Trail/Search/Notes from every screen; return
   chips after walks/search; trail Return per step; Escape closes sheets; grade chips
   explain everywhere.

## Decision

1. **Hash routing.** Every screen has a URL: `#/start`, `#/read/<book>/<ch>[/<verse>]`,
   `#/event/<id>`, `#/thread/<id>`, `#/search`, `#/notes`. `showScreen` writes the hash;
   `hashchange` (browser back/forward) restores the screen. Deep links work — opening
   `#/read/john/3/16` on a fresh device passes through the ADR-005 adoption gate
   (KJV adopted out loud) — never a silent state, never preloaded content.
2. **Lazy editions.** Boot loads only the KJV edition (the graph's anchor substrate and
   the book-list source). The WEB edition is fetched on first selection, announced, and
   cached for the session.
3. **Verify-this-edition verifies the ACTIVE edition** — each Edition-2 artifact carries
   its own checksum and source-PDF SHA-256 (ADR-006 §2), so the WEB reader verifies the
   WEB file. (Supersedes the ADR-005 §3 rule that verify always targets KJV — that rule
   existed because the WEB layer had no artifact of its own; now it does.)
4. **Start screen is an accordion**: Old/New Testament sections list the 66 books; a
   tapped book unfolds its chapter grid in place. Same pattern as the Books sheet — one
   navigation grammar everywhere.
