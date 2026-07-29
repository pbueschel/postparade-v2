/* Store + workflow smoke, plus the content guards that keep the removed
   features from creeping back. Run: bun test/app-smoke.js
   (Real-browser rendering is verified separately — see README/CLAUDE.md.) */
const fs = require('fs');
const path = require('path');

const PPData = require('../app/data.js');
globalThis.PPData = PPData;
const PPConditions = require('../app/conditions.js');
globalThis.PPConditions = PPConditions;
// PPStore runs in-memory when localStorage is absent.
const PPStore = require('../app/store.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL  ' + name + (extra ? '  → ' + extra : ''));
}

// ---- seeded state --------------------------------------------------------
ok('seeded submissions load', PPStore.listSubmissions().length >= 6);
ok('a seeded submission is still pending', PPStore.listSubmissions({ status: 'pending' }).length >= 3);
ok('a seeded decline carries a reason code',
  PPStore.listSubmissions({ status: 'declined' }).some((s) => s.denialReason));
ok('a seeded decline carries a free-text comment',
  PPStore.listSubmissions({ status: 'declined' }).some((s) => (s.denialComment || '').length > 20));
ok('every seeded submission has a submittedAt timestamp',
  PPStore.listSubmissions().every((s) => !!s.submittedAt));
ok('every decided submission has a decidedAt timestamp',
  PPStore.listSubmissions().filter((s) => s.status !== 'pending')
    .every((s) => !!s.decidedAt));
ok('every seeded submission names a jockey',
  PPStore.listSubmissions().every((s) => !!s.jockeyId));

// ---- three-way horse status ---------------------------------------------
const counts = PPStore.statusCounts('larose');
ok('status counts cover the whole roster',
  counts.active + counts.placement + counts.entered === counts.all);
ok('all three statuses are represented in the demo',
  counts.active > 0 && counts.placement > 0 && counts.entered > 0, JSON.stringify(counts));

// ---- spots arithmetic ---------------------------------------------------
const raceId = 'elp-d1-r3';
const before = PPStore.spotsFor(raceId);
ok('spots report openings and fills', before.spots > 0 && before.open === before.spots - before.filled);
ok('a deliberately full race shows no openings', PPStore.spotsFor('elp-d2-r4').open === 0);

// ---- the loop: submit → pending → accept → spot fills -------------------
const out = PPStore.submit({ horseId: 'arthur-jr', raceId, jockeyId: 'jk-jlortiz' });
ok('submit succeeds', out.ok);
ok('a new submission starts pending', out.submission.status === 'pending');
ok('submitting sets a timestamp', !!out.submission.submittedAt);
ok('the horse now reads as placement-requested', PPStore.statusOf('arthur-jr') === 'placement');
ok('a duplicate submission is refused', PPStore.submit({ horseId: 'arthur-jr', raceId, jockeyId: 'jk-jlortiz' }).ok === false);
ok('the pending count on the race rose', PPStore.spotsFor(raceId).pending === before.pending + 1);

PPStore.accept(out.submission.id, 'Ellis Park racing office');
ok('accept records who decided', PPStore.getSubmission(out.submission.id).decidedBy === 'Ellis Park racing office');
ok('accept records when', !!PPStore.getSubmission(out.submission.id).decidedAt);
ok('the horse now reads as entered', PPStore.statusOf('arthur-jr') === 'entered');
ok('an accepted submission fills a spot', PPStore.spotsFor(raceId).filled === before.filled + 1);
ok('the entry shows on the race', PPStore.entriesForRace(raceId).some((e) => e.horseId === 'arthur-jr'));

// ---- decline with reason + comment -------------------------------------
// hello-angel has no other open submission, so its status is a clean read.
const d = PPStore.submit({ horseId: 'hello-angel', raceId: 'elp-d1-r5', jockeyId: 'jk-bejarano' });
PPStore.decline(d.submission.id, 'preference', 'Held the spot for a horse dropping out of an allowance.', 'Ellis Park racing office');
const declined = PPStore.getSubmission(d.submission.id);
ok('decline sets the status', declined.status === 'declined');
ok('decline stores the standard reason', declined.denialReason === 'preference');
ok('the reason resolves to a label', !!PPData.getDenialReason(declined.denialReason).label);
ok('decline stores the comment', declined.denialComment.startsWith('Held the spot'));
ok('a declined horse returns to active', PPStore.statusOf('hello-angel') === 'active');
ok('declining does not fill a spot', !PPStore.entriesForRace('elp-d1-r5').some((e) => e.horseId === 'hello-angel'));

// ---- submit anyway (override) ------------------------------------------
const conflicted = PPConditions.check(PPData.getHorse('modo'), PPData.getRace('ded-d2-r1'), { today: PPData.today });
ok('the QH race is a real conflict for a Thoroughbred', !conflicted.eligible);
const o = PPStore.submit({ horseId: 'modo', raceId: 'ded-d2-r1', jockeyId: 'jk-diego',
  overrode: true, conflictsAtSubmit: conflicted.conflicts });
ok('a flagged submission still goes through for manual review', o.ok && o.submission.status === 'pending');
ok('the override is recorded', o.submission.overrode === true);
ok('the flags are snapshotted on the record', o.submission.conflictsAtSubmit.length > 0);

// ---- AE / MTO ----------------------------------------------------------
const ae = PPStore.submit({ horseId: 'glen-airy', raceId: 'elp-d3-r3', jockeyId: 'jk-esquivel', aeMto: 'AE' });
ok('AE designation persists', ae.submission.aeMto === 'AE');
const mtoRace = PPData.races.find((r) => r.mtoAllowed);
ok('at least one race permits MTO', !!mtoRace);

