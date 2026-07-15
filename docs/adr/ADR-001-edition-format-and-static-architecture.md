# ADR-001: Edition Format & Static Architecture

| Field | Value |
|-------|-------|
| Status | Accepted |
| Date | 2026-07-15 |
| Deciders | curator (evadraganova) · drafted by the edition-1 loop |
| Derived from | `docs/01_inital/PRD-living-scripture-graph.md` §4–§9 · `docs/02_architecture/ruv-stack-architecture.md` |

## Context

The PRD requires editions that are **read-only, numbered, verifiable, account-free, and
fully client-side** (§4.4, §7). The Ruv-stack architecture doc establishes that an edition
is "just a set of static files" whose integrity a skeptic can check.

## Decision

1. **An edition is one static JSON artifact** (`app/data/edition-1.json`) plus the app
   shell. No server, no accounts, no runtime generation — the constitution is enforced by
   architecture (PRD §6.2).
2. **Schema** (the open, forkable substrate — PRD §6.4):
   - `edition` — number, name, published date, `checksum`, changelog, corrections address.
   - `books[]` — id, name, canonical order, total chapter count, and the *included*
     chapters as verse maps. Partial books are explicitly marked `partial: true`
     ("Edition 1 slice"); reading whole books stays the first-class path as coverage grows.
   - `nodes[]` — events (witness refs, aligned phrases, divergence flags) and threads
     (graded stops). People arrive in Edition 2.
   - `edges[]` — every edge carries `grade` (A/B/C — explicitness, never truth), a
     resolvable `warrant` ref, a human-readable `claim` phrased as assertion
     ("X quotes Y", never "Y predicts X" — PRD §6.1), and an `anchor` (verse + exact
     phrase) that places its door in the text.
   - `moments[]` / `questions[]` — curator-set routes and cited answers for Search
     (retrieval-only; ADR-004).
3. **Verification**: `edition.checksum` is SHA-256 over the canonicalized artifact
   (stable-sorted keys, checksum field excluded), recomputed by `npm run checksum` and
   asserted by the test suite. *Target state per the architecture doc is RVF witness
   chains (SHAKE-256/Ed25519, `rulake/docs/gists/datalake-layer-deep.md`); SHA-256 is the
   Edition-1 stand-in and the upgrade is a data-format change, not an app change.*
4. **Graph engine deferral**: Edition 1 is ~90 verses / ~10 edges. It ships as plain JSON
   walked by `app/lib/graph.mjs` (pure functions, no dependencies).
   `@ruvector/graph-wasm` (Cypher-in-browser) is adopted when an edition's graph exceeds
   what naive lookup serves well (criterion: Edition ≥2 or >5,000 edges) — recorded here
   so the swap is a decision, not a drift.
5. **On-device state** (PRD §4.5): notebook → `localStorage["wtw.notes"]`; reading
   positions → `localStorage["wtw.continue"]`; walk trail → `sessionStorage["wtw.trail"]`
   (session memory, not a history log). Nothing ever leaves the device.

## Open items (declared, not hidden — PRD §4.4)

- **Scripture text is curator-unverified.** All passages are KJV rendered from the loop's
  best knowledge; before public release every verse must be diffed against a canonical
  public-domain KJV source. The test suite enforces *structural* integrity (anchors are
  verbatim substrings, warrants resolve); *textual* accuracy needs the canonical diff.
- Translation display layer (PRD §7) is out of scope for Edition 1.

## Compliance gates (this loop)

Tests green → PRD §6/§7 compliance review → judge grade 1–100, loop until >96.
