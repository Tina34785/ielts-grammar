// Entry point: loads state and content, routes between screens, registers the service worker.
import { $, h, show, runLeave, toast } from './ui.js';
import { load, state, status, setProblemHandler, dueMistakes } from './store.js';
import { loadData } from './data.js';
import { homeView } from './progress.js';
import { lessonList, lessonView, drillView } from './lessons.js';
import { writeHome, editorView, essayView } from './writing.js';
import { readList, readView } from './reading.js';
import { reviewHome, reviewRun, errorLog } from './review.js';
import { settingsView, onboarding } from './settings.js';

const routes = [
  [/^#\/home$/, homeView, 'home'],
  [/^#\/lessons$/, lessonList, 'lesson'],
  [/^#\/lesson\/(\w+)$/, lessonView, 'lesson'],
  [/^#\/drill\/(\w+)$/, drillView, 'lesson'],
  [/^#\/write$/, writeHome, 'write'],
  [/^#\/write\/([12])\/([\w-]+)$/, editorView, 'write'],
  [/^#\/essay\/(\w+)$/, essayView, 'write'],
  [/^#\/read$/, readList, 'read'],
  [/^#\/read\/([\w-]+)$/, readView, 'read'],
  [/^#\/review$/, reviewHome, 'review'],
  [/^#\/review\/run$/, reviewRun, 'review'],
  [/^#\/errors$/, errorLog, 'review'],
  [/^#\/settings$/, settingsView, '']
];

function route() {
  runLeave();
  const hash = location.hash || '#/home';
  const hit = routes.find(r => r[0].test(hash)) || routes[0];
  document.querySelectorAll('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.tab === hit[2]));
  $('#dueDot').hidden = dueMistakes().length === 0;
  hit[1](...(hash.match(hit[0]) || []).slice(1));
}

function banner() {
  const b = $('#banner');
  b.hidden = status.ok;
  b.textContent = status.reason === 'full'
    ? 'Storage is full. New work is kept only until you close the app. Export a backup in Settings, then delete old essays.'
    : 'Storage is not available (private browsing?). The app works, but progress is lost when you close it.';
}

async function start() {
  setProblemHandler(banner);
  load();
  banner();
  $('#back').addEventListener('click', e => { location.hash = e.currentTarget.dataset.href || '#/home'; });
  try {
    await loadData();
  } catch (e) {
    show('IELTS Grammar Coach', h('div', { class: 'stack' },
      h('p', {}, 'The lesson content could not be loaded. Connect to the internet once so the app can save itself for offline use.'),
      h('button', { class: 'btn primary', onclick: () => location.reload() }, 'Try again')));
    return;
  }
  window.addEventListener('hashchange', route);
  route();
  if (!state.settings.onboarded) onboarding();

  if ('serviceWorker' in navigator) {
    const hadController = !!navigator.serviceWorker.controller;
    navigator.serviceWorker.register('sw.js').catch(() => {});
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) toast('A new version was downloaded. Close and reopen the app to use it.', 7000);
    });
  }
}

start();
