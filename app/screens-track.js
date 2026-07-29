/* Track (racing office) workspace screens.
 *
 * The office side of the same records the trainer sees: its own condition book,
 * the queue of entry requests to accept or decline (with a standard reason and a
 * free-text comment), the horse-and-history log, auto-drafted overnight sheets,
 * and messaging. Timestamps come from the same store as the trainer view.
 *
 * Nothing here ranks horses. Where the office asks "who could fill this race",
 * the answer is an ELIGIBILITY list in condition-book order — not a
 * recommendation, not a score.
 */
(function (global) {
  'use strict';

  const R = global.PPRenderers = global.PPRenderers || {};

  const trackId = () => (global.PPSession ? PPSession.trackId : 'ELP');
  const track = () => PPData.getTrack(trackId()) || PPData.pairedTracks()[0];
  const meet = () => PPData.listMeets(trackId())[0] || {};
  const horseFor = (id) => PPStore.horseFor(id);
  const check = (h, r) => PPConditions.check(h, r, { today: PPData.today });
  const raceReg = (race) => (race.conditions && race.conditions.registry) || 'Jockey Club';

  function raceLine(race) {
    return [race.typeLabel, fmtDistance(race.distanceYards, raceReg(race)),
      surfaceLabel(race.surface), fmtMoney(race.purse)].join(' · ');
  }

  // ====================================================== RACING OFFICE ====
  R['track/dashboard'] = function () {
    const t = track(), m = meet();
    const days = PPData.listRaceDays(m.id);
    const races = PPData.listRaces({ trackId: t.id, openOnly: true });
    const pending = PPStore.listSubmissions({ trackId: t.id, status: 'pending' });
    const decided = PPStore.listSubmissions({ trackId: t.id }).filter((s) => s.decidedAt).slice(0, 5);
    const short = races.map((r) => ({ r, s: PPStore.spotsFor(r.id) }))
      .filter((x) => x.s.filled < x.r.minField)
      .sort((a, b) => (a.s.filled - a.r.minField) - (b.s.filled - b.r.minField));

    document.getElementById('track/dashboard').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">${esc(t.name)} racing office</h1>
          <div class="text-sm text-ink-500">${esc(m.name || '')} · condition book ${esc(String(m.conditionBookNo || '—'))} ·
            racing secretary ${esc(t.racingSecretary || '—')}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="#track/queue" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
            <i data-lucide="inbox" class="w-4 h-4"></i>Review ${pending.length} entry request${pending.length === 1 ? '' : 's'}</a>
          <a href="#track/book" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">
            <i data-lucide="book-open" class="w-4 h-4"></i>Our condition book</a>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${[['Race days published', days.length, 'calendar-days'],
           ['Races open for entry', races.length, 'flag-triangle-right'],
           ['Requests awaiting review', pending.length, 'inbox'],
           ['Races under minimum field', short.length, 'triangle-alert']]
          .map(([label, n, icon]) => `
            <div class="card ring-soft p-4">
              <div class="flex items-start justify-between">
                <div class="text-xs text-ink-500">${esc(label)}</div>
                <i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i>
              </div>
              <div class="mt-1 text-2xl font-semibold tracking-tight">${n}</div>
            </div>`).join('')}
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div><div class="font-semibold">Oldest requests waiting</div>
              <div class="text-xs text-ink-500">Ordered by how long the trainer has been waiting.</div></div>
            <a href="#track/queue" class="text-xs accent-text hover:underline">Queue →</a>
          </div>
          ${pending.length ? `<div class="divide-y divide-slate-50">
            ${pending.slice().sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''))
              .slice(0, 5).map((s) => queueLine(s, true)).join('')}
          </div>` : '<div class="p-5 text-sm text-ink-500">Nothing waiting.</div>'}
        </div>

        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100">
            <div class="font-semibold">Races that need horses</div>
            <div class="text-xs text-ink-500">Under the minimum field written into the condition book.</div>
          </div>
          ${short.length ? `<div class="divide-y divide-slate-50">
            ${short.slice(0, 6).map(({ r, s }) => `
              <div class="px-5 py-3 flex items-center gap-3">
                <div class="min-w-0 flex-1">
                  <a href="#track/race/${esc(r.id)}" class="font-medium hover:underline">Race ${esc(r.raceNumber)} · ${esc((PPData.getRaceDay(r.raceDayId) || {}).label || '')}</a>
                  <div class="text-[11px] text-ink-500">${esc(raceLine(r))}</div>
                </div>
                ${spotsBar(s)}
              </div>`).join('')}
          </div>` : '<div class="p-5 text-sm text-ink-500">Every race is at or above its minimum.</div>'}
        </div>
      </div>

      <div class="card ring-soft overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-100 font-semibold">Recent decisions by this office</div>
        ${decided.length ? `<div class="divide-y divide-slate-50">${decided.map((s) => queueLine(s, false)).join('')}</div>`
          : '<div class="p-5 text-sm text-ink-500">No decisions recorded yet.</div>'}
      </div>`;
  };

  function queueLine(s, showActions) {
    const h = horseFor(s.horseId), race = PPData.getRace(s.raceId);
    const j = PPData.getJockey(s.jockeyId);
    const reason = s.denialReason && PPData.getDenialReason(s.denialReason);
    return `
      <div class="px-5 py-3 flex flex-wrap items-start gap-3">
        ${horseIcon(h, 'sm')}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${h ? horseLink(h) : esc(s.horseId)}
            ${statusPill(s.status)}
            ${s.aeMto ? pill(s.aeMto === 'AE' ? 'Also eligible' : 'Main track only', 'bg-sky-50 text-sky-700') : ''}
            ${s.overrode ? pill('Trainer overrode a flag', 'bg-amber-50 text-amber-700', 'alert-triangle') : ''}
          </div>
          <div class="text-xs text-ink-500">${h ? esc(h.trainer) : ''}${j ? ' · ' + esc(j.name) : ' · <span class="text-red-600">no jockey named</span>'}</div>
          <div class="text-xs text-ink-600">${race ? `<a href="#track/race/${esc(race.id)}" class="hover:underline">Race ${esc(race.raceNumber)} · ${esc(raceLine(race))}</a>` : esc(s.raceId)}</div>
          <div class="text-[10px] text-ink-400 mono">submitted ${esc(fmtStamp(s.submittedAt))} · ${esc(fmtAgo(s.submittedAt))}${s.decidedAt ? ` · decided ${esc(fmtStamp(s.decidedAt))}` : ''}</div>
          ${reason ? `<div class="text-xs text-red-700 mt-1">${esc(reason.label)}${s.denialComment ? ` — “${esc(s.denialComment)}”` : ''}</div>` : ''}
        </div>
        ${showActions ? `
          <div class="flex gap-1.5">
            <button class="pp-accept inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" data-sub-id="${esc(s.id)}">
              <i data-lucide="check" class="w-3.5 h-3.5"></i>Accept</button>
            <button class="pp-open-decline inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-red-200 text-red-700 hover:bg-red-50" data-sub-id="${esc(s.id)}">
              <i data-lucide="x" class="w-3.5 h-3.5"></i>Decline</button>
          </div>` : ''}
      </div>`;
  }

  // ================================================== OUR CONDITION BOOK ===
  R['scr-track-book'] = function (dayId) {
    const t = track(), m = meet();
    const days = PPData.listRaceDays(m.id);
    const active = dayId ? PPData.getRaceDay(dayId) : days[0];
    const host = document.getElementById('scr-track-book');
    if (!active) { host.innerHTML = emptyState('book', 'No race days published', 'This meet has no published cards.'); return; }
    const races = PPData.listRaces({ raceDayId: active.id })
      .sort((a, b) => a.raceNumber - b.raceNumber);

    host.innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">${esc(t.name)} condition book ${esc(String(m.conditionBookNo || ''))}</h1>
          <div class="text-sm text-ink-500">${esc(m.name || '')} · posted ${esc(fmtStamp(m.conditionBookPostedAt))} ·
            trainers see exactly this</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <a href="#track/overnight/${esc(active.id)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">
            <i data-lucide="file-text" class="w-4 h-4"></i>Overnight for this card</a>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        ${days.map((d) => `
          <a href="#track/book/${esc(d.id)}" class="px-3 py-2 rounded-lg text-sm border ${d.id === active.id ? 'accent-soft accent-border' : 'bg-white border-slate-200 hover:border-slate-300'}">
            <div class="font-medium">${esc(d.label)}</div>
            <div class="text-[11px] opacity-70">${PPData.listRaces({ raceDayId: d.id }).length} races · closes ${esc(fmtDate(d.entryClose))}</div>
          </a>`).join('')}
      </div>

      <div class="card ring-soft overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <div class="font-semibold">${esc(active.label)}</div>
            <div class="text-xs text-ink-500">${races.length} races · entries close ${esc(fmtStamp(active.entryClose))}</div>
          </div>
          ${closePill(active.entryClose)}
        </div>
        <div class="divide-y divide-slate-100">
          ${races.map((r) => {
            const s = PPStore.spotsFor(r.id);
            const pending = PPStore.listSubmissions({ raceId: r.id, status: 'pending' });
            return `
              <div class="p-5">
                <div class="flex flex-wrap items-start justify-between gap-3">
                  <div class="min-w-0">
                    <div class="flex flex-wrap items-center gap-2">
                      <a href="#track/race/${esc(r.id)}" class="font-semibold hover:underline">Race ${esc(r.raceNumber)}${r.name ? ' — ' + esc(r.name) : ''}</a>
                      ${pill(r.typeLabel, 'bg-slate-100 text-slate-700')}${surfacePill(r.surface)}
                      ${r.extra ? pill('Extra', 'bg-violet-50 text-violet-700', 'plus-circle') : ''}
                    </div>
                    <div class="text-xs text-ink-500 mt-1">${esc(raceLine(r))} · post ${esc(fmtStamp(r.postTime))}</div>
                    <div class="mt-2 cond-text text-ink-600 max-w-3xl">${esc(r.conditionText)}</div>
                  </div>
                  <div class="flex flex-col items-end gap-2">
                    ${spotsBar(s)}
                    ${pending.length ? `<a href="#track/queue" class="pill bg-indigo-50 text-indigo-700"><i data-lucide="inbox" class="w-3 h-3"></i>${pending.length} awaiting review</a>` : ''}
                    <a href="#track/race/${esc(r.id)}" class="text-xs accent-text hover:underline">Who has asked in →</a>
                  </div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  };

  // ====================================================== ENTRY REQUESTS ===
  let queueFilter = 'pending';

  R['track/queue'] = function () {
    const t = track();
    const all = PPStore.listSubmissions({ trackId: t.id });
    const counts = { pending: 0, accepted: 0, declined: 0, withdrawn: 0 };
    all.forEach((s) => { counts[s.status] = (counts[s.status] || 0) + 1; });
    const rows = all.filter((s) => queueFilter === 'all' || s.status === queueFilter)
      .sort((a, b) => (a.submittedAt || '').localeCompare(b.submittedAt || ''));

    document.getElementById('track/queue').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Entry requests</h1>
          <div class="text-sm text-ink-500">Every submission trainers have sent to ${esc(t.name)}. Accept it, or decline it with a reason on the record.</div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-ink-500" for="queueFilter">Show</label>
          <select id="queueFilter" class="pp-queue-filter text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
            ${[['pending', 'Awaiting review'], ['accepted', 'Accepted'], ['declined', 'Declined'], ['withdrawn', 'Withdrawn'], ['all', 'Everything']]
              .map(([k, label]) => `<option value="${k}" ${queueFilter === k ? 'selected' : ''}>${esc(label)}${k !== 'all' ? ' (' + (counts[k] || 0) + ')' : ''}</option>`).join('')}
          </select>
        </div>
      </div>

      <div class="card ring-soft overflow-hidden">
        ${rows.length ? `<div class="divide-y divide-slate-50">${rows.map((s) => requestCard(s)).join('')}</div>`
          : emptyState('inbox', 'Nothing here', 'No submissions in this state.')}
      </div>`;
  };

  /* The full review card — the office sees the horse's facts, the conditions it
     meets or misses, and what the trainer said at submission. */
  function requestCard(s) {
    const h = horseFor(s.horseId), race = PPData.getRace(s.raceId);
    const j = PPData.getJockey(s.jockeyId);
    const res = h && race ? check(h, race) : null;
    const reason = s.denialReason && PPData.getDenialReason(s.denialReason);
    const spots = race ? PPStore.spotsFor(race.id) : null;
    const startsHere = h ? PPData.startsAtTrack(h.id, trackId()) : 0;
    return `
      <div class="p-5">
        <div class="flex flex-wrap items-start gap-4">
          ${horseIcon(h)}
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              ${h ? horseLink(h) : esc(s.horseId)}
              ${statusPill(s.status)}
              ${registryPill(h ? h.registry : 'Jockey Club')}
              ${s.aeMto ? pill(s.aeMto === 'AE' ? 'Also eligible' : 'Main track only', 'bg-sky-50 text-sky-700') : ''}
              ${s.overrode ? pill('Trainer submitted over a flag', 'bg-amber-50 text-amber-700', 'alert-triangle') : ''}
              ${startsHere ? pill(startsHere + ' start' + (startsHere === 1 ? '' : 's') + ' here', 'bg-slate-100 text-slate-600', 'history')
                : pill('New to this track', 'bg-violet-50 text-violet-700', 'sparkles')}
            </div>
            <div class="text-xs text-ink-500 mt-1">
              ${h ? `${esc(h.age)}yo ${esc(h.sexLabel)} · ${esc(h.color)} · ${esc(h.bred)}-bred · ${esc(h.trainer)} · owner ${esc(h.owner || '—')}` : ''}
            </div>
            <div class="text-sm mt-2">
              ${race ? `<a href="#track/race/${esc(race.id)}" class="font-medium hover:underline">Race ${esc(race.raceNumber)}${race.name ? ' — ' + esc(race.name) : ''}</a>
                <span class="text-ink-500">· ${esc(raceLine(race))}</span>` : esc(s.raceId)}
            </div>
            <div class="mt-2 grid sm:grid-cols-4 gap-2 text-[11px]">
              <div><div class="text-ink-500">Submitted</div><div class="mono">${esc(fmtStamp(s.submittedAt))}</div><div class="text-ink-400">${esc(fmtAgo(s.submittedAt))}</div></div>
              <div><div class="text-ink-500">Jockey named</div><div>${j ? esc(j.name) : '<span class="text-red-600">none — ask the trainer</span>'}</div></div>
              <div><div class="text-ink-500">Equipment</div><div>${s.equipmentNote ? esc(s.equipmentNote) : '<span class="text-ink-400">not declared</span>'}</div></div>
              <div><div class="text-ink-500">Spots</div><div>${spots ? esc(spots.filled) + ' of ' + esc(spots.spots) + ' · ' + esc(spots.open) + ' open' : '—'}</div></div>
            </div>
            ${s.note ? `<div class="mt-2 text-xs text-ink-600 italic">Trainer note: “${esc(s.note)}”</div>` : ''}
            ${res && res.conflicts.length ? `
              <div class="mt-3 rounded-lg border ${res.eligible ? 'border-amber-100 bg-amber-50/50' : 'border-red-100 bg-red-50/50'} p-3">
                <div class="text-xs font-medium ${res.eligible ? 'text-amber-800' : 'text-red-800'}">Condition check</div>
                <ul class="mt-1 space-y-1">${res.conflicts.map((c) => `<li class="text-xs ${c.severity === 'hard' ? 'text-red-700' : 'text-amber-700'}"><strong>${esc(c.label)}.</strong> ${esc(c.detail)}</li>`).join('')}</ul>
                <div class="text-[10px] text-ink-500 mt-1">Advisory. The office rules on eligibility, not the software.</div>
              </div>` : res ? `<div class="mt-3 text-xs text-emerald-700 flex items-center gap-1.5">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>Meets every written condition.</div>` : ''}
            ${reason ? `<div class="mt-3 rounded-lg bg-red-50 border border-red-100 p-3">
              <div class="text-xs font-medium text-red-800">Declined — ${esc(reason.label)}</div>
              ${s.denialComment ? `<div class="text-xs text-red-700 mt-0.5 italic">“${esc(s.denialComment)}”</div>` : ''}
              <div class="text-[10px] text-red-600 mt-1 mono">${esc(s.decidedBy || 'racing office')} · ${esc(fmtStamp(s.decidedAt))}</div>
            </div>` : ''}
          </div>
          <div class="flex flex-col gap-1.5 min-w-[8.5rem]">
            ${s.status === 'pending' ? `
              <button class="pp-accept inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white" data-sub-id="${esc(s.id)}">
                <i data-lucide="check" class="w-4 h-4"></i>Accept</button>
              <button class="pp-open-decline inline-flex items-center justify-center gap-1 px-3 py-1.5 text-sm rounded-lg border border-red-200 text-red-700 hover:bg-red-50" data-sub-id="${esc(s.id)}">
                <i data-lucide="x" class="w-4 h-4"></i>Decline</button>`
              : `<div class="text-[11px] text-ink-500 text-right">Decided ${esc(fmtStamp(s.decidedAt))}<br>${esc(s.decidedBy || '')}</div>`}
            ${h ? `<a href="#track/messages/${esc(trackId())}" class="text-xs accent-text hover:underline text-center">Message trainer</a>` : ''}
          </div>
        </div>
      </div>`;
  }

  /* Decline form — standard reason from the track's list, plus a comment field
     for the one-off cases that need documenting. */
  function declineModal(subId) {
    const s = PPStore.getSubmission(subId);
    if (!s) return;
    const h = horseFor(s.horseId), race = PPData.getRace(s.raceId);
    openModal(`
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">Decline ${esc((h && h.name) || s.horseId)}</div>
          <div class="text-xs text-ink-500 mt-0.5">${race ? 'Race ' + esc(race.raceNumber) + ' · ' + esc(raceLine(race)) : esc(s.raceId)}</div>
          <div class="text-xs text-ink-500">Submitted ${esc(fmtStamp(s.submittedAt))} by ${esc((h && h.trainer) || 'trainer')}</div>
        </div>
        <button class="pp-modal-cancel p-1.5 rounded hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      <label class="block mt-4 text-sm"><span class="text-xs text-ink-500">Reason <span class="text-red-600">(required)</span></span>
        <select id="dm-reason" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
          <option value="">Select a reason…</option>
          ${PPData.denialReasons.map((r) => `<option value="${esc(r.code)}">${esc(r.label)}</option>`).join('')}
        </select></label>

      <label class="block mt-3 text-sm"><span class="text-xs text-ink-500">Comment — more detail, or a one-off reason worth documenting</span>
        <textarea id="dm-comment" rows="3" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2"
          placeholder="e.g. Filled at 10 with four also-eligibles. Take him back Sunday in R7, same distance."></textarea>
        <span class="text-[11px] text-ink-500">Stored with the submission and shown to the trainer.</span></label>

      <div class="mt-4 flex flex-wrap gap-2">
        <button class="pp-do-decline inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-red-600 hover:bg-red-700 text-white" data-sub-id="${esc(subId)}">
          <i data-lucide="x-circle" class="w-4 h-4"></i>Decline and notify the trainer</button>
        <button class="pp-modal-cancel px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
      </div>`);
  }

  // =================================================== HORSES & HISTORY ====
  // Two things the office needs: who is entered on each card right now, and the
  // persistent record of every horse that has ever come through this track.
  let horsesTab = 'entered';

  R['track/horses'] = function () {
    const t = track(), m = meet();
    const days = PPData.listRaceDays(m.id);

    // Entered, grouped by race day → race.
    const enteredHtml = days.map((d) => {
      const races = PPData.listRaces({ raceDayId: d.id }).sort((a, b) => a.raceNumber - b.raceNumber);
      return `
        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold">${esc(d.label)}</div>
            <div class="text-xs text-ink-500">entries close ${esc(fmtStamp(d.entryClose))}</div>
          </div>
          <div class="divide-y divide-slate-50">
            ${races.map((r) => {
              const entries = PPStore.entriesForRace(r.id);
              const s = PPStore.spotsFor(r.id);
              return `<div class="px-5 py-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <a href="#track/race/${esc(r.id)}" class="text-sm font-medium hover:underline">Race ${esc(r.raceNumber)} · ${esc(r.typeLabel)}</a>
                  <div class="flex items-center gap-3">${spotsBar(s)}</div>
                </div>
                <div class="mt-2 flex flex-wrap gap-1.5">
                  ${entries.length ? entries.map((e) => {
                    const h = horseFor(e.horseId);
                    const n = h ? PPData.startsAtTrack(h.id, t.id) : 0;
                    return `<a href="#horse/${esc(e.horseId)}" class="pill ${n ? 'bg-slate-100 text-slate-700' : 'bg-violet-50 text-violet-700'} hover:opacity-80"
                      title="${h ? esc(h.trainer) : ''}${n ? ' · ' + n + ' prior start(s) here' : ' · new to this track'}">
                      ${h ? esc(h.name) : esc(e.horseId)}${e.aeMto ? ' (' + esc(e.aeMto) + ')' : ''}</a>`;
                  }).join('') : '<span class="text-xs text-ink-500">No entries yet.</span>'}
                </div>
              </div>`;
            }).join('')}
          </div>
        </div>`;
    }).join('');

    // The persistent log: every horse that has ever been submitted to or run at
    // this track, with the tally of starts here. Kept for documentation and
    // history — a horse's record stays in the system after its race is run.
    const submitted = PPStore.listSubmissions({ trackId: t.id });
    const ids = new Set(submitted.map((s) => s.horseId));
    PPData.horses.forEach((h) => { if ((h.startsByTrack || {})[t.id]) ids.add(h.id); });
    PPData.listRaces({ trackId: t.id }).forEach((r) => {
      PPStore.entriesForRace(r.id).forEach((e) => ids.add(e.horseId));
    });
    const log = Array.from(ids).map((id) => {
      const h = horseFor(id);
      if (!h) return null;
      const subs = submitted.filter((s) => s.horseId === id);
      const first = subs.map((s) => s.submittedAt).sort()[0] || null;
      const lastAct = subs.map((s) => s.decidedAt || s.submittedAt).sort().reverse()[0] || null;
      return { h, starts: PPData.startsAtTrack(id, t.id), subs, first, lastAct };
    }).filter(Boolean).sort((a, b) => (b.starts - a.starts) || a.h.name.localeCompare(b.h.name));

    document.getElementById('track/horses').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Horses &amp; history</h1>
          <div class="text-sm text-ink-500">Who is entered on each card, and the standing record of every horse that has come through ${esc(t.name)}.</div>
        </div>
        <div class="flex items-center gap-2">
          <button class="pp-horses-tab px-3 py-1.5 text-sm rounded-lg border ${horsesTab === 'entered' ? 'accent-soft accent-border' : 'bg-white border-slate-200'}" data-tab="entered">Entered per race</button>
          <button class="pp-horses-tab px-3 py-1.5 text-sm rounded-lg border ${horsesTab === 'log' ? 'accent-soft accent-border' : 'bg-white border-slate-200'}" data-tab="log">System log</button>
        </div>
      </div>

      ${horsesTab === 'entered' ? `<div class="space-y-4">${enteredHtml}</div>` : `
        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100">
            <div class="font-semibold">Standing horse record at ${esc(t.name)}</div>
            <div class="text-xs text-ink-500">Once a horse is entered here its record stays active in the system — for documentation, and so the office knows whether it is new to this track.</div>
          </div>
          <div class="overflow-x-auto"><table class="w-full text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500"><tr>
              <th class="text-left font-medium px-5 py-2">Horse</th>
              <th class="text-left font-medium px-3 py-2">Trainer</th>
              <th class="text-left font-medium px-3 py-2">Starts here</th>
              <th class="text-left font-medium px-3 py-2">Requests to this office</th>
              <th class="text-left font-medium px-3 py-2">First contact</th>
              <th class="text-left font-medium px-3 py-2">Last activity</th>
            </tr></thead>
            <tbody class="divide-y divide-slate-50">
              ${log.map((row) => `
                <tr class="row-hover align-top">
                  <td class="px-5 py-3"><div class="flex items-center gap-2.5">${horseIcon(row.h, 'sm')}
                    <div>${horseLink(row.h)}
                      <div class="text-[11px] text-ink-500">${esc(row.h.age)}yo ${esc(row.h.sexLabel)} · ${esc(row.h.registry)}</div></div></div></td>
                  <td class="px-3 py-3 text-xs">${esc(row.h.trainer || '—')}</td>
                  <td class="px-3 py-3">${row.starts
                    ? `<span class="mono text-sm">${row.starts}</span>`
                    : pill('New to this track', 'bg-violet-50 text-violet-700', 'sparkles')}</td>
                  <td class="px-3 py-3 text-xs">
                    ${row.subs.length ? row.subs.map((s) => `<div>${statusPill(s.status)} <span class="text-ink-500">${esc(s.raceId)}</span></div>`).join('') : '<span class="text-ink-500">—</span>'}
                  </td>
                  <td class="px-3 py-3 text-[11px] mono">${row.first ? esc(fmtStamp(row.first)) : '—'}</td>
                  <td class="px-3 py-3 text-[11px] mono">${row.lastAct ? esc(fmtStamp(row.lastAct)) : '—'}</td>
                </tr>`).join('')}
            </tbody></table></div>
        </div>`}`;
  };

  // ==================================================== OVERNIGHT SHEETS ===
  R['scr-track-overnight'] = function (dayId) {
    const t = track(), m = meet();
    const days = PPData.listRaceDays(m.id);
    const active = dayId ? PPData.getRaceDay(dayId) : days[0];
    const host = document.getElementById('scr-track-overnight');
    if (!active) { host.innerHTML = emptyState('file-text', 'No cards', 'Nothing to draft an overnight from.'); return; }
    const races = PPData.listRaces({ raceDayId: active.id }).sort((a, b) => a.raceNumber - b.raceNumber);

    host.innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Overnight sheets</h1>
          <div class="text-sm text-ink-500">Drafted automatically from accepted entries. ${esc(t.name)} · ${esc(m.shortName || '')}</div>
        </div>
        <div class="flex flex-wrap gap-2">
          <button class="pp-print inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
            <i data-lucide="printer" class="w-4 h-4"></i>Print / save as PDF</button>
          <button class="pp-publish-overnight inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" data-day-id="${esc(active.id)}">
            <i data-lucide="send" class="w-4 h-4"></i>Notify trainers</button>
        </div>
      </div>

      <div class="flex flex-wrap gap-2">
        ${days.map((d) => `
          <a href="#track/overnight/${esc(d.id)}" class="px-3 py-2 rounded-lg text-sm border ${d.id === active.id ? 'accent-soft accent-border' : 'bg-white border-slate-200 hover:border-slate-300'}">
            <div class="font-medium">${esc(d.label)}</div>
            <div class="text-[11px] opacity-70">${d.overnightPostedAt ? 'posted ' + esc(fmtDate(d.overnightPostedAt)) : 'draft'}</div>
          </a>`).join('')}
      </div>

      <div class="card ring-soft p-6" id="overnightSheet">
        <div class="text-center border-b border-slate-200 pb-4">
          <div class="text-lg font-semibold tracking-tight">${esc(t.name)}</div>
          <div class="text-sm text-ink-600">OVERNIGHT — ${esc(active.label)}</div>
          <div class="text-xs text-ink-500 mt-1">${esc(m.name || '')} · condition book ${esc(String(m.conditionBookNo || ''))} ·
            drafted ${esc(fmtStamp(PPData.today))}</div>
        </div>
        <div class="mt-5 space-y-5">
          ${races.map((r) => {
            const all = PPStore.entriesForRace(r.id);
            const body = all.filter((e) => e.aeMto !== 'AE');
            const ae = all.filter((e) => e.aeMto === 'AE');
            const mto = all.filter((e) => e.aeMto === 'MTO');
            const s = PPStore.spotsFor(r.id);
            const line = (e, i) => {
              const h = horseFor(e.horseId), j = PPData.getJockey(e.jockeyId);
              return `<tr>
                <td class="py-1 pr-3 mono text-xs text-ink-500">${i + 1}</td>
                <td class="py-1 pr-3">${h ? esc(h.name) : esc(e.horseId)}</td>
                <td class="py-1 pr-3 text-xs">${j ? esc(j.name) : '—'}</td>
                <td class="py-1 pr-3 text-xs">${h ? esc(h.trainer || '—') : '—'}</td>
                <td class="py-1 text-xs">${h ? esc(h.owner || '—') : '—'}</td>
              </tr>`;
            };
            return `
              <div>
                <div class="flex flex-wrap items-baseline gap-2 border-b border-slate-100 pb-1">
                  <div class="font-semibold text-sm">RACE ${esc(r.raceNumber)}</div>
                  <div class="text-xs text-ink-600">${esc(r.typeLabel)}${r.name ? ' — ' + esc(r.name) : ''} ·
                    ${esc(fmtMoney(r.purse))} · ${esc(fmtDistance(r.distanceYards, raceReg(r)))} · ${esc(surfaceLabel(r.surface))} ·
                    post ${esc(fmtStamp(r.postTime))}</div>
                  <div class="ml-auto text-[11px] text-ink-500">${esc(s.filled)} of ${esc(s.spots)} · ${esc(s.open)} open</div>
                </div>
                <div class="mt-1.5 cond-text text-ink-600">${esc(r.conditionText)}</div>
                ${body.length ? `<table class="mt-2 w-full text-sm"><tbody>${body.map(line).join('')}</tbody></table>`
                  : '<div class="mt-2 text-xs text-ink-500">No entries drawn.</div>'}
                ${mto.length ? `<div class="mt-2 text-xs"><span class="font-semibold">MAIN TRACK ONLY:</span> ${mto.map((e) => esc((horseFor(e.horseId) || {}).name || e.horseId)).join(', ')}</div>` : ''}
                ${ae.length ? `<div class="mt-1 text-xs"><span class="font-semibold">ALSO ELIGIBLE:</span> ${ae.map((e) => esc((horseFor(e.horseId) || {}).name || e.horseId)).join(', ')}</div>` : ''}
              </div>`;
          }).join('')}
        </div>
        <div class="mt-6 pt-3 border-t border-slate-200 text-[11px] text-ink-500">
          Drafted by PostParade from accepted entries. A track-branded PDF export is planned, not built —
          use Print / save as PDF for now.
        </div>
      </div>`;
  };

  // ============================================================ MESSAGES ===
  R['scr-track-messages'] = function () {
    const st = PPData.demoStable();
    const t = track();
    // The office sees its own thread with each stable it works with. This demo
    // has one stable, so the thread list is that stable at this track.
    const thread = { trackId: t.id, trackName: st.name + ' — ' + t.name, messages: PPStore.messages(st.id, t.id) };
    thread.last = thread.messages[thread.messages.length - 1] || null;
    document.getElementById('scr-track-messages').innerHTML = PPMessagesLayout({
      threads: [thread], activeId: t.id, side: 'track',
      title: 'Messages', subtitle: 'Direct line to the trainers who submit here. Stored with the submission record.',
      hrefPrefix: '#track/messages/',
    });
  };

  // ========================================================= RACE DETAIL ===
  R['scr-track-race'] = function (raceId) {
    const host = document.getElementById('scr-track-race');
    const race = PPData.getRace(raceId);
    host.innerHTML = PPRaceDetail(raceId, 'track') + (race ? eligibleFillPanel(race) : '');
  };

  /* Who in the system could legally fill this race. An eligibility filter over
     the condition text — alphabetical, not ranked, no scores. */
  function eligibleFillPanel(race) {
    const entered = new Set(PPStore.entriesForRace(race.id).map((e) => e.horseId));
    const pending = new Set(PPStore.listSubmissions({ raceId: race.id, status: 'pending' }).map((s) => s.horseId));
    const pool = PPData.horses.filter((h) => !entered.has(h.id) && !pending.has(h.id));
    const eligible = PPConditions.eligibleHorses(pool, race, { today: PPData.today })
      .sort((a, b) => a.name.localeCompare(b.name));
    return `
      <div class="card ring-soft overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-100">
          <div class="font-semibold">Eligible and not yet in (${eligible.length})</div>
          <div class="text-xs text-ink-500">Horses in the system that pass every written condition for this race, listed alphabetically.
            This is an eligibility filter — PostParade does not rank horses or predict results.</div>
        </div>
        ${eligible.length ? `<div class="divide-y divide-slate-50">
          ${eligible.map((h) => {
            const n = PPData.startsAtTrack(h.id, trackId());
            return `<div class="px-5 py-3 flex flex-wrap items-center gap-3">
              ${horseIcon(h, 'sm')}
              <div class="min-w-0 flex-1">${horseLink(h)}
                <div class="text-[11px] text-ink-500">${esc(h.age)}yo ${esc(h.sexLabel)} · ${esc(h.trainer)} · ${esc(h.record.starts)}-${esc(h.record.wins)}-${esc(h.record.seconds)}-${esc(h.record.thirds)}</div></div>
              ${n ? pill(n + ' start' + (n === 1 ? '' : 's') + ' here', 'bg-slate-100 text-slate-600', 'history')
                : pill('New here', 'bg-violet-50 text-violet-700', 'sparkles')}
              <a href="#track/messages/${esc(trackId())}" class="text-xs accent-text hover:underline">Ask the barn →</a>
            </div>`;
          }).join('')}</div>` : '<div class="p-5 text-sm text-ink-500">No other horse in the system passes these conditions.</div>'}
      </div>`;
  }

  // ================================================ delegated interaction ===
  document.addEventListener('click', function (e) {
    const el = (sel) => e.target.closest && e.target.closest(sel);

    const acc = el('.pp-accept');
    if (acc) {
      const s = PPStore.accept(acc.dataset.subId, track().office);
      const h = s && horseFor(s.horseId);
      toast(((h && h.name) || 'Horse') + ' accepted — the trainer sees it immediately');
      window.rerender();
      return;
    }

    const openDec = el('.pp-open-decline');
    if (openDec) { declineModal(openDec.dataset.subId); return; }

    const doDec = el('.pp-do-decline');
    if (doDec) {
      const reason = (document.getElementById('dm-reason') || {}).value || '';
      const comment = (document.getElementById('dm-comment') || {}).value || '';
      if (!reason) { toast('Pick a reason — it goes on the record', 'alert-triangle'); return; }
      const s = PPStore.decline(doDec.dataset.subId, reason, comment, track().office);
      closeModal();
      const h = s && horseFor(s.horseId);
      toast(((h && h.name) || 'Horse') + ' declined — reason recorded', 'x-circle');
      window.rerender();
      return;
    }

    const tab = el('.pp-horses-tab');
    if (tab) { horsesTab = tab.dataset.tab; window.rerender(); return; }

    const print = el('.pp-print');
    if (print) { global.print(); return; }

    const pub = el('.pp-publish-overnight');
    if (pub) {
      PPStore.logEvent('overnight.published', 'track', pub.dataset.dayId,
        track().name + ' overnight for ' + ((PPData.getRaceDay(pub.dataset.dayId) || {}).label || ''));
      toast('Overnight published — trainers notified', 'send');
      window.rerender();
      return;
    }
  });

  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('pp-queue-filter')) {
      queueFilter = e.target.value;
      window.rerender();
    }
  });
})(window);
