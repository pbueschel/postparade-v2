# Worklog

Append-only session journal. Newest entry first.

---

## 2026-08-06 — landing page rebuilt on v1's design

**What changed.** Phil asked why the landing page had changed and said it needs
to be the same one. Finding: it never changed. v2's `index.html` was written
fresh in `738efeb` (2026-07-29) and never edited since; v1's landing is
untouched at https://pbueschel.github.io/postparade/. They are separate repos
and separate Pages sites, so v2 never inherited v1's page.

Verbatim reuse was not possible: v1's landing is built on the removed engine
("Race recommendations and eligibility, automated"; "Three steps. Then ranked
spots, every morning."), and `index.html` is in the Rule 0 content-guard list in
`test/app-smoke.js`. Phil chose: **port v1's design, rewrite the predictive
copy.**

Regenerated `index.html` in one pass with v1's structure and visual language —
over-the-hero nav, gradient + grid hero backdrop, stacked/rotated floating card,
problem strip, numbered step cards, three-column "who it's for", alternating
feature rows, pilot pricing, dark CTA strip, footer, login modal. Reproduced in
hand-written CSS with an inline SVG sprite instead of v1's Tailwind + lucide
CDNs, because v2's `index.html` must stay self-contained.

Copy rewritten to the actual product: hero card is a condition book with a
flagged preference clause instead of a 94 FIT ring; "how it works" is v2's real
four-step loop; the owner workspace (which v2 does not have) became "The
record"; the jockey/ship-share feature row became jockey-at-submission plus
timestamps. Kept from the old v2 page: the v1→v2 diff table (unchanged, and the
render-check landmark), the "Still open" callout, and "About the data".

**Verification.** `bun test/conditions-smoke.js` 48/48 · `bun test/app-smoke.js`
178/178 (including the Rule 0 guards on `index.html`) · `sh test/render-check.sh`
all 26 routes clean. Screenshotted at 1440px.

**What's next / held.** On branch `landing-v1-design`, **not merged** — merging
to `main` publishes it, which needs Phil's go-ahead.

---

## 2026-07-29 — repo created; v2 revision build shipped end to end

**What changed.** Built PostParade v2 from scratch in a new repo as a second,
independent GitHub Pages site, from Phil's 2026-07-29 revision brief (platform
checklist + Weg's notes + the consolidated notes). v1 stays live and untouched.

Two decisions taken with Phil before writing code:

1. Own repo + own Pages site, created and published immediately (Phil overrode
   the usual HELD-until-approval rule for this deliverable).
2. "Spot alerts" → **"Entry windows"**, with "entries closing soon" merged into
   it as its own page rather than a dashboard block.

Shipped, in one pass:

- `app/data.js` — new seed. Four paired tracks publishing condition books
  (Ellis Park, Saratoga, Evangeline Downs, Delta Downs), 45 races over 11 race
  days on a **rolling calendar** derived from the demo clock, 41 horses
  (Kinnon LaRose's real roster + rival barns + AQHA horses for the registry
  gate), 11 jockeys with agents, 11 standard denial reasons, seeded submissions
  in every state, seeded message threads, and overnight/extra notifications.
  Every figure column from v1 (`classR`, `lastSpeed`, `trainerPct`, `par`) is
  gone — the seed carries records and conditions only.
- `app/conditions.js` — replaces v1's scoring engine. Hard gates (entry window,
  registry, sex, age, maiden, non-winners ladder, state-bred, vet's list),
  office-settled flags (nomination, furosemide, starter verification),
  preference clauses reported as applies / does not apply / **cannot be settled
  from the record**, notices that never block, and a raw condition-text parse
  rendered beside the text so extraction is auditable.
- `app/store.js` — submissions as a request/decision record (`submittedAt`,
  `decidedAt`, `decidedBy`, `denialReason`, `denialComment`, `overrode`,
  `conflictsAtSubmit`), messages, watches, roster edits, and an append-only
  audit log that all three views read.
- `app.html` — shell with a workspace switcher spanning trainer, each of the
  four tracks, and a system/developer view; router with param + exact route
  tables; notification bell; global search over horses, tracks, and races.
- Screens: trainer (dashboard, my horses, condition books, entry windows,
  submissions, messages, horse profile, race detail), track (racing office,
  our condition book, entry requests, horses & history, overnight sheets,
  messages, race detail), system (activity log, submission records).
- `index.html` — landing page including an explicit v1→v2 diff table.

**Verification.** `bun test/conditions-smoke.js` 48/48;
`bun test/app-smoke.js` 178/178; `sh test/render-check.sh` — all 26 routes plus
the landing page render clean in headless Chrome (no `undefined`, `NaN`,
`[object Object]`, or unrendered `${`). Manual loop confirmed: trainer submits →
office queue → accept → spot count rises on both sides → reload persists →
Reset demo data clears.

Two test-side corrections worth remembering: `--dump-dom` includes `<script>`
bodies, so the junk scan must strip them or every template literal reads as a
failure; and the content guards must be line-scoped with comments stripped,
because the docs and the v1→v2 table legitimately *name* the removed features.

**What's next.**
- Open questions for Tom: equipment required at entry? Equibase rating on the
  profile (it conflicts with Rule 0 as written)? Coupled entries?
- Backlog B1–B7 in `plan.md`; nothing blocking.

**Published.** Repo `pbueschel/postparade-v2` created public, `main` pushed,
Pages enabled from `main` at root. Live at
https://pbueschel.github.io/postparade-v2/ (app at `/app.html`); landing page,
app shell, and all seven `app/*.js` modules return 200, and `#dashboard`,
`#trainer/books/ELP`, and `#track/queue` were re-checked in headless Chrome
against the deployed URL, not just `file://`.

**Held.** Outward-facing v2 walkthrough materials, track-branded PDF exports,
and the horse-profile question box. The site itself is published per Phil's
go-ahead.
