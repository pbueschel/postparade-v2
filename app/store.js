/* PostParade v2 persistence (PPStore) — a localStorage overlay on the immutable
 * PPData seed. The seed never mutates; everything a user does persists as a
 * delta under one versioned key. Stage 2 swap: these methods become API calls
 * with the same shapes.
 *
 * What v2 stores that v1 did not:
 *   - submissions as a REQUEST/DECISION record: submittedAt, decidedAt, decidedBy,
 *     denialReason (from the track's standard list) + denialComment (free text),
 *     the jockey named at submission, AE/MTO designation, and whether the trainer
 *     overrode a flagged conflict.
 *   - an append-only AUDIT LOG — the same event stream rendered on all three
 *     ends (trainer, track, system/developer view), so a timestamp is never
 *     "the app's opinion" of when something happened.
 *   - messages between a stable and a track, persisted per thread.
 *   - saved entry-window watches, and the trainer's own roster edits.
 */
(function (global) {
  'use strict';

  const KEY = 'pp2.demo.v1';
  const blank = () => ({
    version: 1,
    submissions: [],        // live submissions (seeded ones live in PPData)
    seedPatches: {},        // status/decision edits applied to seeded submissions
    messages: [],
    watches: [],            // raceIds the trainer is watching
    createdHorses: [],
    removedHorseIds: [],
    readNotificationIds: [],
    audit: [],              // append-only event log
  });

  let state = blank();
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.version === 1) state = Object.assign(blank(), parsed);
    }
  } catch (e) { /* unavailable or corrupt storage — run in-memory */ }

  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* quota/private mode */ }
  }

  let seq = state.submissions.length + state.messages.length + state.audit.length;
  function newId(prefix) { return prefix + '-' + (++seq) + '-' + Math.random().toString(36).slice(2, 7); }
  function nowISO() { return new Date().toISOString(); }
  const D = () => global.PPData;

  /* ---- Audit log ---------------------------------------------------------
     One row per real event. `actor` is which end initiated it; every screen
     that shows a timestamp reads it from here or from the record itself — the
     trainer view, the track view, and the system view are the same data. */
  function logEvent(kind, actor, subject, detail) {
    const row = { id: newId('ev'), kind, actor, at: nowISO(), subject: subject || null, detail: detail || null };
    state.audit.push(row);
    save();
    return row;
  }

  /* Seeded submissions + live ones, with any status patch applied. */
  function allSubmissions() {
    const seeded = ((D() && D().seedSubmissions) || []).map((s) => {
      const patch = state.seedPatches[s.id];
      return patch ? Object.assign({}, s, patch) : s;
    });
    return seeded.concat(state.submissions);
  }

  function getSubmission(id) { return allSubmissions().find((s) => s.id === id) || null; }

  function listSubmissions(filter) {
    const f = filter || {};
    return allSubmissions().filter((s) => {
      if (f.raceId && s.raceId !== f.raceId) return false;
      if (f.horseId && s.horseId !== f.horseId) return false;
      if (f.status && s.status !== f.status) return false;
      if (f.stableId && stableOf(s) !== f.stableId) return false;
      if (f.trackId && trackOfSubmission(s) !== f.trackId) return false;
      return true;
    }).sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  }

  function stableOf(s) {
    if (s.stableId) return s.stableId;
    const h = D() && D().getHorse(s.horseId);
    return h ? h.stableId : null;
  }
  function trackOfSubmission(s) {
    const r = D() && D().getRace(s.raceId);
    return r ? D().trackOfRace(r) : null;
  }

  /* Submit a horse to a race. `opts.jockeyId` is required by the UI (a jockey
     must be named to avoid double-booking); `opts.overrode` records that the
     trainer used Submit Anyway over a flagged conflict, and the conflicts are
     snapshotted so the track sees exactly what was flagged at submission time. */
  function submit(spec) {
    const dup = allSubmissions().find((s) => s.horseId === spec.horseId && s.raceId === spec.raceId &&
      s.status !== 'withdrawn' && s.status !== 'declined');
    if (dup) return { ok: false, reason: 'duplicate', submission: dup };
    const h = D() && D().getHorse(spec.horseId);
    const row = {
      id: newId('sub'),
      horseId: spec.horseId,
      raceId: spec.raceId,
      stableId: (h && h.stableId) || (D() && D().demoStable().id),
      jockeyId: spec.jockeyId || null,
      aeMto: spec.aeMto || null,
      equipmentNote: spec.equipmentNote || '',
      note: spec.note || '',
      overrode: !!spec.overrode,
      conflictsAtSubmit: spec.conflictsAtSubmit || [],
      status: 'pending',
      submittedAt: nowISO(),
      decidedAt: null, decidedBy: null,
      denialReason: null, denialComment: null,
      source: 'live',
    };
    state.submissions.push(row);
    save();
    logEvent('submission.created', 'trainer', row.id,
      `${(h && h.name) || spec.horseId} → ${spec.raceId}${row.overrode ? ' (submitted over a flagged conflict)' : ''}`);
    return { ok: true, submission: row };
  }

  function patchSubmission(id, patch) {
    const live = state.submissions.find((s) => s.id === id);
    if (live) { Object.assign(live, patch); save(); return live; }
    const seeded = ((D() && D().seedSubmissions) || []).find((s) => s.id === id);
    if (!seeded) return null;
    state.seedPatches[id] = Object.assign({}, state.seedPatches[id], patch);
    save();
    return Object.assign({}, seeded, state.seedPatches[id]);
  }

  /* Track accepts a submission. */
  function accept(id, by) {
    const row = patchSubmission(id, { status: 'accepted', decidedAt: nowISO(),
      decidedBy: by || 'racing office', denialReason: null, denialComment: null });
    if (row) {
      const h = D() && D().getHorse(row.horseId);
      logEvent('submission.accepted', 'track', id, `${(h && h.name) || row.horseId} accepted into ${row.raceId}`);
    }
    return row;
  }

  /* Track declines a submission — a standard reason code plus optional free
     text. Both are stored; the trainer sees both. */
  function decline(id, reasonCode, comment, by) {
    const row = patchSubmission(id, { status: 'declined', decidedAt: nowISO(),
      decidedBy: by || 'racing office', denialReason: reasonCode || 'other',
      denialComment: comment || '' });
    if (row) {
      const h = D() && D().getHorse(row.horseId);
      logEvent('submission.declined', 'track', id,
        `${(h && h.name) || row.horseId} declined for ${row.raceId} — ${reasonCode || 'other'}`);
    }
    return row;
  }

  function withdraw(id) {
    const row = patchSubmission(id, { status: 'withdrawn', decidedAt: nowISO(), decidedBy: 'trainer' });
    if (row) logEvent('submission.withdrawn', 'trainer', id, `${row.horseId} withdrawn from ${row.raceId}`);
    return row;
  }

  /* ---- Entries + spots ---------------------------------------------------
     Seeded entries plus accepted submissions, deduped per horse. This is the
     one join every "openings left / spots filled" number comes from. */
  function entriesForRace(raceId) {
    const byHorse = new Map();
    ((D() && D().entriesForRace(raceId)) || []).forEach((e) => {
      byHorse.set(e.horseId, Object.assign({}, e, { source: 'seed' }));
    });
    listSubmissions({ raceId, status: 'accepted' }).forEach((s) => {
      if (byHorse.has(s.horseId)) return;
      byHorse.set(s.horseId, { raceId, horseId: s.horseId, jockeyId: s.jockeyId,
        aeMto: s.aeMto, source: 'submission', ref: s.id });
    });
    return Array.from(byHorse.values());
  }

  /* Spot arithmetic for a race — visible to BOTH sides, identically. */
  function spotsFor(raceId) {
    const race = D() && D().getRace(raceId);
    if (!race) return { spots: 0, filled: 0, open: 0, ae: 0, aeCap: 0, pending: 0, full: false };
    const all = entriesForRace(raceId);
    const ae = all.filter((e) => e.aeMto === 'AE').length;
    const inBody = all.length - ae;
    const pending = listSubmissions({ raceId, status: 'pending' }).length;
    return {
      spots: race.spots,
      filled: Math.min(inBody, race.spots),
      open: Math.max(0, race.spots - inBody),
      ae, aeCap: race.alsoEligibleCap || 0,
      pending,
      full: inBody >= race.spots,
    };
  }

  /* ---- Messages ---------------------------------------------------------- */
  function threadId(stableId, trackId) { return `${stableId}::${trackId}`; }

  function messages(stableId, trackId) {
    const tid = threadId(stableId, trackId);
    return ((D() && D().seedMessages) || []).filter((m) => m.threadId === tid)
      .concat(state.messages.filter((m) => m.threadId === tid))
      .sort((a, b) => (a.at || '').localeCompare(b.at || ''));
  }

  function threads(stableId) {
    const tracks = (D() && D().pairedTracks()) || [];
    return tracks.map((t) => {
      const msgs = messages(stableId, t.id);
      return { trackId: t.id, trackName: t.name, id: threadId(stableId, t.id),
        messages: msgs, last: msgs[msgs.length - 1] || null };
    }).sort((a, b) => ((b.last && b.last.at) || '').localeCompare((a.last && a.last.at) || ''));
  }

  function sendMessage(stableId, trackId, from, body, authorName) {
    const row = { id: newId('msg'), threadId: threadId(stableId, trackId), from,
      authorName: authorName || (from === 'track' ? 'Racing office' : 'Trainer'),
      body: String(body || '').trim(), at: nowISO() };
    if (!row.body) return null;
    state.messages.push(row);
    save();
    logEvent('message.sent', from, row.id, `${from} → ${trackId}: ${row.body.slice(0, 60)}`);
    return row;
  }

  /* ---- Entry-window watches --------------------------------------------- */
  function isWatched(raceId) { return state.watches.indexOf(raceId) !== -1; }
  function toggleWatch(raceId) {
    const i = state.watches.indexOf(raceId);
    if (i === -1) state.watches.push(raceId); else state.watches.splice(i, 1);
    save();
    logEvent(i === -1 ? 'watch.added' : 'watch.removed', 'trainer', raceId, null);
    return isWatched(raceId);
  }
  function watches() { return state.watches.slice(); }

  /* ---- The trainer's roster (add / remove) ------------------------------- */
  function rosterFor(stableId) {
    const seeded = ((D() && D().listHorses({ stableId })) || [])
      .filter((h) => state.removedHorseIds.indexOf(h.id) === -1);
    return seeded.concat(state.createdHorses.filter((h) => h.stableId === stableId));
  }

  function addHorse(spec) {
    const id = newId('horse');
    const stable = (D() && D().getStable(spec.stableId)) || {};
    const yearNow = +String((D() && D().today) || '').slice(0, 4) || new Date().getFullYear();
    const horse = Object.assign({
      sex: 'F', foaled: yearNow - 3, color: 'Bay', bred: 'KY',
      sire: '', dam: '', damSire: '', owner: stable.name || '', breeder: '',
      registry: 'Jockey Club',
      record: { starts: 0, wins: 0, seconds: 0, thirds: 0, earnings: 0 },
      careerWins: 0, winsOtherThanMdnClmStarter: 0, lastRanForPrice: null,
      firstTimeStarter: true, pps: [], startsByTrack: {},
      vetList: { listed: false }, medication: { lasix: false },
      equipment: { blinkers: 'off', declared: false }, nominated: [],
      icon: 'rabbit', tint: 'emerald',
    }, spec, { id });
    horse.age = yearNow - horse.foaled;
    horse.sexLabel = ((D() && D().sexLabels) || {})[horse.sex] || horse.sex;
    horse.maiden = (horse.careerWins || 0) === 0;
    horse.stable = stable.name;
    horse.trainer = stable.trainer;
    horse.lastStart = null;
    horse.lastStartDate = null;
    state.createdHorses.push(horse);
    save();
    logEvent('horse.added', 'trainer', id, `${horse.name} added to ${stable.name || spec.stableId}`);
    return horse;
  }

  function getCreatedHorse(id) { return state.createdHorses.find((h) => h.id === id) || null; }

  function removeHorse(id) {
    const h = (D() && D().getHorse(id)) || getCreatedHorse(id);
    const i = state.createdHorses.findIndex((x) => x.id === id);
    if (i >= 0) state.createdHorses.splice(i, 1);
    else if (state.removedHorseIds.indexOf(id) === -1) state.removedHorseIds.push(id);
    save();
    logEvent('horse.removed', 'trainer', id, `${(h && h.name) || id} removed from the roster`);
    return true;
  }

  /* Any horse, seeded or user-added. */
  function horseFor(id) {
    return (D() && D().getHorse(id)) || getCreatedHorse(id) || null;
  }

  /* ---- Horse status (drives the dashboard's three-way filter) ------------
     entered    — accepted by a track, in the body of a race (or on the AE list)
     placement  — submitted, awaiting the track's decision
     active     — in training, nothing pending
     Facts about workflow state. No performance judgement anywhere. */
  function statusOf(horseId) {
    const subs = listSubmissions({ horseId });
    if (subs.some((s) => s.status === 'accepted')) return 'entered';
    if (subs.some((s) => s.status === 'pending')) return 'placement';
    return 'active';
  }

  function statusCounts(stableId) {
    const roster = rosterFor(stableId);
    const counts = { all: roster.length, active: 0, placement: 0, entered: 0 };
    roster.forEach((h) => { counts[statusOf(h.id)]++; });
    return counts;
  }

  /* ---- Notifications ---------------------------------------------------- */
  function notifications() {
    return ((D() && D().notifications) || []).map((n) => Object.assign({}, n, {
      read: state.readNotificationIds.indexOf(n.id) !== -1,
    })).sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }
  function markNotificationRead(id) {
    if (state.readNotificationIds.indexOf(id) === -1) state.readNotificationIds.push(id);
    save();
  }

  /* ---- Audit / system view ---------------------------------------------- */
  function auditLog() {
    // Seeded submissions carry their own timestamps; project them into the same
    // event stream so the system view is complete from first load.
    const seeded = [];
    ((D() && D().seedSubmissions) || []).forEach((s) => {
      const h = (D() && D().getHorse(s.horseId)) || {};
      seeded.push({ id: s.id + '-c', kind: 'submission.created', actor: 'trainer',
        at: s.submittedAt, subject: s.id, detail: `${h.name || s.horseId} → ${s.raceId}` });
      if (s.decidedAt) {
        seeded.push({ id: s.id + '-d', kind: 'submission.' + s.status, actor: 'track',
          at: s.decidedAt, subject: s.id,
          detail: `${h.name || s.horseId} ${s.status} for ${s.raceId}` +
            (s.denialReason ? ` — ${s.denialReason}` : '') });
      }
    });
    ((D() && D().seedMessages) || []).forEach((m) => {
      seeded.push({ id: m.id + '-e', kind: 'message.sent', actor: m.from, at: m.at,
        subject: m.id, detail: `${m.authorName}: ${m.body.slice(0, 60)}` });
    });
    ((D() && D().notifications) || []).forEach((n) => {
      seeded.push({ id: n.id + '-e', kind: 'notification.' + n.kind, actor: 'track',
        at: n.at, subject: n.id, detail: n.title });
    });
    return seeded.concat(state.audit)
      .filter((e) => e.at)
      .sort((a, b) => (b.at || '').localeCompare(a.at || ''));
  }

  function reset() {
    try { localStorage.removeItem(KEY); } catch (e) {}
    if (global.location) global.location.reload();
    else state = blank();
  }

  global.PPStore = {
    // submissions
    submit, accept, decline, withdraw, listSubmissions, getSubmission, allSubmissions,
    stableOf, trackOfSubmission,
    // entries + spots
    entriesForRace, spotsFor,
    // messaging
    messages, threads, sendMessage, threadId,
    // watches
    isWatched, toggleWatch, watches,
    // roster
    rosterFor, addHorse, removeHorse, horseFor, getCreatedHorse,
    // status
    statusOf, statusCounts,
    // notifications + audit
    notifications, markNotificationRead, auditLog, logEvent,
    reset,
    _debug: () => JSON.parse(JSON.stringify(state)),
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.PPStore;
})(typeof window !== 'undefined' ? window : globalThis);
