# PostParade v2 — condition books, entries, and the racing office

A two-sided horse-racing prototype: **tracks** publish condition books,
**trainers** request entries into them, and a person at the racing office accepts
or declines with a reason on the record.

**Live:** https://pbueschel.github.io/postparade-v2/ · app at
[`/app.html`](https://pbueschel.github.io/postparade-v2/app.html)
**v1, kept for comparison:** https://pbueschel.github.io/postparade/

This is the **revision build**, made from the 2026-07-29 brief. v1 put a
recommendation engine at the centre of the product; v2 takes it out and puts the
condition book there instead.

### Rule 0

No ratings, scores, win rates, projected finishes, suggested ships, or
recommended races — nothing statistical about a future or past result. The app
reads *conditions* and reports *facts*: purses, distances, spots, records,
timestamps. The one piece of inference left, condition matching, **flags**
conflicts for a person to rule on and can always be overridden ("submit
anyway"). This is enforced by tests, not convention — see `test/app-smoke.js`.

### Try it

| Route | What it shows |
|---|---|
| [`#dashboard`](https://pbueschel.github.io/postparade-v2/app.html#dashboard) | The barn in three actionable states: active · placement requested · entered |
| [`#trainer/books`](https://pbueschel.github.io/postparade-v2/app.html#trainer/books) | Pick a track → its condition book, chronological, five filters, raw conditions |
| [`#trainer/submissions`](https://pbueschel.github.io/postparade-v2/app.html#trainer/submissions) | Every request sent, with the office's decision, reason, and comment |
| [`#track/queue`](https://pbueschel.github.io/postparade-v2/app.html#track/queue) | The office side: accept, or decline with a standard reason + comment |
| [`#track/horses`](https://pbueschel.github.io/postparade-v2/app.html#track/horses) | Entries per race, and the standing record of every horse that has come through |
| [`#track/overnight`](https://pbueschel.github.io/postparade-v2/app.html#track/overnight) | An overnight sheet drafted from accepted entries |
| [`#system/log`](https://pbueschel.github.io/postparade-v2/app.html#system/log) | The third end of the timestamps — the raw event stream |

Switch workspaces from the name in the top-left corner. State persists in
`localStorage`; **Reset demo data** in the top banner clears it.

### Repo

- `app/data.js` seed + facade · `app/conditions.js` eligibility · `app/store.js`
  persistence · `app/screens-*.js` renderers · `app/render.js` helpers
- `plan.md` epics and Held items · `docs/revisions-2026-07-29.md` the checklist,
  item by item, with where each landed · `docs/decisions.md` why
- `CLAUDE.md` conventions for agents working in this repo

### Verify

```sh
bun test/conditions-smoke.js    # eligibility rules + the no-prediction guarantee
bun test/app-smoke.js           # workflow loop + content guards
sh  test/render-check.sh        # every route in headless Chrome (~5 min)
```

### About the data

Real where cited: the trainer, his horses, their pedigrees, owners, and the
results referenced on each profile. Illustrative where it must be: condition
books, race cards, spot counts, messages, and the demo calendar, which rolls
forward off the clock so the books are always open. Nothing here is a rating or a
projection. A concept prototype, not a system of record.
