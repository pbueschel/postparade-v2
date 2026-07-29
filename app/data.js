/* PostParade v2 — seed data + facade (Stage 1: in-memory; Stage 2: fetch() the API)
 *
 * Loaded as a plain <script>; exposes the global `PPData`. Accessor methods are
 * the future API boundary — in Stage 2 they become `await fetch('/races')` etc.
 * without changing callers.
 *
 * WHAT CHANGED FROM v1 (see plan.md §1 and docs/revisions-2026-07-29.md):
 *   - No scoring, no ratings, no predicted outcomes, no win rates, no shipping
 *     suggestions. Nothing in this file ranks or forecasts anything. Horses carry
 *     FACTS (record, past performances, conditions of eligibility) only.
 *   - Races carry a full CONDITION BOOK entry: raw condition text + the parsed
 *     structure the condition checker evaluates (eligibility, never prediction).
 *   - Submissions are a request/decision workflow with timestamps on every end.
 *   - Horse profiles are Equibase-shaped: color, sex, state/country bred, year
 *     foaled, sire/dam/dam's sire, and connections of last start.
 *
 * Model: Track 1─* Meet(Event) 1─* RaceDay 1─* Race 1─* Entry
 *        Stable(Trainer) 1─* Horse 1─* PastPerformance
 *        Race 1─* Submission (trainer→track) → Entry once accepted
 */
