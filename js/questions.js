// Renders one question with instant feedback. Used by quick checks, drills and the Mistakes deck.
// Question types: mc (multiple choice), gap (typed), spot (tap the wrong word), tr (sentence transformation).
import { h } from './ui.js';

const ZERO = /^(-|–|—|x|0|ø|none|nothing|no article|zero)$/i;

export function norm(s) {
  return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[’‘`´]/g, "'").replace(/[^a-z0-9' ]+/g, ' ').replace(/\s+/g, ' ').trim();
}
// Treat common contractions and their full forms as the same answer.
function expand(s) {
  return s
    .replace(/\bwon't\b/g, 'will not').replace(/\bcan't\b/g, 'cannot').replace(/\bcan not\b/g, 'cannot')
    .replace(/(\w+)n't\b/g, '$1 not').replace(/(\w+)'ll\b/g, '$1 will').replace(/(\w+)'ve\b/g, '$1 have')
    .replace(/(\w+)'re\b/g, '$1 are').replace(/\bi'm\b/g, 'i am')
    .replace(/(^| )'ve\b/g, '$1have').replace(/(^| )'ll\b/g, '$1will');
}
export const same = (a, b) => expand(norm(a)) === expand(norm(b));

export function isCorrect(q, input) {
  if (q.t === 'mc') return input === q.a;
  if (q.t === 'spot') return q.a.map(norm).includes(norm(input));
  return q.a.some(a => a === '-' ? ZERO.test(String(input).trim()) : same(a, input));
}
export function answerText(q) {
  if (q.t === 'mc') return q.o[q.a];
  if (q.t === 'spot') return q.fix;
  return q.a[0] === '-' ? '– (no article)' : q.a[0];
}

const LABEL = { mc: 'Choose the correct option', gap: 'Fill the gap', spot: 'Tap the wrong word', tr: 'Rewrite the sentence' };

export function renderQuestion(q, cb = {}) {
  const fb = h('div', { class: 'fb', role: 'status' });
  const box = h('div', { class: 'q' }, h('div', { class: 'qtype' }, LABEL[q.t]), h('p', { class: 'qtext' }, q.q));
  if (q.hint) box.append(h('p', { class: 'hint' }, q.hint));

  function finish(ok) {
    fb.className = 'fb ' + (ok ? 'ok' : 'bad');
    fb.replaceChildren(
      h('strong', {}, ok ? 'Correct. ' : 'Not quite. '),
      !ok && h('span', {}, q.t === 'spot' ? 'Correct sentence: ' : 'Answer: ', h('b', {}, answerText(q))),
      h('span', { class: 'ex' }, q.e || ''),
      !ok && (q.t === 'gap' || q.t === 'tr') && h('button', {
        class: 'link small', onclick: e => { e.target.remove(); fb.className = 'fb ok'; cb.onOverride && cb.onOverride(); }
      }, 'My answer was also right — count it')
    );
    cb.onAnswer && cb.onAnswer(ok);
  }

  if (q.t === 'mc') {
    const btns = q.o.map((text, i) => h('button', {
      class: 'opt', onclick: () => {
        btns.forEach(b => { b.disabled = true; });
        btns[q.a].classList.add('right');
        if (i !== q.a) btns[i].classList.add('wrong');
        finish(i === q.a);
      }
    }, text));
    box.append(...btns);
  } else if (q.t === 'spot') {
    const answers = q.a.map(norm);
    const toks = q.q.split(/\s+/).map(word => h('button', {
      class: 'tok', onclick: e => {
        toks.forEach(b => { b.disabled = true; if (answers.includes(norm(b.textContent))) b.classList.add('right'); });
        const ok = answers.includes(norm(word));
        if (!ok) e.currentTarget.classList.add('wrong');
        finish(ok);
      }
    }, word));
    box.querySelector('.qtext').replaceWith(h('div', { class: 'toks' }, toks));
  } else {
    const long = q.t === 'tr';
    const input = h(long ? 'textarea' : 'input', {
      type: long ? null : 'text', class: long ? 'short' : null, autocomplete: 'off', autocapitalize: 'off',
      autocorrect: 'off', spellcheck: 'false', enterkeyhint: 'done', 'aria-label': 'Your answer',
      placeholder: long ? 'Type the whole sentence' : 'Type your answer'
    });
    const check = h('button', { class: 'btn', onclick: submit }, 'Check');
    function submit() {
      if (!input.value.trim() || input.disabled) return;
      input.disabled = true; check.hidden = true;
      finish(isCorrect(q, input.value));
    }
    input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
    box.append(input, check);
  }
  box.append(fb);
  return box;
}
