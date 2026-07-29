# PostParade v2 — agent conventions

Two-sided horse-racing prototype: **tracks** (racing offices) publish condition
books, **trainers** request entries into them, and a person at the office accepts
or declines. This is the **revision build** — a separate site from
[`postparade`](https://github.com/pbueschel/postparade) (v1), created from the
2026-07-29 revision checklist in
[`docs/revisions-2026-07-29.md`](docs/revisions-2026-07-29.md). v1 is not
deprecated by this repo; it stays live for comparison.

**Session ritual:** read `plan.md` (including its **Held** section) and
`docs/worklog.md` before working; end substantive sessions by updating
`plan.md`, appending a worklog entry, recording decisions in
`docs/decisions.md`, running the verification gates, and committing.

## Rule 0 — the product rule that shapes every other decision

**No ratings, scores, projections, or statistics about a future or past result.**
No fit scores, win rates, speed or class figures, draw-in probability,
acceptance likelihood, suggested ships, or recommended races. The app may:

- read a **condition** and say whether a horse meets it (`app/conditions.js`),
- **flag** a conflict for a person to rule on, and
- report **facts**: purses, distances, spots, records, timestamps.

If a feature needs a number that predicts or ranks, it does not belong here.
`test/app-smoke.js` enforces this with content guards on every source file, and
`test/conditions-smoke.js` asserts the checker exposes no score-shaped fields.
Do not weaken those guards to land a feature — bring the question to Phil.

## File map

| Path | Role |
|---|---|
| `index.html` | Landing page — the loop, both workspaces, v1→v2 diff. Self-contained CSS. |
| `app.html` | App shell: workspace switcher, sidebar nav, router, notification bell, global search, empty `<section class="screen">` shells |
| `app/data.js` | `PPData` — normalized seed + facade (the future API shape). Rolling demo calendar. |
| `app/conditions.js` | `PPConditions` — eligibility gates, preference clauses, notices, condition-text parse. No scoring. |
| `app/store.js` | `PPStore` — localStorage overlay (`pp2.demo.v1`): submissions, decisions, messages, watches, roster edits, append-only audit log |
| `app/render.js` | Shared helpers (`esc`, `pill`, `spotsBar`, `horseLink`, `horseIcon`, `fmtStamp`, `openModal`…) + `PPRenderers` registry |
| `app/screens-trainer.js` | Trainer screens + the submission modal; exports `PPRaceDetail`, `PPMessagesLayout`, `PPSubmitModal` |
| `app/screens-track.js` | Racing-office screens + the decline modal |
| `app/screens-system.js` | Activity log + raw submission records (the app-developer end of the timestamps) |
| `plan.md` | Epics, work items, acceptance criteria, **Held** deliverables |
| `docs/revisions-2026-07-29.md` | The source checklist, item by item, with where each landed |
| `docs/worklog.md` | Session journal, append-only |
| `docs/decisions.md` | Decision log, append-only |
| `test/*.js`, `test/render-check.sh` | Verification gates |

## Hard rules

1. **Runtime is `bun`, not node.** Syntax check a file with
   `bun -e "new Function(require('fs').readFileSync('<file>','utf8'))"`.
2. **Rule 0 above.** Nothing predictive, ever.
3. **Seed is immutable.** Every user action goes through `PPStore`; seeded
   submissions are patched via `state.seedPatches`, never mutated in place.
4. **Spot counts come from `PPStore.spotsFor(raceId)`** — nowhere else. Both
   workspaces must show the same numbers.
5. **Timestamps are records, not renders.** A submission carries `submittedAt`,
   `decidedAt`, `decidedBy`; a decline carries `denialReason` + `denialComment`.
   The trainer view, track view, and `#system/log` all read those same rows.
   Show the absolute stamp (`fmtStamp`); relative time (`fmtAgo`) only beside it.
6. **A jockey is required at submission.** `PPStore.submit()` accepts a null
   jockey (the API shape allows it) but the UI must not.
7. **`esc()` every interpolated value.** One delegated `click` and one delegated
   `change` listener per screens file; after any mutation: `toast(...)` then
   `window.rerender()`.
8. **The demo calendar rolls.** All race days derive from `PPData.today`
   (`offset` from the anchor Saturday, or `fromToday`), so every condition book
   is perpetually open and one card always closes inside 24h. Never hard-code a
   calendar date into a race day.
9. **Real vs illustrative.** Real, cited facts (trainer, horses, pedigrees,
   owners, results) stay untouched. Condition books, race cards, spot counts,
   messages, and the calendar are illustrative and must be labelled as such
   where a reader could mistake them.
10. **Industry-correct terminology.** Condition book · race day · entry ·
    entry close · post time · also eligible (AE) · main track only (MTO) ·
    overnight · racing secretary. A trainer *submits*; the office *accepts* or
    *declines*.

## Adding a screen (3 steps)

1. Sidebar link: `<a class="nav-item" href="#trainer/x">` inside the right
   `data-nav` group in `app.html`.
2. Empty shell: `<section id="trainer/x" class="screen p-6 space-y-6">`.
3. Renderer: `PPRenderers['trainer/x'] = function (param, rawHash) { … }` in the
   matching screens file. Parameterized routes resolve through the `paramRoutes`
   prefix table (and `exactRoutes`) in `app.html`; `wsForRoute` decides which
   workspace a deep link switches to.

## Brand tokens

Page bg `#f7f8fa` (landing `#fbfaf7`) · ink `#0b1220 / #475569 / #94a3b8` ·
trainer accent turf green `#059669 / #10b981 / #ecfdf5` · track accent indigo
`#4f46e5 / #eef2ff` · system accent slate `#475569 / #f1f5f9` · cards white,
border `#eef0f4`, radius 14px, shadow `0 8px 24px -12px rgba(15,23,42,.08)` ·
fonts Inter + JetBrains Mono · logo = 32px `#0b1220` rounded square + flag glyph
in `#6ee7b7`. `index.html` must stay **self-contained** (inline CSS, no CDN JS)
so it works on Pages and as an artifact.

## Verification (run before every commit)

```sh
bun test/conditions-smoke.js    # eligibility rules + the no-prediction guarantee
bun test/app-smoke.js           # store/workflow loop + content guards
sh  test/render-check.sh        # every route in headless Chrome (slow, ~5 min)
```

`render-check.sh` asserts each route renders its landmark text and contains no
`undefined` / `NaN` / `[object Object]` / unrendered `${`. Manual loop test:
trainer submits → `#track/queue` shows it → accept → spot count rises on both
sides → reload persists → Reset demo data clears.

## Deploy

GitHub Pages serves **`main` at root** — public. Work on a feature branch,
staged logical commits, merge to `main` only with Phil's approval, then verify
the live URLs.