(function (global) {
  'use strict';

  // ---- Demo clock ----------------------------------------------------------
  // Central-time ISO so every string comparison against seeded timestamps
  // (`race.entryClose > PPData.today`) shares one UTC offset suffix.
  const pad2 = (n) => String(n).padStart(2, '0');
  function centralISO(d) {
    const s = new Date(d.getTime() - 5 * 3600 * 1000);
    return `${s.getUTCFullYear()}-${pad2(s.getUTCMonth() + 1)}-${pad2(s.getUTCDate())}T${pad2(s.getUTCHours())}:${pad2(s.getUTCMinutes())}:${pad2(s.getUTCSeconds())}-05:00`;
  }
  const today = centralISO(new Date());

  const DAY_MS = 86400000;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July',
    'August', 'September', 'October', 'November', 'December'];
  const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function ymd(d) { return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`; }
  function dayLabel(d) { return `${DOW[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`; }

  // ---- Rolling calendar ----------------------------------------------------
  // Every race day is derived from `today`, so the condition books are always
  // open and the entry-close countdowns always live. Anchor = the next Saturday
  // at least 6 days out, which leaves each card's T-72h entry close in the
  // future (the Friday card closes ~2 days out → the "closing soon" case).
  const base = new Date(today.slice(0, 10) + 'T00:00:00Z');
  let toSat = (6 - base.getUTCDay() + 7) % 7;
  if (toSat < 6) toSat += 7;
  const anchor = base.getTime() + toSat * DAY_MS;          // upcoming Saturday
  const dayAt = (offset) => new Date(anchor + offset * DAY_MS);
  const closeISO = (d) => `${ymd(new Date(d.getTime() - 3 * DAY_MS))}T10:00:00-05:00`;
  const postISO = (d, hhmm) => `${ymd(d)}T${hhmm}:00-05:00`;
  const agoISO = (hours) => centralISO(new Date(Date.now() - hours * 3600 * 1000));

  // ---- Tracks (the paired tracks posting condition books) ------------------
  const tracks = [
    { id: 'ELP', name: 'Ellis Park', state: 'KY', city: 'Henderson, KY', discipline: 'TB',
      office: 'Ellis Park racing office', racingSecretary: 'Dan Bork', paired: true },
    { id: 'SAR', name: 'Saratoga', state: 'NY', city: 'Saratoga Springs, NY', discipline: 'TB',
      office: 'NYRA racing office', racingSecretary: 'Andrew Byrnes', paired: true },
    { id: 'EVD', name: 'Evangeline Downs', state: 'LA', city: 'Opelousas, LA', discipline: 'TB',
      office: 'Evangeline Downs racing office', racingSecretary: 'Cody Guidry', paired: true },
    { id: 'DED', name: 'Delta Downs', state: 'LA', city: 'Vinton, LA', discipline: 'QH',
      office: 'Delta Downs racing office', racingSecretary: 'Aaron Rachal', paired: true },
    // Unpaired tracks appear in horse history but post no condition books here.
    { id: 'CD',  name: 'Churchill Downs', state: 'KY', city: 'Louisville, KY', discipline: 'TB', paired: false },
    { id: 'KEE', name: 'Keeneland',       state: 'KY', city: 'Lexington, KY',  discipline: 'TB', paired: false },
    { id: 'OP',  name: 'Oaklawn Park',    state: 'AR', city: 'Hot Springs, AR', discipline: 'TB', paired: false },
    { id: 'LS',  name: 'Lone Star Park',  state: 'TX', city: 'Grand Prairie, TX', discipline: 'TB', paired: false },
  ];

  // ---- Meets (an "event" in the UI: which race of which event at which track) ----
  const meets = [
    { id: 'elp-summer', track: 'ELP', name: 'Ellis Park — Summer Meet', shortName: 'Summer Meet',
      discipline: 'TB', status: 'published', conditionBookNo: 3,
      conditionBookPostedAt: agoISO(96), surfaces: ['D', 'T'] },
    { id: 'sar-summer', track: 'SAR', name: 'Saratoga — Summer Meet', shortName: 'Summer Meet',
      discipline: 'TB', status: 'published', conditionBookNo: 2,
      conditionBookPostedAt: agoISO(120), surfaces: ['D', 'T'] },
    { id: 'evd-summer', track: 'EVD', name: 'Evangeline Downs — Summer Meet', shortName: 'Summer Meet',
      discipline: 'TB', status: 'published', conditionBookNo: 5,
      conditionBookPostedAt: agoISO(60), surfaces: ['D'] },
    { id: 'ded-qh', track: 'DED', name: 'Delta Downs — Quarter Horse Meet', shortName: 'Quarter Horse Meet',
      discipline: 'QH', status: 'published', conditionBookNo: 4,
      conditionBookPostedAt: agoISO(72), surfaces: ['D'] },
  ];

  // ---- Race days -----------------------------------------------------------
  // offset is days from the anchor Saturday. Two ELP weekends so the race-date
  // filter has range; every card is open (entryClose is always in the future).
  const raceDaySpecs = [
    // fromToday (instead of offset) anchors a card to the demo clock directly —
    // used for the midweek card whose entry window closes inside 48h, which is
    // what the Entry Windows screen is built around.
    { id: 'elp-d0', meetId: 'elp-summer', fromToday: 4, note: 'Midweek card — entries close within 24h' },
    { id: 'elp-d1', meetId: 'elp-summer', offset: -1, note: 'Twilight card' },
    { id: 'elp-d2', meetId: 'elp-summer', offset: 0,  note: 'Feature card' },
    { id: 'elp-d3', meetId: 'elp-summer', offset: 1 },
    { id: 'elp-d4', meetId: 'elp-summer', offset: 7,  note: 'Second weekend' },
    { id: 'sar-d1', meetId: 'sar-summer', offset: 0 },
    { id: 'sar-d2', meetId: 'sar-summer', offset: 1 },
    { id: 'evd-d1', meetId: 'evd-summer', offset: 4 },
    { id: 'evd-d2', meetId: 'evd-summer', offset: 7 },
    { id: 'ded-d1', meetId: 'ded-qh',     offset: -1 },
    { id: 'ded-d2', meetId: 'ded-qh',     offset: 0, note: 'Louisiana-bred night' },
  ];
  const raceDays = raceDaySpecs.map((s) => {
    const d = s.fromToday != null
      ? new Date(base.getTime() + s.fromToday * DAY_MS)
      : dayAt(s.offset);
    return {
      id: s.id, meetId: s.meetId, date: ymd(d), label: dayLabel(d),
      entryClose: closeISO(d), note: s.note || null, status: 'published',
      overnightPostedAt: s.offset <= 0 ? agoISO(6) : null,
    };
  });
  const raceDayDate = (id) => (raceDays.find((d) => d.id === id) || {}).date;

  // ---- Condition-book race templates --------------------------------------
  // Each entry is one race in a published condition book. `text` is the raw
  // condition-book paragraph (what the track publishes); `conditions` is the
  // parsed structure the condition checker reads. Distances in yards
  // (220y = 1 furlong); Quarter Horse races are quoted in yards directly.
  const T = {
    msw: 'Maiden Special Weight', mdnClm: 'Maiden Claiming', clm: 'Claiming',
    optClm: 'Allowance Optional Claiming', starterAlw: 'Starter Allowance',
    alw: 'Allowance', hcp: 'Handicap', listed: 'Stakes (Listed)', stakes: 'Stakes',
    trial: 'Trial', futurity: 'Futurity',
  };

  const raceSpecs = [
    // ============ Ellis Park — midweek card, entry window closing (elp-d0) ============
    { day: 'elp-d0', no: 1, type: 'mdnClm', surface: 'D', yards: 1320, purse: 28000, spots: 10, ae: 4, post: '13:00',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 20000, weight: '124 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $28,000. FOR MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $20,000. Six Furlongs. (Dirt)' },
    { day: 'elp-d0', no: 2, type: 'clm', surface: 'D', yards: 1540, purse: 23000, spots: 10, ae: 4, post: '13:35',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 30000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $23,000. FOR THREE YEAR OLDS AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $30,000. Seven Furlongs. (Dirt)' },
    { day: 'elp-d0', no: 3, type: 'alw', surface: 'D', yards: 1430, purse: 50000, spots: 9, ae: 3, post: '14:10',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 4 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $50,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON FOUR RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. Six And One Half Furlongs. (Dirt)' },

    // ===================== Ellis Park — Friday twilight (elp-d1) =====================
    { day: 'elp-d1', no: 1, type: 'mdnClm', surface: 'D', yards: 1320, purse: 34000, spots: 10, ae: 4, post: '17:15',
      conditions: { sexes: ['F', 'M'], minAge: 3, maidenOnly: true, claimingPrice: 30000, weight: '121 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $34,000. FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Weight, 121 lbs. Claiming Price $30,000. Six Furlongs. (Dirt)' },
    { day: 'elp-d1', no: 2, type: 'clm', surface: 'D', yards: 1430, purse: 22000, spots: 10, ae: 4, post: '17:45',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 15000, nonWinners: { kind: 'N2L', count: 2 }, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $22,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $15,000. Six And One Half Furlongs. (Dirt)' },
    { day: 'elp-d1', no: 3, type: 'alw', surface: 'D', yards: 1830, purse: 46000, spots: 9, ae: 3, post: '18:15',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 3 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $46,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON THREE RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. One Mile And 70 Yards. (Dirt)' },
    { day: 'elp-d1', no: 4, type: 'msw', surface: 'T', yards: 1210, purse: 52000, spots: 12, ae: 6, mto: true, post: '18:45',
      conditions: { sexes: ['F'], minAge: 2, maidenOnly: true, weight: '119 lbs.' },
      text: 'MAIDEN SPECIAL WEIGHT. Purse $52,000. FOR MAIDENS, FILLIES TWO YEARS OLD. Weight, 119 lbs. Five And One Half Furlongs. (Turf) (If the Stewards consider it inadvisable to run this race on the turf course, this race will be run at Five And One Half Furlongs on the main track.) Main-track-only entries permitted.' },
    { day: 'elp-d1', no: 5, type: 'starterAlw', surface: 'D', yards: 1540, purse: 38000, spots: 10, ae: 4, post: '19:15',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, starterPrice: 20000, starterSince: '2025-07-01', weight: '124 lbs.' },
      text: 'STARTER ALLOWANCE. Purse $38,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE STARTED FOR A CLAIMING PRICE OF $20,000 OR LESS SINCE JULY 1, 2025. Three Year Olds, 120 lbs.; Older, 124 lbs. Seven Furlongs. (Dirt)' },

    // ===================== Ellis Park — Saturday feature (elp-d2) =====================
    { day: 'elp-d2', no: 1, type: 'msw', surface: 'D', yards: 1320, purse: 55000, spots: 10, ae: 4, post: '13:00',
      conditions: { sexes: ['F', 'M'], minAge: 3, maidenOnly: true, weight: '124 lbs.' },
      text: 'MAIDEN SPECIAL WEIGHT. Purse $55,000. FOR MAIDENS, FILLIES AND MARES THREE YEARS OLD AND UPWARD. Three Year Olds, 118 lbs.; Older, 124 lbs. Six Furlongs. (Dirt)' },
    { day: 'elp-d2', no: 2, type: 'clm', surface: 'D', yards: 1210, purse: 26000, spots: 10, ae: 4, post: '13:30',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 20000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $26,000. FOR THREE YEAR OLDS AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $20,000. Five And One Half Furlongs. (Dirt)' },
    { day: 'elp-d2', no: 3, type: 'optClm', surface: 'D', yards: 1540, purse: 62000, spots: 9, ae: 3, post: '14:05',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 62500, optional: true, nonWinners: { kind: 'N_X', count: 2 }, weight: '123 lbs.' },
      text: 'ALLOWANCE OPTIONAL CLAIMING. Purse $62,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER OR CLAIMING PRICE OF $62,500. Three Year Olds, 119 lbs.; Older, 123 lbs. Seven Furlongs. (Dirt)' },
    { day: 'elp-d2', no: 4, type: 'alw', surface: 'D', yards: 1760, purse: 68000, spots: 10, ae: 4, post: '14:40',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 3 }, weight: '123 lbs.',
        preference: { kind: 'notStartedForClaimingPriceOrLess', amount: 55000, starts: 3 } },
      text: 'ALLOWANCE. Purse $68,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON THREE RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. (Non-Starters For A Claiming Price Of $55,000 Or Less In The Last 3 Starts Preferred). One Mile. (Dirt)' },
    { day: 'elp-d2', no: 5, type: 'listed', surface: 'T', yards: 1870, purse: 150000, spots: 12, ae: 4, post: '15:20',
      name: 'The Kentucky Downs Turf Cup (Listed)',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, lasixProhibited: true, nominationRequired: true, weight: '122 lbs.' },
      text: 'THE KENTUCKY DOWNS TURF CUP (LISTED). Purse $150,000. FOR THREE YEAR OLDS AND UPWARD. By subscription of $150 each, which should accompany the nomination; $750 to pass the entry box. Weight, 122 lbs. One And One Sixteenth Miles. (Turf) No race-day furosemide permitted.' },
    { day: 'elp-d2', no: 6, type: 'mdnClm', surface: 'D', yards: 1430, purse: 30000, spots: 10, ae: 4, post: '15:55',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 20000, weight: '124 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $30,000. FOR MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $20,000. Six And One Half Furlongs. (Dirt)' },
    { day: 'elp-d2', no: 7, type: 'clm', surface: 'D', yards: 1980, purse: 24000, spots: 10, ae: 4, post: '16:30',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 4, claimingPrice: 10000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $24,000. FOR FOUR YEAR OLDS AND UPWARD. Weight, 124 lbs. Claiming Price $10,000. One And One Eighth Miles. (Dirt)' },

    // ===================== Ellis Park — Sunday (elp-d3) =====================
    { day: 'elp-d3', no: 1, type: 'msw', surface: 'D', yards: 1210, purse: 55000, spots: 10, ae: 4, post: '13:00',
      conditions: { sexes: ['C', 'G', 'H', 'R'], minAge: 2, maidenOnly: true, weight: '119 lbs.' },
      text: 'MAIDEN SPECIAL WEIGHT. Purse $55,000. FOR MAIDENS, COLTS AND GELDINGS TWO YEARS OLD. Weight, 119 lbs. Five And One Half Furlongs. (Dirt)' },
    { day: 'elp-d3', no: 2, type: 'alw', surface: 'T', yards: 1760, purse: 58000, spots: 12, ae: 6, mto: true, post: '13:35',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 2 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $58,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. One Mile. (Turf) Main-track-only entries permitted.' },
    { day: 'elp-d3', no: 3, type: 'clm', surface: 'D', yards: 1320, purse: 20000, spots: 10, ae: 4, post: '14:10',
      conditions: { sexes: ['F', 'M'], minAge: 3, claimingPrice: 10000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $20,000. FOR FILLIES AND MARES THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $10,000. Six Furlongs. (Dirt)' },
    { day: 'elp-d3', no: 4, type: 'starterAlw', surface: 'D', yards: 1870, purse: 40000, spots: 9, ae: 3, post: '14:45',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, starterPrice: 25000, starterSince: '2025-01-01', weight: '124 lbs.' },
      text: 'STARTER ALLOWANCE. Purse $40,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE STARTED FOR A CLAIMING PRICE OF $25,000 OR LESS SINCE JANUARY 1, 2025. Three Year Olds, 120 lbs.; Older, 124 lbs. One And One Sixteenth Miles. (Dirt)' },
    { day: 'elp-d3', no: 5, type: 'alw', surface: 'D', yards: 1320, purse: 64000, spots: 9, ae: 3, post: '15:20',
      conditions: { sexes: ['F', 'M'], minAge: 3, nonWinners: { kind: 'N_X', count: 1 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $64,000. FOR FILLIES AND MARES THREE YEARS OLD AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. Six Furlongs. (Dirt)' },

    // ===================== Ellis Park — second weekend (elp-d4) =====================
    { day: 'elp-d4', no: 1, type: 'mdnClm', surface: 'D', yards: 1320, purse: 32000, spots: 10, ae: 4, post: '13:00',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 30000, weight: '124 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $32,000. FOR MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $30,000. Six Furlongs. (Dirt)' },
    { day: 'elp-d4', no: 2, type: 'optClm', surface: 'D', yards: 1430, purse: 60000, spots: 9, ae: 3, post: '13:35',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 40000, optional: true, nonWinners: { kind: 'N_X', count: 4 }, weight: '123 lbs.' },
      text: 'ALLOWANCE OPTIONAL CLAIMING. Purse $60,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON FOUR RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER OR CLAIMING PRICE OF $40,000. Three Year Olds, 119 lbs.; Older, 123 lbs. Six And One Half Furlongs. (Dirt)' },
    { day: 'elp-d4', no: 3, type: 'stakes', surface: 'D', yards: 1540, purse: 125000, spots: 12, ae: 4, post: '14:15',
      name: 'The Green River Sprint',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nominationRequired: true, weight: '122 lbs.' },
      text: 'THE GREEN RIVER SPRINT. Purse $125,000. FOR THREE YEAR OLDS AND UPWARD. By subscription of $125 each, which should accompany the nomination; $625 to pass the entry box, $625 additional to start. Weight, 122 lbs. Seven Furlongs. (Dirt)' },
    { day: 'elp-d4', no: 4, type: 'clm', surface: 'T', yards: 1760, purse: 28000, spots: 12, ae: 6, mto: true, post: '14:50',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 25000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $28,000. FOR THREE YEAR OLDS AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $25,000. One Mile. (Turf) Main-track-only entries permitted.' },

    // ===================== Saratoga — Saturday (sar-d1) =====================
    // The New York-bred maiden turf race Weg quoted verbatim, preference clause included.
    { day: 'sar-d1', no: 1, type: 'msw', surface: 'T', yards: 1210, purse: 115000, spots: 12, ae: 6, mto: true, post: '13:05',
      conditions: { sexes: ['F'], minAge: 2, maxAge: 2, maidenOnly: true, stateBred: 'NY', weight: '123 lbs.',
        preference: { kind: 'nonStartersForClaimingPriceOrLess', amount: 55000, starts: 3 } },
      text: '5½ Furlongs. (Turf) Mdn 115k Purse $115,000 FOR MAIDENS, FILLIES TWO YEARS OLD FOALED IN NEW YORK STATE AND APPROVED BY THE NEW YORK STATE-BRED REGISTRY. Weight, 123 lbs. (Non-Starters For A Claiming Price Of $55,000 Or Less In The Last 3 Starts Preferred). (If the Stewards consider it inadvisable to run this race on the turf course, this race will run at Five And One Half Furlongs on the main track.)' },
    { day: 'sar-d1', no: 2, type: 'msw', surface: 'D', yards: 1320, purse: 100000, spots: 10, ae: 4, post: '13:38',
      conditions: { sexes: ['C', 'G', 'R'], minAge: 2, maxAge: 2, maidenOnly: true, weight: '119 lbs.' },
      text: 'MAIDEN SPECIAL WEIGHT. Purse $100,000. FOR MAIDENS, COLTS AND GELDINGS TWO YEARS OLD. Weight, 119 lbs. Six Furlongs. (Dirt)' },
    { day: 'sar-d1', no: 3, type: 'alw', surface: 'T', yards: 1870, purse: 92000, spots: 12, ae: 6, mto: true, post: '14:12',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 2 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $92,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. One And One Sixteenth Miles. (Inner Turf) Main-track-only entries permitted.' },
    { day: 'sar-d1', no: 4, type: 'listed', surface: 'D', yards: 1430, purse: 200000, spots: 12, ae: 4, post: '14:47',
      name: 'The Amsterdam Prep (Listed)',
      conditions: { sexes: ['C', 'G', 'R'], minAge: 3, maxAge: 3, nominationRequired: true, weight: '122 lbs.' },
      text: 'THE AMSTERDAM PREP (LISTED). Purse $200,000. FOR THREE YEAR OLDS. By subscription of $200 each, which should accompany the nomination; $1,000 to pass the entry box, $1,000 additional to start. Weight, 122 lbs. Six And One Half Furlongs. (Dirt)' },
    { day: 'sar-d1', no: 5, type: 'clm', surface: 'D', yards: 1760, purse: 46000, spots: 10, ae: 4, post: '15:20',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 35000, nonWinners: { kind: 'N3L', count: 3 }, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $46,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON THREE RACES. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $35,000. One Mile. (Dirt)' },

    // ===================== Saratoga — Sunday (sar-d2) =====================
    { day: 'sar-d2', no: 1, type: 'mdnClm', surface: 'D', yards: 1540, purse: 60000, spots: 10, ae: 4, post: '13:05',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 40000, weight: '124 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $60,000. FOR MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $40,000. Seven Furlongs. (Dirt)' },
    { day: 'sar-d2', no: 2, type: 'alw', surface: 'D', yards: 1320, purse: 90000, spots: 10, ae: 4, post: '13:40',
      conditions: { sexes: ['F', 'M'], minAge: 3, nonWinners: { kind: 'N_X', count: 1 }, weight: '123 lbs.',
        preference: { kind: 'nonStartersForClaimingPriceOrLess', amount: 40000, starts: 3 } },
      text: 'ALLOWANCE. Purse $90,000. FOR FILLIES AND MARES THREE YEARS OLD AND UPWARD WHICH HAVE NEVER WON A RACE OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. (Non-Starters For A Claiming Price Of $40,000 Or Less In The Last 3 Starts Preferred). Six Furlongs. (Dirt)' },
    { day: 'sar-d2', no: 3, type: 'starterAlw', surface: 'T', yards: 1980, purse: 80000, spots: 12, ae: 6, mto: true, post: '14:15',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 4, starterPrice: 40000, starterSince: '2025-01-01', weight: '124 lbs.' },
      text: 'STARTER ALLOWANCE. Purse $80,000. FOR FOUR YEAR OLDS AND UPWARD WHICH HAVE STARTED FOR A CLAIMING PRICE OF $40,000 OR LESS SINCE JANUARY 1, 2025. Weight, 124 lbs. One And One Eighth Miles. (Turf) Main-track-only entries permitted.' },

    // ===================== Evangeline Downs (evd-d1, evd-d2) =====================
    { day: 'evd-d1', no: 1, type: 'msw', surface: 'D', yards: 1210, purse: 42000, spots: 10, ae: 4, post: '17:20',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, stateBred: 'LA', weight: '122 lbs.' },
      text: 'MAIDEN SPECIAL WEIGHT. Purse $42,000. FOR ACCREDITED LOUISIANA BRED MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 118 lbs.; Older, 122 lbs. Five And One Half Furlongs. (Dirt)' },
    { day: 'evd-d1', no: 2, type: 'clm', surface: 'D', yards: 1320, purse: 18000, spots: 10, ae: 4, post: '17:50',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 7500, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $18,000. FOR THREE YEAR OLDS AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $7,500. Six Furlongs. (Dirt)' },
    { day: 'evd-d1', no: 3, type: 'alw', surface: 'D', yards: 1760, purse: 48000, spots: 9, ae: 3, post: '18:20',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nonWinners: { kind: 'N_X', count: 2 }, weight: '123 lbs.' },
      text: 'ALLOWANCE. Purse $48,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE NEVER WON TWO RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Three Year Olds, 119 lbs.; Older, 123 lbs. One Mile. (Dirt)' },
    { day: 'evd-d2', no: 1, type: 'mdnClm', surface: 'D', yards: 1430, purse: 24000, spots: 10, ae: 4, post: '17:20',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, maidenOnly: true, claimingPrice: 15000, weight: '124 lbs.' },
      text: 'MAIDEN CLAIMING. Purse $24,000. FOR MAIDENS, THREE YEARS OLD AND UPWARD. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $15,000. Six And One Half Furlongs. (Dirt)' },
    { day: 'evd-d2', no: 2, type: 'stakes', surface: 'D', yards: 1760, purse: 100000, spots: 12, ae: 4, post: '18:00',
      name: 'The Evangeline Mile',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, nominationRequired: true, weight: '122 lbs.' },
      text: 'THE EVANGELINE MILE. Purse $100,000. FOR THREE YEAR OLDS AND UPWARD. By subscription of $100 each, which should accompany the nomination; $500 to pass the entry box. Weight, 122 lbs. One Mile. (Dirt)' },

    // ===================== Delta Downs — Quarter Horse (ded-d1, ded-d2) =====================
    // Distances are real yards (Quarter Horse sprints), registry AQHA.
    { day: 'ded-d1', no: 1, type: 'clm', surface: 'D', yards: 350, purse: 14000, spots: 10, ae: 4, post: '18:15',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, registry: 'AQHA', claimingPrice: 10000, weight: '124 lbs.' },
      text: 'CLAIMING. Purse $14,000. FOR THREE YEAR OLDS AND UPWARD (QUARTER HORSES). Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $10,000. Three Hundred Fifty Yards.' },
    { day: 'ded-d1', no: 2, type: 'trial', surface: 'D', yards: 400, purse: 20000, spots: 10, ae: 2, post: '18:45',
      name: 'Louisiana Bred Futurity Trial',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 2, maxAge: 2, registry: 'AQHA', stateBred: 'LA', nominationRequired: true, weight: '124 lbs.' },
      text: 'LOUISIANA BRED FUTURITY TRIAL. Purse $20,000. FOR ACCREDITED LOUISIANA BRED TWO YEAR OLDS (QUARTER HORSES) NOMINATED TO THE FUTURITY. Weight, 124 lbs. Four Hundred Yards.' },
    { day: 'ded-d2', no: 1, type: 'alw', surface: 'D', yards: 400, purse: 26000, spots: 10, ae: 4, post: '18:15',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, registry: 'AQHA', nonWinners: { kind: 'N_X', count: 2 }, weight: '124 lbs.' },
      text: 'ALLOWANCE. Purse $26,000. FOR THREE YEAR OLDS AND UPWARD (QUARTER HORSES) WHICH HAVE NEVER WON TWO RACES OTHER THAN MAIDEN, CLAIMING, OR STARTER. Weight, 124 lbs. Four Hundred Yards.' },
    { day: 'ded-d2', no: 2, type: 'stakes', surface: 'D', yards: 440, purse: 75000, spots: 10, ae: 2, post: '18:50',
      name: 'The Vinton Sprint Championship',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, registry: 'AQHA', nominationRequired: true, weight: '124 lbs.' },
      text: 'THE VINTON SPRINT CHAMPIONSHIP. Purse $75,000. FOR THREE YEAR OLDS AND UPWARD (QUARTER HORSES). By subscription of $75 each. Weight, 124 lbs. Four Hundred Forty Yards.' },
  ];

  const races = raceSpecs.map((s) => {
    const dayId = s.day;
    const dateStr = raceDayDate(dayId);
    const d = new Date(dateStr + 'T00:00:00Z');
    const meetId = (raceDays.find((x) => x.id === dayId) || {}).meetId;
    return {
      id: `${dayId}-r${s.no}`,
      raceDayId: dayId,
      meetId,
      raceNumber: s.no,
      name: s.name || null,
      type: s.type,
      typeLabel: T[s.type] || s.type,
      surface: s.surface,                 // 'D' dirt · 'T' turf · 'S' synthetic
      distanceYards: s.yards,
      purse: s.purse,
      spots: s.spots,                     // field cap — the "spots allocated"
      minField: Math.max(5, s.spots - 4),
      alsoEligibleCap: s.ae,
      mtoAllowed: !!s.mto,
      entryClose: closeISO(d),
      postTime: postISO(d, s.post),
      conditionText: s.text,
      conditions: s.conditions,
      status: 'open',
      extra: false,                       // set true for races added after the book posted
      postedAt: (meets.find((m) => m.id === meetId) || {}).conditionBookPostedAt || agoISO(96),
    };
  });

  // One "extra" race, added after the condition book posted — drives the
  // Overnights & Extras notification story.
  (function addExtra() {
    const day = raceDays.find((d) => d.id === 'elp-d2');
    const d = new Date(day.date + 'T00:00:00Z');
    races.push({
      id: 'elp-d2-r8', raceDayId: 'elp-d2', meetId: 'elp-summer', raceNumber: 8,
      name: null, type: 'clm', typeLabel: T.clm, surface: 'D', distanceYards: 1320,
      purse: 21000, spots: 10, minField: 6, alsoEligibleCap: 4, mtoAllowed: false,
      entryClose: closeISO(d), postTime: postISO(d, '17:05'),
      conditionText: 'EXTRA RACE. CLAIMING. Purse $21,000. FOR THREE YEAR OLDS AND UPWARD WHICH HAVE STARTED FOR A CLAIMING PRICE OF $10,000 OR LESS. Three Year Olds, 120 lbs.; Older, 124 lbs. Claiming Price $10,000. Six Furlongs. (Dirt)',
      conditions: { sexes: ['F', 'M', 'G', 'C', 'H', 'R'], minAge: 3, claimingPrice: 10000, weight: '124 lbs.' },
      status: 'open', extra: true, postedAt: agoISO(5),
    });
  })();

  // ---- Stables -------------------------------------------------------------
  const stables = [
    { id: 'larose', name: 'Kinnon LaRose Racing', trainer: 'Kinnon LaRose', licenseNo: 'KY-T-44119',
      homeTrack: 'CD', isDemoUser: true },
    { id: 'stewart',   name: 'Stewart Racing',        trainer: 'Dallas Stewart',  homeTrack: 'ELP' },
    { id: 'bcox',      name: 'Brad Cox Racing',       trainer: 'Brad Cox',        homeTrack: 'CD' },
    { id: 'asmussen',  name: 'Asmussen Stable',       trainer: 'Steve Asmussen',  homeTrack: 'OP' },
    { id: 'calhoun',   name: 'W. Bret Calhoun Racing', trainer: 'W. Bret Calhoun', homeTrack: 'LS' },
    { id: 'pish',      name: 'Danny Pish Racing',     trainer: 'Danny Pish',      homeTrack: 'LS' },
    { id: 'ponce',     name: 'Josue Ponce Racing',    trainer: 'Josue Ponce',     homeTrack: 'DED' },
    { id: 'jgarcia',   name: 'Jose A. Garcia Stable', trainer: 'Jose A. Garcia',  homeTrack: 'DED' },
  ];

  // ---- Jockeys (a jockey must be named at submission) ---------------------
  const jockeys = [
    { id: 'jk-prat',      name: 'Flavien Prat',       agent: 'Derek Ryan',    based: 'SAR' },
    { id: 'jk-franco',    name: 'Manuel Franco',      agent: 'Angel Cordero', based: 'SAR' },
    { id: 'jk-jlortiz',   name: 'Jose L. Ortiz',      agent: 'Steve Rushing', based: 'SAR' },
    { id: 'jk-iortiz',    name: 'Irad Ortiz Jr.',     agent: 'Steve Rushing', based: 'SAR' },
    { id: 'jk-bejarano',  name: 'Rafael Bejarano',    agent: 'Tom Knust',     based: 'OP' },
    { id: 'jk-vazquez',   name: 'Ramon Vazquez',      agent: 'Kenny Fischer', based: 'OP' },
    { id: 'jk-hernandez', name: 'Brian Hernandez Jr.', agent: 'Liz Morris',   based: 'ELP' },
    { id: 'jk-luzzi',     name: 'Lane Luzzi',         agent: 'Jay Fedor',     based: 'LS' },
    { id: 'jk-roman',     name: 'Kevin Roman',        agent: 'Ray Hebert',    based: 'EVD' },
    { id: 'jk-esquivel',  name: 'Emanuel Esquivel',   agent: 'Sam Kennedy',   based: 'ELP' },
    { id: 'jk-diego',     name: 'Diego Saenz',        agent: 'Paul Hebert',   based: 'DED' },
  ];

  // ---- Horses --------------------------------------------------------------
  // Equibase-shaped profile. REAL per horse: name, sex, sire/dam and owner where
  // sourced, and the cited start (track/date/finish/jockey). ILLUSTRATIVE: color,
  // year foaled where unsourced, earnings, and the fields marked below.
  // NOTHING here is a rating, projection, or figure — facts and conditions only.
  const SEX_LABEL = { C: 'Colt', F: 'Filly', G: 'Gelding', H: 'Horse', M: 'Mare', R: 'Ridgling' };
  const ICONS = ['rabbit', 'flame', 'anchor', 'compass', 'crown', 'feather', 'gem', 'leaf',
    'mountain', 'shield', 'snowflake', 'sparkles', 'sun', 'waves', 'wind', 'zap', 'clover',
    'droplet', 'star', 'moon', 'cloud', 'bird'];
  const ICON_TINTS = ['emerald', 'indigo', 'amber', 'rose', 'sky', 'violet', 'teal', 'orange'];
  function iconFor(id) {
    let h = 0;
    for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 100000;
    return { icon: ICONS[h % ICONS.length], tint: ICON_TINTS[(h >> 3) % ICON_TINTS.length] };
  }

  const horseSpecs = [
    // ===== Kinnon LaRose Racing — the trainer workspace's barn =====
    { id: 'modo', name: 'Modo', stableId: 'larose', sex: 'M', foaled: 2021, color: 'Bay',
      bred: 'TX', sire: "Liam's Map", dam: 'Academy Road', damSire: 'Quality Road',
      owner: 'Dr. Joel Politi', breeder: 'Whitehall Farm', registry: 'Jockey Club',
      record: { starts: 12, wins: 6, seconds: 2, thirds: 1, earnings: 318450 },
      careerWins: 6, winsOtherThanMdnClmStarter: 5, lastRanForPrice: null,
      pps: [
        { date: -104, track: 'LS', raceNo: 8, type: 'stakes', name: 'Bluebonnet Stakes', yards: 1430, surface: 'D', finish: 1, field: 9, jockey: 'jk-luzzi', purse: 75000, note: 'Wire to wire, 1:16.31' },
        { date: -160, track: 'OP', raceNo: 6, type: 'optClm', yards: 1320, surface: 'D', finish: 2, field: 8, jockey: 'jk-bejarano', purse: 98000 },
        { date: -222, track: 'CD', raceNo: 4, type: 'alw', yards: 1540, surface: 'D', finish: 1, field: 7, jockey: 'jk-hernandez', purse: 82000 },
      ] },
    { id: 'carbone', name: 'Carbone', stableId: 'larose', sex: 'G', foaled: 2021, color: 'Dark Bay/Brown',
      bred: 'KY', sire: 'Mitole', dam: 'Sunset Glow', damSire: 'Malibu Moon',
      owner: '8:38 Racing LLC', breeder: 'Hill \'n\' Dale', registry: 'Jockey Club',
      record: { starts: 15, wins: 4, seconds: 3, thirds: 2, earnings: 286900 },
      careerWins: 4, winsOtherThanMdnClmStarter: 4, lastRanForPrice: null,
      pps: [
        { date: -89, track: 'OP', raceNo: 10, type: 'optClm', yards: 1320, surface: 'D', finish: 1, field: 8, jockey: 'jk-bejarano', purse: 126000, note: 'Paid $6.60' },
        { date: -174, track: 'OP', raceNo: 7, type: 'clm', yards: 1210, surface: 'D', finish: 1, field: 9, jockey: 'jk-bejarano', purse: 50000, note: 'Claimed by 8:38 Racing' },
        { date: -240, track: 'FG', raceNo: 5, type: 'alw', yards: 1320, surface: 'D', finish: 4, field: 10, jockey: 'jk-vazquez', purse: 62000 },
      ] },
    { id: 'oscars-hope', name: "Oscar's Hope", stableId: 'larose', sex: 'C', foaled: 2023, color: 'Bay',
      bred: 'KY', sire: 'Twirling Candy', dam: 'Hopeful Princess', damSire: 'Not This Time',
      owner: 'Michael McLoughlin', breeder: 'Stonestreet Thoroughbred Holdings', registry: 'Jockey Club',
      record: { starts: 5, wins: 2, seconds: 2, thirds: 0, earnings: 214300 },
      careerWins: 2, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null, nominated: ['elp-d4-r3'],
      pps: [
        { date: -117, track: 'KEE', raceNo: 7, type: 'listed', name: 'Lafayette Stakes', yards: 1430, surface: 'D', finish: 2, field: 8, jockey: 'jk-iortiz', purse: 400000, note: 'Beaten a head; earned $78,000' },
        { date: -165, track: 'FG', raceNo: 9, type: 'alw', yards: 1320, surface: 'D', finish: 1, field: 9, jockey: 'jk-iortiz', purse: 90000 },
        { date: -206, track: 'FG', raceNo: 3, type: 'msw', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-hernandez', purse: 68000 },
      ] },
    { id: 'arthur-jr', name: 'Arthur Jr.', stableId: 'larose', sex: 'G', foaled: 2022, color: 'Bay/Brown',
      bred: 'LA', sire: 'Authentic', dam: 'Parade Of Roses', damSire: 'Tapit',
      owner: 'L F Geaux Racing', breeder: 'L F Geaux Racing', registry: 'Jockey Club',
      record: { starts: 9, wins: 2, seconds: 1, thirds: 3, earnings: 148700 },
      careerWins: 2, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null,
      pps: [
        { date: -110, track: 'KEE', raceNo: 4, type: 'alw', yards: 1870, surface: 'D', finish: 1, field: 8, jockey: 'jk-jlortiz', purse: 96000, note: 'Won by ½L, 1:45.56' },
        { date: -152, track: 'FG', raceNo: 6, type: 'optClm', yards: 1760, surface: 'D', finish: 3, field: 9, jockey: 'jk-hernandez', purse: 64000 },
        { date: -198, track: 'ELP', raceNo: 5, type: 'clm', yards: 1760, surface: 'D', finish: 3, field: 10, jockey: 'jk-esquivel', purse: 28000 },
      ] },
    { id: 'eye-dee-kay', name: 'Eye Dee Kay', stableId: 'larose', sex: 'G', foaled: 2019, color: 'Chestnut',
      bred: 'KY', sire: 'Overanalyze', dam: 'Crab Key', damSire: 'Candy Ride',
      owner: 'Maggi Moss', breeder: 'Brereton C. Jones', registry: 'Jockey Club',
      record: { starts: 27, wins: 5, seconds: 6, thirds: 4, earnings: 402100 },
      careerWins: 5, winsOtherThanMdnClmStarter: 5, lastRanForPrice: 40000,
      pps: [
        { date: -109, track: 'KEE', raceNo: 3, type: 'optClm', yards: 1430, surface: 'D', finish: 1, field: 9, jockey: 'jk-iortiz', purse: 88000 },
        { date: -168, track: 'ELP', raceNo: 7, type: 'starterAlw', yards: 1430, surface: 'D', finish: 2, field: 8, jockey: 'jk-esquivel', purse: 40000 },
        { date: -211, track: 'ELP', raceNo: 2, type: 'clm', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-hernandez', purse: 26000, claimedFor: 40000 },
      ] },
    { id: 'glen-airy', name: 'Glen Airy', stableId: 'larose', sex: 'G', foaled: 2020, color: 'Chestnut',
      bred: 'KY', sire: 'Sky Mesa', dam: 'My Favorite Tune', damSire: 'Distorted Humor',
      owner: 'Maggi Moss', breeder: 'Gainesway Farm', registry: 'Jockey Club',
      record: { starts: 22, wins: 3, seconds: 5, thirds: 5, earnings: 231800 },
      careerWins: 3, winsOtherThanMdnClmStarter: 3, lastRanForPrice: 70000,
      pps: [
        { date: -94, track: 'OP', raceNo: 1, type: 'clm', yards: 1540, surface: 'D', finish: 3, field: 8, jockey: 'jk-bejarano', purse: 70000, note: 'Went off 11/4 co-favorite' },
        { date: -148, track: 'FG', raceNo: 8, type: 'clm', yards: 1430, surface: 'D', finish: 2, field: 9, jockey: 'jk-vazquez', purse: 52000 },
        { date: -190, track: 'ELP', raceNo: 6, type: 'clm', yards: 1320, surface: 'D', finish: 5, field: 10, jockey: 'jk-esquivel', purse: 30000 },
      ] },
    { id: 'standoutsensation', name: 'Standoutsensation', stableId: 'larose', sex: 'M', foaled: 2021, color: 'Bay',
      bred: 'KY', sire: 'Take Charge Indy', dam: 'Standout Style', damSire: 'Bernardini',
      owner: 'Whitham Thoroughbreds', breeder: 'Whitham Thoroughbreds', registry: 'Jockey Club',
      record: { starts: 14, wins: 3, seconds: 4, thirds: 3, earnings: 396500 },
      careerWins: 3, winsOtherThanMdnClmStarter: 3, lastRanForPrice: null,
      pps: [
        { date: -95, track: 'OP', raceNo: 9, type: 'stakes', name: 'Dig a Diamond Stakes', yards: 1430, surface: 'D', finish: 3, field: 8, jockey: 'jk-bejarano', purse: 200000 },
        { date: -164, track: 'OP', raceNo: 8, type: 'stakes', name: 'Pippin Stakes', yards: 1760, surface: 'D', finish: 1, field: 7, jockey: 'jk-bejarano', purse: 150000 },
        { date: -228, track: 'CD', raceNo: 9, type: 'stakes', name: 'Turnback the Alarm Stakes', yards: 1760, surface: 'D', finish: 1, field: 8, jockey: 'jk-hernandez', purse: 125000 },
      ] },
    { id: 'gewurztraminer', name: 'Gewurztraminer', stableId: 'larose', sex: 'G', foaled: 2021, color: 'Gray/Roan',
      bred: 'KY', sire: 'Blame', dam: 'Vintage Bloom', damSire: 'Kitten\'s Joy',
      owner: 'Kinnon LaRose Racing', breeder: 'Claiborne Farm', registry: 'Jockey Club',
      record: { starts: 18, wins: 3, seconds: 3, thirds: 4, earnings: 189200 },
      careerWins: 3, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null, turfPreferred: true,
      pps: [
        { date: -80, track: 'SAR', raceNo: 7, type: 'alw', yards: 1870, surface: 'T', finish: 4, field: 12, jockey: 'jk-jlortiz', purse: 80000 },
        { date: -130, track: 'CD', raceNo: 10, type: 'alw', yards: 1760, surface: 'T', finish: 1, field: 11, jockey: 'jk-hernandez', purse: 78000 },
        { date: -175, track: 'FG', raceNo: 7, type: 'optClm', yards: 1980, surface: 'T', finish: 3, field: 10, jockey: 'jk-vazquez', purse: 60000 },
      ] },
    { id: 'batter-up', name: 'Batter Up', stableId: 'larose', sex: 'G', foaled: 2022, color: 'Bay',
      bred: 'KY', sire: 'Gun Runner', dam: 'Home Plate', damSire: 'Speightstown',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — breeder not sourced', registry: 'Jockey Club',
      record: { starts: 7, wins: 2, seconds: 1, thirds: 1, earnings: 96400 },
      careerWins: 2, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null, illustrativeSexAge: true,
      pps: [
        { date: -89, track: 'OP', raceNo: 1, type: 'alw', yards: 1430, surface: 'D', finish: 1, field: 8, jockey: 'jk-bejarano', purse: 88000, note: 'Favored, paid $6.00' },
        { date: -145, track: 'FG', raceNo: 2, type: 'mdnClm', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-vazquez', purse: 38000 },
        { date: -190, track: 'ELP', raceNo: 3, type: 'msw', yards: 1320, surface: 'D', finish: 4, field: 9, jockey: 'jk-esquivel', purse: 52000 },
      ] },
    { id: 'hello-angel', name: 'Hello Angel', stableId: 'larose', sex: 'F', foaled: 2022, color: 'Chestnut',
      bred: 'KY', sire: 'Practical Joke', dam: 'Angel Song', damSire: 'Union Rags',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — breeder not sourced', registry: 'Jockey Club',
      record: { starts: 6, wins: 2, seconds: 0, thirds: 2, earnings: 78900 },
      careerWins: 2, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null, illustrativeSexAge: true,
      pps: [
        { date: -104, track: 'OP', raceNo: 3, type: 'alw', yards: 1430, surface: 'D', finish: 1, field: 7, jockey: 'jk-vazquez', purse: 84000, note: 'Favored, paid $6.20' },
        { date: -160, track: 'FG', raceNo: 4, type: 'msw', yards: 1320, surface: 'D', finish: 3, field: 10, jockey: 'jk-vazquez', purse: 58000 },
        { date: -205, track: 'ELP', raceNo: 1, type: 'msw', yards: 1210, surface: 'D', finish: 1, field: 9, jockey: 'jk-hernandez', purse: 52000 },
      ] },
    { id: 'authentic-gallop', name: 'Authentic Gallop', stableId: 'larose', sex: 'G', foaled: 2022, color: 'Bay',
      bred: 'LA', sire: 'Authentic', dam: 'Galloping Ami', damSire: 'Curlin',
      owner: 'L F Geaux Racing', breeder: 'L F Geaux Racing', registry: 'Jockey Club',
      record: { starts: 11, wins: 2, seconds: 2, thirds: 1, earnings: 132600 },
      careerWins: 2, winsOtherThanMdnClmStarter: 2, lastRanForPrice: null,
      pps: [
        { date: -116, track: 'EVD', raceNo: 8, type: 'stakes', name: 'Evangeline Mile', yards: 1760, surface: 'D', finish: 7, field: 8, jockey: 'jk-roman', purse: 100000 },
        { date: -172, track: 'FG', raceNo: 6, type: 'alw', yards: 1540, surface: 'D', finish: 1, field: 9, jockey: 'jk-vazquez', purse: 66000 },
        { date: -214, track: 'EVD', raceNo: 4, type: 'alw', yards: 1430, surface: 'D', finish: 2, field: 10, jockey: 'jk-roman', purse: 48000 },
      ] },
    { id: 'my-noble-knight', name: 'My Noble Knight', stableId: 'larose', sex: 'G', foaled: 2021, color: 'Dark Bay/Brown',
      bred: 'KY', sire: 'Noble Mission', dam: 'Knightly Deed', damSire: 'Smart Strike',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — breeder not sourced', registry: 'Jockey Club',
      record: { starts: 8, wins: 1, seconds: 1, thirds: 2, earnings: 64200 },
      careerWins: 1, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 50000, illustrativeSexAge: true,
      pps: [
        { date: -118, track: 'OP', raceNo: 2, type: 'starterAlw', yards: 1980, surface: 'D', finish: 4, field: 9, jockey: 'jk-bejarano', purse: 50000 },
        { date: -180, track: 'FG', raceNo: 3, type: 'clm', yards: 1870, surface: 'D', finish: 3, field: 10, jockey: 'jk-vazquez', purse: 34000, claimedFor: 50000 },
        { date: -240, track: 'ELP', raceNo: 4, type: 'clm', yards: 1760, surface: 'D', finish: 6, field: 10, jockey: 'jk-esquivel', purse: 24000 },
      ] },
    { id: 'midnight-still', name: 'Midnight Still', stableId: 'larose', sex: 'C', foaled: 2024, color: 'Dark Bay/Brown',
      bred: 'KY', sire: 'Into Mischief', dam: 'Still Water', damSire: 'War Front',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — breeder not sourced', registry: 'Jockey Club',
      record: { starts: 0, wins: 0, seconds: 0, thirds: 0, earnings: 0 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null, firstTimeStarter: true, pps: [] },
    { id: 'hormesis', name: 'Hormesis', stableId: 'larose', sex: 'F', foaled: 2024, color: 'Bay',
      bred: 'NY', sire: 'Vekoma', dam: 'Adaptive Trait', damSire: 'Medaglia d\'Oro',
      owner: 'Kinnon LaRose Racing', breeder: 'Sequel New York', registry: 'Jockey Club',
      nyBredRegistry: true,
      record: { starts: 0, wins: 0, seconds: 0, thirds: 0, earnings: 0 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null, firstTimeStarter: true, pps: [] },
    { id: 'molly-mciver', name: 'Molly McIver', stableId: 'larose', sex: 'F', foaled: 2024, color: 'Bay',
      bred: 'KY', sire: 'Charlatan', dam: 'McIver\'s Girl', damSire: 'Ghostzapper',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — breeder not sourced', registry: 'Jockey Club',
      record: { starts: 2, wins: 0, seconds: 0, thirds: 0, earnings: 4200 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      pps: [
        { date: -23, track: 'ELP', raceNo: 4, type: 'msw', yards: 1210, surface: 'D', finish: 8, field: 12, jockey: 'jk-hernandez', purse: 55000, note: 'Card postponed from Jul 2' },
        { date: -58, track: 'CD', raceNo: 2, type: 'msw', yards: 1210, surface: 'D', finish: 6, field: 10, jockey: 'jk-hernandez', purse: 62000 },
      ] },
    { id: 'sabine-pass', name: 'Sabine Pass', stableId: 'larose', sex: 'F', foaled: 2022, color: 'Gray/Roan',
      bred: 'KY', sire: 'Tapit', dam: 'Coastal Chart', damSire: 'Bernardini',
      owner: 'Kinnon LaRose Racing', breeder: 'Illustrative — demo-fiction horse', registry: 'Jockey Club',
      record: { starts: 9, wins: 1, seconds: 2, thirds: 1, earnings: 71300 },
      careerWins: 1, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 30000, demoFiction: true,
      vetList: { listed: true, reason: 'Unsound', eligibleDateOffset: 12 },
      pps: [
        { date: -34, track: 'ELP', raceNo: 6, type: 'clm', yards: 1320, surface: 'D', finish: 4, field: 9, jockey: 'jk-esquivel', purse: 26000 },
        { date: -76, track: 'ELP', raceNo: 3, type: 'mdnClm', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-esquivel', purse: 32000 },
      ] },

    // ===== Rival barns — they fill the fields and give the track a history log =====
    { id: 'river-sonata', name: 'River Sonata', stableId: 'stewart', sex: 'F', foaled: 2023, color: 'Bay',
      bred: 'KY', sire: 'Munnings', dam: 'Sonata Key', damSire: 'Bernardini',
      owner: 'Stewart Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 4, wins: 0, seconds: 1, thirds: 1, earnings: 18400 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 30000,
      pps: [{ date: -30, track: 'ELP', raceNo: 1, type: 'mdnClm', yards: 1320, surface: 'D', finish: 2, field: 9, jockey: 'jk-esquivel', purse: 34000 }] },
    { id: 'silk-purse', name: 'Silk Purse', stableId: 'stewart', sex: 'F', foaled: 2023, color: 'Chestnut',
      bred: 'KY', sire: 'Oscar Performance', dam: 'Purse Strings', damSire: 'Hard Spun',
      owner: 'Stewart Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 5, wins: 0, seconds: 0, thirds: 2, earnings: 12900 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 20000,
      pps: [{ date: -41, track: 'ELP', raceNo: 2, type: 'mdnClm', yards: 1430, surface: 'D', finish: 3, field: 10, jockey: 'jk-esquivel', purse: 30000 }] },
    { id: 'bourbon-barrel', name: 'Bourbon Barrel', stableId: 'asmussen', sex: 'G', foaled: 2022, color: 'Bay',
      bred: 'KY', sire: 'Nyquist', dam: 'Barrel Proof', damSire: 'More Than Ready',
      owner: 'Heider Family Stables', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 8, wins: 2, seconds: 2, thirds: 1, earnings: 118000 },
      careerWins: 2, winsOtherThanMdnClmStarter: 1, lastRanForPrice: null,
      pps: [{ date: -37, track: 'OP', raceNo: 5, type: 'alw', yards: 1430, surface: 'D', finish: 1, field: 8, jockey: 'jk-bejarano', purse: 92000 }] },
    { id: 'quiet-storm', name: 'Quiet Storm', stableId: 'asmussen', sex: 'F', foaled: 2022, color: 'Gray/Roan',
      bred: 'KY', sire: 'Arrogate', dam: 'Storm Warning', damSire: 'Malibu Moon',
      owner: 'Heider Family Stables', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 5, wins: 0, seconds: 2, thirds: 0, earnings: 26800 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      pps: [{ date: -44, track: 'OP', raceNo: 2, type: 'msw', yards: 1320, surface: 'D', finish: 2, field: 9, jockey: 'jk-vazquez', purse: 78000 }] },
    { id: 'lone-star-legend', name: 'Lone Star Legend', stableId: 'calhoun', sex: 'G', foaled: 2021, color: 'Chestnut',
      bred: 'TX', sire: 'Bolt d\'Oro', dam: 'Legendary Lady', damSire: 'Distorted Humor',
      owner: 'End Zone Athletics', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 19, wins: 4, seconds: 3, thirds: 4, earnings: 224000 },
      careerWins: 4, winsOtherThanMdnClmStarter: 3, lastRanForPrice: 40000,
      pps: [{ date: -52, track: 'LS', raceNo: 6, type: 'optClm', yards: 1540, surface: 'D', finish: 2, field: 8, jockey: 'jk-luzzi', purse: 58000 },
        { date: -132, track: 'ELP', raceNo: 8, type: 'clm', yards: 1430, surface: 'D', finish: 1, field: 9, jockey: 'jk-esquivel', purse: 30000 }] },
    { id: 'pecan-grove', name: 'Pecan Grove', stableId: 'pish', sex: 'M', foaled: 2020, color: 'Bay',
      bred: 'TX', sire: 'Too Much Bling', dam: 'Grove Alley', damSire: 'Grasshopper',
      owner: 'Pish Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 24, wins: 5, seconds: 5, thirds: 3, earnings: 198500 },
      careerWins: 5, winsOtherThanMdnClmStarter: 2, lastRanForPrice: 25000,
      pps: [{ date: -60, track: 'LS', raceNo: 3, type: 'clm', yards: 1760, surface: 'D', finish: 3, field: 10, jockey: 'jk-luzzi', purse: 26000 },
        { date: -145, track: 'ELP', raceNo: 5, type: 'clm', yards: 1760, surface: 'D', finish: 4, field: 10, jockey: 'jk-esquivel', purse: 24000 },
        { date: -320, track: 'ELP', raceNo: 2, type: 'clm', yards: 1540, surface: 'D', finish: 2, field: 9, jockey: 'jk-esquivel', purse: 22000 }] },
    { id: 'cox-turf-flyer', name: 'Turf Flyer', stableId: 'bcox', sex: 'C', foaled: 2023, color: 'Bay',
      bred: 'KY', sire: 'Omaha Beach', dam: 'Flying Colours', damSire: 'War Front',
      owner: 'Godolphin', breeder: 'Godolphin', registry: 'Jockey Club',
      record: { starts: 3, wins: 1, seconds: 1, thirds: 0, earnings: 88000 },
      careerWins: 1, winsOtherThanMdnClmStarter: 1, lastRanForPrice: null, turfPreferred: true,
      pps: [{ date: -28, track: 'ELP', raceNo: 9, type: 'alw', yards: 1760, surface: 'T', finish: 1, field: 11, jockey: 'jk-hernandez', purse: 58000 }] },
    { id: 'empire-echo', name: 'Empire Echo', stableId: 'bcox', sex: 'F', foaled: 2024, color: 'Bay',
      bred: 'NY', sire: 'Vekoma', dam: 'Echo Park', damSire: 'Tiznow',
      owner: 'Godolphin', breeder: 'Sequel New York', registry: 'Jockey Club', nyBredRegistry: true,
      record: { starts: 1, wins: 0, seconds: 1, thirds: 0, earnings: 14000 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      pps: [{ date: -26, track: 'SAR', raceNo: 3, type: 'msw', yards: 1210, surface: 'T', finish: 2, field: 11, jockey: 'jk-franco', purse: 115000 }] },
    // Field-filling horses from the rival barns. Compact on purpose: they exist so
    // spot counts, overnight sheets, and the track's history log are real. Names
    // and pedigrees here are invented, not sourced.
    { id: 'ohio-valley', name: 'Ohio Valley', stableId: 'stewart', sex: 'G', foaled: 2021, color: 'Bay',
      bred: 'KY', sire: 'Mineshaft', dam: 'Valley Song', damSire: 'Giant\'s Causeway',
      owner: 'Stewart Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 17, wins: 3, seconds: 2, thirds: 4, earnings: 141000 },
      careerWins: 3, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 20000,
      pps: [{ date: -33, track: 'ELP', raceNo: 4, type: 'clm', yards: 1430, surface: 'D', finish: 1, field: 9, jockey: 'jk-esquivel', purse: 22000 },
        { date: -95, track: 'ELP', raceNo: 2, type: 'clm', yards: 1320, surface: 'D', finish: 3, field: 10, jockey: 'jk-esquivel', purse: 20000 }] },
    { id: 'green-river-girl', name: 'Green River Girl', stableId: 'stewart', sex: 'F', foaled: 2022, color: 'Chestnut',
      bred: 'KY', sire: 'Tapiture', dam: 'River Bend', damSire: 'Bernardini',
      owner: 'Stewart Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 12, wins: 2, seconds: 3, thirds: 1, earnings: 96000 },
      careerWins: 2, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 30000,
      pps: [{ date: -40, track: 'ELP', raceNo: 6, type: 'alw', yards: 1320, surface: 'D', finish: 2, field: 8, jockey: 'jk-hernandez', purse: 58000 }] },
    { id: 'copper-kettle', name: 'Copper Kettle', stableId: 'bcox', sex: 'F', foaled: 2023, color: 'Bay',
      bred: 'KY', sire: 'Constitution', dam: 'Kettle Creek', damSire: 'Speightstown',
      owner: 'Godolphin', breeder: 'Godolphin', registry: 'Jockey Club',
      record: { starts: 3, wins: 0, seconds: 1, thirds: 1, earnings: 21000 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      pps: [{ date: -31, track: 'ELP', raceNo: 1, type: 'msw', yards: 1320, surface: 'D', finish: 2, field: 10, jockey: 'jk-hernandez', purse: 55000 }] },
    { id: 'harbor-mist', name: 'Harbor Mist', stableId: 'bcox', sex: 'M', foaled: 2021, color: 'Gray/Roan',
      bred: 'KY', sire: 'Frosted', dam: 'Misty Harbor', damSire: 'Tapit',
      owner: 'Godolphin', breeder: 'Godolphin', registry: 'Jockey Club',
      record: { starts: 20, wins: 4, seconds: 4, thirds: 3, earnings: 268000 },
      careerWins: 4, winsOtherThanMdnClmStarter: 3, lastRanForPrice: null,
      pps: [{ date: -36, track: 'CD', raceNo: 7, type: 'optClm', yards: 1540, surface: 'D', finish: 1, field: 8, jockey: 'jk-hernandez', purse: 102000 }] },
    { id: 'razorback-red', name: 'Razorback Red', stableId: 'asmussen', sex: 'C', foaled: 2023, color: 'Chestnut',
      bred: 'AR', sire: 'Gun Runner', dam: 'Red Clover', damSire: 'Curlin',
      owner: 'Heider Family Stables', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 4, wins: 1, seconds: 1, thirds: 0, earnings: 74000 },
      careerWins: 1, winsOtherThanMdnClmStarter: 1, lastRanForPrice: null,
      pps: [{ date: -42, track: 'OP', raceNo: 6, type: 'msw', yards: 1320, surface: 'D', finish: 1, field: 9, jockey: 'jk-bejarano', purse: 86000 }] },
    { id: 'hot-springs-lady', name: 'Hot Springs Lady', stableId: 'asmussen', sex: 'F', foaled: 2022, color: 'Bay',
      bred: 'KY', sire: 'Nyquist', dam: 'Thermal Spring', damSire: 'Malibu Moon',
      owner: 'Heider Family Stables', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 10, wins: 2, seconds: 1, thirds: 2, earnings: 118000 },
      careerWins: 2, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 25000,
      pps: [{ date: -47, track: 'OP', raceNo: 3, type: 'clm', yards: 1430, surface: 'D', finish: 2, field: 10, jockey: 'jk-vazquez', purse: 34000 }] },
    { id: 'bluebonnet-boy', name: 'Bluebonnet Boy', stableId: 'calhoun', sex: 'G', foaled: 2022, color: 'Dark Bay/Brown',
      bred: 'TX', sire: 'Bolt d\'Oro', dam: 'Prairie Star', damSire: 'Distorted Humor',
      owner: 'End Zone Athletics', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 13, wins: 2, seconds: 3, thirds: 2, earnings: 104000 },
      careerWins: 2, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 15000,
      pps: [{ date: -55, track: 'LS', raceNo: 4, type: 'clm', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-luzzi', purse: 24000 },
        { date: -160, track: 'ELP', raceNo: 3, type: 'mdnClm', yards: 1320, surface: 'D', finish: 4, field: 9, jockey: 'jk-esquivel', purse: 30000 }] },
    { id: 'opelousas-queen', name: 'Opelousas Queen', stableId: 'pish', sex: 'F', foaled: 2023, color: 'Bay',
      bred: 'LA', sire: 'Star Guitar', dam: 'Queen Cane', damSire: 'Half Ours',
      owner: 'Pish Racing Stable', breeder: 'Illustrative', registry: 'Jockey Club',
      record: { starts: 6, wins: 1, seconds: 0, thirds: 2, earnings: 42000 },
      careerWins: 1, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 15000,
      pps: [{ date: -50, track: 'EVD', raceNo: 2, type: 'mdnClm', yards: 1320, surface: 'D', finish: 1, field: 10, jockey: 'jk-roman', purse: 24000 }] },
    { id: 'saratoga-sky', name: 'Saratoga Sky', stableId: 'bcox', sex: 'F', foaled: 2024, color: 'Gray/Roan',
      bred: 'NY', sire: 'Practical Joke', dam: 'Sky Sonnet', damSire: 'Bernardini',
      owner: 'Godolphin', breeder: 'Sequel New York', registry: 'Jockey Club', nyBredRegistry: true,
      record: { starts: 0, wins: 0, seconds: 0, thirds: 0, earnings: 0 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null, firstTimeStarter: true, pps: [] },
    { id: 'empire-tide', name: 'Empire Tide', stableId: 'stewart', sex: 'C', foaled: 2024, color: 'Bay',
      bred: 'NY', sire: 'Vekoma', dam: 'Tidal Wave', damSire: 'Tiznow',
      owner: 'Stewart Racing Stable', breeder: 'Sequel New York', registry: 'Jockey Club', nyBredRegistry: true,
      record: { starts: 1, wins: 0, seconds: 0, thirds: 1, earnings: 9000 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      pps: [{ date: -29, track: 'SAR', raceNo: 2, type: 'msw', yards: 1320, surface: 'D', finish: 3, field: 10, jockey: 'jk-franco', purse: 100000 }] },

    // Quarter Horses (AQHA) — the registry conflict the checker must catch.
    { id: 'dropping-dimes', name: 'Dropping Dimes', stableId: 'ponce', sex: 'F', foaled: 2022, color: 'Sorrel',
      bred: 'LA', sire: 'Apollitical Jess', dam: 'Dime Piece', damSire: 'Corona Cartel',
      owner: 'Ponce Racing', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 11, wins: 5, seconds: 2, thirds: 1, earnings: 186000 },
      careerWins: 5, winsOtherThanMdnClmStarter: 4, lastRanForPrice: null,
      pps: [{ date: -74, track: 'DED', raceNo: 9, type: 'stakes', name: 'Miss Polly Classic (G3)', yards: 400, surface: 'D', finish: 1, field: 10, jockey: 'jk-diego', purse: 90000, note: '19.910' },
        { date: -140, track: 'DED', raceNo: 6, type: 'alw', yards: 400, surface: 'D', finish: 1, field: 9, jockey: 'jk-diego', purse: 26000 }] },
    { id: 'vinton-flash', name: 'Vinton Flash', stableId: 'jgarcia', sex: 'G', foaled: 2022, color: 'Bay',
      bred: 'LA', sire: 'Jess Good Candy', dam: 'Flash Point', damSire: 'Walk Thru Fire',
      owner: 'Garcia Stable', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 14, wins: 3, seconds: 4, thirds: 2, earnings: 94000 },
      careerWins: 3, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 10000,
      pps: [{ date: -68, track: 'DED', raceNo: 4, type: 'clm', yards: 350, surface: 'D', finish: 2, field: 10, jockey: 'jk-diego', purse: 14000 },
        { date: -132, track: 'DED', raceNo: 3, type: 'clm', yards: 350, surface: 'D', finish: 1, field: 10, jockey: 'jk-diego', purse: 14000 }] },
    { id: 'bayou-blaze', name: 'Bayou Blaze', stableId: 'ponce', sex: 'G', foaled: 2023, color: 'Sorrel',
      bred: 'LA', sire: 'Coronas Fast Dash', dam: 'Bayou Belle', damSire: 'Tres Seis',
      owner: 'Ponce Racing', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 6, wins: 1, seconds: 1, thirds: 1, earnings: 28000 },
      careerWins: 1, winsOtherThanMdnClmStarter: 0, lastRanForPrice: 10000,
      pps: [{ date: -70, track: 'DED', raceNo: 2, type: 'clm', yards: 350, surface: 'D', finish: 1, field: 10, jockey: 'jk-diego', purse: 14000 }] },
    { id: 'cajun-cartel', name: 'Cajun Cartel', stableId: 'jgarcia', sex: 'F', foaled: 2024, color: 'Bay',
      bred: 'LA', sire: 'Apollitical Jess', dam: 'Cartel Queen', damSire: 'Corona Cartel',
      owner: 'Garcia Stable', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 1, wins: 0, seconds: 1, thirds: 0, earnings: 4000 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null, nominated: ['ded-d1-r2'],
      pps: [{ date: -35, track: 'DED', raceNo: 1, type: 'msw', yards: 350, surface: 'D', finish: 2, field: 9, jockey: 'jk-diego', purse: 18000 }] },
    { id: 'vinton-vixen', name: 'Vinton Vixen', stableId: 'ponce', sex: 'M', foaled: 2021, color: 'Palomino',
      bred: 'LA', sire: 'Jess Good Candy', dam: 'Vixen Run', damSire: 'Walk Thru Fire',
      owner: 'Ponce Racing', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 18, wins: 4, seconds: 3, thirds: 3, earnings: 132000 },
      careerWins: 4, winsOtherThanMdnClmStarter: 1, lastRanForPrice: null,
      pps: [{ date: -66, track: 'DED', raceNo: 7, type: 'alw', yards: 400, surface: 'D', finish: 3, field: 10, jockey: 'jk-diego', purse: 26000 }] },
    { id: 'lake-charles-lad', name: 'Lake Charles Lad', stableId: 'jgarcia', sex: 'G', foaled: 2022, color: 'Brown',
      bred: 'LA', sire: 'Tres Seis', dam: 'Charles Street', damSire: 'Corona Cartel',
      owner: 'Garcia Stable', breeder: 'Illustrative', registry: 'AQHA',
      record: { starts: 9, wins: 1, seconds: 2, thirds: 2, earnings: 46000 },
      careerWins: 1, winsOtherThanMdnClmStarter: 1, lastRanForPrice: 10000,
      pps: [{ date: -64, track: 'DED', raceNo: 5, type: 'clm', yards: 400, surface: 'D', finish: 2, field: 10, jockey: 'jk-diego', purse: 16000 }] },
  ];

  const horses = horseSpecs.map((h) => {
    const stable = stables.find((s) => s.id === h.stableId) || {};
    const art = iconFor(h.id);
    const pps = (h.pps || []).map((p) => ({
      date: ymd(new Date(base.getTime() + p.date * DAY_MS)),
      trackId: p.track, raceNo: p.raceNo, type: p.type, typeLabel: T[p.type] || p.type,
      name: p.name || null, distanceYards: p.yards, surface: p.surface,
      finish: p.finish, fieldSize: p.field, jockeyId: p.jockey, purse: p.purse,
      claimedFor: p.claimedFor || null, note: p.note || null,
    }));
    const last = pps[0] || null;
    const yearNow = new Date(today.slice(0, 4) + '-01-01T00:00:00Z').getUTCFullYear();
    const vet = h.vetList
      ? { listed: true, reason: h.vetList.reason,
          eligibleDate: ymd(new Date(base.getTime() + h.vetList.eligibleDateOffset * DAY_MS)) }
      : { listed: false };
    return Object.assign({}, h, {
      stable: stable.name, trainer: stable.trainer,
      sexLabel: SEX_LABEL[h.sex] || h.sex,
      age: yearNow - h.foaled,
      icon: art.icon, tint: art.tint,
      registry: h.registry || 'Jockey Club',
      maiden: (h.careerWins || 0) === 0,
      pps,
      lastStart: last,
      lastStartDate: last ? last.date : null,
      startsByTrack: pps.reduce((m, p) => { m[p.trackId] = (m[p.trackId] || 0) + 1; return m; }, {}),
      vetList: vet,
      medication: { lasix: !h.firstTimeStarter },
      equipment: { blinkers: 'off', declared: false },
      nominated: h.nominated || [],
    });
  });

  // ---- Standard denial reasons (racing-office vocabulary) -----------------
  // The track picks one when declining; a free-text comment is always available
  // for one-off documentation.
  const denialReasons = [
    { code: 'oversubscribed', label: 'Race oversubscribed — field full' },
    { code: 'ineligible', label: 'Horse ineligible under the conditions' },
    { code: 'preference', label: 'Preference given to other entrants' },
    { code: 'jockey', label: 'Jockey unavailable or double-booked' },
    { code: 'vet-list', label: "On the veterinarian's list — not eligible to run" },
    { code: 'equipment', label: 'Equipment or medication not properly declared' },
    { code: 'late', label: 'Submitted after entry close' },
    { code: 'paperwork', label: 'Registration, licensing, or stall paperwork incomplete' },
    { code: 'nomination', label: 'Not nominated to this stakes' },
    { code: 'race-cancelled', label: 'Race cancelled or rewritten' },
    { code: 'other', label: 'Other — see comment' },
  ];

  // ---- Seeded entries (spots already filled by other barns) --------------
  // Deterministic filler so "openings left / spots filled" is real from load.
  const entries = [];
  (function seedEntries() {
    const fillers = horses.filter((h) => h.stableId !== 'larose');
    const qh = fillers.filter((h) => h.registry === 'AQHA');
    const tb = fillers.filter((h) => h.registry !== 'AQHA');
    races.forEach((race, i) => {
      const pool = race.conditions.registry === 'AQHA' ? qh : tb;
      if (!pool.length) return;
      // 40–80% of spots pre-filled; one race deliberately full to show the
      // "no openings left" state, one deliberately near-empty.
      let n;
      if (race.id === 'elp-d2-r4') n = race.spots;              // full
      else if (race.id === 'elp-d1-r3') n = 1;                  // needs horses
      else n = Math.max(1, Math.round(race.spots * (0.4 + ((i * 7) % 5) / 10)));
      for (let k = 0; k < n; k++) {
        const h = pool[(i * 3 + k) % pool.length];
        entries.push({
          raceId: race.id, horseId: h.id, source: 'seed',
          jockeyId: jockeys[(i + k) % jockeys.length].id,
          aeMto: null,
          // Filler entries are anonymised in the UI as "other barns" beyond the
          // ones we actually seed by id — every id here is a real seeded horse.
          slot: k + 1,
        });
      }
    });
  })();

  // ---- Notifications (Overnights & Extras) --------------------------------
  const notifications = [
    { id: 'ntf-1', kind: 'overnight', trackId: 'ELP', raceDayId: 'elp-d2',
      title: 'Overnight sheet posted — Ellis Park',
      body: 'The overnight for the feature card is available. 8 races, 2 also-eligible lists.',
      at: agoISO(6), audience: 'trainer' },
    { id: 'ntf-2', kind: 'extra', trackId: 'ELP', raceDayId: 'elp-d2', raceId: 'elp-d2-r8',
      title: 'Extra race added — Ellis Park R8',
      body: '$21,000 claiming, 6 furlongs dirt, $10,000 claiming price. Entries still open.',
      at: agoISO(5), audience: 'trainer' },
    { id: 'ntf-3', kind: 'overnight', trackId: 'DED', raceDayId: 'ded-d1',
      title: 'Overnight sheet posted — Delta Downs',
      body: 'Quarter Horse card overnight posted with trial draw.',
      at: agoISO(4), audience: 'trainer' },
    { id: 'ntf-4', kind: 'book', trackId: 'EVD', title: 'Condition book 5 posted — Evangeline Downs',
      body: 'Two new race days open for submissions.', at: agoISO(60), audience: 'trainer' },
  ];

  // ---- Seeded submissions + messages (so every log has history on load) ---
  // Shapes match PPStore exactly; PPStore merges these with live activity.
  const seedSubmissions = [
    { id: 'sub-seed-1', horseId: 'eye-dee-kay', raceId: 'elp-d2-r3', jockeyId: 'jk-esquivel',
      aeMto: null, equipmentNote: 'No change from last start', status: 'accepted',
      submittedAt: agoISO(52), decidedAt: agoISO(44), decidedBy: 'Ellis Park racing office',
      denialReason: null, denialComment: null, source: 'seed' },
    { id: 'sub-seed-2', horseId: 'gewurztraminer', raceId: 'sar-d1-r3', jockeyId: 'jk-jlortiz',
      aeMto: 'MTO', equipmentNote: '', status: 'pending',
      submittedAt: agoISO(19), decidedAt: null, decidedBy: null,
      denialReason: null, denialComment: null, source: 'seed' },
    { id: 'sub-seed-3', horseId: 'glen-airy', raceId: 'elp-d2-r4', jockeyId: 'jk-hernandez',
      aeMto: 'AE', equipmentNote: '', status: 'declined',
      submittedAt: agoISO(40), decidedAt: agoISO(33), decidedBy: 'Ellis Park racing office',
      denialReason: 'oversubscribed',
      denialComment: 'Race filled at 10 with four also-eligibles already listed. Happy to take him back in R7 Sunday — same distance, same surface.',
      source: 'seed' },
    { id: 'sub-seed-4', horseId: 'molly-mciver', raceId: 'elp-d1-r4', jockeyId: 'jk-hernandez',
      aeMto: 'MTO', equipmentNote: 'Blinkers off', status: 'pending',
      submittedAt: agoISO(8), decidedAt: null, decidedBy: null,
      denialReason: null, denialComment: null, source: 'seed' },
    { id: 'sub-seed-5', horseId: 'carbone', raceId: 'elp-d4-r2', jockeyId: 'jk-bejarano',
      aeMto: null, equipmentNote: '', status: 'pending',
      submittedAt: agoISO(3), decidedAt: null, decidedBy: null,
      denialReason: null, denialComment: null, source: 'seed' },
    { id: 'sub-seed-6', horseId: 'authentic-gallop', raceId: 'evd-d1-r3', jockeyId: 'jk-roman',
      aeMto: null, equipmentNote: '', status: 'accepted',
      submittedAt: agoISO(30), decidedAt: agoISO(26), decidedBy: 'Evangeline Downs racing office',
      denialReason: null, denialComment: null, source: 'seed' },
    // A rival barn's submission, so the track queue is not a single-trainer view.
    { id: 'sub-seed-7', horseId: 'lone-star-legend', raceId: 'elp-d2-r3', jockeyId: 'jk-luzzi',
      aeMto: null, equipmentNote: '', status: 'pending',
      submittedAt: agoISO(11), decidedAt: null, decidedBy: null,
      denialReason: null, denialComment: null, source: 'seed' },
  ];

  const seedMessages = [
    { id: 'msg-seed-1', threadId: 'larose::ELP', from: 'track', authorName: 'Ellis Park racing office',
      body: 'Kinnon — book 3 is up. We are light in Friday R3, the $46k allowance at a mile and 70. If you have anything for it we will hold a spot.',
      at: agoISO(70) },
    { id: 'msg-seed-2', threadId: 'larose::ELP', from: 'trainer', authorName: 'Kinnon LaRose',
      body: 'Looking at it. Eye Dee Kay is in for the optional claimer Saturday. Will get you an answer on the allowance by tomorrow.',
      at: agoISO(66) },
    { id: 'msg-seed-3', threadId: 'larose::ELP', from: 'track', authorName: 'Ellis Park racing office',
      body: 'Eye Dee Kay is in. Sorry about Glen Airy in R4 — that one filled fast and we already had four AEs.',
      at: agoISO(33) },
    { id: 'msg-seed-4', threadId: 'larose::SAR', from: 'trainer', authorName: 'Kinnon LaRose',
      body: 'Gewurztraminer submitted for the inner-turf allowance Saturday, main-track-only. Jose Ortiz to ride.',
      at: agoISO(19) },
    { id: 'msg-seed-5', threadId: 'larose::DED', from: 'track', authorName: 'Delta Downs racing office',
      body: 'Heads up, our meet is Quarter Horse only — Jockey Club horses will not pass the entry box here. Trials for the Louisiana Bred Futurity are Friday.',
      at: agoISO(48) },
  ];

  // ---- Indexes + facade ---------------------------------------------------
  const byId = (arr) => arr.reduce((m, x) => { m[x.id] = x; return m; }, {});
  const trackById = byId(tracks);
  const meetById = byId(meets);
  const raceDayById = byId(raceDays);
  const raceById = byId(races);
  const horseById = byId(horses);
  const stableById = byId(stables);
  const jockeyById = byId(jockeys);

  const meetOfRace = (r) => (r && (r.meetId || (raceDayById[r.raceDayId] || {}).meetId)) || null;
  const trackOfRace = (r) => {
    const m = meetById[meetOfRace(r)];
    return m ? m.track : null;
  };

  const PPData = {
    today,
    tracks, meets, raceDays, races, horses, stables, jockeys,
    denialReasons, notifications,
    seedEntries: entries,
    seedSubmissions, seedMessages,
    raceTypes: T,
    sexLabels: SEX_LABEL,

    getTrack: (id) => trackById[id] || null,
    getMeet: (id) => meetById[id] || null,
    getRaceDay: (id) => raceDayById[id] || null,
    getRace: (id) => raceById[id] || null,
    getHorse: (id) => horseById[id] || null,
    getStable: (id) => stableById[id] || null,
    getJockey: (id) => jockeyById[id] || null,
    getDenialReason: (code) => denialReasons.find((r) => r.code === code) || null,

    /* The signed-in trainer for the demo. */
    demoStable: () => stables.find((s) => s.isDemoUser) || stables[0],

    /* Tracks that post condition books into PostParade. */
    pairedTracks: () => tracks.filter((t) => t.paired),

    listMeets: (trackId) => meets.filter((m) => !trackId || m.track === trackId),
    listRaceDays: (meetId) => raceDays.filter((d) => !meetId || d.meetId === meetId),

    /* Races, optionally filtered. `openOnly` keeps races whose entry window
       has not closed against the demo clock. */
    listRaces(filter) {
      const f = filter || {};
      return races.filter((r) => {
        if (f.raceDayId && r.raceDayId !== f.raceDayId) return false;
        if (f.meetId && meetOfRace(r) !== f.meetId) return false;
        if (f.trackId && trackOfRace(r) !== f.trackId) return false;
        if (f.openOnly && !(r.entryClose > today)) return false;
        return true;
      });
    },

    listHorses(filter) {
      const f = filter || {};
      return horses.filter((h) => (!f.stableId || h.stableId === f.stableId) &&
        (!f.registry || h.registry === f.registry));
    },

    meetOfRace, trackOfRace,
    trackIdOfRace: trackOfRace,

    /* Seeded entries for a race (PPStore layers live submissions on top). */
    entriesForRace: (raceId) => entries.filter((e) => e.raceId === raceId),

    /* How many times a horse has started at a given track — the track-side
       history tally. Facts only: a count of past starts, not a projection. */
    startsAtTrack(horseId, trackId) {
      const h = horseById[horseId];
      return (h && h.startsByTrack[trackId]) || 0;
    },

    /* Chronological ordering key for a race. */
    raceSortKey: (r) => `${r.postTime}#${String(r.raceNumber).padStart(2, '0')}`,
  };

  global.PPData = PPData;
  if (typeof module !== 'undefined' && module.exports) module.exports = PPData;
})(typeof window !== 'undefined' ? window : globalThis);
