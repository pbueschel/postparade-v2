/* Condition-checker unit assertions. Run: bun test/conditions-smoke.js
   These lock the eligibility rules — and lock OUT anything predictive. */
const PPData = require('../app/data.js');
globalThis.PPData = PPData;
const PPConditions = require('../app/conditions.js');

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; return; }
  fail++;
  console.error('FAIL  ' + name + (extra ? '  → ' + extra : ''));
}
const ctx = { today: PPData.today };
const check = (hid, rid) => PPConditions.check(PPData.getHorse(hid), PPData.getRace(rid), ctx);
const codes = (res) => res.conflicts.map((c) => c.code);

// ---- the seed itself is demoable ------------------------------------------
ok('every race is open for entry', PPData.listRaces({ openOnly: true }).length === PPData.races.length);
ok('at least 4 paired tracks post books', PPData.pairedTracks().length >= 4);
ok('a card closes inside 48h (Entry Windows has content)',
  PPData.races.some((r) => (new Date(r.entryClose) - new Date(PPData.today)) / 3600000 < 48));
ok('every LaRose horse fits at least one open race', (() => {
  const open = PPData.listRaces({ openOnly: true });
  return PPData.listHorses({ stableId: 'larose' })
    .every((h) => open.some((r) => PPConditions.check(h, r, ctx).eligible));
})());

// ---- hard gates ------------------------------------------------------------
ok('Thoroughbred is barred from a Quarter Horse race',
  codes(check('modo', 'ded-d2-r1')).includes('registry'));
ok('Quarter Horse passes the registry gate at Delta Downs',
  !codes(check('vinton-flash', 'ded-d2-r1')).includes('registry'));
ok('colt is barred from a fillies-only race',
  codes(check('midnight-still', 'sar-d1-r1')).includes('sex'));
ok('non-NY-bred is barred from the NY-bred restricted race',
  codes(check('molly-mciver', 'sar-d1-r1')).includes('state-bred'));
ok('NY-bred with registry approval clears the state-bred gate',
  !codes(check('hormesis', 'sar-d1-r1')).includes('state-bred'));
ok('a 2yo is barred from a 3yo-and-up race',
  codes(check('hormesis', 'elp-d2-r4')).includes('age'));
ok('a winner is barred from a maidens-only race',
  codes(check('modo', 'elp-d2-r1')).includes('maiden'));
ok('a maiden clears the maiden condition',
  !codes(check('molly-mciver', 'elp-d1-r4')).includes('maiden'));
ok('the non-winners ladder blocks a horse over the bar',
  codes(check('modo', 'elp-d2-r4')).includes('non-winners'));
ok("a horse on the vet's list is blocked",
  codes(check('sabine-pass', 'elp-d0-r2')).includes('vet-list'));
ok("the vet's-list conflict is hard, not advisory",
  check('sabine-pass', 'elp-d0-r2').hardConflicts.some((c) => c.code === 'vet-list'));

// ---- flags (reviewable, not disqualifying) --------------------------------
const stakes = check('gewurztraminer', 'elp-d2-r5');
ok('missing stakes nomination is a FLAG, not a hard block',
  stakes.eligible && stakes.flags.some((c) => c.code === 'nomination'), JSON.stringify(codes(stakes)));
ok('a lasix horse in a no-lasix race is a FLAG',
  stakes.flags.some((c) => c.code === 'medication'));
ok('a starter-condition mismatch is a FLAG the office settles',
  check('eye-dee-kay', 'elp-d1-r5').flags.some((c) => c.code === 'starter'));

// ---- preference clauses --------------------------------------------------
const pref = check('hormesis', 'sar-d1-r1');
ok('preference clause is reported', pref.preferences.length === 1);
ok('preference never affects eligibility', pref.eligible);
ok('an unraced horse qualifies for a non-starters preference', pref.preferences[0].met);

// ---- notices -------------------------------------------------------------
ok('equipment disclosure is a notice, never a conflict',
  check('modo', 'elp-d2-r4').notices.some((n) => n.code === 'equipment') &&
  !codes(check('modo', 'elp-d2-r4')).includes('equipment'));
ok('MTO availability is surfaced as a notice on turf races',
  check('gewurztraminer', 'elp-d3-r2').notices.some((n) => n.code === 'mto'));

// ---- the parser ----------------------------------------------------------
const parsed = PPConditions.parse(PPData.getRace('sar-d1-r1').conditionText);
ok('parser reads the purse', parsed.purse === 115000);
ok('parser reads the surface', parsed.surface === 'Turf');
ok('parser reads the state-bred restriction', /NEW YORK/.test(parsed.stateBred || ''));
ok('parser catches the off-the-turf clause', parsed.turfToDirtClause === true);
ok('parser catches a no-furosemide clause',
  PPConditions.parse(PPData.getRace('elp-d2-r5').conditionText).lasixProhibited === true);

// ---- the guarantee: nothing predictive ------------------------------------
const res = check('modo', 'elp-d2-r4');
['score', 'fit', 'rating', 'probability', 'odds', 'winRate', 'drawIn', 'rank', 'prediction']
  .forEach((k) => ok('check() exposes no "' + k + '" field', !(k in res)));
const src = require('fs').readFileSync(__dirname + '/../app/conditions.js', 'utf8');
ok('conditions.js contains no scoring arithmetic',
  !/\bscore\s*[+*]?=|weight\s*\*|\.score\b/.test(src));
// Strip comments first — the file's own header talks ABOUT the figures it omits.
const dataSrc = require('fs').readFileSync(__dirname + '/../app/data.js', 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
['winRate', 'winPct', 'trainerPct', 'lastSpeed', 'classR', 'par:', 'predicted', 'projected']
  .forEach((k) => ok('data.js carries no "' + k + '" figure', !dataSrc.includes(k)));

// ---- eligibility filter (track side) -------------------------------------
const fill = PPConditions.eligibleHorses(PPData.horses, PPData.getRace('elp-d1-r3'), ctx);
ok('eligibility filter returns a plain list', Array.isArray(fill) && fill.length > 0);
ok('eligibility filter is not sorted by any figure',
  fill.every((h) => !('score' in h)));

console.log(`\nconditions-smoke: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
