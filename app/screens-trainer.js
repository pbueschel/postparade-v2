/* Trainer workspace screens (classic script — globals).
 *
 * Renderers register on window.PPRenderers under each section id; the router
 * calls PPRenderers[sectionId](param, rawHash) on every navigation and runs
 * lucide.createIcons() after. Each renderer owns its section's full innerHTML
 * and recomputes everything from PPData / PPStore / PPConditions.
 * All interpolated data goes through esc(). One delegated click listener and
 * one delegated change listener live at the bottom of the file.
 *
 * Screens: dashboard · my horses · see condition books · entry windows ·
 *          submissions · messages · horse profile · race detail
 * Not here, by design: recommendations, spot alerts, suggested ship, win rate,
 *          predicted outcomes.
 */
(function (global) {
  'use strict';

  const R = global.PPRenderers = global.PPRenderers || {};

  // ---- resolution helpers -------------------------------------------------
  const stable = () => PPData.demoStable();
  const roster = () => PPStore.rosterFor(stable().id);
  const horseFor = (id) => PPStore.horseFor(id);
  const trackOf = (race) => PPData.getTrack(PPData.trackOfRace(race));
  const meetOf = (race) => PPData.getMeet(PPData.meetOfRace(race));
  const dayOf = (race) => PPData.getRaceDay(race.raceDayId);
  const check = (h, r) => PPConditions.check(h, r, { today: PPData.today });

  function raceTitle(race) {
    const t = trackOf(race);
    return `${(t && t.name) || 'Track'} · Race ${race.raceNumber}`;
  }
  function raceWhere(race) {
    const t = trackOf(race), m = meetOf(race), d = dayOf(race);
    return `Race ${race.raceNumber} of ${(m && m.shortName) || 'the meet'} at ${(t && t.name) || '—'} · ${(d && d.label) || ''}`;
  }
  function raceMetaLine(race) {
    const h = horseRegistryOfRace(race);
    return [race.typeLabel, fmtDistance(race.distanceYards, h), surfaceLabel(race.surface),
      fmtMoney(race.purse)].join(' · ');
  }
  function horseRegistryOfRace(race) {
    return (race.conditions && race.conditions.registry) || 'Jockey Club';
  }
  function query(raw) {
    const q = {};
    const i = String(raw || '').indexOf('?');
    if (i === -1) return q;
    String(raw).slice(i + 1).split('&').forEach((kv) => {
      const [k, v] = kv.split('=');
      if (k) q[decodeURIComponent(k)] = decodeURIComponent(v || '');
    });
    return q;
  }

  // ============================================================ DASHBOARD ===
  // Three ACTIONABLE states, one dropdown filter, no performance figures.
  let dashFilter = 'all';

  R['dashboard'] = function () {
    const st = stable();
    const counts = PPStore.statusCounts(st.id);
    const all = roster();
    const hour = new Date().getHours();
    const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
    const first = String(st.trainer || '').split(' ')[0];

    const tile = (key, label, icon, note) => {
      const active = dashFilter === key;
      return `<button class="pp-dash-tile card ring-soft p-4 text-left w-full ${active ? 'ring-2 ring-emerald-500' : ''}" data-filter="${key}">
        <div class="flex items-start justify-between">
          <div class="text-xs text-ink-500">${esc(label)}</div>
          <i data-lucide="${icon}" class="w-4 h-4 text-slate-300"></i>
        </div>
        <div class="mt-1 text-2xl font-semibold tracking-tight">${key === 'all' ? counts.all : counts[key]}</div>
        <div class="text-[11px] text-ink-500 mt-0.5">${esc(note)}</div>
        <div class="mt-2 text-[11px] accent-text font-medium">${active ? 'Showing below' : 'Show these'} →</div>
      </button>`;
    };

    const shown = all.filter((h) => dashFilter === 'all' || PPStore.statusOf(h.id) === dashFilter);
    const recent = PPStore.listSubmissions({ stableId: st.id })
      .filter((s) => s.decidedAt).slice(0, 4);

    document.getElementById('dashboard').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">${esc(greet)}, ${esc(first)}</h1>
          <div class="text-sm text-ink-500">${esc(st.name)} · ${all.length} horses in the barn ·
            <span class="mono text-[11px]">${esc(PPData.today.slice(0, 16).replace('T', ' '))}</span></div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-ink-500" for="dashFilter">Show</label>
          <select id="dashFilter" class="pp-dash-filter text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
            <option value="all" ${dashFilter === 'all' ? 'selected' : ''}>All horses (${counts.all})</option>
            <option value="active" ${dashFilter === 'active' ? 'selected' : ''}>Active (${counts.active})</option>
            <option value="placement" ${dashFilter === 'placement' ? 'selected' : ''}>Placement requested (${counts.placement})</option>
            <option value="entered" ${dashFilter === 'entered' ? 'selected' : ''}>Entered (${counts.entered})</option>
          </select>
          <a href="#trainer/books" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
            <i data-lucide="book-open" class="w-4 h-4"></i>See condition books</a>
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${tile('active', 'Active', 'circle-dot', 'In training, nothing pending')}
        ${tile('placement', 'Placement requested', 'clock', 'Submitted, awaiting the track')}
        ${tile('entered', 'Entered', 'check-circle-2', 'Accepted into a race')}
        ${tile('all', 'Whole barn', 'list', 'Every horse you manage')}
      </div>

      <div class="card ring-soft overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <div class="font-semibold">Horse slip</div>
            <div class="text-xs text-ink-500">Every horse name is a link to its profile — including horses already placed.</div>
          </div>
          <a href="#trainer/horses" class="text-xs accent-text hover:underline">Manage roster →</a>
        </div>
        ${shown.length ? `
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th class="text-left font-medium px-5 py-2">Horse</th>
                <th class="text-left font-medium px-3 py-2">Status</th>
                <th class="text-left font-medium px-3 py-2">Where it stands</th>
                <th class="text-left font-medium px-3 py-2 hidden md:table-cell">Last start</th>
                <th class="text-right font-medium px-5 py-2">Find a spot</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${shown.map((h) => slipRow(h)).join('')}
            </tbody>
          </table>
        </div>` : emptyState('list', 'Nothing in this view', 'Switch the filter above to see other horses.')}
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft p-5">
          <div class="flex items-center justify-between">
            <div class="font-semibold">Latest decisions from tracks</div>
            <a href="#trainer/submissions" class="text-xs accent-text hover:underline">All submissions →</a>
          </div>
          <div class="mt-3 space-y-3">
            ${recent.length ? recent.map((s) => decisionLine(s)).join('')
              : '<div class="text-sm text-ink-500">No decisions yet.</div>'}
          </div>
        </div>
        <div class="card ring-soft p-5">
          <div class="font-semibold">What this app does not do</div>
          <ul class="mt-2 text-sm text-ink-500 space-y-1.5">
            <li class="flex gap-2"><i data-lucide="minus" class="w-3.5 h-3.5 mt-1 shrink-0"></i>No win rates, ratings, speed figures, or projected finishes.</li>
            <li class="flex gap-2"><i data-lucide="minus" class="w-3.5 h-3.5 mt-1 shrink-0"></i>No recommended races or suggested ships — you read the condition book.</li>
            <li class="flex gap-2"><i data-lucide="check" class="w-3.5 h-3.5 mt-1 shrink-0 text-emerald-600"></i>It does check a horse against the published <em>conditions</em> and flag conflicts for the racing office to settle.</li>
          </ul>
        </div>
      </div>`;
  };

  function slipRow(h) {
    const status = PPStore.statusOf(h.id);
    const subs = PPStore.listSubmissions({ horseId: h.id });
    const live = subs.find((s) => s.status === 'accepted') || subs.find((s) => s.status === 'pending');
    const race = live && PPData.getRace(live.raceId);
    const where = race
      ? `<a href="#race/${esc(race.id)}" class="hover:underline">${esc(raceTitle(race))}</a>
         <div class="text-[11px] text-ink-500">${esc(raceMetaLine(race))}</div>
         <div class="text-[10px] text-ink-400 mono">submitted ${esc(fmtStamp(live.submittedAt))}</div>`
      : '<span class="text-ink-500">No open submission</span>';
    const last = h.lastStart
      ? `${esc(h.lastStart.date)} · ${esc((PPData.getTrack(h.lastStart.trackId) || {}).name || h.lastStart.trackId)}
         <div class="text-[11px] text-ink-500">finished ${esc(String(h.lastStart.finish))} of ${esc(String(h.lastStart.fieldSize))}</div>`
      : '<span class="text-ink-500">Unraced</span>';
    return `
      <tr class="row-hover align-top">
        <td class="px-5 py-3">
          <div class="flex items-center gap-2.5">
            ${horseIcon(h, 'sm')}
            <div class="min-w-0">
              ${horseLink(h)}
              <div class="text-[11px] text-ink-500">${esc(h.age)}yo ${esc(h.sexLabel)} · ${esc(h.color)}</div>
            </div>
          </div>
        </td>
        <td class="px-3 py-3">${statusPill(status)}</td>
        <td class="px-3 py-3">${where}</td>
        <td class="px-3 py-3 hidden md:table-cell text-xs">${last}</td>
        <td class="px-5 py-3 text-right whitespace-nowrap">
          <a href="#trainer/books?horse=${esc(h.id)}" class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:border-slate-300 hover:bg-slate-50">
            <i data-lucide="book-open" class="w-3.5 h-3.5"></i>Condition books</a>
        </td>
      </tr>`;
  }

  function decisionLine(s) {
    const h = horseFor(s.horseId), race = PPData.getRace(s.raceId);
    const reason = s.denialReason && PPData.getDenialReason(s.denialReason);
    return `
      <div class="flex gap-2.5">
        ${horseIcon(h, 'sm')}
        <div class="min-w-0 flex-1">
          <div class="flex flex-wrap items-center gap-2">
            ${horseLink(h)} ${statusPill(s.status)}
          </div>
          <div class="text-xs text-ink-500">${race ? esc(raceTitle(race)) : esc(s.raceId)} · decided ${esc(fmtStamp(s.decidedAt))} by ${esc(s.decidedBy || 'racing office')}</div>
          ${reason ? `<div class="text-xs text-red-700 mt-0.5">${esc(reason.label)}</div>` : ''}
          ${s.denialComment ? `<div class="text-xs text-ink-600 mt-0.5 italic">“${esc(s.denialComment)}”</div>` : ''}
        </div>
      </div>`;
  }

  // =========================================================== MY HORSES ===
  R['trainer/horses'] = function (param, raw) {
    const st = stable();
    const list = roster();
    const q = query(raw);
    document.getElementById('trainer/horses').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">My horses</h1>
          <div class="text-sm text-ink-500">Every horse ${esc(st.name)} manages. Add one, remove one, or take one to a condition book.</div>
        </div>
        <button class="pp-toggle-add inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
          <i data-lucide="plus" class="w-4 h-4"></i>Add a horse</button>
      </div>

      <div id="addHorsePanel" class="${q.add ? '' : 'hidden'} card ring-soft p-5">
        <div class="font-semibold">Add a horse to the barn</div>
        <div class="text-xs text-ink-500 mt-0.5">Registration facts only. No figures, no ratings.</div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-4 text-sm">
          <label class="block"><span class="text-xs text-ink-500">Name</span>
            <input id="ah-name" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5" placeholder="Horse name"></label>
          <label class="block"><span class="text-xs text-ink-500">Sex</span>
            <select id="ah-sex" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              ${Object.entries(PPData.sexLabels).map(([k, v]) => `<option value="${k}">${esc(v)}</option>`).join('')}
            </select></label>
          <label class="block"><span class="text-xs text-ink-500">Year foaled</span>
            <input id="ah-foaled" type="number" value="${+PPData.today.slice(0, 4) - 3}" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5"></label>
          <label class="block"><span class="text-xs text-ink-500">Color</span>
            <input id="ah-color" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5" placeholder="Bay"></label>
          <label class="block"><span class="text-xs text-ink-500">State / country bred</span>
            <input id="ah-bred" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5" placeholder="KY"></label>
          <label class="block"><span class="text-xs text-ink-500">Registry</span>
            <select id="ah-registry" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              <option value="Jockey Club">Jockey Club (Thoroughbred)</option>
              <option value="AQHA">AQHA (Quarter Horse)</option>
            </select></label>
          <label class="block"><span class="text-xs text-ink-500">Sire</span>
            <input id="ah-sire" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5"></label>
          <label class="block"><span class="text-xs text-ink-500">Dam</span>
            <input id="ah-dam" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5"></label>
          <label class="block"><span class="text-xs text-ink-500">Owner</span>
            <input id="ah-owner" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5" value="${esc(st.name)}"></label>
        </div>
        <div class="mt-4 flex gap-2">
          <button class="pp-add-horse px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">Add to barn</button>
          <button class="pp-toggle-add px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
        </div>
      </div>

      <div class="card ring-soft overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500">
              <tr>
                <th class="text-left font-medium px-5 py-2">Horse</th>
                <th class="text-left font-medium px-3 py-2">Registration</th>
                <th class="text-left font-medium px-3 py-2">Record</th>
                <th class="text-left font-medium px-3 py-2">Status</th>
                <th class="text-right font-medium px-5 py-2">Actions</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-50">
              ${list.map((h) => `
                <tr class="row-hover align-top">
                  <td class="px-5 py-3">
                    <div class="flex items-center gap-2.5">${horseIcon(h, 'sm')}
                      <div>${horseLink(h)}
                        <div class="text-[11px] text-ink-500">${esc(h.age)}yo ${esc(h.sexLabel)}</div></div></div>
                  </td>
                  <td class="px-3 py-3 text-xs text-ink-600">
                    ${esc(h.color || '—')} · ${esc(h.bred || '—')}-bred · foaled ${esc(String(h.foaled || '—'))}<br>
                    <span class="text-ink-500">${esc(h.sire || '—')} — ${esc(h.dam || '—')}</span>
                  </td>
                  <td class="px-3 py-3 text-xs mono">${esc(h.record.starts)}-${esc(h.record.wins)}-${esc(h.record.seconds)}-${esc(h.record.thirds)}
                    <div class="text-ink-500">${esc(fmtMoney(h.record.earnings))}</div></td>
                  <td class="px-3 py-3">${statusPill(PPStore.statusOf(h.id))}
                    ${h.vetList && h.vetList.listed ? `<div class="mt-1">${pill("Vet's list", 'bg-red-50 text-red-700', 'stethoscope')}</div>` : ''}</td>
                  <td class="px-5 py-3 text-right whitespace-nowrap">
                    <a href="#trainer/books?horse=${esc(h.id)}" class="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50">
                      <i data-lucide="book-open" class="w-3.5 h-3.5"></i>Pursue races</a>
                    <button class="pp-remove-horse ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 text-red-700 hover:bg-red-50" data-horse-id="${esc(h.id)}">
                      <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>Remove</button>
                  </td>
                </tr>`).join('')}
            </tbody>
          </table>
        </div>
      </div>`;
  };

  // ================================================== SEE CONDITION BOOKS ===
  // Step 1: pick a track. Step 2: its races in chronological order, filterable.
  const bookFilters = { closeBy: '', raceDate: '', surface: '', type: '', purseMin: '', horse: '' };

  R['scr-books'] = function (trackId, raw) {
    const q = query(raw);
    if (q.horse) bookFilters.horse = q.horse;
    const host = document.getElementById('scr-books');
    if (!trackId) { host.innerHTML = bookTrackPicker(); return; }
    host.innerHTML = bookRaceList(trackId);
  };

  function bookTrackPicker() {
    const tks = PPData.pairedTracks();
    const focusHorse = bookFilters.horse ? horseFor(bookFilters.horse) : null;
    return `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">See condition books</h1>
        <div class="text-sm text-ink-500">Pick a track. You will get its published condition book — every race, in chronological order, with the conditions as written.</div>
      </div>
      ${focusHorse ? `
        <div class="card ring-soft p-4 flex items-center gap-3">
          ${horseIcon(focusHorse)}
          <div class="flex-1 min-w-0">
            <div class="text-xs text-ink-500">Looking for a spot for</div>
            ${horseLink(focusHorse)}
            <div class="text-[11px] text-ink-500">${esc(focusHorse.age)}yo ${esc(focusHorse.sexLabel)} · ${esc(focusHorse.registry)}</div>
          </div>
          <button class="pp-clear-horse text-xs text-ink-500 hover:text-ink-900 underline">Clear</button>
        </div>` : ''}
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        ${tks.map((t) => {
          const meets = PPData.listMeets(t.id);
          const open = PPData.listRaces({ trackId: t.id, openOnly: true });
          const soonest = open.slice().sort((a, b) => a.entryClose.localeCompare(b.entryClose))[0];
          const m = meets[0] || {};
          return `
            <a href="#trainer/books/${esc(t.id)}${bookFilters.horse ? '?horse=' + esc(bookFilters.horse) : ''}" class="card ring-soft p-5 hover:border-slate-300 block">
              <div class="flex items-start justify-between">
                <div>
                  <div class="font-semibold">${esc(t.name)}</div>
                  <div class="text-xs text-ink-500">${esc(t.city)}</div>
                </div>
                ${registryPill(t.discipline === 'QH' ? 'AQHA' : 'Jockey Club')}
              </div>
              <div class="mt-3 text-xs text-ink-600">${esc(m.shortName || '')} · condition book ${esc(String(m.conditionBookNo || '—'))}</div>
              <div class="mt-2 flex flex-wrap gap-1.5">
                ${pill(open.length + ' races open', 'bg-slate-100 text-slate-700', 'flag-triangle-right')}
                ${soonest ? closePill(soonest.entryClose) : ''}
              </div>
              <div class="mt-3 text-[11px] text-ink-500">Posted ${esc(fmtStamp(m.conditionBookPostedAt))}</div>
              <div class="mt-2 text-xs accent-text font-medium">Open the book →</div>
            </a>`;
        }).join('')}
      </div>`;
  }

  const TYPE_ORDER = ['msw', 'mdnClm', 'clm', 'optClm', 'starterAlw', 'alw', 'hcp', 'trial', 'listed', 'stakes', 'futurity'];

  function bookRaceList(trackId) {
    const track = PPData.getTrack(trackId);
    if (!track) return emptyState('search-x', 'Unknown track', 'That track is not paired with PostParade.');
    const meet = PPData.listMeets(trackId)[0] || {};
    const focusHorse = bookFilters.horse ? horseFor(bookFilters.horse) : null;

    let list = PPData.listRaces({ trackId, openOnly: true });
    const typesPresent = TYPE_ORDER.filter((t) => list.some((r) => r.type === t));
    const surfacesPresent = ['D', 'T', 'S'].filter((s) => list.some((r) => r.surface === s));

    // Filters — entry close date, race date, surface, race type, purse size.
    if (bookFilters.closeBy) list = list.filter((r) => r.entryClose.slice(0, 10) <= bookFilters.closeBy);
    if (bookFilters.raceDate) list = list.filter((r) => r.postTime.slice(0, 10) === bookFilters.raceDate);
    if (bookFilters.surface) list = list.filter((r) => r.surface === bookFilters.surface);
    if (bookFilters.type) list = list.filter((r) => r.type === bookFilters.type);
    if (bookFilters.purseMin) list = list.filter((r) => r.purse >= +bookFilters.purseMin);

    // Default sort is chronological by race date, then race number.
    list.sort((a, b) => PPData.raceSortKey(a).localeCompare(PPData.raceSortKey(b)));

    const dates = Array.from(new Set(PPData.listRaces({ trackId, openOnly: true })
      .map((r) => r.postTime.slice(0, 10)))).sort();

    const byDay = {};
    list.forEach((r) => { (byDay[r.raceDayId] = byDay[r.raceDayId] || []).push(r); });
    const dayIds = Object.keys(byDay).sort((a, b) =>
      (PPData.getRaceDay(a).date || '').localeCompare(PPData.getRaceDay(b).date || ''));

    return `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div class="text-xs text-ink-500"><a href="#trainer/books" class="hover:underline">Condition books</a> / ${esc(track.name)}</div>
          <h1 class="text-2xl font-semibold tracking-tight">${esc(track.name)} — condition book ${esc(String(meet.conditionBookNo || ''))}</h1>
          <div class="text-sm text-ink-500">${esc(meet.name || '')} · posted ${esc(fmtStamp(meet.conditionBookPostedAt))} · races in chronological order</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <a href="#trainer/messages/${esc(trackId)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">
            <i data-lucide="messages-square" class="w-4 h-4"></i>Message this office</a>
          <button class="pp-see-all-conditions inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" data-track-id="${esc(trackId)}">
            <i data-lucide="file-text" class="w-4 h-4"></i>See all conditions</button>
        </div>
      </div>

      ${focusHorse ? `
        <div class="card ring-soft p-4 flex flex-wrap items-center gap-3">
          ${horseIcon(focusHorse)}
          <div class="flex-1 min-w-0">
            <div class="text-xs text-ink-500">Checking conditions for</div>
            ${horseLink(focusHorse)}
            <div class="text-[11px] text-ink-500">${esc(focusHorse.age)}yo ${esc(focusHorse.sexLabel)} · ${esc(focusHorse.registry)} · ${esc(focusHorse.careerWins)} career win${focusHorse.careerWins === 1 ? '' : 's'}</div>
          </div>
          <select class="pp-book-horse text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
            ${roster().map((h) => `<option value="${esc(h.id)}" ${h.id === focusHorse.id ? 'selected' : ''}>${esc(h.name)}</option>`).join('')}
          </select>
          <button class="pp-clear-horse text-xs text-ink-500 hover:text-ink-900 underline">Clear</button>
        </div>` : `
        <div class="card ring-soft p-4 flex flex-wrap items-center gap-3">
          <i data-lucide="info" class="w-4 h-4 text-slate-400"></i>
          <div class="text-sm text-ink-600 flex-1">Pick one of your horses to check its conditions against each race.</div>
          <select class="pp-book-horse text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
            <option value="">Select a horse…</option>
            ${roster().map((h) => `<option value="${esc(h.id)}">${esc(h.name)}</option>`).join('')}
          </select>
        </div>`}

      <div class="card ring-soft p-4">
        <div class="flex items-center justify-between">
          <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Filter this book</div>
          <button class="pp-clear-filters text-xs text-ink-500 hover:text-ink-900 underline">Reset filters</button>
        </div>
        <div class="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-3 text-sm">
          <label class="block"><span class="text-xs text-ink-500">Entry closes on or before</span>
            <input type="date" data-filter-key="closeBy" value="${esc(bookFilters.closeBy)}" class="pp-book-filter mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5"></label>
          <label class="block"><span class="text-xs text-ink-500">Race date</span>
            <select data-filter-key="raceDate" class="pp-book-filter mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              <option value="">Any date</option>
              ${dates.map((d) => `<option value="${d}" ${bookFilters.raceDate === d ? 'selected' : ''}>${esc(fmtDateFull(d + 'T12:00:00'))}</option>`).join('')}
            </select></label>
          <label class="block"><span class="text-xs text-ink-500">Surface</span>
            <select data-filter-key="surface" class="pp-book-filter mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              <option value="">Any surface</option>
              ${surfacesPresent.map((s) => `<option value="${s}" ${bookFilters.surface === s ? 'selected' : ''}>${esc(surfaceLabel(s))}</option>`).join('')}
            </select></label>
          <label class="block"><span class="text-xs text-ink-500">Type of race</span>
            <select data-filter-key="type" class="pp-book-filter mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              <option value="">Any type</option>
              ${typesPresent.map((t) => `<option value="${t}" ${bookFilters.type === t ? 'selected' : ''}>${esc(PPData.raceTypes[t] || t)}</option>`).join('')}
            </select></label>
          <label class="block"><span class="text-xs text-ink-500">Purse at least</span>
            <select data-filter-key="purseMin" class="pp-book-filter mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
              <option value="">Any purse</option>
              ${[20000, 40000, 60000, 100000, 150000].map((p) => `<option value="${p}" ${String(bookFilters.purseMin) === String(p) ? 'selected' : ''}>${fmtMoney(p)}+</option>`).join('')}
            </select></label>
        </div>
        <div class="mt-3 text-xs text-ink-500">${list.length} race${list.length === 1 ? '' : 's'} shown${list.length !== PPData.listRaces({ trackId, openOnly: true }).length ? ' (filtered)' : ''}.</div>
      </div>

      ${dayIds.length ? dayIds.map((dayId) => {
        const day = PPData.getRaceDay(dayId);
        return `
          <div class="space-y-3">
            <div class="flex flex-wrap items-center gap-2">
              <h2 class="font-semibold">${esc(day.label)}</h2>
              ${day.note ? pill(day.note, 'bg-slate-100 text-slate-600') : ''}
              ${closePill(day.entryClose)}
              <span class="text-xs text-ink-500">${byDay[dayId].length} race${byDay[dayId].length === 1 ? '' : 's'}</span>
            </div>
            ${byDay[dayId].map((r) => bookRaceCard(r, focusHorse)).join('')}
          </div>`;
      }).join('') : emptyState('filter-x', 'No races match these filters',
        'Widen a filter, or use “See all conditions” to read the whole book as published.')}`;
  }

  /* One race in the book. Shows the facts (which race of which event at which
     track, purse, surface, distance, spots) and — if a horse is selected — the
     condition check, with Submit or Submit Anyway. */
  function bookRaceCard(race, horse) {
    const s = PPStore.spotsFor(race.id);
    const res = horse ? check(horse, race) : null;
    const existing = horse && PPStore.listSubmissions({ horseId: horse.id, raceId: race.id })[0];
    const t = trackOf(race);
    return `
      <div class="card ring-soft overflow-hidden" id="race-card-${esc(race.id)}">
        <div class="p-5">
          <div class="flex flex-wrap items-start justify-between gap-3">
            <div class="min-w-0">
              <div class="flex flex-wrap items-center gap-2">
                <a href="#race/${esc(race.id)}" class="font-semibold hover:underline">Race ${esc(race.raceNumber)}${race.name ? ' — ' + esc(race.name) : ''}</a>
                ${pill(race.typeLabel, 'bg-slate-100 text-slate-700')}
                ${surfacePill(race.surface)}
                ${race.extra ? pill('Extra race', 'bg-violet-50 text-violet-700', 'plus-circle') : ''}
                ${race.mtoAllowed ? pill('MTO permitted', 'bg-sky-50 text-sky-700') : ''}
              </div>
              <div class="text-xs text-ink-500 mt-1">${esc(raceWhere(race))}</div>
              <div class="text-sm mt-2 flex flex-wrap gap-x-4 gap-y-1">
                <span><span class="text-ink-500">Purse</span> <strong>${esc(fmtMoney(race.purse))}</strong></span>
                <span><span class="text-ink-500">Distance</span> ${esc(fmtDistance(race.distanceYards, horseRegistryOfRace(race)))}</span>
                <span><span class="text-ink-500">Post</span> ${esc(fmtStamp(race.postTime))}</span>
                <span><span class="text-ink-500">Entries close</span> ${esc(fmtStamp(race.entryClose))}</span>
              </div>
            </div>
            <div class="flex flex-col items-end gap-2">
              ${closePill(race.entryClose)}
              ${spotsBar(s)}
            </div>
          </div>

          ${res ? `
            <div class="mt-4 rounded-xl border ${res.eligible ? 'border-emerald-100 bg-emerald-50/40' : 'border-red-100 bg-red-50/40'} p-3.5">
              <div class="flex flex-wrap items-center gap-2">
                <i data-lucide="${res.eligible ? 'check-circle-2' : 'alert-triangle'}" class="w-4 h-4 ${res.eligible ? 'text-emerald-600' : 'text-red-600'}"></i>
                <span class="text-sm font-medium">${res.eligible
                  ? esc(horse.name) + ' meets the written conditions'
                  : esc(horse.name) + ' has ' + res.hardConflicts.length + ' condition conflict' + (res.hardConflicts.length === 1 ? '' : 's')}</span>
                <span class="text-[11px] text-ink-500">condition check only — never a judgement about how the horse will run</span>
              </div>
              ${res.conflicts.length ? `<div class="mt-2 flex flex-wrap gap-1.5">${res.conflicts.map(conflictChip).join('')}</div>
                <ul class="mt-2 space-y-1">${res.conflicts.map((c) => `<li class="text-xs ${c.severity === 'hard' ? 'text-red-700' : 'text-amber-700'}">${esc(c.detail)}</li>`).join('')}</ul>` : ''}
              ${res.preferences.length ? res.preferences.map((p) => `
                <div class="mt-2 text-xs ${p.met ? 'text-emerald-800' : p.verified ? 'text-ink-600' : 'text-amber-700'}">
                  <strong>${esc(p.label)}</strong> — ${p.met ? 'applies' : p.verified ? 'does not apply' : 'cannot be settled from the record here'}. ${esc(p.detail)}
                </div>`).join('') : ''}
            </div>` : ''}

          <div class="mt-4 flex flex-wrap items-center gap-2">
            <button class="pp-toggle-conditions inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50" data-race-id="${esc(race.id)}">
              <i data-lucide="file-text" class="w-3.5 h-3.5"></i>Conditions as written</button>
            <button class="pp-watch inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50" data-race-id="${esc(race.id)}">
              <i data-lucide="${PPStore.isWatched(race.id) ? 'bell-ring' : 'bell'}" class="w-3.5 h-3.5"></i>${PPStore.isWatched(race.id) ? 'Watching entry window' : 'Watch entry window'}</button>
            <div class="flex-1"></div>
            ${existing && existing.status !== 'declined' && existing.status !== 'withdrawn' ? `
              <span class="text-xs text-ink-500">Submitted ${esc(fmtStamp(existing.submittedAt))}</span>
              ${statusPill(existing.status)}`
              : horse ? `
              <button class="pp-open-submit inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg ${res.eligible ? 'accent-bg accent-bg-h text-white' : 'border border-amber-300 text-amber-800 bg-amber-50 hover:bg-amber-100'}"
                data-race-id="${esc(race.id)}" data-horse-id="${esc(horse.id)}">
                <i data-lucide="${res.eligible ? 'send' : 'alert-triangle'}" class="w-4 h-4"></i>${res.eligible ? 'Submit ' + esc(horse.name) : 'Submit anyway'}</button>`
              : `
              <button class="pp-open-submit inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white" data-race-id="${esc(race.id)}">
                <i data-lucide="send" class="w-4 h-4"></i>Submit a horse</button>`}
          </div>
        </div>
        <div id="cond-${esc(race.id)}" class="hidden border-t border-slate-100 bg-slate-50 p-5">
          ${conditionsPanel(race)}
        </div>
      </div>`;
  }

  /* The full condition text plus what we read out of it — the bypass valve for
     a trainer who believes a horse fits and wants to see the book itself. */
  function conditionsPanel(race) {
    const p = PPConditions.parse(race.conditionText);
    const c = race.conditions || {};
    const rows = [
      ['Type of race', race.typeLabel],
      ['Purse', fmtMoney(race.purse)],
      ['Distance', fmtDistance(race.distanceYards, horseRegistryOfRace(race))],
      ['Surface', surfaceLabel(race.surface) + (p.turfToDirtClause ? ' (comes off the turf if the stewards rule it unsafe)' : '')],
      ['Sex restriction', (c.sexes && c.sexes.length < 6)
        ? c.sexes.map((s) => PPConditions.SEX_WORD[s] || s).join(', ') : 'None'],
      ['Age', c.maxAge != null ? (c.minAge === c.maxAge ? c.minAge + 'yo only' : c.minAge + '–' + c.maxAge + 'yo')
        : (c.minAge != null ? c.minAge + 'yo and upward' : '—')],
      ['Maiden condition', c.maidenOnly ? 'Maidens only' : 'Open'],
      ['Non-winners clause', c.nonWinners
        ? (c.nonWinners.kind === 'N_X'
          ? 'Never won ' + c.nonWinners.count + ' races other than maiden, claiming, or starter'
          : 'Never won ' + c.nonWinners.count + ' races')
        : 'None'],
      ['Claiming price', c.claimingPrice ? fmtMoney(c.claimingPrice) + (c.optional ? ' (optional)' : '') : '—'],
      ['Starter condition', c.starterPrice ? 'Started for ' + fmtMoney(c.starterPrice) + ' or less since ' + (c.starterSince || '—') : '—'],
      ['State-bred restriction', c.stateBred ? c.stateBred + '-bred' + (c.stateBred === 'NY' ? ', registry approval required' : '') : 'None'],
      ['Registry', c.registry === 'AQHA' ? 'AQHA (Quarter Horses)' : 'Jockey Club (Thoroughbreds)'],
      ['Weight', c.weight || '—'],
      ['Race-day furosemide', c.lasixProhibited ? 'Not permitted' : 'Permitted'],
      ['Nomination', c.nominationRequired ? 'Required (supplementary may be available)' : 'Not required'],
      ['Also-eligible list', race.alsoEligibleCap ? race.alsoEligibleCap + ' places' : 'None'],
      ['Main-track-only', race.mtoAllowed ? 'Permitted' : 'Not permitted'],
    ];
    return `
      <div class="grid lg:grid-cols-2 gap-4">
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">Conditions as published</div>
          <div class="mt-2 cond-text text-ink-700 bg-white border border-slate-200 rounded-lg p-3.5">${esc(race.conditionText)}</div>
          <div class="mt-2 text-[11px] text-ink-500">Posted ${esc(fmtStamp(race.postedAt))}. If you read this differently from the checker, submit anyway — the racing office rules on it, not the software.</div>
        </div>
        <div>
          <div class="text-xs font-semibold uppercase tracking-wide text-ink-500">What we read out of it</div>
          <div class="mt-2 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            ${rows.map(([k, v]) => `<div><div class="text-[11px] text-ink-500">${esc(k)}</div><div>${esc(v)}</div></div>`).join('')}
          </div>
        </div>
      </div>`;
  }

  /* "See all conditions" — the whole book, raw, in one scrollable place. */
  function allConditionsModal(trackId) {
    const track = PPData.getTrack(trackId);
    const races = PPData.listRaces({ trackId, openOnly: true })
      .sort((a, b) => PPData.raceSortKey(a).localeCompare(PPData.raceSortKey(b)));
    openModal(`
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">${esc(track.name)} — all conditions as published</div>
          <div class="text-xs text-ink-500 mt-0.5">The book itself, unfiltered. Use this when you believe a horse is eligible and the checker did not surface the race.</div>
        </div>
        <button class="pp-modal-cancel p-1.5 rounded hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>
      <div class="mt-4 space-y-3">
        ${races.map((r) => {
          const d = dayOf(r);
          return `<div class="border border-slate-200 rounded-lg p-3">
            <div class="flex flex-wrap items-center gap-2 text-xs text-ink-500">
              <strong class="text-ink-900">${esc(d.label)} · Race ${esc(r.raceNumber)}</strong>
              ${pill(r.typeLabel, 'bg-slate-100 text-slate-700')}${surfacePill(r.surface)}
              <span>closes ${esc(fmtStamp(r.entryClose))}</span>
              <a href="#race/${esc(r.id)}" class="ml-auto accent-text hover:underline">Open race →</a>
            </div>
            <div class="mt-2 cond-text text-ink-700">${esc(r.conditionText)}</div>
          </div>`;
        }).join('')}
      </div>`);
  }

  // ======================================================= ENTRY WINDOWS ===
  // The old "spot alerts" and "entries closing soon" merged into one page you
  // visit on purpose — nothing here is pushed into the dashboard.
  R['trainer/windows'] = function () {
    const open = PPData.listRaces({ openOnly: true })
      .sort((a, b) => a.entryClose.localeCompare(b.entryClose));
    const soon = open.filter((r) => hoursUntil(r.entryClose) < 72);
    const watched = PPStore.watches().map((id) => PPData.getRace(id)).filter(Boolean)
      .sort((a, b) => a.entryClose.localeCompare(b.entryClose));
    const notes = PPStore.notifications();

    const row = (r) => {
      const s = PPStore.spotsFor(r.id);
      const t = trackOf(r);
      return `
        <tr class="row-hover align-top">
          <td class="px-5 py-3">
            <a href="#race/${esc(r.id)}" class="font-medium hover:underline">${esc((t && t.name) || '')} R${esc(r.raceNumber)}</a>
            <div class="text-[11px] text-ink-500">${esc(raceMetaLine(r))}</div>
          </td>
          <td class="px-3 py-3 text-xs">${esc(fmtStamp(r.entryClose))}<div class="text-ink-500">${esc(fmtCountdown(r.entryClose))} left</div></td>
          <td class="px-3 py-3 text-xs">${esc(fmtStamp(r.postTime))}</td>
          <td class="px-3 py-3">${spotsBar(s)}</td>
          <td class="px-5 py-3 text-right whitespace-nowrap">
            <button class="pp-watch inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-200 hover:bg-slate-50" data-race-id="${esc(r.id)}">
              <i data-lucide="${PPStore.isWatched(r.id) ? 'bell-ring' : 'bell'}" class="w-3.5 h-3.5"></i>${PPStore.isWatched(r.id) ? 'Watching' : 'Watch'}</button>
            <button class="pp-open-submit ml-1 inline-flex items-center gap-1 px-2.5 py-1.5 text-xs rounded-lg accent-bg accent-bg-h text-white" data-race-id="${esc(r.id)}">
              <i data-lucide="send" class="w-3.5 h-3.5"></i>Submit</button>
          </td>
        </tr>`;
    };
    const table = (rows, empty) => rows.length ? `
      <div class="card ring-soft overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500"><tr>
            <th class="text-left font-medium px-5 py-2">Race</th>
            <th class="text-left font-medium px-3 py-2">Entries close</th>
            <th class="text-left font-medium px-3 py-2">Race date</th>
            <th class="text-left font-medium px-3 py-2">Spots</th>
            <th class="text-right font-medium px-5 py-2"></th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">${rows.map(row).join('')}</tbody>
        </table></div>
      </div>` : empty;

    document.getElementById('trainer/windows').innerHTML = `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Entry windows</h1>
        <div class="text-sm text-ink-500">Deadlines and the races you are watching. This page exists because you came looking for it — it is never pushed at you.</div>
      </div>

      <div class="space-y-3">
        <h2 class="font-semibold flex items-center gap-2"><i data-lucide="alarm-clock" class="w-4 h-4 text-red-500"></i>Closing inside 72 hours
          <span class="text-xs text-ink-500 font-normal">${soon.length} race${soon.length === 1 ? '' : 's'}</span></h2>
        ${table(soon, emptyState('clock', 'Nothing closing yet', 'No entry window closes in the next three days.'))}
      </div>

      <div class="space-y-3">
        <h2 class="font-semibold flex items-center gap-2"><i data-lucide="bell-ring" class="w-4 h-4 text-amber-500"></i>Races you are watching
          <span class="text-xs text-ink-500 font-normal">${watched.length}</span></h2>
        ${table(watched, emptyState('bell', 'No watches yet', 'Use “Watch entry window” on any race in a condition book.'))}
      </div>

      <div class="space-y-3">
        <h2 class="font-semibold flex items-center gap-2"><i data-lucide="file-text" class="w-4 h-4 text-indigo-500"></i>Overnights &amp; extras</h2>
        <div class="card ring-soft divide-y divide-slate-50">
          ${notes.map((n) => `
            <div class="p-4 flex items-start gap-3">
              <i data-lucide="${n.kind === 'extra' ? 'plus-circle' : n.kind === 'book' ? 'book-open' : 'file-text'}" class="w-4 h-4 mt-0.5 text-indigo-500"></i>
              <div class="flex-1 min-w-0">
                <div class="font-medium text-sm">${esc(n.title)}</div>
                <div class="text-xs text-ink-500">${esc(n.body)}</div>
                <div class="text-[11px] text-ink-400 mono mt-1">${esc(fmtStamp(n.at))} · ${esc(fmtAgo(n.at))}</div>
              </div>
              ${n.raceId ? `<a href="#race/${esc(n.raceId)}" class="text-xs accent-text hover:underline whitespace-nowrap">Open race →</a>`
                : n.raceDayId ? `<a href="#track/overnight/${esc(n.raceDayId)}" class="text-xs accent-text hover:underline whitespace-nowrap">Overnight →</a>` : ''}
            </div>`).join('')}
        </div>
      </div>`;
  };

  // ========================================================= SUBMISSIONS ===
  // Where every submission a trainer has sent to a track is stored.
  R['trainer/submissions'] = function () {
    const st = stable();
    const subs = PPStore.listSubmissions({ stableId: st.id });
    const group = (status) => subs.filter((s) => s.status === status);
    const section = (title, icon, rows, note) => `
      <div class="space-y-3">
        <h2 class="font-semibold flex items-center gap-2"><i data-lucide="${icon}" class="w-4 h-4 text-slate-400"></i>${esc(title)}
          <span class="text-xs text-ink-500 font-normal">${rows.length}</span></h2>
        ${rows.length ? `<div class="card ring-soft divide-y divide-slate-50">${rows.map(submissionRow).join('')}</div>`
          : `<div class="text-sm text-ink-500">${esc(note)}</div>`}
      </div>`;

    document.getElementById('trainer/submissions').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Submissions</h1>
          <div class="text-sm text-ink-500">Every horse you have sent to a racing office, what the office decided, and when.</div>
        </div>
        <a href="#trainer/books" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
          <i data-lucide="book-open" class="w-4 h-4"></i>See condition books</a>
      </div>
      ${section('Awaiting the track', 'clock', group('pending'), 'Nothing waiting on a racing office.')}
      ${section('Accepted', 'check-circle-2', group('accepted'), 'No accepted submissions yet.')}
      ${section('Declined', 'x-circle', group('declined'), 'No declines. Reasons and comments from the office appear here.')}
      ${group('withdrawn').length ? section('Withdrawn', 'undo-2', group('withdrawn'), '') : ''}`;
  };

  function submissionRow(s) {
    const h = horseFor(s.horseId), race = PPData.getRace(s.raceId);
    const t = race && trackOf(race);
    const jockey = PPData.getJockey(s.jockeyId);
    const reason = s.denialReason && PPData.getDenialReason(s.denialReason);
    return `
      <div class="p-4">
        <div class="flex flex-wrap items-start gap-3">
          ${horseIcon(h, 'sm')}
          <div class="min-w-0 flex-1">
            <div class="flex flex-wrap items-center gap-2">
              ${horseLink(h)} ${statusPill(s.status)}
              ${s.aeMto ? pill(s.aeMto === 'AE' ? 'Also eligible' : 'Main track only', 'bg-sky-50 text-sky-700') : ''}
              ${s.overrode ? pill('Submitted over a flag', 'bg-amber-50 text-amber-700', 'alert-triangle') : ''}
            </div>
            <div class="text-xs text-ink-600 mt-1">
              ${race ? `<a href="#race/${esc(race.id)}" class="hover:underline">${esc(raceWhere(race))}</a>` : esc(s.raceId)}
            </div>
            <div class="text-xs text-ink-500">${race ? esc(raceMetaLine(race)) : ''}</div>
            <div class="mt-2 grid sm:grid-cols-3 gap-2 text-[11px]">
              <div><div class="text-ink-500">Submitted by you</div><div class="mono">${esc(fmtStamp(s.submittedAt))}</div></div>
              <div><div class="text-ink-500">${s.decidedAt ? 'Decided by the track' : 'Awaiting decision'}</div>
                <div class="mono">${s.decidedAt ? esc(fmtStamp(s.decidedAt)) : '—'}</div></div>
              <div><div class="text-ink-500">Jockey named</div><div>${jockey ? esc(jockey.name) : '<span class="text-red-600">none</span>'}</div></div>
            </div>
            ${s.equipmentNote ? `<div class="text-[11px] text-ink-500 mt-1">Equipment note: ${esc(s.equipmentNote)}</div>` : ''}
            ${reason ? `<div class="mt-2 rounded-lg bg-red-50 border border-red-100 p-2.5">
              <div class="text-xs font-medium text-red-800">${esc(reason.label)}</div>
              ${s.denialComment ? `<div class="text-xs text-red-700 mt-0.5 italic">“${esc(s.denialComment)}”</div>` : ''}
              <div class="text-[10px] text-red-600 mt-1">${esc(s.decidedBy || 'racing office')} · ${esc(fmtStamp(s.decidedAt))}</div>
            </div>` : ''}
          </div>
          <div class="flex flex-col gap-1.5 items-end">
            ${t ? `<a href="#trainer/messages/${esc(t.id)}" class="text-xs accent-text hover:underline whitespace-nowrap">Message office →</a>` : ''}
            ${s.status === 'pending' ? `<button class="pp-withdraw text-xs text-red-700 hover:underline" data-sub-id="${esc(s.id)}">Withdraw</button>` : ''}
          </div>
        </div>
      </div>`;
  }

  // ============================================================ MESSAGES ===
  R['scr-trainer-messages'] = function (trackId) {
    const st = stable();
    const threads = PPStore.threads(st.id);
    const active = trackId || (threads[0] && threads[0].trackId) || 'ELP';
    document.getElementById('scr-trainer-messages').innerHTML =
      messagesLayout({ threads, activeId: active, side: 'trainer',
        title: 'Messages', subtitle: 'Direct line to each racing office. Everything is stored with the submission history.',
        hrefPrefix: '#trainer/messages/' });
  };

  /* Shared by both workspaces — same store, same thread ids. */
  function messagesLayout(opts) {
    const active = opts.threads.find((t) => t.trackId === opts.activeId) || opts.threads[0];
    return `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">${esc(opts.title)}</h1>
        <div class="text-sm text-ink-500">${esc(opts.subtitle)}</div>
      </div>
      <div class="grid lg:grid-cols-[16rem_1fr] gap-4">
        <div class="card ring-soft overflow-hidden h-fit">
          ${opts.threads.map((t) => `
            <a href="${opts.hrefPrefix}${esc(t.trackId)}" class="block px-4 py-3 border-b border-slate-50 last:border-0 hover:bg-slate-50 ${t.trackId === (active && active.trackId) ? 'bg-slate-50' : ''}">
              <div class="flex items-center justify-between gap-2">
                <span class="font-medium text-sm">${esc(t.trackName)}</span>
                <span class="text-[10px] text-ink-400">${t.last ? esc(fmtAgo(t.last.at)) : ''}</span>
              </div>
              <div class="text-[11px] text-ink-500 truncate">${t.last ? esc(t.last.body) : 'No messages yet'}</div>
            </a>`).join('')}
        </div>
        <div class="card ring-soft flex flex-col">
          <div class="px-5 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div class="font-semibold">${esc((active && active.trackName) || '')}</div>
            <div class="text-xs text-ink-500">${active ? active.messages.length : 0} message${active && active.messages.length === 1 ? '' : 's'} · stored</div>
          </div>
          <div class="p-5 space-y-3 max-h-[26rem] overflow-y-auto scrollbar-thin">
            ${active && active.messages.length ? active.messages.map((m) => {
              const mine = m.from === opts.side;
              return `<div class="flex ${mine ? 'justify-end' : 'justify-start'}">
                <div class="max-w-[85%] rounded-xl px-3.5 py-2.5 ${mine ? 'accent-soft' : 'bg-slate-100 text-ink-800'}">
                  <div class="text-[11px] font-medium opacity-80">${esc(m.authorName)}</div>
                  <div class="text-sm leading-snug mt-0.5">${esc(m.body)}</div>
                  <div class="text-[10px] opacity-60 mt-1 mono">${esc(fmtStamp(m.at))}</div>
                </div></div>`;
            }).join('') : '<div class="text-sm text-ink-500">No messages in this thread yet.</div>'}
          </div>
          <div class="border-t border-slate-100 p-3 flex gap-2">
            <input id="msgInput" class="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm" placeholder="Write a message…"
              data-track-id="${esc((active && active.trackId) || '')}" data-side="${esc(opts.side)}">
            <button class="pp-send-msg px-3 py-2 text-sm rounded-lg accent-bg accent-bg-h text-white inline-flex items-center gap-1.5">
              <i data-lucide="send" class="w-4 h-4"></i>Send</button>
          </div>
        </div>
      </div>`;
  }
  global.PPMessagesLayout = messagesLayout;

  // ======================================================= HORSE PROFILE ===
  // Shaped like an Equibase profile: identity, pedigree, connections of last
  // start, and the past-performance lines. Facts only.
  R['scr-horse'] = function (horseId) {
    const h = horseFor(horseId);
    const host = document.getElementById('scr-horse');
    if (!h) { host.innerHTML = emptyState('search-x', 'Horse not found', 'That horse is not in the system.'); return; }
    const last = h.lastStart;
    const lastTrack = last && PPData.getTrack(last.trackId);
    const lastJockey = last && PPData.getJockey(last.jockeyId);
    const subs = PPStore.listSubmissions({ horseId: h.id });
    const status = PPStore.statusOf(h.id);
    const mine = h.stableId === stable().id;

    const fact = (k, v) => `<div><div class="text-[11px] text-ink-500">${esc(k)}</div><div class="text-sm">${v}</div></div>`;

    host.innerHTML = `
      <div class="flex flex-wrap items-start justify-between gap-4">
        <div class="flex items-start gap-4 min-w-0">
          ${horseIcon(h, 'lg')}
          <div class="min-w-0">
            <div class="flex flex-wrap items-center gap-2">
              <h1 class="text-2xl font-semibold tracking-tight">${esc(h.name)}</h1>
              ${registryPill(h.registry)} ${statusPill(status)}
              ${h.vetList && h.vetList.listed ? pill("Vet's list — not eligible until " + h.vetList.eligibleDate, 'bg-red-50 text-red-700', 'stethoscope') : ''}
              ${h.demoFiction ? pill('Illustrative horse', 'bg-slate-100 text-slate-500') : ''}
            </div>
            <div class="text-sm text-ink-500 mt-1">${esc(h.age)}-year-old ${esc(h.color)} ${esc(h.sexLabel)} · foaled ${esc(String(h.foaled))} in ${esc(h.bred || '—')} (USA)</div>
            <div class="text-sm text-ink-500">${esc(h.sire || '—')} — ${esc(h.dam || '—')}${h.damSire ? ', by ' + esc(h.damSire) : ''}</div>
          </div>
        </div>
        <div class="flex flex-wrap gap-2">
          ${mine ? `<a href="#trainer/books?horse=${esc(h.id)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
            <i data-lucide="book-open" class="w-4 h-4"></i>Find a spot</a>` : ''}
          <button class="pp-open-submit inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" data-horse-id="${esc(h.id)}">
            <i data-lucide="send" class="w-4 h-4"></i>Submit to a race</button>
        </div>
      </div>

      <div class="grid lg:grid-cols-3 gap-4">
        <div class="card ring-soft p-5 lg:col-span-2">
          <div class="font-semibold">Identity</div>
          <div class="grid sm:grid-cols-3 gap-3 mt-3">
            ${fact('Color', esc(h.color || '—'))}
            ${fact('Sex', esc(h.sexLabel))}
            ${fact('Year foaled', esc(String(h.foaled || '—')))}
            ${fact('State / country bred', esc((h.bred || '—') + ' · USA'))}
            ${fact('Sire', esc(h.sire || '—'))}
            ${fact('Dam', esc(h.dam || '—'))}
            ${fact("Dam's sire", esc(h.damSire || '—'))}
            ${fact('Registry', esc(h.registry))}
            ${fact('Owner', esc(h.owner || '—'))}
            ${fact('Breeder', esc(h.breeder || '—'))}
            ${fact('Trainer', esc(h.trainer || '—'))}
            ${fact('Eligibility', h.maiden ? 'Maiden' : esc(h.careerWins) + ' career wins · ' + esc(h.winsOtherThanMdnClmStarter) + ' other than maiden/claiming/starter')}
          </div>
        </div>
        <div class="card ring-soft p-5">
          <div class="font-semibold">Lifetime record</div>
          <div class="mt-3 text-3xl font-semibold tracking-tight mono">
            ${esc(h.record.starts)}-${esc(h.record.wins)}-${esc(h.record.seconds)}-${esc(h.record.thirds)}</div>
          <div class="text-xs text-ink-500">starts · wins · seconds · thirds</div>
          <div class="mt-3 text-sm"><span class="text-ink-500">Earnings</span> <strong>${esc(fmtMoney(h.record.earnings))}</strong></div>
          <div class="mt-3 text-[11px] text-ink-500">A record, not a rating. PostParade computes no figures and offers no view on future results.</div>
        </div>
      </div>

      ${last ? `
      <div class="card ring-soft p-5">
        <div class="font-semibold">Connections of last start</div>
        <div class="text-xs text-ink-500">${esc(last.date)} · ${esc((lastTrack && lastTrack.name) || last.trackId)} Race ${esc(last.raceNo)} ·
          ${esc(last.typeLabel)}${last.name ? ' — ' + esc(last.name) : ''} · finished ${esc(last.finish)} of ${esc(last.fieldSize)}</div>
        <div class="grid sm:grid-cols-4 gap-3 mt-3">
          ${fact('Jockey', esc((lastJockey && lastJockey.name) || '—'))}
          ${fact('Trainer', esc(h.trainer || '—'))}
          ${fact('Owner', esc(h.owner || '—'))}
          ${fact('Breeder', esc(h.breeder || '—'))}
        </div>
      </div>` : `
      <div class="card ring-soft p-5">
        <div class="font-semibold">Connections of last start</div>
        <div class="text-sm text-ink-500 mt-1">Unraced — no starts on record.</div>
      </div>`}

      <div class="card ring-soft overflow-hidden">
        <div class="px-5 py-3.5 border-b border-slate-100 font-semibold">Past performances</div>
        ${h.pps && h.pps.length ? `
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500"><tr>
            <th class="text-left font-medium px-5 py-2">Date</th>
            <th class="text-left font-medium px-3 py-2">Track</th>
            <th class="text-left font-medium px-3 py-2">Race</th>
            <th class="text-left font-medium px-3 py-2">Dist / surf</th>
            <th class="text-left font-medium px-3 py-2">Finish</th>
            <th class="text-left font-medium px-3 py-2">Jockey</th>
            <th class="text-right font-medium px-5 py-2">Purse</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">
            ${h.pps.map((p) => {
              const t = PPData.getTrack(p.trackId), j = PPData.getJockey(p.jockeyId);
              return `<tr class="row-hover">
                <td class="px-5 py-2.5 mono text-xs">${esc(p.date)}</td>
                <td class="px-3 py-2.5">${esc((t && t.name) || p.trackId)}</td>
                <td class="px-3 py-2.5">R${esc(p.raceNo)} · ${esc(p.typeLabel)}${p.name ? ' — ' + esc(p.name) : ''}
                  ${p.claimedFor ? `<div class="text-[11px] text-ink-500">claimed for ${esc(fmtMoney(p.claimedFor))}</div>` : ''}
                  ${p.note ? `<div class="text-[11px] text-ink-500">${esc(p.note)}</div>` : ''}</td>
                <td class="px-3 py-2.5 text-xs">${esc(fmtDistance(p.distanceYards, h.registry))}<div class="text-ink-500">${esc(surfaceLabel(p.surface))}</div></td>
                <td class="px-3 py-2.5"><span class="font-semibold ${p.finish === 1 ? 'text-emerald-700' : ''}">${esc(p.finish)}</span>
                  <span class="text-ink-500 text-xs">of ${esc(p.fieldSize)}</span></td>
                <td class="px-3 py-2.5 text-xs">${esc((j && j.name) || '—')}</td>
                <td class="px-5 py-2.5 text-right text-xs mono">${esc(fmtMoney(p.purse))}</td>
              </tr>`;
            }).join('')}
          </tbody></table></div>` : '<div class="p-5 text-sm text-ink-500">No starts on record.</div>'}
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft p-5">
          <div class="font-semibold">Starts by track</div>
          <div class="text-xs text-ink-500">What each racing office sees when this horse asks for a spot.</div>
          <div class="mt-3 space-y-2">
            ${Object.keys(h.startsByTrack || {}).length ? Object.entries(h.startsByTrack).map(([tid, n]) => {
              const t = PPData.getTrack(tid);
              return `<div class="flex items-center justify-between text-sm">
                <span>${esc((t && t.name) || tid)}</span>
                <span class="mono text-xs">${esc(n)} start${n === 1 ? '' : 's'}</span></div>`;
            }).join('') : '<div class="text-sm text-ink-500">No starts yet — new to every track.</div>'}
          </div>
        </div>
        <div class="card ring-soft p-5">
          <div class="flex items-center justify-between">
            <div class="font-semibold">This horse's submissions</div>
            <a href="#trainer/submissions" class="text-xs accent-text hover:underline">All →</a>
          </div>
          <div class="mt-3 space-y-2">
            ${subs.length ? subs.map((s) => {
              const r = PPData.getRace(s.raceId);
              return `<div class="text-sm flex items-start justify-between gap-2">
                <div class="min-w-0">
                  ${r ? `<a href="#race/${esc(r.id)}" class="hover:underline">${esc(raceTitle(r))}</a>` : esc(s.raceId)}
                  <div class="text-[11px] text-ink-500 mono">submitted ${esc(fmtStamp(s.submittedAt))}${s.decidedAt ? ' · decided ' + esc(fmtStamp(s.decidedAt)) : ''}</div>
                </div>${statusPill(s.status)}</div>`;
            }).join('') : '<div class="text-sm text-ink-500">No submissions yet.</div>'}
          </div>
        </div>
      </div>

      <div class="card ring-soft p-5">
        <div class="flex items-center gap-2">
          <i data-lucide="message-circle-question" class="w-4 h-4 text-slate-400"></i>
          <div class="font-semibold">Ask about this horse</div>
          ${pill('Planned', 'bg-slate-100 text-slate-500')}
        </div>
        <div class="text-sm text-ink-500 mt-1">A condition-question box — “has this horse won $22,000 other than maiden, claiming, or starter?” — answered from the record, never a prediction. Not built yet; noted in the plan.</div>
      </div>`;
  };

  // ========================================================= RACE DETAIL ===
  R['scr-race'] = function (raceId) {
    const host = document.getElementById('scr-race');
    host.innerHTML = raceDetail(raceId, 'trainer');
  };

  /* Shared race detail. `side` decides which actions show. */
  function raceDetail(raceId, side) {
    const race = PPData.getRace(raceId);
    if (!race) return emptyState('search-x', 'Race not found', 'That race is not in a published condition book.');
    const t = trackOf(race), m = meetOf(race), d = dayOf(race);
    const s = PPStore.spotsFor(race.id);
    const entries = PPStore.entriesForRace(race.id);
    const pending = PPStore.listSubmissions({ raceId: race.id, status: 'pending' });
    const reg = horseRegistryOfRace(race);

    return `
      <div class="flex flex-wrap items-start justify-between gap-3">
        <div class="min-w-0">
          <div class="text-xs text-ink-500">
            <a href="#${side === 'track' ? 'track/book' : 'trainer/books/' + esc(t.id)}" class="hover:underline">${esc((t && t.name) || '')}</a>
            / ${esc((m && m.shortName) || '')} / ${esc((d && d.label) || '')}
          </div>
          <h1 class="text-2xl font-semibold tracking-tight">Race ${esc(race.raceNumber)}${race.name ? ' — ' + esc(race.name) : ''}</h1>
          <div class="text-sm text-ink-500">${esc(raceWhere(race))}</div>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          ${closePill(race.entryClose)}
          ${side === 'trainer' ? `
            <button class="pp-watch inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg border border-slate-200 hover:bg-slate-50" data-race-id="${esc(race.id)}">
              <i data-lucide="${PPStore.isWatched(race.id) ? 'bell-ring' : 'bell'}" class="w-4 h-4"></i>${PPStore.isWatched(race.id) ? 'Watching' : 'Watch'}</button>
            <button class="pp-open-submit inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white" data-race-id="${esc(race.id)}">
              <i data-lucide="send" class="w-4 h-4"></i>Submit a horse</button>`
          : `<a href="#track/queue" class="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg accent-bg accent-bg-h text-white">
              <i data-lucide="inbox" class="w-4 h-4"></i>Review ${pending.length} request${pending.length === 1 ? '' : 's'}</a>`}
        </div>
      </div>

      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="card ring-soft p-4"><div class="text-xs text-ink-500">Purse</div>
          <div class="text-xl font-semibold tracking-tight">${esc(fmtMoney(race.purse))}</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-ink-500">Surface &amp; distance</div>
          <div class="text-xl font-semibold tracking-tight">${esc(surfaceLabel(race.surface))}</div>
          <div class="text-xs text-ink-500">${esc(fmtDistance(race.distanceYards, reg))}</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-ink-500">Type</div>
          <div class="text-xl font-semibold tracking-tight">${esc(race.typeLabel)}</div>
          <div class="text-xs text-ink-500">Race ${esc(race.raceNumber)} of ${esc((m && m.shortName) || '')}</div></div>
        <div class="card ring-soft p-4"><div class="text-xs text-ink-500">Spots</div>
          <div class="mt-1">${spotsBar(s)}</div></div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft p-5">
          <div class="font-semibold">Key dates</div>
          <div class="mt-3 space-y-2 text-sm">
            <div class="flex justify-between"><span class="text-ink-500">Entries close</span><span class="mono">${esc(fmtStamp(race.entryClose))}</span></div>
            <div class="flex justify-between"><span class="text-ink-500">Post time</span><span class="mono">${esc(fmtStamp(race.postTime))}</span></div>
            <div class="flex justify-between"><span class="text-ink-500">Condition posted</span><span class="mono">${esc(fmtStamp(race.postedAt))}</span></div>
            <div class="flex justify-between"><span class="text-ink-500">Also-eligible places</span><span>${esc(race.alsoEligibleCap || 0)}</span></div>
            <div class="flex justify-between"><span class="text-ink-500">Main-track-only</span><span>${race.mtoAllowed ? 'Permitted' : 'Not permitted'}</span></div>
          </div>
        </div>
        <div class="card ring-soft p-5">
          <div class="font-semibold">Spots allocated</div>
          <div class="text-xs text-ink-500">Both the track and every trainer see the same numbers.</div>
          <div class="mt-3 grid grid-cols-3 gap-3 text-center">
            <div><div class="text-2xl font-semibold">${esc(s.filled)}</div><div class="text-[11px] text-ink-500">filled</div></div>
            <div><div class="text-2xl font-semibold ${s.open ? 'text-emerald-700' : 'text-slate-400'}">${esc(s.open)}</div><div class="text-[11px] text-ink-500">openings left</div></div>
            <div><div class="text-2xl font-semibold">${esc(s.pending)}</div><div class="text-[11px] text-ink-500">awaiting review</div></div>
          </div>
          <div class="mt-3 text-[11px] text-ink-500">${esc(s.ae)} of ${esc(s.aeCap)} also-eligible places used.</div>
        </div>
      </div>

      <div class="card ring-soft p-5">
        <div class="font-semibold">Conditions as published</div>
        <div class="mt-2 cond-text text-ink-700 bg-slate-50 border border-slate-200 rounded-lg p-3.5">${esc(race.conditionText)}</div>
        <div class="mt-3">${conditionsPanel(race)}</div>
      </div>

      <div class="grid lg:grid-cols-2 gap-4">
        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 font-semibold">In the race (${entries.length})</div>
          ${entries.length ? `<div class="divide-y divide-slate-50">
            ${entries.map((e) => {
              const h = horseFor(e.horseId), j = PPData.getJockey(e.jockeyId);
              return `<div class="px-5 py-3 flex items-center gap-2.5">
                ${horseIcon(h, 'sm')}
                <div class="min-w-0 flex-1">${h ? horseLink(h) : esc(e.horseId)}
                  <div class="text-[11px] text-ink-500">${h ? esc(h.trainer) : ''}${j ? ' · ' + esc(j.name) : ''}</div></div>
                ${e.aeMto ? pill(e.aeMto, 'bg-sky-50 text-sky-700') : ''}
                ${e.source === 'submission' ? pill('via PostParade', 'bg-emerald-50 text-emerald-700') : ''}
              </div>`;
            }).join('')}</div>` : '<div class="p-5 text-sm text-ink-500">No entries yet.</div>'}
        </div>
        <div class="card ring-soft overflow-hidden">
          <div class="px-5 py-3.5 border-b border-slate-100 font-semibold">Requests awaiting the office (${pending.length})</div>
          ${pending.length ? `<div class="divide-y divide-slate-50">
            ${pending.map((sub) => {
              const h = horseFor(sub.horseId), j = PPData.getJockey(sub.jockeyId);
              return `<div class="px-5 py-3 flex items-start gap-2.5">
                ${horseIcon(h, 'sm')}
                <div class="min-w-0 flex-1">${h ? horseLink(h) : esc(sub.horseId)}
                  <div class="text-[11px] text-ink-500">${h ? esc(h.trainer) : ''}${j ? ' · ' + esc(j.name) : ''}</div>
                  <div class="text-[10px] text-ink-400 mono">submitted ${esc(fmtStamp(sub.submittedAt))}</div></div>
                ${sub.overrode ? pill('flagged', 'bg-amber-50 text-amber-700', 'alert-triangle') : ''}
              </div>`;
            }).join('')}</div>` : '<div class="p-5 text-sm text-ink-500">Nothing pending.</div>'}
        </div>
      </div>`;
  }
  global.PPRaceDetail = raceDetail;
  global.PPConditionsPanel = conditionsPanel;

  // ==================================================== SUBMISSION MODAL ===
  /* A jockey must be named. AE/MTO available. Conflicts are shown verbatim and
     the trainer can always Submit Anyway — the office reviews it either way. */
  function submitModal(raceId, horseId) {
    const race = PPData.getRace(raceId);
    const list = roster();
    const horse = horseFor(horseId) || null;
    const res = horse && race ? check(horse, race) : null;
    const s = race ? PPStore.spotsFor(race.id) : null;
    const t = race && trackOf(race);

    openModal(`
      <div class="flex items-start justify-between gap-3">
        <div>
          <div class="font-semibold">Submit a horse${race ? ' — ' + esc(raceTitle(race)) : ''}</div>
          ${race ? `<div class="text-xs text-ink-500 mt-0.5">${esc(raceWhere(race))} · ${esc(raceMetaLine(race))}</div>
          <div class="text-xs text-ink-500">Entries close ${esc(fmtStamp(race.entryClose))} · ${esc(s.open)} of ${esc(s.spots)} spots open</div>` : ''}
        </div>
        <button class="pp-modal-cancel p-1.5 rounded hover:bg-slate-100"><i data-lucide="x" class="w-4 h-4"></i></button>
      </div>

      ${!race ? `
        <label class="block mt-4 text-sm"><span class="text-xs text-ink-500">Race</span>
          <select id="sm-race" class="pp-sm-race mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
            <option value="">Select a race…</option>
            ${PPData.listRaces({ openOnly: true })
              .sort((a, b) => PPData.raceSortKey(a).localeCompare(PPData.raceSortKey(b)))
              .map((r) => `<option value="${esc(r.id)}">${esc(raceTitle(r))} · ${esc(fmtDateFull(r.postTime))} · ${esc(r.typeLabel)}</option>`).join('')}
          </select></label>` : ''}

      <label class="block mt-4 text-sm"><span class="text-xs text-ink-500">Horse</span>
        <select class="pp-sm-horse mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 bg-white" data-race-id="${esc(raceId || '')}">
          <option value="">Select a horse…</option>
          ${list.map((h) => `<option value="${esc(h.id)}" ${horse && h.id === horse.id ? 'selected' : ''}>${esc(h.name)} — ${esc(h.age)}yo ${esc(h.sexLabel)}</option>`).join('')}
        </select></label>

      ${res ? `
        <div class="mt-3 rounded-xl border ${res.eligible ? 'border-emerald-100 bg-emerald-50/50' : 'border-red-100 bg-red-50/50'} p-3.5">
          <div class="flex items-center gap-2">
            <i data-lucide="${res.eligible ? 'check-circle-2' : 'alert-triangle'}" class="w-4 h-4 ${res.eligible ? 'text-emerald-600' : 'text-red-600'}"></i>
            <span class="text-sm font-medium">${res.eligible ? 'Meets the written conditions' : 'Condition conflict flagged'}</span>
          </div>
          ${res.conflicts.length ? `<ul class="mt-2 space-y-1.5">${res.conflicts.map((c) => `
            <li class="text-xs ${c.severity === 'hard' ? 'text-red-700' : 'text-amber-700'}"><strong>${esc(c.label)}.</strong> ${esc(c.detail)}</li>`).join('')}</ul>` : ''}
          ${res.preferences.map((p) => `<div class="mt-2 text-xs text-ink-600"><strong>${esc(p.label)}</strong> — ${esc(p.detail)}</div>`).join('')}
          ${res.notices.length ? `<ul class="mt-2 space-y-1">${res.notices.map((n) => `<li class="text-[11px] text-ink-500">${esc(n.label)}: ${esc(n.detail)}</li>`).join('')}</ul>` : ''}
        </div>` : ''}

      <div class="grid sm:grid-cols-2 gap-3 mt-3 text-sm">
        <label class="block"><span class="text-xs text-ink-500">Jockey <span class="text-red-600">(required)</span></span>
          <select id="sm-jockey" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
            <option value="">Name a jockey…</option>
            ${PPData.jockeys.map((j) => `<option value="${esc(j.id)}">${esc(j.name)}${j.agent ? ' — agent ' + esc(j.agent) : ''}</option>`).join('')}
          </select>
          <span class="text-[11px] text-ink-500">Named at submission so the office can catch double-bookings.</span></label>
        <label class="block"><span class="text-xs text-ink-500">Designation</span>
          <select id="sm-aemto" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2 bg-white">
            <option value="">In the body of the race</option>
            <option value="AE">AE — also eligible</option>
            ${race && race.mtoAllowed ? '<option value="MTO">MTO — main track only</option>' : ''}
          </select></label>
      </div>

      <label class="block mt-3 text-sm"><span class="text-xs text-ink-500">Equipment declared
          <span class="pill bg-slate-100 text-slate-500 ml-1">requirement pending confirmation</span></span>
        <input id="sm-equipment" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2" placeholder="e.g. blinkers on, tongue tie — leave blank if unchanged"></label>

      <label class="block mt-3 text-sm"><span class="text-xs text-ink-500">Note to the racing office (optional)</span>
        <textarea id="sm-note" rows="2" class="mt-1 w-full rounded-lg border border-slate-200 px-2.5 py-2" placeholder="Anything the office should know"></textarea></label>

      <div class="mt-4 flex flex-wrap items-center gap-2">
        <button class="pp-do-submit inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg ${res && !res.eligible ? 'border border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100' : 'accent-bg accent-bg-h text-white'}"
          data-race-id="${esc(raceId || '')}" data-horse-id="${esc(horseId || '')}" data-override="${res && !res.eligible ? '1' : '0'}">
          <i data-lucide="${res && !res.eligible ? 'alert-triangle' : 'send'}" class="w-4 h-4"></i>${res && !res.eligible ? 'Submit anyway' : 'Submit to the track'}</button>
        <button class="pp-modal-cancel px-3 py-2 text-sm rounded-lg border border-slate-200 hover:bg-slate-50">Cancel</button>
        ${t ? `<a href="#trainer/messages/${esc(t.id)}" class="ml-auto text-xs accent-text hover:underline">Ask the office first →</a>` : ''}
      </div>
      <div class="mt-3 text-[11px] text-ink-500">Every submission — flagged or clean — is reviewed by a person at the racing office before it becomes an entry.</div>`);
  }
  global.PPSubmitModal = submitModal;

  // ================================================ delegated interaction ===
  document.addEventListener('click', function (e) {
    const el = (sel) => e.target.closest && e.target.closest(sel);

    const tile = el('.pp-dash-tile');
    if (tile) { dashFilter = tile.dataset.filter; window.rerender(); return; }

    const seeAll = el('.pp-see-all-conditions');
    if (seeAll) { allConditionsModal(seeAll.dataset.trackId); return; }

    const cond = el('.pp-toggle-conditions');
    if (cond) {
      const panel = document.getElementById('cond-' + cond.dataset.raceId);
      if (panel) panel.classList.toggle('hidden');
      return;
    }

    const watch = el('.pp-watch');
    if (watch) {
      const on = PPStore.toggleWatch(watch.dataset.raceId);
      toast(on ? 'Watching this entry window' : 'Stopped watching', on ? 'bell-ring' : 'bell');
      window.rerender();
      return;
    }

    const clearHorse = el('.pp-clear-horse');
    if (clearHorse) { bookFilters.horse = ''; window.rerender(); return; }

    const clearFilters = el('.pp-clear-filters');
    if (clearFilters) {
      bookFilters.closeBy = ''; bookFilters.raceDate = ''; bookFilters.surface = '';
      bookFilters.type = ''; bookFilters.purseMin = '';
      window.rerender();
      return;
    }

    const openSubmit = el('.pp-open-submit');
    if (openSubmit) {
      submitModal(openSubmit.dataset.raceId || '', openSubmit.dataset.horseId || bookFilters.horse || '');
      return;
    }

    const doSubmit = el('.pp-do-submit');
    if (doSubmit) {
      const val = (id) => { const n = document.getElementById(id); return n ? n.value.trim() : ''; };
      const raceId = doSubmit.dataset.raceId || val('sm-race');
      const horseSel = document.querySelector('.pp-sm-horse');
      const horseId = (horseSel && horseSel.value) || doSubmit.dataset.horseId;
      if (!raceId) { toast('Pick a race first', 'alert-triangle'); return; }
      if (!horseId) { toast('Pick a horse first', 'alert-triangle'); return; }
      const jockeyId = val('sm-jockey');
      if (!jockeyId) { toast('Name a jockey — required at submission', 'alert-triangle'); return; }
      const h = horseFor(horseId), race = PPData.getRace(raceId);
      const res = check(h, race);
      const out = PPStore.submit({
        horseId, raceId, jockeyId,
        aeMto: val('sm-aemto') || null,
        equipmentNote: val('sm-equipment'),
        note: val('sm-note'),
        overrode: !res.eligible,
        conflictsAtSubmit: res.conflicts,
      });
      closeModal();
      if (!out.ok) { toast(esc(h.name) + ' already has an open submission for that race', 'info'); return; }
      toast(h.name + ' submitted to ' + raceTitle(race) + (res.eligible ? '' : ' — flagged for review'));
      window.rerender();
      return;
    }

    const withdraw = el('.pp-withdraw');
    if (withdraw) {
      PPStore.withdraw(withdraw.dataset.subId);
      toast('Submission withdrawn', 'undo-2');
      window.rerender();
      return;
    }

    const toggleAdd = el('.pp-toggle-add');
    if (toggleAdd) {
      const p = document.getElementById('addHorsePanel');
      if (p) p.classList.toggle('hidden');
      return;
    }

    const add = el('.pp-add-horse');
    if (add) {
      const val = (id) => { const n = document.getElementById(id); return n ? n.value.trim() : ''; };
      const name = val('ah-name');
      if (!name) { toast('Enter a horse name', 'alert-triangle'); return; }
      const h = PPStore.addHorse({
        name, stableId: stable().id, sex: val('ah-sex') || 'F',
        foaled: +val('ah-foaled') || (+PPData.today.slice(0, 4) - 3),
        color: val('ah-color') || 'Bay', bred: (val('ah-bred') || 'KY').toUpperCase(),
        registry: val('ah-registry') || 'Jockey Club',
        sire: val('ah-sire'), dam: val('ah-dam'), owner: val('ah-owner'),
      });
      toast(h.name + ' added to the barn');
      location.hash = '#horse/' + h.id;
      return;
    }

    const rm = el('.pp-remove-horse');
    if (rm) {
      const h = horseFor(rm.dataset.horseId);
      if (h && !global.confirm('Remove ' + h.name + ' from the barn? Submission history is kept.')) return;
      PPStore.removeHorse(rm.dataset.horseId);
      toast(((h && h.name) || 'Horse') + ' removed', 'trash-2');
      window.rerender();
      return;
    }

    const send = el('.pp-send-msg');
    if (send) {
      const input = document.getElementById('msgInput');
      if (!input || !input.value.trim()) return;
      const side = input.dataset.side || 'trainer';
      const author = side === 'track'
        ? (PPData.getTrack(input.dataset.trackId) || {}).office
        : stable().trainer;
      PPStore.sendMessage(stable().id, input.dataset.trackId, side, input.value, author);
      window.rerender();
      return;
    }
  });

  document.addEventListener('change', function (e) {
    const t = e.target;
    if (t.classList.contains('pp-dash-filter')) { dashFilter = t.value; window.rerender(); return; }
    if (t.classList.contains('pp-book-filter')) {
      bookFilters[t.dataset.filterKey] = t.value;
      window.rerender();
      return;
    }
    if (t.classList.contains('pp-book-horse')) {
      bookFilters.horse = t.value;
      window.rerender();
      return;
    }
    if (t.classList.contains('pp-sm-horse')) {
      const raceId = t.dataset.raceId || (document.getElementById('sm-race') || {}).value || '';
      submitModal(raceId, t.value);
      return;
    }
    if (t.classList.contains('pp-sm-race')) {
      const horseSel = document.querySelector('.pp-sm-horse');
      submitModal(t.value, (horseSel && horseSel.value) || '');
      return;
    }
  });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target && e.target.id === 'msgInput') {
      const btn = document.querySelector('.pp-send-msg');
      if (btn) btn.click();
    }
  });
})(window);
