// Settings, backup (export/import) and first-run onboarding.
import { h, show, toast, modal, closeModal, confirmBox, fmtDate } from './ui.js';
import { state, save, status, getKey, setKey, delKey, exportJSON, importJSON, resetAll } from './store.js';

const MODELS = [['claude-sonnet-5-5', 'Claude Sonnet 5.5 — best marking (default)'], ['claude-haiku-5-5', 'Claude Haiku 5.5 — cheaper, faster']];
const isStandalone = () => navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const mask = k => k.slice(0, 7) + '…' + k.slice(-4);

export async function doExport() {
  const json = exportJSON();
  const name = `ielts-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    const file = new File([json], name, { type: 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: 'IELTS Grammar Coach backup' });   // iOS: "Save to Files"
      return toast('Backup shared.');
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  toast('Backup downloaded.');
}

function installSteps() {
  return h('ol', {},
    h('li', {}, 'Open this page in ', h('b', {}, 'Safari'), ' (not Chrome or an in-app browser).'),
    h('li', {}, 'Tap the ', h('b', {}, 'Share'), ' button (square with an arrow).'),
    h('li', {}, 'Scroll down and tap ', h('b', {}, 'Add to Home Screen'), ', then ', h('b', {}, 'Add'), '.'),
    h('li', {}, 'Open the app from its new icon. Do this once while online so it can save itself for offline use.'));
}

function keyCard(after) {
  const box = h('div', { class: 'stack tight' });
  function draw() {
    const key = getKey();
    const input = h('input', { type: 'password', placeholder: 'sk-ant-…', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off', spellcheck: 'false', 'aria-label': 'Anthropic API key' });
    box.replaceChildren(
      key ? h('p', {}, 'Saved key: ', h('b', {}, mask(key))) : h('p', { class: 'muted small' }, 'No key saved. Essays you submit wait as “pending marking”.'),
      input,
      h('div', { class: 'row' },
        h('button', {
          class: 'btn primary grow', onclick: () => {
            const v = input.value.trim();
            if (!v) return toast('Paste your key first.');
            setKey(v); toast('API key saved on this device.'); draw(); after && after();
          }
        }, key ? 'Replace key' : 'Save key'),
        key ? h('button', { class: 'btn danger', onclick: () => { delKey(); toast('API key deleted.'); draw(); } }, 'Delete key') : null),
      h('p', { class: 'muted small' }, 'Stored only in this browser’s local storage. Sent only to api.anthropic.com when you mark an essay. Never included in backups.'));
  }
  draw();
  return box;
}

export function settingsView() {
  const s = state.settings;
  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json', hidden: true, onchange: async e => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        const text = await f.text();
        confirmBox('Replace everything on this device with the backup file?', 'Import backup', () => {
          try { importJSON(text); toast('Backup imported.'); settingsView(); } catch (err) { toast(err.message, 6000); }
        });
      } catch (err) { toast('Could not read that file.'); }
      e.target.value = '';
    }
  });

  show('Settings', h('div', { class: 'stack' },
    h('div', { class: 'card stack' }, h('h2', {}, 'Anthropic API key'), keyCard()),

    h('div', { class: 'card stack' }, h('h2', {}, 'Marking model'),
      h('select', { 'aria-label': 'Marking model', onchange: e => { s.model = e.target.value; save(); toast('Model saved.'); } },
        MODELS.map(([id, name]) => h('option', { value: id, selected: s.model === id }, name)))),

    h('div', { class: 'card stack' }, h('h2', {}, 'Backup'),
      h('p', { class: 'muted small' }, s.lastExport ? `Last export: ${fmtDate(s.lastExport)}.` : 'Never exported.', ' iOS can clear app storage after long inactivity, so export weekly.'),
      h('div', { class: 'row' },
        h('button', { class: 'btn primary grow', onclick: () => doExport().then(settingsView) }, 'Export JSON'),
        h('button', { class: 'btn grow', onclick: () => fileInput.click() }, 'Import JSON')),
      fileInput,
      h('p', { class: 'small ' + (status.ok ? 'muted' : '') }, status.ok ? 'Storage: working.' : status.reason === 'full' ? 'Storage: FULL — export, then delete old essays.' : 'Storage: unavailable — running in memory only.')),

    h('div', { class: 'card stack' }, h('h2', {}, 'Exam date'),
      h('input', { type: 'date', value: s.examDate, 'aria-label': 'Exam date', onchange: e => { if (e.target.value) { s.examDate = e.target.value; save(); toast('Exam date saved.'); } } })),

    h('div', { class: 'card stack' }, h('h2', {}, 'Install on iPhone'),
      isStandalone() ? h('p', { class: 'muted' }, 'Installed: you are using the home-screen app.') : installSteps()),

    h('div', { class: 'card stack' }, h('h2', {}, 'About'),
      h('p', {}, 'Version ', h('b', {}, self.APP_VERSION)),
      h('button', {
        class: 'btn', onclick: async () => {
          if (!('serviceWorker' in navigator)) return toast('Updates are not supported in this browser.');
          try { const reg = await navigator.serviceWorker.getRegistration(); if (reg) await reg.update(); toast('Checked. If a new version exists it loads next time you open the app.', 5000); }
          catch (e) { toast('Could not check — are you offline?'); }
        }
      }, 'Check for update'),
      h('button', { class: 'link small', onclick: () => confirmBox('Erase all progress, essays and mistakes on this device? Your API key is kept.', 'Erase everything', () => { resetAll(); toast('All data erased.'); settingsView(); }, true) }, 'Erase all data')),
  ), '#/home');
}

export function onboarding() {
  let step = 0;
  const finish = () => { state.settings.onboarded = true; save(); closeModal(); };
  const steps = [
    () => [h('h2', {}, 'Welcome'),
      h('p', {}, 'Four things to do in 10–15 minute sessions: grammar lessons with drills, timed writing with AI marking, reading passages, and a Mistakes deck that brings your errors back for review.'),
      h('p', { class: 'muted small' }, 'Everything except essay marking works offline. Your data stays on this phone.')],
    () => [h('h2', {}, '1. Add it to your Home Screen'),
      isStandalone() ? h('p', {}, 'Done — you are already using the installed app.') : installSteps(),
      isStandalone() ? null : h('p', { class: 'notice' }, 'Install first, then add your API key inside the installed app: on iPhone the home-screen app keeps its own separate storage.')],
    () => [h('h2', {}, '2. Add your Anthropic API key'),
      h('p', { class: 'small' }, 'Needed only for essay marking. Create one at console.anthropic.com → API keys. You can skip this and add it later in Settings.'),
      keyCard()]
  ];
  function draw() {
    const last = step === steps.length - 1;
    modal([...steps[step]().filter(Boolean),
      h('button', { class: 'btn primary wide', onclick: () => { if (last) finish(); else { step++; draw(); } } }, last ? 'Start practising' : 'Next'),
      step === 0 ? h('button', { class: 'link small', onclick: finish }, 'Skip setup') : h('button', { class: 'link small', onclick: () => { step--; draw(); } }, 'Back')]);
  }
  draw();
}
