# Worklog

Append-only session journal. Newest entry first.

---

## 2026-08-06 — direction B (modern pass) adopted across the product

**What changed.** Phil picked the modern pass. Implemented it in the real build:
`index.html`, `app.html`, and the screen renderers.

**How it is wired** — the decision that made this tractable. `app.html` now
**remaps the built-in Tailwind scales** (`slate`, `emerald`, `amber`, `red`,
`indigo`, plus the horse-tint colours) onto the parchment/forest palette rather
than replacing them, so the utility classes already spread across ~2,000 lines
of screen renderers carried the new palette with no markup churn. Shape and
typography then come from a component layer in `app.html`'s `<style>`: `.card`,
`.tile`/`.tile-v`, `.list`/`.list-row`/`.list-col`, `.info` (+`-accent`,
`-alarm`), `.checkrow` (+`.flag`, `.hard`), `.meter`, `.seg`, `.chip`,
`.cond-text`. Documented in `CLAUDE.md` — keep the ramp direction (50 lightest,
900 darkest) or every screen shifts at once.

Structural work, screen by screen:

- **Chrome** — dark forest sidebar, pill search, rounded bell and CTA.
- **Trainer dashboard** — stat tiles with serif numerals and meters (the filter
  buttons kept their `pp-dash-tile`/`data-filter` hooks); horse slip is a list.
- **My Horses** — list view, round silks avatars, fixed-width labelled columns.
  Widths are pinned deliberately: content-sized columns did not align row to row.
- **Condition book** — each race is a card: number badge, serif title, facts as
  pills, fill meter, footer action bar.
- **Condition checks** — `.checkrow` rows plus info boxes, in the submission
  modal, the book's race cards, and the office's entry-request queue.
- **Track dashboard** — stat tiles; declines are oxblood info boxes.
- **`index.html`** — regenerated in one pass, self-contained, palette by hand.

New helpers in `app/render.js`: `infoBox()`, `statTile()`; `spotsBar()` now
emits the rounded meter; `horseIcon()` is a round avatar; `emptyState()` and the
modal were restyled.

**Left alone on purpose.** The past-performances, entry-windows, and
activity-log tables stay tables — they are genuinely tabular and a list view
would read worse. They inherit the palette regardless.

**Verification.** `bun test/conditions-smoke.js` 48/48 · `bun test/app-smoke.js`
178/178 (Rule 0 guards intact) · `sh test/render-check.sh` **26/26 routes
clean**. An earlier render-check run was stopped and re-run from scratch — it
had been started while files were still being edited, which would have made the
result meaningless.

**Gotcha worth remembering.** Screenshotting `app.html#<route>` shows the page
scrolled past the demo banner and topbar, because the fragment scrolls the
`<section id="…">` into view. Not a rendering bug — screenshot `app.html` with
no hash to see the chrome. `sips --cropOffset` also does not crop where you
expect; do not use it to locate regions.

**What's next / held.** On `landing-v1-design`, **not merged**. Merging
publishes to Pages and needs Phil's go-ahead.

---

## 2026-08-06 — direction B, modern pass

**What changed.** Phil asked for another pass at B using modern styling and UI
choices — rounded corners, list views, info boxes — keeping the same colouring.
Built `docs/mockups/2026-08-06-classic/b-modern.html`, all five screens again.

Every colour value is identical to variant B. The structure is not:

- rounded cards (16px) and controls (9px) replace hairline-ruled panels;
- **My Horses is a list view**, not a table — round silks avatar, horse and
  breeding on the left, labelled columns right, one action per row, and it
  reflows to a single column instead of scrolling sideways;
- notices became **info boxes** (tinted, iconed, with a bold lead line);
- the three dashboard panels became **stat tiles** with rounded meters;
- the tab strip became a **segmented control**; filters became pill chips;
- condition-book races became individual cards with a fill meter and a footer
  action, each carrying its own flag info box where one applies;
- the meets grid became separate cards floating on the parchment ground.

Kept classic on purpose: Source Serif display headings, and monospace confined
to data that wants to line up — times, money, records, and the condition text,
which still reads better as a typed book than as UI copy. Body copy moved to
Inter, which is what makes the whole thing read modern.

Separate file rather than a fourth theme toggle in `index.html`: the difference
is structural, not token-level, so it could not be expressed as a variant of the
same markup. The two files cross-link.

**Noted for the decision.** Modern structure costs vertical space — seven horses
occupy roughly what nine did in the ruled table. If the roster is where trainers
live, a density toggle on the list view is the fix.

**Verification.** Headless-Chrome dump clean (no `undefined`, `NaN`, `[object`,
unrendered `${`); screenshotted at 1440px. Fixed a sidebar bug where the brand
and user names ran into their subtitles (inline spans needed `display:block`).

**What's next / held.** Still mockups — nothing wired to `app/`. Awaiting Phil's
pick between original B and this pass.

---

## 2026-08-06 — classic-direction mockups (three variants, five screens)

**What changed.** Phil supplied two screenshots from a partner's brief attempt —
a racing-form treatment: forest-green chrome, parchment ground, old-style serif
headings over monospace uppercase micro-labels, hairline rules, oxblood alert
bars — and asked for mockups giving the site a classic feel. Scope agreed with
him: **all five surfaces, three variants.**

Built `docs/mockups/2026-08-06-classic/index.html` — one static file, one
markup, three themes switchable in place, so the screens compare like for like.
Every difference between directions is a CSS custom property.

Directions:

- **A · Paddock** — current v2 palette, classic typography only. Cheapest to
  adopt, least distinctive.
- **B · Condition Book** — the partner's treatment. Parchment `#f2efe6`, forest
  green `#24402f` chrome, gold and oxblood accents. (Default on load.)
- **C · Racing Form** — newsprint. No round corners, ruled tables, tighter rows,
  gold on near-black chrome. Most characterful, most work to hold consistent.

Screens: landing, trainer dashboard, My Horses, condition book, race
detail + submission. Data is the real seed (LaRose's 16-horse string, Ellis Park's
book, the four paired tracks) so the density is honest rather than flattering.

Two deliberate departures from the partner's screenshots: their sidebar reads
"J. Thomas / Trainer Workspace" against a stock roster — these use Kinnon LaRose
and the real string; and their "Find a race" action became "Open book", since
the app takes you to the condition book rather than proposing races.

**Verification.** All three variants dumped in headless Chrome — no `undefined`,
`NaN`, `[object`, or unrendered `${`. Screenshotted at 1400px.

**What's next / held.** Mockups only — nothing is wired to `app/`, and no gate
runs against the file. Awaiting Phil's pick before any of it touches
`index.html` or `app/`. Landing rebuild from earlier today is still on
`landing-v1-design`, unmerged.

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
