/* System / app-developer screens.
 *
 * The third end of the timestamp requirement: the trainer sees when they
 * submitted, the track sees when it decided, and this view shows the same events
 * as the raw record the application actually stored — one append-only stream,
 * plus the submission table with every field.
 */
(function (global) {
  'use strict';

  const R = global.PPRenderers = global.PPRenderers || {};
  const horseFor = (id) => PPStore.horseFor(id);

  let logActor = 'all';

  const KIND_META = {
    'submission.created': ['send', 'text-emerald-600'],
    'submission.accepted': ['check-circle-2', 'text-emerald-600'],
    'submission.declined': ['x-circle', 'text-red-600'],
    'submission.withdrawn': ['undo-2', 'text-slate-400'],
    'message.sent': ['messages-square', 'text-indigo-500'],
    'watch.added': ['bell-ring', 'text-amber-500'],
    'watch.removed': ['bell-off', 'text-slate-400'],
    'horse.added': ['plus-circle', 'text-emerald-600'],
    'horse.removed': ['trash-2', 'text-red-500'],
    'overnight.published': ['file-text', 'text-indigo-500'],
    'notification.overnight': ['file-text', 'text-indigo-500'],
    'notification.extra': ['plus-circle', 'text-violet-500'],
    'notification.book': ['book-open', 'text-indigo-500'],
  };

  R['system/log'] = function () {
    const all = PPStore.auditLog();
    const rows = all.filter((e) => logActor === 'all' || e.actor === logActor);
    const counts = all.reduce((m, e) => { m[e.actor] = (m[e.actor] || 0) + 1; return m; }, {});

    document.getElementById('system/log').innerHTML = `
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="text-2xl font-semibold tracking-tight">Activity log</h1>
          <div class="text-sm text-ink-500">Every event the application recorded, newest first, with the timestamp it was written.
            The trainer view, the track view, and this view read the same rows.</div>
        </div>
        <div class="flex items-center gap-2">
          <label class="text-xs text-ink-500" for="logActor">Actor</label>
          <select id="logActor" class="pp-log-actor text-sm rounded-lg border border-slate-200 px-2.5 py-1.5 bg-white">
            <option value="all" ${logActor === 'all' ? 'selected' : ''}>All (${all.length})</option>
            <option value="trainer" ${logActor === 'trainer' ? 'selected' : ''}>Trainer (${counts.trainer || 0})</option>
            <option value="track" ${logActor === 'track' ? 'selected' : ''}>Track (${counts.track || 0})</option>
          </select>
        </div>
      </div>

      <div class="card ring-soft overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500"><tr>
            <th class="text-left font-medium px-5 py-2">Timestamp (UTC)</th>
            <th class="text-left font-medium px-3 py-2">Local</th>
            <th class="text-left font-medium px-3 py-2">Actor</th>
            <th class="text-left font-medium px-3 py-2">Event</th>
            <th class="text-left font-medium px-5 py-2">Detail</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">
            ${rows.map((e) => {
              const [icon, cls] = KIND_META[e.kind] || ['dot', 'text-slate-400'];
              return `<tr class="row-hover">
                <td class="px-5 py-2.5 mono text-[11px] text-ink-600">${esc(e.at)}</td>
                <td class="px-3 py-2.5 text-xs">${esc(fmtStamp(e.at))}<div class="text-[10px] text-ink-400">${esc(fmtAgo(e.at))}</div></td>
                <td class="px-3 py-2.5">${pill(e.actor, e.actor === 'track' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700')}</td>
                <td class="px-3 py-2.5"><span class="inline-flex items-center gap-1.5 text-xs mono">
                  <i data-lucide="${icon}" class="w-3.5 h-3.5 ${cls}"></i>${esc(e.kind)}</span></td>
                <td class="px-5 py-2.5 text-xs text-ink-600">${esc(e.detail || '')}
                  ${e.subject ? `<div class="text-[10px] text-ink-400 mono">${esc(e.subject)}</div>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody></table></div>
      </div>`;
  };

  R['system/submissions'] = function () {
    const subs = PPStore.allSubmissions()
      .slice().sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
    document.getElementById('system/submissions').innerHTML = `
      <div>
        <h1 class="text-2xl font-semibold tracking-tight">Submission records</h1>
        <div class="text-sm text-ink-500">The stored record behind every submission — the shape a real API would return.
          Three timestamps per record: submitted, decided, and (where a decline was recorded) the reason and comment.</div>
      </div>
      <div class="card ring-soft overflow-hidden">
        <div class="overflow-x-auto"><table class="w-full text-sm">
          <thead class="bg-slate-50 text-[11px] uppercase tracking-wide text-ink-500"><tr>
            <th class="text-left font-medium px-5 py-2">id</th>
            <th class="text-left font-medium px-3 py-2">horse</th>
            <th class="text-left font-medium px-3 py-2">race</th>
            <th class="text-left font-medium px-3 py-2">jockey</th>
            <th class="text-left font-medium px-3 py-2">AE/MTO</th>
            <th class="text-left font-medium px-3 py-2">status</th>
            <th class="text-left font-medium px-3 py-2">submittedAt</th>
            <th class="text-left font-medium px-3 py-2">decidedAt</th>
            <th class="text-left font-medium px-5 py-2">denial</th>
          </tr></thead>
          <tbody class="divide-y divide-slate-50">
            ${subs.map((s) => {
              const h = horseFor(s.horseId), j = PPData.getJockey(s.jockeyId);
              const reason = s.denialReason && PPData.getDenialReason(s.denialReason);
              return `<tr class="row-hover align-top">
                <td class="px-5 py-2.5 mono text-[11px] text-ink-500">${esc(s.id)}</td>
                <td class="px-3 py-2.5">${h ? horseLink(h) : esc(s.horseId)}</td>
                <td class="px-3 py-2.5 mono text-[11px]"><a href="#race/${esc(s.raceId)}" class="hover:underline">${esc(s.raceId)}</a></td>
                <td class="px-3 py-2.5 text-xs">${j ? esc(j.name) : '<span class="text-red-600">null</span>'}</td>
                <td class="px-3 py-2.5 text-xs mono">${esc(s.aeMto || '—')}</td>
                <td class="px-3 py-2.5">${statusPill(s.status)}${s.overrode ? '<div class="mt-1">' + pill('override', 'bg-amber-50 text-amber-700') + '</div>' : ''}</td>
                <td class="px-3 py-2.5 mono text-[11px]">${esc(s.submittedAt || '—')}</td>
                <td class="px-3 py-2.5 mono text-[11px]">${esc(s.decidedAt || '—')}<div class="text-[10px] text-ink-400">${esc(s.decidedBy || '')}</div></td>
                <td class="px-5 py-2.5 text-xs">${reason ? esc(reason.code) : '—'}
                  ${s.denialComment ? `<div class="text-[11px] text-ink-500 italic">“${esc(s.denialComment)}”</div>` : ''}</td>
              </tr>`;
            }).join('')}
          </tbody></table></div>
      </div>
      <div class="card ring-soft p-5">
        <div class="font-semibold">Conflicts captured at submission</div>
        <div class="text-xs text-ink-500">When a trainer submits over a flagged conflict, the flags are snapshotted on the record so the office reviews what was actually shown.</div>
        <div class="mt-3 space-y-2">
          ${subs.filter((s) => (s.conflictsAtSubmit || []).length).map((s) => `
            <div class="text-xs">
              <span class="mono text-ink-500">${esc(s.id)}</span> —
              ${(s.conflictsAtSubmit || []).map((c) => esc(c.code + ' (' + c.severity + ')')).join(', ')}
            </div>`).join('') || '<div class="text-sm text-ink-500">No overridden submissions recorded yet.</div>'}
        </div>
      </div>`;
  };

  document.addEventListener('change', function (e) {
    if (e.target.classList.contains('pp-log-actor')) { logActor = e.target.value; window.rerender(); }
  });
})(window);
