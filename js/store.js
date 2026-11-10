// All persistence. State lives in localStorage; if that fails we keep working in memory and warn.

const KEY = 'ielts.state.v1';
const KEY_API = 'ielts.apiKey';       // kept apart from the state so it is never exported
export const DAY = 86400000;

const mem = {};
export const status = { ok: true, reason: '' };
let onProblem = () => {};
export function setProblemHandler(fn) { onProblem = fn; }

function flag(ok, reason) {
  if (status.ok === ok && status.reason === reason) return;
  status.ok = ok; status.reason = reason;
  onProblem(status);
}
const isQuota = e => e && (e.name === 'QuotaExceededError' || e.code === 22 || e.code === 1014);

function get(k) {
  if (k in mem) return mem[k];
  try { return localStorage.getItem(k); } catch (e) { flag(false, 'unavailable'); return null; }
}
function set(k, v) {
  mem[k] = v;
  try {
    localStorage.setItem(k, v);
    if (!status.ok) flag(true, '');
    return true;
  } catch (e) {
    flag(false, isQuota(e) ? 'full' : 'unavailable');
    return false;
  }
}
function del(k) {
  delete mem[k];
  try { localStorage.removeItem(k); } catch (e) { /* ignore */ }
}

function blank() {
  return {
    v: 1,
    createdAt: Date.now(),
    settings: { model: 'claude-sonnet-5-5', onboarded: false, lastExport: 0, examDate: '2026-11-28', lastTask: 2 },
    lessons: {},      // id -> { quick: bool, attempts: [{ date, score, total }] }
    mistakes: [],     // spaced-review deck
    retired: 0,       // mistakes that passed both reviews
    errorLog: [],     // every error found by essay marking
    essays: [],
    drafts: {},       // 'task:promptId' -> { text, remaining, endsAt, ... }
    reading: {},      // id -> [{ date, score, total }]
    readingRun: null,
    days: []          // 'YYYY-MM-DD' for each day with practice
  };
}

export let state = blank();

export function load() {
  try {
    const probe = '__ielts_probe';
    localStorage.setItem(probe, '1');
    localStorage.removeItem(probe);
  } catch (e) {
    flag(false, isQuota(e) ? 'full' : 'unavailable');
  }
  const raw = get(KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    const base = blank();
    state = Object.assign(base, parsed);
    state.settings = Object.assign(blank().settings, parsed.settings || {});
  } catch (e) {
    set(KEY + '.corrupt', raw);   // keep the broken copy rather than silently destroying it
  }
}

export function save() { return set(KEY, JSON.stringify(state)); }

export const dayKey = (d = new Date()) =>
  d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');

export function markDay() {
  const k = dayKey();
  if (!state.days.includes(k)) state.days.push(k);
  save();
}

export function streak() {
  const days = new Set(state.days);
  const d = new Date();
  if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);   // today not practised yet: streak still alive
  let n = 0;
  while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}

export function daysToExam() {
  const [y, m, d] = state.settings.examDate.split('-').map(Number);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((new Date(y, m - 1, d) - today) / DAY);
}

/* ---- Mistakes deck: wrong -> due in 1 day -> (right) due in 3 days -> (right) retired ---- */
export function addMistake(m) {
  const ex = state.mistakes.find(x => x.key === m.key);
  if (ex) { ex.stage = 0; ex.due = Date.now() + DAY; ex.misses = (ex.misses || 1) + 1; }
  else state.mistakes.push({ ...m, stage: 0, due: Date.now() + DAY, created: Date.now(), misses: 1 });
  save();
}
export function reviewMistake(key, ok) {
  const m = state.mistakes.find(x => x.key === key);
  if (!m) return;
  if (!ok) { m.stage = 0; m.due = Date.now() + DAY; m.misses = (m.misses || 1) + 1; }
  else if (m.stage >= 1) { state.mistakes = state.mistakes.filter(x => x !== m); state.retired = (state.retired || 0) + 1; }
  else { m.stage = 1; m.due = Date.now() + 3 * DAY; }
  save();
}
export const dueMistakes = () => state.mistakes.filter(m => m.due <= Date.now());

/* ---- API key ---- */
export const getKey = () => get(KEY_API) || '';
export const setKey = k => set(KEY_API, k.trim());
export const delKey = () => del(KEY_API);

/* ---- Export / import (the API key is deliberately not included) ---- */
export function exportJSON() {
  state.settings.lastExport = Date.now();
  save();
  return JSON.stringify({ app: 'ielts-grammar-coach', version: self.APP_VERSION, exportedAt: new Date().toISOString(), state }, null, 1);
}
export function importJSON(text) {
  const obj = JSON.parse(text);
  const s = obj && obj.app === 'ielts-grammar-coach' ? obj.state : null;
  if (!s || s.v !== 1 || !Array.isArray(s.essays) || !Array.isArray(s.mistakes)) throw new Error('This is not an IELTS Grammar Coach backup file.');
  state = Object.assign(blank(), s);
  state.settings = Object.assign(blank().settings, s.settings || {});
  state.settings.onboarded = true;
  return save();
}
export function resetAll() {
  state = blank();
  state.settings.onboarded = true;
  save();
}
export const needsExport = () => {
  const hasData = state.days.length > 0 || state.essays.length > 0;
  return hasData && Date.now() - (state.settings.lastExport || state.createdAt) > 7 * DAY;
};
