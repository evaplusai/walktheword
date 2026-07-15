# ADR-003: Connection Cards, Walk & Trail

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Depends on | ADR-001, ADR-002 |
| Derived from | PRD §4.1–§4.3, §5 · Design 02 F2 fix |

## Decision

1. **Connection card** (bottom sheet on door tap): grade chip → claim stated as assertion
   ("Matthew 13:14 quotes Isaiah 6:9") → **target passage verbatim** → warrant as a
   tappable receipt → two actions: *Stay here* / *Walk*. Card content is 100%
   edition data; nothing composed (PRD §6.1–6.2).
2. **Walk** lands in the destination's own book context (or event/thread view for node
   destinations) and records a step: `{title, ref, grade, from, to}`.
3. **Trail** (`sessionStorage["wtw.trail"]`): session memory, not a history log —
   clears with the session, never synced. Return chip under the appbar names the exact
   verse you left; the Trail sheet renders all steps on the same arc rail as thread view,
   each with a working *Return*. **Keep this walk** writes one dated line to the notebook.
4. **Event view**: witness tabs (each gospel full-width at reading size), aligned phrase
   tinted; tapping it reveals the other witnesses' exact words; divergence flag stays
   dashed-amber and unresolved (harmonization remains impossible — PRD §5 anti-goal).
   **Thread view**: graded stops on the arc rail; every stop walks into its book.

## Open items

- Multi-hop return stack beyond the trail (currently the trail itself is the stack).
