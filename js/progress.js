// Home / Progress screen: plain numbers and one trend line.
import { h, show, fmtDate, pct } from './ui.js';
import { state, streak, daysToExam, dueMistakes, needsExport } from './store.js';
import { data } from './data.js';
import { lessonStats } from './lessons.js';
import { doExport } from './settings.js';

const NS = 'http://www.w3.org/2000/svg';
function trend(values) {
  // Band trend, fixed 4.0-9.0 scale so the line means the same thing every time.
  const W = 320, H = 110, L = 26, R = 10, T = 10, B = 16, lo = 4, hi = 9;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`); svg.setAttribute('class', 'spark'); svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Overall band estimates over time: ' + values.join(', '));
  const add = (tag, attrs, text) => { const el = document.createElementNS(NS, tag); for (const k in attrs) el.setAttribute(k, attrs[k]); if (text != null) el.textContent = text; svg.append(el); };
  const y = v => T + (H - T - B) * (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo));
  const x = i => values.length === 1 ? (L + W - R) / 2 : L + (W - L - R) * i / (values.length - 1);
  [5, 6.5, 8].forEach(b => {
    add('line', { x1: L, x2: W - R, y1: y(b), y2: y(b), stroke: b === 6.5 ? 'var(--accent)' : 'var(--line)', 'stroke-width': 1, 'stroke-dasharray': b === 6.5 ? '4 3' : '' });
    add('text', { x: L - 5, y: y(b) + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' }, b);
  });
  if (values.length > 1) add('polyline', { points: values.map((v, i) => `${x(i)},${y(v)}`).join(' '), fill: 'none', stroke: 'var(--c2)', 'stroke-width': 2.4, 'stroke-linejoin': 'round' });
  values.forEach((v, i) => add('circle', { cx: x(i), cy: y(v), r: 3.5, fill: 'var(--c2)' }));
  return svg;
}

export function homeView() {
  const days = daysToExam(), due = dueMistakes().length, st = streak();
  const marked = state.essays.filter(e => e.status === 'marked');
  const pending = state.essays.length - marked.length;
  const next = data.lessons.find(l => !lessonStats(l.id).attempts);
  const bands = marked.map(e => e.result.overall);
  const readRows = data.reading.map((p, i) => ({ p, i, a: state.reading[p.id] || [] })).filter(r => r.a.length);

  show('IELTS Grammar Coach', h('div', { class: 'stack' },
    h('div', { class: 'card hero center' },
      h('b', {}, days > 0 ? days : days === 0 ? 'Today' : '—'),
      h('div', { class: 'muted' }, days > 0 ? `day${days === 1 ? '' : 's'} until your exam` : days === 0 ? 'is exam day. Good luck.' : 'exam date has passed'),
      h('div', { class: 'muted small' }, new Date(state.settings.examDate + 'T12:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) + ' · target 6.5')),

    needsExport() ? h('div', { class: 'notice stack tight' },
      h('span', {}, 'Weekly backup: iPhones can clear app storage without warning. Export your data now.'),
      h('button', { class: 'btn', onclick: () => doExport().then(homeView) }, 'Export backup')) : null,

    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, st), h('span', {}, `day streak · ${state.days.length} day${state.days.length === 1 ? '' : 's'} practised`)),
      h('div', { class: 'stat' }, h('b', {}, state.mistakes.length), h('span', {}, `in Mistakes deck · ${due} due now`)),
      h('div', { class: 'stat' }, h('b', {}, state.essays.length), h('span', {}, `essays written${pending ? ` · ${pending} pending` : ''}`)),
      h('div', { class: 'stat' }, h('b', {}, bands.length ? bands[bands.length - 1].toFixed(1) : '—'), h('span', {}, 'latest essay band (AI estimate)'))),

    h('div', { class: 'stack tight' },
      due ? h('a', { class: 'btn primary wide', href: '#/review/run' }, `Review ${due} due mistake${due === 1 ? '' : 's'}`) : null,
      next ? h('a', { class: 'btn wide', href: '#/lesson/' + next.id }, `Next lesson: ${next.title}`) : null),

    h('div', { class: 'card' }, h('h2', {}, 'Drill accuracy by lesson'),
      h('div', { class: 'list' }, data.lessons.map(l => {
        const s = lessonStats(l.id);
        return h('a', { class: 'item', href: '#/lesson/' + l.id },
          h('span', { class: 'grow small' }, `${l.id}. ${l.title}`),
          h('span', { class: 'num small ' + (s.attempts ? '' : 'muted') }, s.attempts ? `${s.overall}% · last ${s.last}% · ${s.attempts}×` : 'not started'));
      }))),

    h('div', { class: 'card stack tight' }, h('h2', {}, 'Essay band trend'),
      bands.length ? [trend(bands),
        h('p', { class: 'muted small' }, `${bands.length} marked essay${bands.length === 1 ? '' : 's'} · dashed line = your 6.5 target · AI estimates, not official scores`),
        h('div', { class: 'list' }, marked.slice(-5).reverse().map(e => h('a', { class: 'item', href: '#/essay/' + e.id },
          h('span', { class: 'small grow' }, `Task ${e.task} · ${fmtDate(e.created)}`), h('span', { class: 'num' }, e.result.overall.toFixed(1)))))]
        : h('p', { class: 'muted small' }, 'No marked essays yet.')),

    h('div', { class: 'card' }, h('h2', {}, 'Reading scores'),
      readRows.length ? h('div', { class: 'list' }, readRows.map(({ p, i, a }) => {
        const last = a[a.length - 1], best = Math.max(...a.map(x => x.score));
        return h('a', { class: 'item', href: '#/read/' + p.id }, h('span', { class: 'grow small' }, `${i + 1}. ${p.title}`),
          h('span', { class: 'num small' }, `${last.score}/${last.total} (${pct(last.score, last.total)}%)` + (a.length > 1 ? ` · best ${best}` : '')));
      })) : h('p', { class: 'muted small' }, 'No passages completed yet.')),

    h('p', { class: 'muted small center' }, `Version ${self.APP_VERSION}`)
  ));
}
