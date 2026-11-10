// Module 3: writing prompts, timed editor with autosave, and AI marking.
import { h, show, toast, fmtTime, fmtDate, countWords, onLeave, confirmBox, closeModal } from './ui.js';
import { state, save, markDay, addMistake, getKey } from './store.js';
import { data } from './data.js';
import { renderVisual, describeVisual } from './charts.js';
import { markEssay } from './api.js';

const CFG = { 1: { mins: 20, min: 150 }, 2: { mins: 40, min: 250 } };
const CAP = 600;            // hard word limit for submitting
const AUTOSAVE_MS = 10000;
const CRITERIA = [['task', t => t === 1 ? 'Task Achievement' : 'Task Response'], ['coherence', () => 'Coherence & Cohesion'],
  ['lexical', () => 'Lexical Resource'], ['grammar', () => 'Grammatical Range & Accuracy']];

const prompts = task => (task === 1 ? data.writing.task1 : data.writing.task2);
const findPrompt = (task, id) => prompts(task).find(p => p.id === id);
const inFlight = new Set();   // essay ids currently being marked: prevents duplicate requests
let autoMark = null;          // essay id to mark automatically right after submitting

const statusTag = e => e.status === 'marked' ? h('span', { class: 'tag ok' }, `Band ${e.result.overall.toFixed(1)}`)
  : e.status === 'raw' ? h('span', { class: 'tag warn' }, 'Unparsed reply')
  : h('span', { class: 'tag warn' }, 'Pending marking');

export function writeHome() {
  const s = state.settings;
  const root = h('div', { class: 'stack' });

  function draw() {
    const task = s.lastTask === 1 ? 1 : 2, list = prompts(task), curKey = 'cur' + task;
    const p = findPrompt(task, s[curKey]) || list[0];
    const draft = state.drafts[`${task}:${p.id}`];
    const pick = t => h('button', { class: s.lastTask === t ? 'on' : '', onclick: () => { s.lastTask = t; save(); draw(); } }, `Task ${t}`);
    const drafts = Object.keys(state.drafts).filter(k => state.drafts[k].text);
    const essays = state.essays.slice().reverse();

    root.replaceChildren(
      h('div', { class: 'seg' }, pick(1), pick(2)),
      h('div', { class: 'card stack' },
        h('div', { class: 'row between' }, h('span', { class: 'tag' }, p.theme || p.visual.type), h('span', { class: 'muted small' }, `${CFG[task].mins} min · ${CFG[task].min}+ words`)),
        h('p', {}, p.prompt),
        task === 1 ? h('p', { class: 'muted small' }, `You will see: ${p.visual.title}`) : null,
        h('div', { class: 'row' },
          h('button', {
            class: 'btn grow', onclick: () => {
              const others = list.filter(x => x.id !== p.id);
              s[curKey] = others[Math.floor(Math.random() * others.length)].id; save(); draw();
            }
          }, 'Shuffle'),
          h('a', { class: 'btn primary grow', href: `#/write/${task}/${p.id}` }, draft && draft.text ? 'Continue draft' : 'Start writing'))),
      drafts.length ? h('div', { class: 'card' }, h('h2', {}, 'Drafts'), h('div', { class: 'list' }, drafts.map(k => {
        const [t, id] = k.split(':'), pr = findPrompt(+t, id);
        return h('a', { class: 'item', href: `#/write/${t}/${id}` },
          h('span', { class: 'grow small' }, `Task ${t} · ${pr ? pr.prompt.slice(0, 60) : id}…`),
          h('span', { class: 'muted small num' }, `${countWords(state.drafts[k].text)} words`));
      }))) : null,
      h('div', { class: 'card' }, h('h2', {}, 'Your essays'),
        essays.length ? h('div', { class: 'list' }, essays.map(e => h('a', { class: 'item', href: '#/essay/' + e.id },
          h('span', { class: 'grow small' }, `Task ${e.task} · ${fmtDate(e.created)} · ${e.words} words`), statusTag(e))))
          : h('p', { class: 'muted small' }, 'Nothing submitted yet.'))
    );
  }
  draw();
  show('Writing', root);
}

