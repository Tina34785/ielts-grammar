// Module 1 (lessons + quick check) and Module 2 (drills).
import { h, show, rich, shuffle, pct, toast } from './ui.js';
import { state, save, markDay, addMistake } from './store.js';
import { data } from './data.js';
import { renderQuestion, answerText } from './questions.js';

const rec = id => (state.lessons[id] = state.lessons[id] || { quick: false, attempts: [] });
export function lessonStats(id) {
  const a = (state.lessons[id] || {}).attempts || [];
  const score = a.reduce((s, x) => s + x.score, 0), total = a.reduce((s, x) => s + x.total, 0);
  return { attempts: a.length, overall: total ? pct(score, total) : null, last: a.length ? pct(a[a.length - 1].score, a[a.length - 1].total) : null };
}

export function lessonList() {
  const cards = data.lessons.map(l => {
    const st = lessonStats(l.id), r = state.lessons[l.id] || {};
    return h('a', { class: 'card', href: '#/lesson/' + l.id },
      h('div', { class: 'row between' },
        h('h2', { class: 'grow' }, `${l.id}. ${l.title}`),
        st.attempts ? h('span', { class: 'tag ok' }, `Drill ${st.last}%`) : r.quick ? h('span', { class: 'tag' }, 'Drill unlocked') : null),
      h('p', { class: 'muted small' }, l.short));
  });
  show('Lessons', h('div', { class: 'stack' }, cards));
}

export function lessonView(id) {
  const l = data.lessons.find(x => String(x.id) === String(id));
  if (!l) return show('Lesson', h('p', {}, 'Lesson not found.'), '#/lessons');
  const r = rec(l.id);

  const rule = h('div', { class: 'card rule' });
  for (const sec of l.rule) {
    rule.append(h('h3', {}, sec.h));
    let ul = null;
    for (const line of sec.items) {
      if (line.startsWith('• ')) {
        if (!ul) { ul = h('ul', {}); rule.append(ul); }
        ul.append(h('li', { html: rich(line.slice(2)) }));
      } else { ul = null; rule.append(h('p', { html: rich(line) })); }
    }
  }

  const pairs = h('div', { class: 'card stack' }, h('h2', {}, 'Typical mistakes → corrections'),
    l.pairs.map(p => h('div', { class: 'pair' },
      h('div', { class: 'w' }, p.w), h('div', { class: 'r' }, p.r), p.n && h('div', { class: 'n' }, p.n))));

  const drillBtn = h('a', { class: 'btn primary wide', href: '#/drill/' + l.id }, 'Start the drill (20 questions)');
  const lock = h('p', { class: 'muted small center' }, 'Get at least 2 of 3 right to unlock the drill.');
  const check = h('div', { class: 'card stack' });

  function quick() {
    let n = 0, right = 0;
    const step = () => {
      if (n >= l.check.length) {
        const pass = right >= 2;
        if (pass && !r.quick) { r.quick = true; markDay(); save(); }
        check.replaceChildren(h('h2', {}, 'Quick check'),
          h('p', {}, `${right} / ${l.check.length} correct. `, pass ? 'Drill unlocked.' : 'Re-read the rule and try again.'),
          h('button', { class: 'btn', onclick: quick }, 'Try the quick check again'));
        unlock();
        return;
      }
      const next = h('button', { class: 'btn primary', disabled: true, onclick: () => { n++; step(); } }, n === l.check.length - 1 ? 'See result' : 'Next');
      check.replaceChildren(h('h2', {}, `Quick check · ${n + 1} of ${l.check.length}`),
        renderQuestion(l.check[n], { onAnswer: ok => { if (ok) right++; next.disabled = false; } }), next);
    };
    step();
  }
  function unlock() {
    drillBtn.hidden = !r.quick;
    lock.hidden = r.quick;
  }
  if (r.quick) check.append(h('h2', {}, 'Quick check'), h('p', { class: 'muted' }, 'Passed.'), h('button', { class: 'btn', onclick: quick }, 'Do it again'));
  else quick();
  unlock();

  show(`Lesson ${l.id}`, h('div', { class: 'stack' },
    h('div', {}, h('h2', {}, l.title), h('p', { class: 'muted small' }, `About ${l.minutes} minutes`)),
    rule, pairs, check, lock, drillBtn), '#/lessons');
}

export function drillView(id) {
  const l = data.lessons.find(x => String(x.id) === String(id));
  const bank = data.drills[id];
  if (!l || !bank) return show('Drill', h('p', {}, 'Drill not found.'), '#/lessons');
  if (!rec(l.id).quick) { toast('Pass the quick check first.'); location.hash = '#/lesson/' + l.id; return; }

  const order = shuffle(bank.map((q, i) => ({ q, i })));
  const root = h('div', { class: 'stack' });
  const wrong = [];
  let n = 0, score = 0;

  function step() {
    if (n >= order.length) return finish();
    const { q, i } = order[n];
    let result = null;
    const next = h('button', {
      class: 'btn primary wide', disabled: true, onclick: () => {
        if (result) score++;
        else { wrong.push(q); addMistake({ key: `d:${id}:${i}`, kind: 'drill', lesson: l.id, q }); }
        n++; step();
      }
    }, n === order.length - 1 ? 'Finish' : 'Next');
    root.replaceChildren(
      h('div', { class: 'row between small muted' }, h('span', {}, `Question ${n + 1} of ${order.length}`), h('span', {}, `${score} correct`)),
      h('div', { class: 'prog' }, h('i', { style: `width:${100 * n / order.length}%` })),
      h('div', { class: 'card' }, renderQuestion(q, {
        onAnswer: ok => { result = ok; next.disabled = false; next.scrollIntoView({ block: 'nearest' }); },
        onOverride: () => { result = true; }
      })),
      next);
    window.scrollTo(0, 0);
  }

  function finish() {
    rec(l.id).attempts.push({ date: Date.now(), score, total: order.length });
    markDay(); save();
    root.replaceChildren(
      h('div', { class: 'card center' }, h('div', { class: 'big' }, `${score} / ${order.length}`), h('p', { class: 'muted' }, `${pct(score, order.length)}% · ${l.title}`)),
      wrong.length
        ? h('div', { class: 'card stack' }, h('h2', {}, `${wrong.length} added to your Mistakes deck`),
          h('p', { class: 'muted small' }, 'They come back for review tomorrow, then again three days later.'),
          h('div', { class: 'list' }, wrong.map(q => h('div', {}, h('div', {}, q.q), h('div', { class: 'small' }, h('b', {}, answerText(q))), h('div', { class: 'muted small' }, q.e)))))
        : h('p', { class: 'center' }, 'No mistakes this time.'),
      h('button', { class: 'btn wide', onclick: () => drillView(id) }, 'Do this drill again'),
      h('a', { class: 'btn primary wide', href: '#/lessons' }, 'Back to lessons'));
    window.scrollTo(0, 0);
  }

  show(`Drill ${l.id}`, root, '#/lesson/' + l.id);
  step();
}