// ---- messaging --------------------------------------------------------
const threadsBefore = PPStore.messages('larose', 'ELP').length;
PPStore.sendMessage('larose', 'ELP', 'trainer', 'Can you use Batter Up in Friday R2?', 'Kinnon LaRose');
ok('messages persist to the thread', PPStore.messages('larose', 'ELP').length === threadsBefore + 1);
PPStore.sendMessage('larose', 'ELP', 'track', 'Send him. We are two short.', 'Ellis Park racing office');
ok('both sides write to the same thread',
  PPStore.messages('larose', 'ELP').slice(-1)[0].from === 'track');
ok('threads exist for every paired track', PPStore.threads('larose').length === PPData.pairedTracks().length);
ok('an empty message is rejected', PPStore.sendMessage('larose', 'ELP', 'trainer', '   ') === null);

// ---- watches (Entry Windows) ------------------------------------------
ok('a race can be watched', PPStore.toggleWatch('elp-d0-r1') === true);
ok('watching persists', PPStore.isWatched('elp-d0-r1'));
ok('watching toggles off', PPStore.toggleWatch('elp-d0-r1') === false);

// ---- roster edits ----------------------------------------------------
const rosterBefore = PPStore.rosterFor('larose').length;
const added = PPStore.addHorse({ name: 'Test Colt', stableId: 'larose', sex: 'C', foaled: 2024 });
ok('a horse can be added', PPStore.rosterFor('larose').length === rosterBefore + 1);
ok('an added horse resolves like a seeded one', !!PPStore.horseFor(added.id));
ok('an added horse gets a derived age', added.age > 0);
PPStore.removeHorse(added.id);
ok('a horse can be removed', PPStore.rosterFor('larose').length === rosterBefore);
PPStore.removeHorse('my-noble-knight');
ok('a seeded horse can be removed from the roster',
  !PPStore.rosterFor('larose').some((h) => h.id === 'my-noble-knight'));

// ---- audit log: the same events on all three ends --------------------
const log = PPStore.auditLog();
ok('the audit log is populated', log.length > 15);
ok('the audit log is newest-first',
  log.every((e, i) => i === 0 || log[i - 1].at >= e.at));
ok('every audit row has a timestamp', log.every((e) => !!e.at));
ok('the log records trainer-side events', log.some((e) => e.actor === 'trainer'));
ok('the log records track-side events', log.some((e) => e.actor === 'track'));
ok('the log records a decline with its reason',
  log.some((e) => e.kind === 'submission.declined' && /preference/.test(e.detail || '')));

// ---- track-side history ----------------------------------------------
ok('starts-at-track tallies from past performances', PPData.startsAtTrack('pecan-grove', 'ELP') === 2);
ok('a horse new to a track tallies zero', PPData.startsAtTrack('midnight-still', 'ELP') === 0);

// ---- content guards: removed features stay removed -------------------
const files = ['app.html', 'index.html', 'app/data.js', 'app/conditions.js', 'app/store.js',
  'app/render.js', 'app/screens-trainer.js', 'app/screens-track.js', 'app/screens-system.js']
  .map((f) => ({ f, src: fs.readFileSync(path.join(__dirname, '..', f), 'utf8') }));

// Feature names that must not appear as live UI. Scanned line by line, with
// code comments stripped — a banned term is allowed only on a line that is
// explicitly about its removal (the v1-vs-v2 table marks those cells .gone).
const stripComments = (src) => src
  .replace(/\/\*[\s\S]*?\*\//g, '')
  .replace(/<!--[\s\S]*?-->/g, '')
  .replace(/(^|\s)\/\/.*$/gm, '');
const REMOVAL_CONTEXT = /class="gone"|\bv1\b|removed|no longer|takes it out|does not|not a recommend|never|remove|stays out|\bno (win|rating|recommend|predict|suggest|figure)/i;
const BANNED_UI = ['Spot alerts', 'Spot Alerts', 'Recommendations tab', 'Suggested ship',
  'Suggested Ship', 'Win rate', 'Win Rate', 'Predicted', 'Draw-in probability', 'Fit score',
  'Acceptance likelihood', 'Likely yes'];
function offendingLines(src, needle) {
  return stripComments(src).split('\n')
    .filter((line) => new RegExp(needle, 'i').test(line) && !REMOVAL_CONTEXT.test(line));
}
files.forEach(({ f, src }) => {
  BANNED_UI.forEach((s) => {
    const hits = offendingLines(src, s.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&'));
    ok(`${f} has no live "${s}"`, hits.length === 0, hits[0] && hits[0].trim().slice(0, 90));
  });
  const rec = offendingLines(src, 'recommend');
  ok(`${f} makes no recommendations`, rec.length === 0, rec[0] && rec[0].trim().slice(0, 90));
});
// The renamed screen exists.
const shell = files.find((x) => x.f === 'app.html').src;
ok('Entry windows is a nav item', shell.includes('Entry windows'));
ok('See condition books is a nav item', shell.includes('See condition books'));
ok('Submissions is a nav item', shell.includes('>Submissions'));
ok('Messages is a nav item', shell.includes('Messages'));
ok('the horses nav item does not deep-link one horse',
  !/href="#horse\/[a-z]/.test(shell));
ok('no scoreRing helper survives',
  !files.some(({ src }) => src.includes('scoreRing')));
ok('no drawIn helper survives', !files.some(({ src }) => src.includes('drawIn')));

console.log(`\napp-smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
