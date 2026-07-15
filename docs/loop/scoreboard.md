# Edition-1 Loop — Scoreboard

Loop contract: per ADR — implement → **Gate T** (tests) → **Gate V** (verify end-to-end)
→ **Gate G** (judge grade 1–100, adversarial rubric) → loop until **score > 96** → next ADR.
Method: SPARC phases with gates (grounded: `sparc/specification/README.md`); orchestration
pattern per Maestro ADR-004 (`ruflo/v3/@claude-flow/shared/src/plugins/official/maestro-plugin.ts`);
auto-continue pattern per Autopilot ADR-037 (`ruflo/ruflo/docs/adr/ADR-037-AUTOPILOT-CHAT-MODE.md`).

| ADR | Scope | Gate T (tests) | Gate V (verify) | Gate G round 1 | Fixes | Gate G final | Status |
|-----|-------|----------------|-----------------|----------------|-------|--------------|--------|
| ADR-001 | Edition format & static architecture | ✅ 10/10 | ✅ checksum stamped `sha256-2a75…af62c` | pending | — | — | judging |
| ADR-002 | App shell, reading, shelf, Books, teach, notes | ✅ 15/15 (incl. render suite) | ✅ served, 4/4 assets 200 | pending | — | — | judging |
| ADR-003 | Cards, walk, trail, event, thread | ✅ (walk/edge tests) | ✅ served | pending | — | — | judging |
| ADR-004 | Unified Search | ✅ (classifier tests) | ✅ served | pending | — | — | judging |

## Standing open items (declared, not hidden)
- Scripture text is **curator-unverified** (ADR-001): structural integrity is tested
  (anchors verbatim, warrants resolve); a diff against a canonical KJV source is required
  before any public release.
- URL routing / browser back (ADR-002), semantic doorway via rvf-wasm (ADR-004 → Edition 3).

## Judge log
(appended per round)
