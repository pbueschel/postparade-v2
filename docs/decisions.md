# Decisions

Append-only. Newest first. Each entry: the decision, why, and what it rules out.

---

## 2026-08-06 — direction B (modern pass) is the product's visual identity

**Decision.** Parchment ground, forest-green chrome, gold advisory, oxblood
declines; rounded cards, list views, info boxes, stat tiles. Serif display
headings; monospace confined to data that lines up — times, money, records, and
condition text. Everything else Inter.

**Why.** Phil's partner supplied a racing-form treatment; three variants were
mocked and this pass — B's colour with modern structure — was chosen. It reads
as a racing product without the newsprint density that variant C could not have
held consistently once real data varied row heights.

**How, and what it rules out.** The Tailwind scales are **remapped, not
replaced**, so the palette reaches every existing utility class. That is what
made a whole-product restyle affordable — and it means **the scales can no
longer be used for their literal colours**: `red` is oxblood, `emerald` is
forest, `amber` is gold, `indigo` is slate blue. Anyone wanting a true red must
add a new token, not reach for `red-500`. Keep the ramp direction intact.

**Also rules out.** A second source of truth for colour. `index.html` is
self-contained (no Tailwind) and repeats the palette by hand — a colour change
has to be made in both files.

**Cost accepted.** List views cost vertical space against the old dense tables.
If the roster becomes the screen trainers live in, the fix is a density toggle,
not a return to tables.

## 2026-08-06 — the landing page carries v1's design, not v1's copy

**Decision.** v2's landing reproduces v1's layout and visual language section
for section, but every predictive claim is rewritten. The v1→v2 diff table, the
"Still open" callout, and "About the data" stay.

**Why.** Phil wants the two sites to read as one product rather than two
unrelated pages. v1's copy cannot come along: it sells the recommendation
engine v2 removed, and `index.html` is inside the Rule 0 guard list in
`test/app-smoke.js`. Design continuity was the part worth keeping.

**Rules out.** Copying v1's `index.html` verbatim, and loosening the guard to
let it through. Also rules out marketing an owner workspace — v2 has trainer
and racing-office workspaces only, so that column became "The record".

**Cost.** The design is reimplemented in hand-written CSS with an inline SVG
sprite, not Tailwind + lucide, because v2's `index.html` must stay
self-contained. A future change to the shared look must be made twice.

## 2026-07-29 — v2 is a separate repo and a separate Pages site

**Decision.** Build the revision as `postparade-v2` with its own GitHub Pages
site, rather than mutating v1 or adding a `/v2/` path under it.

**Why.** The revisions remove the feature v1 is built around (the recommendation
engine). Patching would have meant deleting the demo's centrepiece in place and
losing the ability to show both. Two sites let Phil compare directly, and the
landing page carries an explicit v1→v2 diff.

**Rules out.** Shared modules between the builds. v2's `app/` is a rewrite, not
an import; a fix in one does not propagate.

## 2026-07-29 — Rule 0: nothing predictive, enforced by tests

**Decision.** No ratings, scores, win rates, projected finishes, draw-in
probability, acceptance likelihood, suggested ships, or recommended races. The
only inference retained is condition matching, which flags conflicts and never
rules. Enforced by content guards in `test/app-smoke.js` and field-shape
assertions in `test/conditions-smoke.js`.

**Why.** It is the clearest instruction in the brief, repeated three ways
("remove all AI suggestions in general", "nothing to do with statistics on
future or past event", "remove win rate or predicted outcomes"). Written as a
test rather than a convention because the pull toward adding a helpful little
score is constant.

**Rules out.** Any future feature needing a computed figure — including an
**Equibase rating on the horse profile**, which is therefore an open question for
Tom rather than a default. If it lands, it lands cited as Equibase's number,
labelled as theirs, not computed by us.

## 2026-07-29 — the checker flags; the office rules

**Decision.** Conflicts are split into `hard` (would not pass the entry box) and
`flag` (the office settles it), and **both** allow the trainer to submit anyway.
Overridden submissions snapshot the flags shown at submission onto the record.

**Why.** Weg's note: a submit-anyway path is needed when the checker believes
there is a conflict. Condition text is ambiguous, and the racing secretary is the
authority. Snapshotting the flags means the office reviews what the trainer
actually saw, not what the checker would say today.

**Rules out.** Auto-entry, and any silent rejection. Nothing becomes an entry
without a person accepting it.

## 2026-07-29 — preference clauses report unverifiable as unverifiable

**Decision.** A preference clause resolves to **applies**, **does not apply**, or
**cannot be settled from the record here** — and never affects eligibility.

**Why.** "Non-starters for a claiming price of $55,000 or less in the last 3
starts preferred" needs per-start claiming prices, which the prototype's seed
does not carry for every line. Guessing would put a wrong answer in front of a
trainer with real money on it. Saying so points them at the raw conditions and
the office.

**Rules out.** Ranking by preference, or using a preference to hide a race.

## 2026-07-29 — equipment disclosure is advisory until confirmed

**Decision.** The equipment field exists on the submission form and the review
card, marked "requirement pending confirmation", and is modeled as a `notice` in
`conditions.js` — never a gate.

**Why.** Phil's brief says he will check with Tom whether equipment must be
submitted before entry. Building it as a blocker would invent a rule; leaving it
out entirely would lose the question.

**Rules out.** Nothing — promoting it to a hard gate is a one-line change once
the answer lands (`notices()` → `GATES`).

## 2026-07-29 — "Entry windows", and it is never pushed

**Decision.** v1's "Spot alerts" is renamed **Entry windows** and absorbs
"entries closing soon"; the dashboard carries nothing deadline-shaped.

**Why.** The brief asked for the capability to stay but stop being "forced in
your face unless you're specifically looking for it". Phil chose the name from
three options.

**Rules out.** Deadline counters on the dashboard, including "helpful" ones.

## 2026-07-29 — the demo calendar rolls off the clock

**Decision.** Every race day derives from `PPData.today` (an offset from the next
anchor Saturday, or a direct `fromToday` offset). One card always closes inside
24 hours.

**Why.** v1 decayed: fixed dates aged past the clock and the demo went dark, and
that had to be fixed under time pressure. Deriving dates means the books are
always open and the Entry windows page always has content.

**Rules out.** Hard-coded race-day dates. Real cited results keep their real
dates — only the invented condition books roll.

## 2026-07-29 — spots come from one helper

**Decision.** `PPStore.spotsFor(raceId)` is the only source of filled / open /
also-eligible / awaiting-review counts, rendered by one component
(`render.js#spotsBar`) on both sides.

**Why.** The brief asks that tracks and trainers both see spots allocated and
openings left. Two code paths would eventually disagree, and a disagreement here
is the kind that costs someone an entry.

**Rules out.** Per-screen spot arithmetic.
