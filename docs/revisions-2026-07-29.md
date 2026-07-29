# Revision checklist → where it landed

Source: Phil's 2026-07-29 revision brief (platform checklist + Weg's notes +
the consolidated notes). Every line item below is traceable to a route, a
module, or an explicitly parked decision. `✅` = built and covered by a gate.
`◻` = deliberately not built, with the reason.

Two naming decisions were taken with Phil at the start of the session:

- **"Spot alerts" → "Entry windows"** (`#trainer/windows`). "Entries closing
  soon" merged into it.
- Site lives in its own repo (`postparade-v2`) and its own Pages site, so v1
  stays live for comparison.

---

## Dashboard / horse slip

| Item | Status | Where |
|---|---|---|
| Hover command broken on horses already placed | ✅ | Hover affordance deleted. Every row action is a real control; nothing depends on hover. `render.js#horseLink` |
| Underlined horse name is the working link | ✅ | `horseLink()` — underlined, `#horse/:id`, on every row of every screen |
| Clicking a horse name opens its profile | ✅ | `#horse/:id` → `screens-trainer.js` `PPRenderers['scr-horse']` |
| Each horse profile has its own icon | ✅ | `data.js#iconFor` — deterministic lucide glyph + tint per horse id; `render.js#horseIcon` renders it at three sizes |
| "Active horse" must be actionable | ✅ | Dashboard tiles are buttons that filter the slip; every row links out to the profile and to the condition books |
| Add "Placement" status | ✅ | `PPStore.statusOf` → `placement` when a submission is pending |
| Add "Entered" status | ✅ | `PPStore.statusOf` → `entered` when a submission is accepted |
| Remove "Win rate" | ✅ | Gone from data and UI; `app-smoke.js` content guard fails the build if it returns |
| Dropdown filter across Active / Placement / Entered | ✅ | `#dashFilter` select **and** the four clickable tiles (all → the same state) |

## Condition books (was "See spots")

| Item | Status | Where |
|---|---|---|
| Rename "See spots" → "See condition books" | ✅ | Nav item + `#trainer/books` |
| Flow: select track → race list | ✅ | `#trainer/books` (track picker) → `#trainer/books/:trackId` |
| Races connected to the app via track postings | ✅ | Four paired tracks post books: Ellis Park, Saratoga, Evangeline Downs, Delta Downs. `PPData.pairedTracks()` |
| Chronological default sort | ✅ | `PPData.raceSortKey` — post time, then race number; grouped by race day |
| Filter: entry close date | ✅ | `bookFilters.closeBy` |
| Filter: race date | ✅ | `bookFilters.raceDate` |
| Filter: surface | ✅ | `bookFilters.surface` (dirt / turf / synthetic) |
| Filter: type of race | ✅ | `bookFilters.type` — MSW, maiden claiming, claiming, allowance optional claiming, starter allowance, allowance, trial, listed, stakes |
| Filter: purse size | ✅ | `bookFilters.purseMin` |
| "See all conditions" bypass valve | ✅ | Per-race "Conditions as written" panel **and** a book-wide "See all conditions" modal with the raw text of every race |
| "Submit anyway" when a conflict is flagged | ✅ | The submit button flips to *Submit anyway* when `PPConditions.check` reports a conflict; the flags are snapshotted onto the record (`conflictsAtSubmit`) |
| Openings left / spots visible to both sides | ✅ | `PPStore.spotsFor()` → `render.js#spotsBar`, used identically on trainer and track screens |

## Entry submission

| Item | Status | Where |
|---|---|---|
| Jockey named at submission | ✅ | Required by the submission modal (11 riders with agents); the office sees "no jockey named" in red if a record lacks one |
| AE / MTO designation | ✅ | `aeMto` on the submission; MTO offered only where `race.mtoAllowed`; both carry into the overnight sheet |
| Equipment disclosure | ✅ *(advisory)* | Field present on the submission form and on the review card, marked "requirement pending confirmation". Modeled as a `notice` in `conditions.js`, never a blocker — flip it to a gate once confirmed with Tom |
| All submissions manually reviewed | ✅ | Nothing auto-enters. Every submission lands in `#track/queue` as `pending` |

