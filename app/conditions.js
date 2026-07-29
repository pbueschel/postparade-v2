/* PostParade v2 — condition checker (PPConditions)
 *
 * THE ONE RULE THIS FILE OBEYS: it decides ELIGIBILITY, never outcome.
 * It reads a horse's facts against a race's published conditions and reports
 * what does or does not pass the entry box. It contains no ratings, no scores,
 * no probabilities, no ranking, and no opinion about how a horse will run.
 *
 *   PPConditions.check(horse, race, ctx) → {
 *     eligible,                       // no hard conflicts
 *     conflicts: [{code,label,detail,severity}],   // 'hard' | 'flag'
 *     preferences: [{label,met,detail}],           // met · not met · unverified
 *     gates:      [{code,label,pass,detail}],      // every rule we evaluated
 *   }
 *
 * A `flag` is a conflict the racing office resolves, not the software: the
 * trainer may always "Submit Anyway" and the track reviews it manually.
 * Every rule reads its inputs defensively — an absent field skips the rule
 * rather than guessing.
 */
(function (global) {
  'use strict';

  const SEX_ALL = ['F', 'M', 'G', 'C', 'H', 'R'];
  const SEX_WORD = { C: 'colt', F: 'filly', G: 'gelding', H: 'horse', M: 'mare', R: 'ridgling' };

  function money(n) { return '$' + Math.round(+n || 0).toLocaleString(); }
  function raceDate(race) { return String(race && race.postTime || '').slice(0, 10); }

  /* ---- Light parse of the raw condition-book paragraph --------------------
     Structured extraction from the text a track actually publishes. Shown to
     the trainer in "See all conditions" so the parse is auditable — if it
     misses a clause, the trainer reads the raw text and submits anyway. */
  function parse(text) {
    const s = String(text || '');
    const out = { raw: s, clauses: [] };
    const grab = (re, key, cast) => {
      const m = s.match(re);
      if (m) out[key] = cast ? cast(m[1]) : m[1];
    };
    grab(/Purse \$([\d,]+)/i, 'purse', (v) => +v.replace(/,/g, ''));
    grab(/Claiming Price \$([\d,]+)/i, 'claimingPrice', (v) => +v.replace(/,/g, ''));
    out.surface = /\(Turf\)|Turf Course|Inner Turf/i.test(s) ? 'Turf'
      : /\(Dirt\)|main track/i.test(s) ? 'Dirt' : null;
    out.mtoAllowed = /main-track-only/i.test(s);
    out.turfToDirtClause = /inadvisable to run this race on the turf/i.test(s);
    out.lasixProhibited = /no race-day (lasix|furosemide)/i.test(s);
    out.nominationRequired = /by subscription of|nominat/i.test(s);
    out.stateBred = (s.match(/FOALED IN ([A-Z ]+?) STATE/i) || [])[1]
      || (s.match(/ACCREDITED ([A-Z ]+?) BRED/i) || [])[1] || null;
    out.quarterHorse = /QUARTER HORSES?/i.test(s);
    // Restriction sentences, split for display
    s.split(/(?<=\.)\s+/).forEach((sentence) => {
      if (/^(FOR |WEIGHT|THREE YEAR OLDS,|NON-|PREFERENCE|\()/i.test(sentence.trim())) {
        out.clauses.push(sentence.trim());
      }
    });
    return out;
  }

  /* ---- Individual gates ---------------------------------------------------
     Each returns {code,label,pass,detail,severity} or null to skip. */

  function gateEntryWindow(h, race, ctx) {
    const now = (ctx && ctx.today) || (global.PPData && PPData.today);
    if (!race.entryClose || !now) return null;
    const open = race.entryClose > now;
    return {
      code: 'entry-window', label: 'Entry window', pass: open, severity: 'hard',
      detail: open ? 'Entries are open' : 'Entries have closed for this race',
    };
  }

  function gateRegistry(h, race) {
    const want = race.conditions && race.conditions.registry;
    const meetWantsQH = want === 'AQHA';
    const isQH = h.registry === 'AQHA';
    if (!want && !isQH) return null;                     // both Thoroughbred — nothing to check
    const pass = meetWantsQH === isQH;
    return {
      code: 'registry', label: 'Breed registry', pass, severity: 'hard',
      detail: pass
        ? (isQH ? 'AQHA-registered, and this is a Quarter Horse race' : 'Jockey Club registered')
        : (isQH
          ? 'AQHA (Quarter Horse) — this race is for Jockey Club Thoroughbreds'
          : 'Jockey Club (Thoroughbred) — this race is for AQHA Quarter Horses'),
    };
  }

  function gateSex(h, race) {
    const allowed = (race.conditions && race.conditions.sexes) || SEX_ALL;
    if (allowed.length === SEX_ALL.length) return null;
    const pass = allowed.indexOf(h.sex) !== -1;
    const words = allowed.map((c) => SEX_WORD[c] || c).join(', ');
    return {
      code: 'sex', label: 'Sex restriction', pass, severity: 'hard',
      detail: pass ? `${SEX_WORD[h.sex] || h.sex} — restriction is ${words}`
        : `This race is restricted to ${words}; ${h.name} is a ${SEX_WORD[h.sex] || h.sex}`,
    };
  }

  function gateAge(h, race) {
    const c = race.conditions || {};
    if (c.minAge == null && c.maxAge == null) return null;
    const okMin = c.minAge == null || h.age >= c.minAge;
    const okMax = c.maxAge == null || h.age <= c.maxAge;
    const range = c.maxAge != null
      ? (c.minAge === c.maxAge ? `${c.minAge}yo only` : `${c.minAge}–${c.maxAge}yo`)
      : `${c.minAge}yo and upward`;
    return {
      code: 'age', label: 'Age restriction', pass: okMin && okMax, severity: 'hard',
      detail: (okMin && okMax) ? `${h.age}yo — condition is ${range}`
        : `${h.age}yo does not meet ${range}`,
    };
  }

  function gateMaiden(h, race) {
    if (!(race.conditions && race.conditions.maidenOnly)) return null;
    const wins = +h.careerWins || 0;
    const pass = wins === 0;
    return {
      code: 'maiden', label: 'Maiden condition', pass, severity: 'hard',
      detail: pass ? 'Still a maiden — 0 lifetime wins'
        : `Not a maiden — ${wins} lifetime win${wins === 1 ? '' : 's'}`,
    };
  }

  /* Non-winners ladder. Two families:
     N_X  — "never won N races other than maiden, claiming, or starter"
     N2L/N3L — "never won N races" (any kind) */
  function gateNonWinners(h, race) {
    const nw = race.conditions && race.conditions.nonWinners;
    if (!nw) return null;
    const optionalOut = race.conditions.optional && race.conditions.claimingPrice;
    if (nw.kind === 'N_X') {
      const n = +h.winsOtherThanMdnClmStarter || 0;
      const pass = n < nw.count;
      return {
        code: 'non-winners', label: `Non-winners of ${nw.count} other than maiden/claiming/starter`,
        pass: pass || !!optionalOut, severity: optionalOut ? 'flag' : 'hard',
        detail: pass
          ? `${n} qualifying win${n === 1 ? '' : 's'} — under the ${nw.count}-win bar`
          : optionalOut
            ? `${n} qualifying wins is over the bar, but the race takes an optional claim at ${money(race.conditions.claimingPrice)} — entering means running for the tag`
            : `${n} qualifying wins — the condition allows fewer than ${nw.count}`,
      };
    }
    const total = +h.careerWins || 0;
    const pass = total < nw.count;
    return {
      code: 'non-winners', label: `Non-winners of ${nw.count} races`, pass, severity: 'hard',
      detail: pass ? `${total} lifetime wins — under the ${nw.count}-win bar`
        : `${total} lifetime wins — the condition allows fewer than ${nw.count}`,
    };
  }

  function gateStateBred(h, race) {
    const code = race.conditions && race.conditions.stateBred;
    if (!code) return null;
    const bredOk = h.bred === code;
    // NY (and several other states) additionally require registry approval.
    const needsRegistry = code === 'NY';
    const registryOk = !needsRegistry || !!h.nyBredRegistry;
    const pass = bredOk && registryOk;
    return {
      code: 'state-bred', label: `${code}-bred restricted`, pass, severity: 'hard',
      detail: pass
        ? (needsRegistry ? `Foaled in ${code} and approved by the state-bred registry` : `Accredited ${code}-bred`)
        : !bredOk ? `Foaled in ${h.bred || 'unknown'} — this race is restricted to ${code}-breds`
          : `Foaled in ${code} but not shown as approved by the ${code} state-bred registry`,
    };
  }

  function gateStarter(h, race) {
    const c = race.conditions || {};
    if (c.starterPrice == null) return null;
    const price = h.lastRanForPrice;
    if (price == null) {
      return {
        code: 'starter', label: `Starter — must have run for ${money(c.starterPrice)} or less`,
        pass: false, severity: 'flag',
        detail: `No claiming start on record for ${h.name} since ${c.starterSince || 'the qualifying date'} — the racing office must verify starter eligibility from the official record`,
      };
    }
    const pass = price <= c.starterPrice;
    return {
      code: 'starter', label: `Starter — must have run for ${money(c.starterPrice)} or less`,
      pass, severity: pass ? 'hard' : 'flag',
      detail: pass
        ? `Last ran for ${money(price)} — qualifies`
        : `Most recent claiming start was for ${money(price)}, above the ${money(c.starterPrice)} bar; earlier starts may still qualify — check the full record`,
    };
  }

  function gateVetList(h, race) {
    const v = h.vetList;
    if (!v || !v.listed) return null;
    const day = raceDate(race);
    const clear = v.eligibleDate && v.eligibleDate <= day;
    return {
      code: 'vet-list', label: "Veterinarian's list", pass: !!clear, severity: 'hard',
      detail: clear
        ? `Cleared ${v.eligibleDate} — eligible on race day`
        : `On the vet's list (${v.reason || 'listed'})${v.eligibleDate ? `, not eligible until ${v.eligibleDate}` : ''} — race day is ${day}`,
    };
  }

  function gateMedication(h, race) {
    if (!(race.conditions && race.conditions.lasixProhibited)) return null;
    const onLasix = !!(h.medication && h.medication.lasix);
    return {
      code: 'medication', label: 'No race-day furosemide permitted', pass: !onLasix,
      severity: 'flag',
      detail: onLasix
        ? `${h.name} has raced on furosemide; this race is run without it — the trainer must confirm the horse will run clean`
        : 'Not on race-day furosemide',
    };
  }

  function gateNomination(h, race) {
    if (!(race.conditions && race.conditions.nominationRequired)) return null;
    const nominated = (h.nominated || []).indexOf(race.id) !== -1;
    return {
      code: 'nomination', label: 'Stakes nomination', pass: nominated, severity: 'flag',
      detail: nominated
        ? 'Nominated to this stakes'
        : 'No nomination on file — supplementary nomination may be available from the racing office',
    };
  }

  const GATES = [gateEntryWindow, gateRegistry, gateSex, gateAge, gateMaiden,
    gateNonWinners, gateStateBred, gateStarter, gateVetList, gateMedication,
    gateNomination];

  /* Notices are neither conflicts nor preferences — reminders that travel with
     a submission. Equipment disclosure at entry is PENDING CONFIRMATION (open
     question for the track), so it lives here and never blocks or triggers the
     Submit Anyway path. Promote it to a gate once the requirement is settled. */
  function notices(h, race) {
    const out = [];
    if (!(h.equipment && h.equipment.declared)) {
      out.push({ code: 'equipment', label: 'Equipment not declared',
        detail: 'Whether the track requires equipment (blinkers, tongue tie, etc.) at submission is still being confirmed. Note it in the submission if you know it.' });
    }
    if (race.mtoAllowed && race.surface === 'T') {
      out.push({ code: 'mto', label: 'Main-track-only entries permitted',
        detail: 'You can enter MTO — the horse runs only if the race comes off the turf.' });
    }
    if (race.alsoEligibleCap) {
      out.push({ code: 'ae', label: `Also-eligible list of ${race.alsoEligibleCap}`,
        detail: 'If the race fills, you can ask to be placed on the also-eligible list instead.' });
    }
    return out;
  }

  /* ---- Preference clauses ------------------------------------------------
     A preference clause never makes a horse ineligible — it decides who draws
     in when a race oversubscribes. We report met / not met / unverified, and
     say plainly when the data cannot settle it. */
  function preferences(h, race) {
    const p = race.conditions && race.conditions.preference;
    if (!p) return [];
    if (p.kind === 'nonStartersForClaimingPriceOrLess' || p.kind === 'notStartedForClaimingPriceOrLess') {
      const label = `Preference: non-starters for a claiming price of ${money(p.amount)} or less in the last ${p.starts} starts`;
      const recent = (h.pps || []).slice(0, p.starts);
      const claimingStarts = recent.filter((r) => r.type === 'clm' || r.type === 'mdnClm' || r.type === 'optClm');
      if (!recent.length) {
        return [{ label, met: true, verified: true,
          detail: 'No starts on record — has not started for any claiming price, so the preference applies' }];
      }
      if (!claimingStarts.length) {
        return [{ label, met: true, verified: true,
          detail: `Last ${recent.length} start${recent.length === 1 ? '' : 's'} were not for a claiming price — preference applies` }];
      }
      if (h.lastRanForPrice == null) {
        return [{ label, met: false, verified: false,
          detail: `${claimingStarts.length} claiming start${claimingStarts.length === 1 ? '' : 's'} in the last ${p.starts}, but no claiming price is on record here — the racing office decides this one from the official chart` }];
      }
      const met = h.lastRanForPrice > p.amount;
      return [{ label, met, verified: true,
        detail: met
          ? `Most recent claiming start was for ${money(h.lastRanForPrice)}, above ${money(p.amount)} — preference applies`
          : `Ran for ${money(h.lastRanForPrice)} in the last ${p.starts} starts, at or under ${money(p.amount)} — preference does not apply` }];
    }
    return [{ label: 'Preference clause', met: false, verified: false,
      detail: 'This preference clause is not modeled — read the full conditions.' }];
  }

  /* ---- Public entry point ------------------------------------------------- */
  function check(horse, race, ctx) {
    if (!horse || !race) {
      return { eligible: false, conflicts: [{ code: 'missing', label: 'Missing horse or race', detail: '', severity: 'hard' }],
        hardConflicts: [], flags: [], preferences: [], notices: [], gates: [] };
    }
    const gates = GATES.map((g) => { try { return g(horse, race, ctx); } catch (e) { return null; } })
      .filter(Boolean);
    const conflicts = gates.filter((g) => !g.pass)
      .map((g) => ({ code: g.code, label: g.label, detail: g.detail, severity: g.severity }));
    const hard = conflicts.filter((c) => c.severity === 'hard');
    return {
      eligible: hard.length === 0,
      conflicts,
      hardConflicts: hard,
      flags: conflicts.filter((c) => c.severity === 'flag'),
      preferences: preferences(horse, race),
      notices: notices(horse, race),
      gates,
    };
  }

  /* Horses from a list that pass every hard condition for a race. Used by the
     track side to see who in the system could legally fill a short field —
     an eligibility filter, in condition-book order, never a ranking. */
  function eligibleHorses(horses, race, ctx) {
    return (horses || []).filter((h) => check(h, race, ctx).eligible);
  }

  const PPConditions = { check, eligibleHorses, parse, SEX_WORD };
  global.PPConditions = PPConditions;
  if (typeof module !== 'undefined' && module.exports) module.exports = PPConditions;
})(typeof window !== 'undefined' ? window : globalThis);
