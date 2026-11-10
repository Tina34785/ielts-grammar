// Draws the Task 1 visuals (line, bar, pie, table, process) from data in writing.json,
// and describes the same data as text so the AI marker knows what the candidate saw.
import { h } from './ui.js';

const NS = 'http://www.w3.org/2000/svg';
const COLORS = ['var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c4)', 'var(--c5)', 'var(--c6)'];

function s(tag, attrs, ...kids) {
  const el = document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, attrs[k]);
  kids.forEach(c => el.append(c));
  return el;
}
function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / p;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p;
}
function table(columns, rows) {
  return h('div', { class: 'tablewrap' }, h('table', {},
    h('thead', {}, h('tr', {}, columns.map(c => h('th', {}, c)))),
    h('tbody', {}, rows.map(r => h('tr', {}, r.map(c => h('td', {}, c)))))));
}
const legend = names => h('div', { class: 'legend' }, names.map((n, i) => h('span', {}, h('i', { style: `background:${COLORS[i % COLORS.length]}` }), n)));

function xy(v) {
  const W = 340, H = 220, L = 34, R = 8, T = 10, B = 26;
  const max = niceMax(Math.max(...v.series.flatMap(x => x.values)));
  const pw = W - L - R, ph = H - T - B, n = v.categories.length;
  const y = val => T + ph - (val / max) * ph;
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': v.title });
  for (let i = 0; i <= 4; i++) {
    const val = max * i / 4, yy = y(val);
    svg.append(s('line', { x1: L, x2: W - R, y1: yy, y2: yy, stroke: 'var(--line)', 'stroke-width': 1 }));
    const t = s('text', { x: L - 5, y: yy + 3.5, 'text-anchor': 'end', 'font-size': 10, fill: 'var(--muted)' });
    t.textContent = Number.isInteger(val) ? val : val.toFixed(1);
    svg.append(t);
  }
  const band = pw / n;
  v.categories.forEach((c, i) => {
    const t = s('text', { x: L + band * (i + .5), y: H - 8, 'text-anchor': 'middle', 'font-size': 10, fill: 'var(--muted)' });
    t.textContent = c;
    svg.append(t);
  });
  if (v.type === 'bar') {
    const k = v.series.length, bw = Math.min(22, (band * .78) / k), start = (band - bw * k) / 2;
    v.series.forEach((ser, si) => ser.values.forEach((val, i) => {
      svg.append(s('rect', { x: L + band * i + start + bw * si, y: y(val), width: bw - 1.5, height: T + ph - y(val), fill: COLORS[si % COLORS.length], rx: 1.5 }));
    }));
  } else {
    v.series.forEach((ser, si) => {
      const pts = ser.values.map((val, i) => `${L + band * (i + .5)},${y(val)}`);
      svg.append(s('polyline', { points: pts.join(' '), fill: 'none', stroke: COLORS[si % COLORS.length], 'stroke-width': 2.4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
      ser.values.forEach((val, i) => svg.append(s('circle', { cx: L + band * (i + .5), cy: y(val), r: 3.2, fill: COLORS[si % COLORS.length] })));
    });
  }
  return [
    h('div', { class: 'muted small' }, v.unit),
    svg, legend(v.series.map(x => x.name)),
    h('details', {}, h('summary', { class: 'small' }, 'Exact figures'),
      table(['', ...v.series.map(x => x.name)], v.categories.map((c, i) => [c, ...v.series.map(x => x.values[i])])))
  ];
}

function pie(p) {
  const total = p.slices.reduce((a, b) => a + b.value, 0);
  const svg = s('svg', { viewBox: '0 0 120 120', role: 'img', 'aria-label': p.name });
  let ang = -Math.PI / 2;
  p.slices.forEach((sl, i) => {
    if (!sl.value) return;
    const a2 = ang + (sl.value / total) * Math.PI * 2;
    const large = a2 - ang > Math.PI ? 1 : 0;
    const p1 = [60 + 56 * Math.cos(ang), 60 + 56 * Math.sin(ang)], p2 = [60 + 56 * Math.cos(a2), 60 + 56 * Math.sin(a2)];
    svg.append(s('path', { d: `M60 60L${p1[0].toFixed(2)} ${p1[1].toFixed(2)}A56 56 0 ${large} 1 ${p2[0].toFixed(2)} ${p2[1].toFixed(2)}Z`, fill: COLORS[i % COLORS.length], stroke: 'var(--card)', 'stroke-width': 1.2 }));
    ang = a2;
  });
  return h('div', {}, svg, p.name);
}

export function renderVisual(v) {
  let body;
  if (v.type === 'table') body = [table(v.columns, v.rows)];
  else if (v.type === 'process') body = [h('ol', { class: 'process' }, v.steps.map(st => h('li', {}, st)))];
  else if (v.type === 'pie') {
    const labels = v.pies[0].slices.map(x => x.label);
    body = [h('div', { class: 'pies' }, v.pies.map(pie)), legend(labels),
      table(['', ...v.pies.map(p => p.name)], labels.map((l, i) => [l, ...v.pies.map(p => p.slices[i].value + '%')]))];
  } else body = xy(v);
  return h('figure', { class: 'visual stack tight' }, h('figcaption', {}, v.title), body);
}

export function describeVisual(v) {
  const kind = { table: 'Table', process: 'Process diagram', pie: 'Pie charts', bar: 'Bar chart', line: 'Line graph' }[v.type];
  let lines;
  if (v.type === 'table') lines = [v.columns.join(' | '), ...v.rows.map(r => r.join(' | '))];
  else if (v.type === 'process') lines = v.steps.map((st, i) => `${i + 1}. ${st}`);
  else if (v.type === 'pie') lines = v.pies.map(p => `${p.name}: ` + p.slices.map(x => `${x.label} ${x.value}%`).join(', '));
  else lines = [`Unit: ${v.unit}`, ...v.series.map(x => `${x.name}: ` + v.categories.map((c, i) => `${c} = ${x.values[i]}`).join(', '))];
  return `${kind}: ${v.title}\n${lines.join('\n')}`;
}