## Track accept / decline

| Item | Status | Where |
|---|---|---|
| Track must accept or decline per race | ✅ | `#track/queue`, `PPStore.accept` / `PPStore.decline` |
| Dropdown of standard denial reasons | ✅ | 11 reasons in `PPData.denialReasons` (oversubscribed, ineligible, preference, jockey, vet's list, equipment, late, paperwork, nomination, race cancelled, other) |
| Free-text comment for one-off reasons | ✅ | `denialComment`, stored and shown to the trainer on `#trainer/submissions` and the dashboard |

## Timestamps on all three ends

| Item | Status | Where |
|---|---|---|
| Trainer end | ✅ | `#trainer/submissions` shows submitted / decided / by whom per record |
| Track end | ✅ | `#track/queue` shows submitted + waiting time + decided |
| App-developer end | ✅ | `#system/log` (append-only event stream, UTC + local) and `#system/submissions` (the raw record with every field) |

## Removals

| Item | Status | Note |
|---|---|---|
| Remove "suggested ship" | ✅ | Shipping features and the supplement/Ship-&-Win program are not in v2 at all |
| Remove all AI suggestions | ✅ | No recommendation engine. The only inference left is condition matching, which flags and never rules |
| Remove win rate / predicted outcomes | ✅ | Guarded by `app-smoke.js` |
| Remove algorithms / statistics about future or past events | ✅ | `conditions-smoke.js` asserts `check()` exposes no score-shaped field and `data.js` carries no figure fields (`classR`, `lastSpeed`, `trainerPct`, `par`) |
| Remove "Entries closing soon" from the forced view | ✅ | Dashboard has no deadline block; the capability lives on `#trainer/windows` |
| Merge closing-soon into the renamed alerts page | ✅ | One page: closing inside 72h + watched races + overnights & extras |
| Remove the recommendations tab entirely | ✅ | Route, renderer, and nav item all absent |

## Horses tab

| Item | Status | Where |
|---|---|---|
| Fix the bug that deep-linked one horse ("Zengraya") | ✅ | Nav points at `#trainer/horses`; `app-smoke.js` fails if any nav item deep-links `#horse/<id>` |
| Trainer view: all horses managed, add / remove / pursue races | ✅ | `#trainer/horses` — roster table, add form (registration facts only), remove, "Pursue races" per horse |
| Track view: horses entered per race | ✅ | `#track/horses` → "Entered per race" tab, grouped by race day |
| Track view: persistent system log after a race is run | ✅ | "System log" tab — every horse that has ever been submitted to or run at this track stays listed |
| Track view: new to this track vs. raced here before | ✅ | `PPData.startsAtTrack` — a violet "New to this track" pill or the start count |
| Track view: tally of starts at this track | ✅ | Same helper; also on the request review card and the horse profile ("Starts by track") |

## Requests → submissions store

| Item | Status | Where |
|---|---|---|
| Restructure as a store of trainer→track submissions | ✅ | `#trainer/submissions` (trainer's copy) and `#track/queue` (office's copy) over one `PPStore` collection |

## Messaging

| Item | Status | Where |
|---|---|---|
| Tracks and trainers can message each other | ✅ | `#trainer/messages/:trackId` and `#track/messages`, one thread per stable×track |
| Store and save messages | ✅ | `PPStore.messages` / `sendMessage`, persisted under `pp2.demo.v1`; seeded history so threads are not empty on first load |

## Race detail

| Item | Status | Where |
|---|---|---|
| Aligns with races hosted by paired tracks | ✅ | `#race/:id` (trainer) and `#track/race/:id` (office) render from the same `PPRaceDetail` |
| Purse amount | ✅ | Header tile |
| Dirt or turf | ✅ | Surface tile + surface pill (synthetic supported) |
| Which race of which event at which track | ✅ | `raceWhere()` — "Race 4 of Summer Meet at Ellis Park · Saturday, August 8" |
| Search by track → all race events they host | ✅ | Global search (horses · tracks · races) and the condition-book track picker |
| Filter per race within an event | ✅ | The five book filters, plus per-race-day tabs on the track side |
| Spots allocated, openings left, filled | ✅ | "Spots allocated" panel, identical numbers on both sides |

## Track tools

| Item | Status | Where |
|---|---|---|
| View our condition books | ✅ | `#track/book` / `#track/book/:raceDayId` — the book as trainers see it, with spots and pending counts |
| See horses requesting entry | ✅ | `#track/queue`, plus per-race "Requests awaiting the office" on the race detail |
| Review queue to approve / reject | ✅ | Same screen |
| Auto-generated overnight sheets | ✅ | `#track/overnight/:raceDayId` — drafted from accepted entries, with MTO and also-eligible sections, print/save-as-PDF, and a "notify trainers" action |
| Notifications for overnights and extras | ✅ | Bell in the top bar + the Overnights & extras block on `#trainer/windows`; one seeded extra race (`elp-d2-r8`) posted after the book |
| Track-branded PDF condition books / overnights | ◻ | Phil's brief marks this "not important right now" — print-to-PDF covers it; parked in `plan.md` Held |

## Horse profile

| Item | Status | Where |
|---|---|---|
| Similar to an Equibase profile | ✅ | `#horse/:id` — identity, pedigree, lifetime record, connections of last start, past-performance table, starts by track |
| Color | ✅ | `horse.color` |
| Sex | ✅ | `horse.sexLabel` (colt / filly / gelding / horse / mare / ridgling) |
| State / country bred | ✅ | `horse.bred` + USA |
| Year foaled | ✅ | `horse.foaled` (age derived from the demo clock) |
| Parents | ✅ | Sire, dam, dam's sire |
| Connections of last start: jockey, trainer, owner, breeder | ✅ | Its own panel |
| Chat box to ask questions about a horse | ◻ | Marked "not important right now" in the brief. Present on the profile as a labelled *Planned* placeholder so the shape is agreed before it is built |
| Equibase rating on the profile | ◻ **open question** | Weg's note says "ask Tom". Deliberately absent — a rating is exactly what Rule 0 excludes, so this needs a decision, not a default |

## Condition matching

| Item | Status | Where |
|---|---|---|
| Parse raw condition text | ✅ | `PPConditions.parse` — purse, surface, claiming price, state-bred, off-the-turf clause, no-furosemide clause, nomination language, Quarter Horse flag |
| Extract distance, surface, type, purse, restrictions, weight, preference clauses | ✅ | Structured on each race + rendered in the "What we read out of it" panel next to the raw text |
| Flag likely conflicts rather than ruling | ✅ | `hard` conflicts (would not pass the entry box) vs `flag` (the office settles it); both allow Submit anyway |
| Check "preferred" clauses, e.g. non-starters for $55,000 or less in the last 3 starts | ✅ | `preferences()` reports **applies / does not apply / cannot be settled from the record**, and never affects eligibility. Weg's quoted NY-bred maiden turf race is seeded verbatim as `sar-d1-r1` |
| PDF condition-book ingestion | ◻ | Out of scope for a static prototype; the parse works on the raw text a PDF yields. Parked |

---

## Open questions carried forward (for Tom)

1. **Equipment at entry** — is equipment required at submission, or declared later
   to the office? Currently advisory. `conditions.js#notices`.
2. **Equibase rating** — does it belong on the horse profile? It conflicts with
   Rule 0 as written; if it goes in, it goes in as a cited third-party figure,
   labelled as Equibase's, not ours.
3. **Coupled entries and trainer/owner conflicts** — not modeled. Real racing
   offices care; worth asking whether the prototype should.
