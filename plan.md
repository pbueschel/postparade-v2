# PostParade v2 — plan

**What this is.** The revision build of PostParade: a second, independent site
built from Phil's 2026-07-29 revision brief. v1
(https://pbueschel.github.io/postparade/) put a recommendation engine at the
centre of the product. v2 takes it out and puts the **condition book** there
instead. Item-by-item traceability lives in
[`docs/revisions-2026-07-29.md`](docs/revisions-2026-07-29.md).

Date: 2026-07-29.

## Design tenets

1. **Rule 0 — nothing predictive.** No ratings, scores, win rates, projected
   finishes, suggested ships, or recommended races. The software reads
   *conditions* and reports *facts*. See CLAUDE.md Rule 0; it is gated by tests.
2. **A person decides.** Every submission is reviewed by the racing office. The
   condition checker flags; it never rules. A trainer can always **submit
   anyway**.
3. **One record, three views.** Trainer, track, and system read the same
   timestamped rows. A decision carries who made it, when, why, and any comment.
4. **Both sides see the same spots.** Filled, open, also-eligible, awaiting
   review — one arithmetic, one helper.
5. **Lightweight first.** Static site on Pages; `localStorage` overlay on an
   immutable seed, shaped like the future API so Stage 2 is a swap not a rewrite.

---

## Held — awaiting Phil's go-ahead

Phil authorised publishing this build (repo created, Pages enabled) at the start
of the 2026-07-29 session, so the site itself is **not** held. What remains held:

- [ ] **Pick a classic direction** (2026-08-06). Three variants across all five
      screens in `docs/mockups/2026-08-06-classic/index.html` — Paddock
      (restrained), Condition Book (the partner's), Racing Form (newsprint) —
      plus `b-modern.html`, B's palette with modern structure (rounded cards,
      list views, info boxes, stat tiles). Nothing is wired up until Phil picks
      one; adopting it means a pass over `index.html` and every
      `app/screens-*.js`.
- [ ] **Merge `landing-v1-design` to `main`** (2026-08-06). The landing page
      rebuilt on v1's design, with the predictive copy rewritten. All three gates
      pass. Merging publishes it to Pages, so it waits on Phil's go-ahead.
- [ ] **Client/investor walkthrough of v2** — the v1 repo's Held walkthrough
      guide should be re-cut against this build before it goes anywhere outward.
      Do not produce or send outward-facing v2 materials without explicit
      go-ahead.
- [ ] **Track-branded PDF condition books and overnight sheets.** Phil's brief:
      "not important right now but would be cool for the future." Print-to-PDF
      covers the demo need.
- [ ] **Horse-profile question box** ("has this horse won $22,000 other than
      maiden, claiming, or starter?"). Placeholder is on the profile so the shape
      can be agreed; answering must come from the record, never a projection.

---

## Epics

### E1 — Condition books as the entry path ✅ shipped 2026-07-29

- [x] **E1.1** Four paired tracks publish books (Ellis Park, Saratoga,
      Evangeline Downs, Delta Downs), 45 races across 11 race days.
      *Accept:* every book is open against the demo clock, and one card always
      closes inside 24h. Guarded by `conditions-smoke.js`.
- [x] **E1.2** Select track → chronological race list, filterable by entry close
      date, race date, surface, race type, and purse size.
      *Accept:* each filter narrows the list; reset restores it.
- [x] **E1.3** "Conditions as written" per race + a book-wide "See all
      conditions" modal — the bypass valve when a trainer reads a clause
      differently from the checker.
- [x] **E1.4** Condition parse rendered beside the raw text, so the extraction is
      auditable rather than trusted.

### E2 — Condition checking without prediction ✅ shipped 2026-07-29

- [x] **E2.1** Hard gates: entry window, breed registry, sex, age, maiden,
      non-winners ladder (`N_X` and `N2L/N3L` families), state-bred restriction
      (incl. NY registry approval), vet's list.
- [x] **E2.2** Flags the office settles: stakes nomination, race-day furosemide,
      starter-condition verification.
- [x] **E2.3** Preference clauses reported as **applies / does not apply /
      cannot be settled from the record** — never affecting eligibility.
- [x] **E2.4** Notices (equipment disclosure, MTO availability, AE list) that
      travel with a submission and never block it.
- [x] **E2.5** Test-enforced guarantee that nothing score-shaped exists.
      *Accept:* `conditions-smoke.js` fails if `check()` gains a score/rating/
      probability field or `data.js` regains a figure column.

### E3 — Submission → decision workflow ✅ shipped 2026-07-29

- [x] **E3.1** Submission requires a named jockey; supports AE/MTO, an equipment
      note, and a note to the office.
- [x] **E3.2** "Submit anyway" over a flagged conflict, with the flags
      snapshotted onto the record.
- [x] **E3.3** Office accepts, or declines with one of 11 standard reasons plus a
      free-text comment; both are shown to the trainer.
- [x] **E3.4** Timestamps on three ends — trainer, track, and `#system/log` /
      `#system/submissions`.
- [x] **E3.5** Accepted submissions fill spots; both sides read
      `PPStore.spotsFor()`.

### E4 — Rosters, history, and the office's tools ✅ shipped 2026-07-29

- [x] **E4.1** Trainer roster: add, remove, pursue races. Fixes v1's Horses tab,
      which deep-linked a single horse.
- [x] **E4.2** Track "Horses & history": entries per race, plus a standing record
      of every horse that has come through — new here, or N starts here.
- [x] **E4.3** Auto-drafted overnight sheets with MTO and also-eligible sections.
- [x] **E4.4** Overnights & extras notifications (bell + Entry windows).

### E5 — Equibase-shaped horse profiles ✅ shipped 2026-07-29

- [x] **E5.1** Identity (color, sex, year foaled, state/country bred), pedigree
      (sire, dam, dam's sire), lifetime record, connections of last start
      (jockey, trainer, owner, breeder), past performances, starts by track.
- [x] **E5.2** Per-horse identity icon, and the underlined name as the link on
      every row of every screen.

### E6 — Messaging ✅ shipped 2026-07-29

- [x] **E6.1** Stored threads per stable×track, writable from both workspaces,
      seeded with history so the feature reads true on first load.

### E7 — Entry windows (the renamed alerts page) ✅ shipped 2026-07-29

- [x] **E7.1** One page holding closing-inside-72h, watched races, and
      overnights/extras. Nothing deadline-shaped on the dashboard.

---

## Backlog

- **B1** Equibase rating on the profile — blocked on the Rule 0 question (see
  `docs/revisions-2026-07-29.md`, open questions).
- **B2** Coupled entries / trainer-owner conflict detection.
- **B3** Condition-book PDF ingestion (the parser already works on raw text).
- **B4** Stall applications, licensing, and paperwork status — referenced by one
  denial reason but not modeled.
- **B5** Real notifications (email/SMS on decisions and entry close).
- **B6** Stage 2 backend: Bun + `bun:sqlite` + a thin JSON API, so two real users
  share state. `PPData`/`PPStore` method shapes are already the API boundary.
- **B7** Multiple stables per track thread (the office side currently has one
  stable to talk to, because the demo has one trainer).

## Architecture (staged)

**Stage 1 — now.** Static site on GitHub Pages. Immutable seed (`app/data.js`) +
`localStorage` overlay (`app/store.js`). No build step, no framework; Tailwind
and lucide from CDN in the app, hand-written CSS on the landing page.

**Stage 2 — when two real users must share state.** `Bun.serve` (or Hono) over
`bun:sqlite`, same HTML, `PPStore` methods become `fetch` calls. Pages is
static-only, so Stage 2 moves the app to a small always-on host and leaves
`index.html` on Pages.

## Verification gates

```sh
bun test/conditions-smoke.js    # 48 assertions — rules + the no-prediction guarantee
bun test/app-smoke.js           # 178 assertions — workflow loop + content guards
sh  test/render-check.sh        # 26 routes in headless Chrome (~5 min)
```
