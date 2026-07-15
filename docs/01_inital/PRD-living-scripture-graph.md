# PRD — Walk the Word
### (working title; the living scripture graph)

> *Thy word is a lamp unto my feet, and a light unto my path.* — Psalm 119:105

**Status:** Draft for build · idea-level only (no technology choices prescribed)
**Naming note:** "Walk the Word" is in use by a Toledo church, a ministry nonprofit, a blog, and a YouTube channel — none of them apps. Trademark search in the software class required before public launch.
**Inspiration:** The Dwight Peltzer "living history" microsite (porres.com/dwightpeltzer) — a versioned, source-graded, read-only archive of one life, maintained by a single curator.

---

## 1. One-sentence definition

The Bible presented as a single navigable graph — its people, places, events, passages, and images as nodes; its own internal connections as edges — where every connection is **walkable, graded, warranted, versioned, and bound to lived testimony**, published as numbered read-only editions by a curator, with no accounts and no generated content.

## 2. The problem

Everyone has access to the Bible's words. Almost no one has access to what the Bible is **doing** — the dense web of quotations, parallels, superscriptions, and threads that turn stories into understanding.

- An ordinary reader gets a fraction of what is on the page: they read the sower parable in Matthew 13 without seeing that Jesus quotes Isaiah four verses later, that Luke states the key ("the seed is the word of God"), or that Mark alone carries a fourth seed parable.
- Existing tools each solve one piece and fail the rest:
  - **Printed cross-references / Treasury of Scripture Knowledge:** the edges exist but are flat pointers — unwalkable, ungraded, unwarranted, frozen since the 1800s.
  - **Cross-reference visualizations (Harrison & Römhild's 63,779 arcs):** proves the graph exists and is dense, but is a poster — nothing is clickable or checkable.
  - **Bible apps / verse-of-the-day:** push fragments on someone else's schedule, stripped of context; devotional commentary blends into the text.
  - **General AI chat:** meets the user's moment in natural language but draws on everything, paraphrases, sometimes misquotes, differs every session, and accumulates nothing.
- Consequence: ten years of daily reading can stay flat — the same surface every pass — instead of compounding into depth.

## 3. Who it is for (in priority order)

1. **The daily reader** — someone already in scripture every day (e.g., psalms against fear) who wants each return visit to deposit something.
2. **Pastors and teachers** — sermon prep (parallel accounts aligned, quotations surfaced, tradition flagged as tradition), series planning, counseling retrieval, honest answers to hard questions.
3. **Families with children** — the Bible as connected story: a person's whole arc walkable in taps.
4. **New believers** — a front door into 66 non-chronologically ordered books: start anywhere, follow edges.
5. **Students and skeptics** — the evidence layer itself: what is multiply attested, single-witness, tradition, archaeology — shown honestly, tensions included.

## 4. The five defining properties (the actual requirements)

1. **Walkable.** Every connection is a door: reading John 19, tap the garments phrase, land in Psalm 22; from there tap David, land in his life. Movement through the text replaces page-flipping and tab-chasing.
2. **Graded.** Every edge carries a visible label of *explicitness* — never of truth:
   - **Grade A** — the text states the connection in words (explicit quotation, superscription, named presence at a named event).
   - **Grade B** — textual but unstated (parallel accounts, shared unattributed details).
   - **Grade C** — tradition or scholarship, not the text (e.g., "three" wise men, Golgotha's location).
3. **Warranted.** Every node and edge shows its receipt: the exact verse that creates it, one tap away. No connection exists without a warrant. Claims invite verification, never trust.
4. **Versioned.** The graph ships as numbered editions with a visible changelog ("Edition 3 · see what changed"). Corrections and additions arrive only in the next edition — never silent edits. **The scripture text itself never changes;** only the map around it grows. Open questions are declared on the page, not hidden (model: Peltzer's unidentified Bach; precedent: critical editions of the biblical text that grade readings and fold in evidence across editions).
5. **Bound to lived testimony.** Lived experience is held beside the record, clearly labeled, never blended:
   - Ancient: superscriptions binding psalms to David's crises ("when the Philistines took him in Gath"); Jesus reaching for Psalm 22 on the cross.
   - Personal: the reader's own dated one-line notes, attached to passages, **stored on the reader's device only.**

## 5. Core product surfaces

- **Reading view** — a book, read whole and in order (the graph must never dissolve the books; each of the 66 is a first-class witness with its own voice, genre, and perspective). Connections appear as tappable phrases; tapping opens a **connection card**: grade badge, target passage in the scripture's own words, warrant line, and a "walk" action.
- **Event view** — one event, all its witnesses side by side, differences preserved and flagged (harmonization is a named anti-goal). Genuine divergences (e.g., placement of the temple cleansing) are shown and graded, not resolved.
- **Person view** — a life as a walkable arc across books (Peter: calling → confession → denial → restoration → Pentecost).
- **Thread view** — an image or word followed across the canon ("seed": sower → mustard seed → tares → grain of wheat → sowing and reaping → incorruptible seed).
- **Moment view** — passages gathered around situations of human life, each with its backstory. *Open design question (unresolved):* people do not speak in category labels ("fear"); they say "my mother is in the hospital." A natural-language doorway that only **routes** to graph destinations — and never composes answers — is likely required. Whether the split (language model as door, bounded graph as destination) beats general AI end-to-end is untested.
- **Ask the archive** — a question box bounded to the text and the graph only: quotes, cites chapter and verse, and says plainly when the text does not address the question. It never generates interpretation and never fills gaps.
- **Private notebook** — one dated line per entry, attached to a passage or connection, on-device only. No sync requirement, no account, invisible to everyone including the curator.
- **Edition footer** — edition number, date, changelog link, and a plain email address for corrections.

## 6. Editorial constitution (non-negotiable rules)

1. **Assert, never adjudicate.** The graph records what the text asserts, not what is true. Not "Psalm 22 predicts the crucifixion" but "John 19:24 quotes Psalm 22:18 — warrant: John 19:24." Contested theological readings enter only as attributed assertions ("Acts 8:35 applies Isaiah 53 to Jesus") or stay out.
2. **No generated content.** Nothing composed by AI appears as content. Scripture answers scripture. AI may assist the curator in extraction; every candidate edge is human-reviewed, graded, and warranted before shipping.
3. **Source types stay visible** so testimony and documentation "reinforce one another without becoming indistinguishable" (the Peltzer principle).
4. **Curator is an editor, not an authority.** Scope limited to checkable textual facts. Methodology published. The data format is open and forkable — plurality by design (a Catholic edition, a Jewish Tanakh edition, a scholarly edition can share the substrate). No single graph claims to be *the* graph.
5. **The books are the foundation layer.** Every connection hangs off the book that attests it. Reading a book straight through is always a first-class path.

## 7. Explicit anti-requirements (what this is NOT)

- **No social layer.** No accounts, comments, feeds, sharing, likes, follower counts, or public testimonies. Value must be complete for a userbase of one on day one.
- **No engagement mechanics.** No streaks, notifications, or retention design. The ideal outcome is a reader who internalizes the reflexes and needs the tool less.
- **No counseling, application, or theology.** It shows what the text is doing; meaning, conviction, and care remain with the reader, their pastor, and their community.
- **No replacement claims.** It does not replace reading whole books, church, pastors, or conversational AI — it is the reference layer beneath them.
- **No alteration of scripture.** Public-domain text, rendered verbatim. Translations are a display layer over an unchanged graph.

## 8. Raw material (idea-level; all open or public domain)

- Public-domain scripture text (e.g., KJV or World English Bible).
- Existing open structured data as **ungraded candidates** only: named-people/places datasets (~3,000 people, ~1,200 places), public-domain cross-reference corpora (hundreds of thousands of verse pairs), geocoded place data.
- The curator's pass — grading and warranting — is the product's actual added value; ingestion alone is explicitly insufficient.

## 9. Scope and editions

- **Edition 1:** one deep, complete slice rather than shallow coverage — e.g., the Passion narrative (roughly 200 nodes, ~1,000 graded edges: four witnesses aligned, all explicit OT quotations, people, places) **or** Matthew 13 + the seed thread. Ships with reading view, connection cards, one event view, notebook, edition footer.
- **Edition 2:** the life of Jesus — events, people, places, four-gospel parallel edges.
- **Edition 3:** the Psalms bound to David's life via superscriptions; moment views.
- **Edition N:** whole canon, grades throughout. Each edition is complete in itself; the number tracks the graded frontier and corrections.

## 10. Success criteria (idea-level)

- A first-time visitor reading one chapter encounters at least one true, warranted connection they did not know — and can verify it in one tap.
- A returning daily reader's familiar passages measurably accumulate layers (story, quotations, threads, their own notes) — deepening, defined as: the same words carrying more on the fiftieth reading than the first.
- A pastor preparing a sermon reaches aligned witnesses + quotations + tradition-flags faster than their current reference workflow, with zero risk of presenting grade-C tradition as text.
- Every claim on every screen can be traced to a verse by a skeptical reader without leaving the product.
- The product remains fully valuable with exactly one user and zero contributions.

## 11. Known risks and open questions (carried honestly)

- **The doorway problem:** category labels don't match how distressed people speak; the natural-language router is undesigned and unvalidated.
- **Non-converging open questions:** unlike the Peltzer site's findable Bach program, questions like the authorship of Hebrews never close; the living record's job is an honest map of where they stand, not closure.
- **Curator standing:** mitigated by the assert-not-adjudicate rule and forkability, but a lone editor of a sacred text will still draw challenge; the constitution above is the defense.
- **Unvalidated demand:** every user flow in this document is hypothesis. The build should be small enough that five real testers, not diagrams, render the verdict.
