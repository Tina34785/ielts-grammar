// Small DOM helpers shared by every screen. No app logic here.

export const $ = (sel, root = document) => root.querySelector(sel);

export function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const k in attrs || {}) {
    const v = attrs[k];
    if (v == null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'class') el.className = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) {
    if (c == null || c === false || c === '') continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
// Lesson text supports **bold** and _italic_ (used for example words and Spanish).
export const rich = s => esc(s)
  .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
  .replace(/(^|[\s(>])_([^_]+)_/g, '$1<em>$2</em>');

let leaveFns = [];
export function onLeave(fn) { leaveFns.push(fn); }
export function runLeave() {
  const fns = leaveFns; leaveFns = [];
  fns.forEach(f => { try { f(); } catch (e) { /* ignore */ } });
}

export function show(title, node, back) {
  $('#title').textContent = title;
  const b = $('#back');
  b.hidden = !back;
  b.dataset.href = back || '';
  $('#view').replaceChildren(node);
  window.scrollTo(0, 0);
}

let toastTimer;
export function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('on'), ms);
}

export function modal(node) {
  const m = $('#modal');
  m.replaceChildren(h('div', { class: 'sheet stack', role: 'dialog', 'aria-modal': 'true' }, node));
  m.classList.add('on');
}
export function closeModal() {
  const m = $('#modal');
  m.classList.remove('on');
  m.replaceChildren();
}
export function confirmBox(text, yesLabel, onYes, danger) {
  modal([
    h('p', {}, text),
    h('button', { class: 'btn wide ' + (danger ? 'danger' : 'primary'), onclick: () => { closeModal(); onYes(); } }, yesLabel),
    h('button', { class: 'btn wide', onclick: closeModal }, 'Cancel')
  ]);
}

export const fmtTime = s => {
  s = Math.max(0, Math.round(s));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
};
export const fmtDate = ts => new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
export const pct = (a, b) => b ? Math.round(100 * a / b) : 0;
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function countWords(text) {
  const m = text.trim().match(/\S+/g);
  return m ? m.length : 0;
}
