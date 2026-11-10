// Mistakes deck (spaced review) and the essay Error Log.
import { h, show, fmtDate } from './ui.js';
import { state, dueMistakes, reviewMistake, markDay } from './store.js';
import { data } from './data.js';
import { renderQuestion } from './questions.js';

const lessonTitle = id => (data.lessons.find(l => l.id === id) || {}).title || '';

export function reviewHome() {
  const due = dueMistakes();
  const later = state.mistakes.filter(m => m.due > Date.now()).sort((a, b) => a.due - b.due);
  show('Mistakes', h('div', { class: 'stack' },
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, due.length), h('span', {}, 'due for review now')),
      h('div', { class: 'stat' }, h('b', {}, state.mistakes.length), h('span', {}, 'in the deck'))),
    due.length
      ? h('a', { class: 'btn primary wide', href: '#/review/run' }, `Review ${due.length} now`)
      : h('p', { class: 'muted center' }, state.mistakes.length ? 'Nothing due right now.' : 'Empty. Wrong drill answers and essay errors appear here.'),
    h('p', { class: 'muted small' }, `A mistake returns after 1 day, then after 3 more days. Answer it right both times and it leaves the deck (${state.retired || 0} cleared so far).`),
    h('a', { class: 'card item', href: '#/errors' }, h('span', {}, 'Essay Error Log'), h('span', { class: 'tag' }, state.errorLog.length)),
    later.length ? h('div', { class: 'card' }, h('h2', {}, 'Coming up'),
      h('div', { class: 'list' }, later.slice(0, 30).map(m => h('div', { class: 'row between' },
        h('span', { class: 'grow small' }, m.kind === 'drill' ? m.q.q : `“${m.quote}”`),
        h('span', { class: 'muted small num' }, fmtDate(m.due)))))) : null
  ));
}

export function reviewRun() {
  const queue = dueMistakes();
  const root = h('div', { class: 'stack' });
  let n = 0, right = 0;

  function step() {
    if (n >= queue.length) {
      if (queue.length) markDay();
      root.replaceChildren(
        h('div', { class: 'card center' }, h('div', { class: 'big' }, `${right} / ${queue.length}`), h('p', { class: 'muted' }, 'reviewed correctly')),
        h('a', { class: 'btn primary wide', href: '#/review' }, 'Done'));
      return;
    }
    const m = queue[n];
    const head = h('div', { class: 'row between small muted' },
      h('span', {}, `${n + 1} of ${queue.length}`),
      h('span', {}, m.kind === 'drill' ? lessonTitle(m.lesson) : 'From your essay'));
    const grade = ok => { reviewMistake(m.key, ok); if (ok) right++; n++; step(); };

    if (m.kind === 'drill') {
      let result = null;
      const next = h('button', { class: 'btn primary wide', disabled: true, onclick: () => grade(result) }, 'Next');
      root.replaceChildren(head, h('div', { class: 'card' }, renderQuestion(m.q, {
        onAnswer: ok => { result = ok; next.disabled = false; }, onOverride: () => { result = true; }
      })), next);
    } else {
      const reveal = h('div', { class: 'stack', hidden: true },
        h('div', { class: 'fb ok' }, h('b', {}, m.correction), h('span', { class: 'ex' }, [m.rule, m.note].filter(Boolean).join(' — '))),
        h('div', { class: 'row' },
          h('button', { class: 'btn grow', onclick: () => grade(false) }, 'I missed it'),
          h('button', { class: 'btn primary grow', onclick: () => grade(true) }, 'I got it')));
      const showBtn = h('button', { class: 'btn primary wide', onclick: () => { reveal.hidden = false; showBtn.hidden = true; } }, 'Show correction');
      root.replaceChildren(head, h('div', { class: 'card q' },
        h('div', { class: 'qtype' }, 'Correct your own sentence'),
        h('p', { class: 'qtext' }, `“${m.quote}”`),
        h('p', { class: 'hint' }, 'Say or write the corrected version, then check.'),
        showBtn, reveal));
    }
    window.scrollTo(0, 0);
  }

  show('Review', root, '#/review');
  step();
}

export function errorLog() {
  const groups = {};
  for (const e of state.errorLog) (groups[e.rule || 'Other'] = groups[e.rule || 'Other'] || []).push(e);
  const sorted = Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  show('Error Log', h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, 'Grammar errors found in your marked essays, grouped by rule. The biggest group is your next lesson.'),
    sorted.length ? sorted.map(([rule, items]) => h('details', { class: 'card' },
      h('summary', {}, h('span', { class: 'grow' }, rule), h('span', { class: 'tag' }, items.length)),
      h('div', { class: 'list' }, items.slice().reverse().map(e => h('div', { class: 'err' },
        h('div', { class: 'quote' }, `“${e.quote}”`), h('div', { class: 'fix' }, e.correction),
        h('div', { class: 'muted small' }, [e.note, fmtDate(e.date)].filter(Boolean).join(' · ')))))))
      : h('p', { class: 'muted center' }, 'No errors logged yet. Submit an essay for marking to start the log.')
  ), '#/review');
}
