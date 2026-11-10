// Module 4: reading passages with a 12-minute timer.
import { h, show, toast, fmtTime, onLeave, pct, confirmBox, closeModal } from './ui.js';
import { state, save, markDay } from './store.js';
import { data } from './data.js';
import { isCorrect } from './questions.js';

const LIMIT = 12 * 60000;
const TFNG = [['T', 'True'], ['F', 'False'], ['NG', 'Not Given']];
const LABEL = { tfng: 'True / False / Not Given', mc: 'Multiple choice', gap: 'Complete the sentence (max. two words from the passage)' };

export function readList() {
  show('Reading', h('div', { class: 'stack' },
    h('p', { class: 'muted small' }, '8 passages · 12 minutes each · 6 questions'),
    data.reading.map((p, i) => {
      const a = state.reading[p.id] || [], last = a[a.length - 1];
      const running = state.readingRun && state.readingRun.id === p.id;
      return h('a', { class: 'card', href: '#/read/' + p.id },
        h('div', { class: 'row between' }, h('h2', { class: 'grow' }, `${i + 1}. ${p.title}`),
          running ? h('span', { class: 'tag warn' }, 'In progress') : last ? h('span', { class: 'tag ok' }, `${last.score}/${last.total}`) : null),
        h('p', { class: 'muted small' }, p.topic + (a.length > 1 ? ` · ${a.length} attempts` : '')));
    })));
}

const right = (q, ans) => q.t === 'tfng' ? ans === q.a : ans != null && ans !== '' && isCorrect(q, ans);
const correctText = q => q.t === 'tfng' ? TFNG.find(x => x[0] === q.a)[1] : q.t === 'mc' ? q.o[q.a] : q.a[0];

export function readView(id) {
  const p = data.reading.find(x => x.id === id);
  if (!p) return show('Reading', h('p', {}, 'Passage not found.'), '#/read');

  let run = state.readingRun && state.readingRun.id === id ? state.readingRun : null;
  if (run && Date.now() - run.startedAt > 3 * LIMIT) run = null;      // stale attempt from long ago: start again
  if (!run) { run = { id, startedAt: Date.now(), answers: {} }; state.readingRun = run; save(); }
  let done = false, warned = false, tab = 'passage';

  const timeEl = h('span', { class: 'timer' });
  const passage = h('div', { class: 'card passage' }, p.paras.map((t, i) =>
    h('p', {}, p.letters ? h('span', { class: 'plabel' }, String.fromCharCode(65 + i)) : null, t)));
  const qbox = h('div', { class: 'card' });
  const segP = h('button', { onclick: () => setTab('passage') }, 'Passage');
  const segQ = h('button', { onclick: () => setTab('questions') }, `Questions (${p.questions.length})`);
  function setTab(t) {
    tab = t;
    passage.hidden = t !== 'passage'; qbox.hidden = t !== 'questions';
    segP.className = t === 'passage' ? 'on' : ''; segQ.className = t === 'questions' ? 'on' : '';
    window.scrollTo(0, 0);
  }

  function tick() {
    if (done) return;
    const ms = run.startedAt + LIMIT - Date.now();     // timestamp-based: correct after backgrounding
    timeEl.textContent = ms >= 0 ? fmtTime(ms / 1000) : '+' + fmtTime(-ms / 1000);
    timeEl.classList.toggle('warn', ms <= 120000);
    if (ms <= 0 && !warned) { warned = true; toast('12 minutes are up. Submit your answers when ready.', 6000); }
  }

  function drawQuestions(results) {
    qbox.replaceChildren(...p.questions.map((q, i) => {
      const ans = run.answers[i];
      const el = h('div', { class: 'rq' }, h('div', { class: 'qtype' }, `${i + 1} · ${LABEL[q.t]}`), h('p', {}, q.q));
      const opts = q.t === 'tfng' ? TFNG : q.t === 'mc' ? q.o.map((o, k) => [k, o]) : null;
      if (opts) {
        const btns = opts.map(([val, text]) => h('button', {
          class: 'opt' + (ans === val ? ' sel' : ''), disabled: !!results, onclick: () => {
            run.answers[i] = val; save();
            btns.forEach(b => b.classList.remove('sel'));
            btns[opts.findIndex(o => o[0] === val)].classList.add('sel');
          }
        }, text));
        if (results) opts.forEach(([val], k) => {
          if (val === q.a) btns[k].classList.add('right');
          else if (val === ans) btns[k].classList.add('wrong');
        });
        el.append(...btns);
      } else {
        const inp = h('input', { type: 'text', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', disabled: !!results, 'aria-label': 'Your answer', placeholder: 'Type your answer' });
        inp.value = ans || '';
        inp.addEventListener('input', () => { run.answers[i] = inp.value; });
        inp.addEventListener('change', save);
        el.append(inp);
      }
      if (results) {
        const ok = results[i];
        el.append(h('div', { class: 'fb ' + (ok ? 'ok' : 'bad') }, h('strong', {}, ok ? 'Correct. ' : 'Not quite. '),
          !ok && h('span', {}, 'Answer: ', h('b', {}, correctText(q))), h('span', { class: 'ex' }, q.e)));
      }
      return el;
    }));
    if (!results) qbox.append(h('button', { class: 'btn primary wide', style: 'margin-top:14px', onclick: trySubmit }, 'Check answers'));
  }

  function trySubmit() {
    const blank = p.questions.filter((q, i) => run.answers[i] == null || run.answers[i] === '').length;
    if (blank) confirmBox(`${blank} question${blank > 1 ? 's are' : ' is'} unanswered. Check anyway?`, 'Check answers', submit);
    else submit();
  }
  function submit() {
    if (done) return;
    done = true;
    const results = p.questions.map((q, i) => right(q, run.answers[i]));
    const score = results.filter(Boolean).length, secs = Math.round((Date.now() - run.startedAt) / 1000);
    (state.reading[id] = state.reading[id] || []).push({ date: Date.now(), score, total: results.length, secs });
    state.readingRun = null;
    markDay(); save();
    timeEl.textContent = fmtTime(secs);
    timeEl.classList.remove('warn');
    head.replaceChildren(h('div', { class: 'card center' }, h('div', { class: 'big' }, `${score} / ${results.length}`),
      h('p', { class: 'muted' }, `${pct(score, results.length)}% in ${fmtTime(secs)}`)));
    drawQuestions(results);
    qbox.append(h('a', { class: 'btn primary wide', style: 'margin-top:14px', href: '#/read' }, 'Back to passages'));
    setTab('questions');
  }

  const head = h('div', {});
  const iv = setInterval(tick, 500);
  const onVis = () => { if (document.visibilityState === 'hidden') save(); else tick(); };
  document.addEventListener('visibilitychange', onVis);
  onLeave(() => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); if (!done) save(); closeModal(); });

  drawQuestions(null); tick();
  show('Reading', h('div', { class: 'stack' },
    h('h2', {}, p.title), head,
    h('div', { class: 'timerbar' }, timeEl, h('div', { class: 'seg grow' }, segP, segQ)),
    passage, qbox), '#/read');
  setTab('passage');
}