export function editorView(taskStr, id) {
  const task = +taskStr, p = findPrompt(task, id);
  if (!p) return show('Writing', h('p', {}, 'Prompt not found.'), '#/write');
  const cfg = CFG[task], key = `${task}:${id}`, total = cfg.mins * 60000;
  const d = state.drafts[key] || { text: '', remaining: total, endsAt: 0, warned: false, over: false };
  let dirty = false, busy = false, submitted = false, lastSave = Date.now();

  const ta = h('textarea', { class: 'essay', placeholder: 'Write your answer here…', spellcheck: 'false', autocorrect: 'off', 'aria-label': 'Your answer' });
  ta.value = d.text;
  const timeEl = h('span', { class: 'timer' });
  const wcEl = h('span', { class: 'wc small' });
  const savedEl = h('span', { class: 'muted small' });
  const warnEl = h('div', { class: 'notice bad', hidden: true });
  const pauseBtn = h('button', { class: 'btn', onclick: toggleTimer });
  const submitBtn = h('button', { class: 'btn primary wide', onclick: submit }, 'Submit for marking');

  const left = () => (d.endsAt ? d.endsAt - Date.now() : d.remaining);   // timestamps, so backgrounding cannot drift
  function persist() {
    d.text = ta.value;
    state.drafts[key] = d;
    const ok = save();
    dirty = false; lastSave = Date.now();
    savedEl.textContent = (ok ? 'Saved ' : 'Not saved to disk ') + new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
  function toggleTimer() {
    if (d.endsAt) { d.remaining = d.endsAt - Date.now(); d.endsAt = 0; }
    else d.endsAt = Date.now() + d.remaining;
    persist(); tick();
  }
  function tick() {
    const ms = left();
    timeEl.textContent = ms >= 0 ? fmtTime(ms / 1000) : '+' + fmtTime(-ms / 1000);
    timeEl.classList.toggle('warn', ms <= 300000);
    pauseBtn.textContent = d.endsAt ? 'Pause' : d.remaining < total ? 'Resume' : 'Start timer';
    if (d.endsAt && ms <= 300000 && ms > 0 && !d.warned) { d.warned = true; toast('5 minutes left.', 5000); }
    if (d.endsAt && ms <= 0 && !d.over) { d.over = d.warned = true; toast('Time is up. Finish your sentence and submit.', 6000); }
    if (dirty && Date.now() - lastSave >= AUTOSAVE_MS) persist();
  }
  function count() {
    const w = countWords(ta.value);
    wcEl.textContent = `${w} words · minimum ${cfg.min}`;
    wcEl.classList.toggle('ok', w >= cfg.min);
    warnEl.hidden = w <= CAP - 50;
    warnEl.className = 'notice' + (w > CAP ? ' bad' : '');
    warnEl.textContent = w > CAP ? `${w} words: over the ${CAP}-word limit. Cut ${w - CAP} words to submit.` : `Getting long (${w} words). The limit for marking is ${CAP}; in the exam, length beyond the minimum earns nothing.`;
    submitBtn.disabled = busy || w > CAP || w === 0;
  }
  ta.addEventListener('input', () => {
    dirty = true;
    if (!d.endsAt && d.remaining === total) { d.endsAt = Date.now() + total; }   // first keystroke starts the clock
    count();
  });

  async function submit() {
    if (busy || submitted) return;
    const text = ta.value.trim(), words = countWords(text);
    if (words < 30) return toast('Write at least 30 words before submitting.');
    if (words > CAP) return;
    const go = () => {
      busy = true; submitted = true; submitBtn.disabled = true; submitBtn.textContent = 'Submitting…';
      const essay = { id: 'e' + Date.now().toString(36), task, promptId: id, text, words, created: Date.now(), status: 'pending', minutes: Math.round((total - left()) / 60000) };
      state.essays.push(essay);
      delete state.drafts[key];
      markDay();
      autoMark = essay.id;
      location.hash = '#/essay/' + essay.id;
    };
    if (words < cfg.min) confirmBox(`Only ${words} words (minimum ${cfg.min}). Under-length answers lose marks. Submit anyway?`, 'Submit anyway', go);
    else go();
  }

  const iv = setInterval(tick, 500);
  const flush = () => { if (dirty && !submitted) persist(); };
  const onVis = () => { if (document.visibilityState === 'hidden') flush(); else tick(); };
  document.addEventListener('visibilitychange', onVis);
  window.addEventListener('pagehide', flush);
  onLeave(() => { clearInterval(iv); document.removeEventListener('visibilitychange', onVis); window.removeEventListener('pagehide', flush); flush(); closeModal(); });

  tick(); count();
  show(`Writing Task ${task}`, h('div', { class: 'stack' },
    h('details', { class: 'card', open: true }, h('summary', {}, 'Question'),
      h('div', { class: 'stack' }, h('p', {}, p.prompt), task === 1 ? renderVisual(p.visual) : null)),
    h('div', { class: 'timerbar' }, timeEl, h('span', { class: 'grow' }, wcEl), pauseBtn),
    ta, warnEl,
    h('div', { class: 'row between' }, savedEl, h('span', { class: 'muted small' }, 'Autosaves every 10 s')),
    submitBtn,
    h('button', {
      class: 'link small', onclick: () => confirmBox('Delete this draft and reset the timer?', 'Delete draft', () => {
        submitted = true; delete state.drafts[key]; save(); location.hash = '#/write';
      }, true)
    }, 'Discard draft')
  ), '#/write');
}

function logErrors(essay) {
  if (essay.logged) return;     // never add the same essay's errors twice
  essay.logged = true;
  essay.result.errors.forEach((er, i) => {
    state.errorLog.push({ rule: er.rule, quote: er.quote, correction: er.correction, note: er.note, date: Date.now(), essayId: essay.id });
    addMistake({ key: `e:${essay.id}:${i}`, kind: 'essay', quote: er.quote, correction: er.correction, rule: er.rule, note: er.note });
  });
}

// Marks one essay. Safe to call repeatedly: a second call while one is running does nothing.
async function runMarking(essay) {
  if (inFlight.has(essay.id)) return;
  if (!getKey()) return toast('No API key yet. Essay saved as pending — add a key in Settings to mark it.', 6000);
  if (navigator.onLine === false) return toast('You are offline. Essay saved — mark it when you are back online.', 6000);
  const p = findPrompt(essay.task, essay.promptId);
  inFlight.add(essay.id);
  essay.lastError = '';
  try {
    const out = await markEssay({
      key: getKey(), model: state.settings.model, task: essay.task, prompt: p ? p.prompt : '(prompt unavailable)',
      visual: p && p.visual ? describeVisual(p.visual) : '', text: essay.text, words: essay.words, minutes: essay.minutes
    });
    essay.model = state.settings.model;
    essay.markedAt = Date.now();
    if (out.result) { essay.status = 'marked'; essay.result = out.result; essay.raw = ''; logErrors(essay); }
    else { essay.status = 'raw'; essay.raw = out.raw; }
  } catch (e) {
    essay.lastError = e.message || 'Marking failed.';
    toast(essay.lastError, 6000);
  } finally {
    inFlight.delete(essay.id);
    save();
  }
}

export function essayView(id) {
  const essay = state.essays.find(e => e.id === id);
  if (!essay) return show('Essay', h('p', {}, 'Essay not found.'), '#/write');
  const p = findPrompt(essay.task, essay.promptId);
  const root = h('div', { class: 'stack' });
  let alive = true;
  onLeave(() => { alive = false; });

  function mark() {
    const run = runMarking(essay);
    draw();
    run.then(() => { if (alive) draw(); });
  }

  function draw() {
    const marking = inFlight.has(essay.id);
    const parts = [h('div', { class: 'row between' },
      h('span', { class: 'muted small' }, `Task ${essay.task} · ${fmtDate(essay.created)} · ${essay.words} words`), marking ? h('span', { class: 'tag' }, 'Marking…') : statusTag(essay))];

    if (essay.status === 'marked') {
      const r = essay.result;
      parts.push(
        h('div', { class: 'estimate' }, 'AI estimate — not an official score'),
        h('div', { class: 'card stack' },
          h('div', { class: 'center' }, h('div', { class: 'big' }, r.overall.toFixed(1)), h('div', { class: 'muted small' }, 'Estimated overall band')),
          h('div', { class: 'bands' }, CRITERIA.flatMap(([k, name]) => [h('span', {}, name(essay.task)), h('b', { class: 'num' }, r.bands[k].toFixed(1))]))),
        r.tip ? h('div', { class: 'card' }, h('h2', {}, 'Priority tip'), h('p', {}, r.tip)) : null,
        h('div', { class: 'card stack' }, h('h2', {}, 'Most important grammar errors'),
          r.errors.length ? h('div', { class: 'list' }, r.errors.map(er => h('div', { class: 'err' },
            h('div', { class: 'quote' }, `“${er.quote}”`), h('div', { class: 'fix' }, er.correction),
            h('div', { class: 'small' }, h('span', { class: 'tag' }, er.rule), ' ', h('span', { class: 'muted' }, er.note)))))
            : h('p', { class: 'muted' }, 'None reported.'),
          r.errors.length ? h('p', { class: 'muted small' }, 'Added to your Mistakes deck and Error Log.') : null),
        r.rewrites.length ? h('div', { class: 'card stack' }, h('h2', {}, 'Two sentences, upgraded'),
          r.rewrites.map(w => h('div', { class: 'pair' }, h('div', { class: 'muted' }, w.original), h('div', { class: 'r' }, w.improved), h('div', { class: 'n' }, w.why)))) : null,
        h('p', { class: 'muted small center' }, `AI estimate — not an official score. Marked by ${essay.model} on ${fmtDate(essay.markedAt)}.`));
    } else if (essay.status === 'raw') {
      parts.push(
        h('div', { class: 'estimate' }, 'AI estimate — not an official score'),
        h('div', { class: 'notice' }, 'The marker replied, but not in the expected format (even after one retry). Here is the raw reply:'),
        h('pre', { class: 'raw' }, essay.raw),
        h('button', { class: 'btn primary wide', disabled: marking, onclick: mark }, marking ? 'Marking…' : 'Try marking again'));
    } else {
      parts.push(
        essay.lastError ? h('div', { class: 'notice bad' }, essay.lastError) : null,
        h('div', { class: 'card stack' },
          h('p', {}, marking ? 'Marking your essay. This usually takes 10–30 seconds.' : 'This essay is saved on your phone and has not been marked yet.'),
          h('button', { class: 'btn primary wide', disabled: marking, onclick: mark }, marking ? 'Marking…' : 'Mark now'),
          !getKey() ? h('a', { class: 'link small', href: '#/settings' }, 'Add your API key in Settings') : null));
    }

    parts.push(
      h('details', { class: 'card' }, h('summary', {}, 'Question'), h('div', { class: 'stack' }, h('p', {}, p ? p.prompt : ''), p && p.visual ? renderVisual(p.visual) : null)),
      h('details', { class: 'card', open: essay.status !== 'marked' }, h('summary', {}, 'Your answer'), h('p', { class: 'essaytext' }, essay.text)),
      h('button', {
        class: 'link small', onclick: () => confirmBox('Delete this essay? Its logged errors stay in your Error Log.', 'Delete essay', () => {
          state.essays = state.essays.filter(e => e !== essay); save(); location.hash = '#/write';
        }, true)
      }, 'Delete essay'));
    root.replaceChildren(...parts.filter(Boolean));
  }

  show('Essay', root, '#/write');
  if (autoMark === essay.id) { autoMark = null; save(); mark(); }
  else draw();
}
