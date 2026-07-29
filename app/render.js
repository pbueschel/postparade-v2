/* Shared render helpers (classic script — top-level declarations are
   intentionally global; the screens modules and the app shell consume them).

   Deliberately absent from v2: score rings, fit meters, win-rate tiles,
   draw-in probability chips, and anything else that renders a prediction or a
   statistic about a future or past result. If a helper here shows a number, the
   number is a fact (a purse, a count of spots, a timestamp). */

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function fmtMoney(n) { return '$' + Math.round(+n || 0).toLocaleString(); }

function fmtDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function fmtDateFull(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

/* Absolute timestamp — the audit-grade form used everywhere a submission or a
   decision is shown. Same string on the trainer, track, and system views. */
function fmtStamp(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

/* Relative form, only ever shown NEXT TO the absolute stamp, never instead. */
function fmtAgo(iso) {
  if (!iso) return '';
  const ms = Date.now() - new Date(iso).getTime();
  const mins = Math.round(ms / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return mins + 'm ago';
  const hrs = Math.round(mins / 60);
  if (hrs < 48) return hrs + 'h ago';
  return Math.round(hrs / 24) + 'd ago';
}

function hoursUntil(iso) {
  const now = new Date((window.PPData && PPData.today) || Date.now());
  return (new Date(iso) - now) / 3600000;
}

function fmtCountdown(iso) {
  const h = hoursUntil(iso);
  if (h <= 0) return 'closed';
  if (h < 1) return Math.round(h * 60) + ' min';
  if (h < 48) return Math.round(h) + 'h';
  return Math.round(h / 24) + ' days';
}

/* Distance display: Thoroughbred races in furlongs/miles, Quarter Horse races
   in yards (as the condition book quotes them). */
function fmtDistance(yards, registry) {
  const y = +yards || 0;
  if (registry === 'AQHA' || y < 660) return y + ' yards';
  const f = y / 220;
  const whole = Math.floor(f), frac = f - whole;
  if (y % 1760 === 0 && y >= 1760) return (y / 1760) + (y === 1760 ? ' mile' : ' miles');
  if (frac > 0.4 && frac < 0.6) return whole + '½ furlongs';
  return (Math.round(f * 10) / 10) + ' furlongs';
}

const SURFACE_LABEL = { D: 'Dirt', T: 'Turf', S: 'Synthetic' };
function surfaceLabel(code) { return SURFACE_LABEL[code] || code || ''; }

function pill(text, cls = 'bg-slate-100 text-slate-600', icon = '') {
  const i = icon ? `<i data-lucide="${icon}" class="w-3 h-3"></i>` : '';
  return `<span class="pill ${cls}">${i}${text}</span>`;
}

function surfacePill(code) {
  if (code === 'T') return pill('Turf', 'bg-emerald-50 text-emerald-700', 'leaf');
  if (code === 'S') return pill('Synthetic', 'bg-sky-50 text-sky-700', 'circle-dot');
  return pill('Dirt', 'bg-amber-50 text-amber-800', 'mountain');
}

function registryPill(registry) {
  if (registry === 'AQHA') return pill('Quarter Horse', 'bg-amber-50 text-amber-700', 'flag');
  return pill('Thoroughbred', 'bg-slate-100 text-slate-600', 'flag');
}

/* Workflow-status pill for a horse or a submission. */
const STATUS_META = {
  active:     { label: 'Active',    cls: 'bg-slate-100 text-slate-700',   icon: 'circle' },
  placement:  { label: 'Placement requested', cls: 'bg-amber-50 text-amber-700', icon: 'clock' },
  entered:    { label: 'Entered',   cls: 'bg-emerald-50 text-emerald-700', icon: 'check-circle-2' },
  pending:    { label: 'Awaiting track', cls: 'bg-amber-50 text-amber-700', icon: 'clock' },
  accepted:   { label: 'Accepted',  cls: 'bg-emerald-50 text-emerald-700', icon: 'check-circle-2' },
  declined:   { label: 'Declined',  cls: 'bg-red-50 text-red-700',        icon: 'x-circle' },
  withdrawn:  { label: 'Withdrawn', cls: 'bg-slate-100 text-slate-500',   icon: 'undo-2' },
};
function statusPill(key) {
  const m = STATUS_META[key] || STATUS_META.active;
  return pill(m.label, m.cls, m.icon);
}
function statusLabel(key) { return (STATUS_META[key] || STATUS_META.active).label; }

/* Entry-close countdown pill — colour ramps as the window closes. */
function closePill(iso) {
  const h = hoursUntil(iso);
  if (h <= 0) return pill('Entries closed', 'bg-slate-100 text-slate-500', 'lock');
  if (h < 24) return pill('Closes in ' + fmtCountdown(iso), 'bg-red-50 text-red-700', 'alarm-clock');
  if (h < 72) return pill('Closes in ' + fmtCountdown(iso), 'bg-amber-50 text-amber-700', 'clock');
  return pill('Closes in ' + fmtCountdown(iso), 'bg-slate-100 text-slate-600', 'clock');
}

/* Spots: openings left vs spots filled. Both sides see this identically. */
function spotsBar(s) {
  const pct = s.spots ? Math.min(100, Math.round(s.filled / s.spots * 100)) : 0;
  const bar = s.full ? 'bg-slate-400' : s.open <= 2 ? 'bg-amber-500' : 'bg-emerald-500';
  return `
    <div class="min-w-[9rem]">
      <div class="flex items-center justify-between text-[11px] mb-1">
        <span class="font-medium text-ink-900">${s.filled} of ${s.spots} spots</span>
        <span class="${s.full ? 'text-slate-500' : 'text-emerald-700'}">${s.full ? 'No openings' : s.open + ' open'}</span>
      </div>
      <div class="h-1.5 rounded-full bg-slate-100 overflow-hidden"><div class="h-full ${bar}" style="width:${pct}%"></div></div>
      ${s.ae || s.pending ? `<div class="text-[10px] text-ink-500 mt-1">${s.ae ? s.ae + ' also-eligible · ' : ''}${s.pending ? s.pending + ' awaiting review' : ''}</div>` : ''}
    </div>`;
}

/* Per-horse identity icon — every horse profile has its own. */
const TINT_CLASSES = {
  emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
  indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
  amber: 'bg-amber-50 text-amber-600 border-amber-100',
  rose: 'bg-rose-50 text-rose-600 border-rose-100',
  sky: 'bg-sky-50 text-sky-600 border-sky-100',
  violet: 'bg-violet-50 text-violet-600 border-violet-100',
  teal: 'bg-teal-50 text-teal-600 border-teal-100',
  orange: 'bg-orange-50 text-orange-600 border-orange-100',
};
function horseIcon(h, size = 'md') {
  if (!h) return '';
  const cls = TINT_CLASSES[h.tint] || TINT_CLASSES.emerald;
  const dim = size === 'lg' ? 'w-12 h-12' : size === 'sm' ? 'w-7 h-7' : 'w-9 h-9';
  const ic = size === 'lg' ? 'w-6 h-6' : size === 'sm' ? 'w-3.5 h-3.5' : 'w-4 h-4';
  return `<span class="${dim} shrink-0 rounded-xl border ${cls} flex items-center justify-center" title="${esc(h.name)}">
    <i data-lucide="${esc(h.icon || 'rabbit')}" class="${ic}"></i></span>`;
}

/* The horse name is the link — underlined, always clickable, on every row.
   (v1 hid this behind a hover affordance that did not fire on placed horses.) */
function horseLink(h, extraCls = '') {
  if (!h) return '';
  return `<a href="#horse/${esc(h.id)}" class="horse-link font-medium text-ink-900 underline decoration-slate-300 decoration-1 underline-offset-2 hover:decoration-emerald-500 hover:text-emerald-700 ${extraCls}">${esc(h.name)}</a>`;
}

/* Conflict chip from a PPConditions.check() conflict. */
function conflictChip(c) {
  const hard = c.severity === 'hard';
  return `<span class="pill ${hard ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}" title="${esc(c.detail)}">
    <i data-lucide="${hard ? 'x-circle' : 'alert-triangle'}" class="w-3 h-3"></i>${esc(c.label)}</span>`;
}

function toast(msg, icon = 'check-circle-2') {
  let t = document.getElementById('pp-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'pp-toast';
    t.className = 'fixed bottom-5 left-1/2 -translate-x-1/2 z-[80] px-4 py-2.5 rounded-lg bg-ink-900 text-white text-sm shadow-lg flex items-center gap-2 transition-opacity duration-300';
    document.body.appendChild(t);
  }
  t.innerHTML = `<i data-lucide="${icon}" class="w-4 h-4 text-emerald-300"></i><span>${esc(msg)}</span>`;
  t.style.opacity = '1';
  if (window.lucide) lucide.createIcons();
  clearTimeout(t._timer);
  t._timer = setTimeout(() => { t.style.opacity = '0'; }, 3000);
}

/* Modal host — used by the submission form and the decline form. */
function openModal(html) {
  let host = document.getElementById('pp-modal');
  if (!host) {
    host = document.createElement('div');
    host.id = 'pp-modal';
    host.className = 'fixed inset-0 z-[70] hidden';
    document.body.appendChild(host);
  }
  host.innerHTML = `
    <div class="absolute inset-0 bg-ink-900/40" data-modal-close></div>
    <div class="relative mx-auto my-8 w-[min(38rem,92vw)] max-h-[86vh] overflow-y-auto scrollbar-thin card ring-soft p-5">${html}</div>`;
  host.classList.remove('hidden');
  if (window.lucide) lucide.createIcons();
}
function closeModal() {
  const host = document.getElementById('pp-modal');
  if (host) { host.classList.add('hidden'); host.innerHTML = ''; }
}

function emptyState(icon, title, body) {
  return `<div class="card ring-soft p-8 text-center">
    <i data-lucide="${icon}" class="w-6 h-6 mx-auto text-slate-300"></i>
    <div class="mt-2 font-medium text-ink-900">${esc(title)}</div>
    <div class="text-sm text-ink-500 mt-1">${esc(body)}</div>
  </div>`;
}

function paint(id, html) { const n = document.getElementById(id); if (n) n.innerHTML = html; }

/* Screen renderer registry: screens modules register under the section id; the
   router invokes on every navigation so screens always reflect live state. */
window.PPRenderers = window.PPRenderers || {};
