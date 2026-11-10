# IELTS Grammar Coach

A personal, offline-first PWA for IELTS Academic practice: grammar lessons and drills, timed writing with AI marking, reading passages, and a spaced-review Mistakes deck. Plain HTML/CSS/JS, no build step.

## Run locally

```bash
node dev-server.js
```

Then open http://localhost:8765. (Any static file server works; the app must be served over http(s), not opened as a file.)

## Deploy to GitHub Pages

Push the contents of this folder to the root of a repository, then in the repository: Settings → Pages → Source "Deploy from a branch" → `main` / `/ (root)`.

## Releasing an update

Change the version in `js/version.js`. That number is shown in Settings and names the offline cache, so bumping it is what makes the phone fetch the new files. If you add a new file, also add it to the `ASSETS` list in `sw.js`.

## Where things live

| Path | What |
| --- | --- |
| `data/lessons.json` | 10 lessons: rule text, wrong → right pairs, 3 quick-check questions |
| `data/drills/<lesson id>.json` | 20 drill questions per lesson |
| `data/reading.json` | 8 passages with questions |
| `data/writing.json` | 10 Task 1 prompts (with chart data) and 12 Task 2 prompts |
| `js/app.js` | startup, routing, service worker registration |
| `js/store.js` | localStorage state, Mistakes deck scheduling, export/import |
| `js/questions.js` | question rendering and answer checking |
| `js/lessons.js`, `js/review.js`, `js/writing.js`, `js/reading.js`, `js/progress.js`, `js/settings.js` | one file per screen group |
| `js/api.js` | the Anthropic Messages API call and the marking prompt |
| `js/charts.js` | draws Task 1 visuals from the JSON data |
| `sw.js` | offline cache |

## Content formats

Questions (drills, quick checks):

- `{"t":"mc","q":"...","o":["a","b","c","d"],"a":1,"e":"why"}`: `a` is the index of the right option.
- `{"t":"gap","q":"She ___ (go) home.","a":["went"],"e":"why"}`: every accepted answer goes in `a`; use `"-"` for "no article". Case, spacing, punctuation and common contractions are ignored.
- `{"t":"spot","q":"I have seen him yesterday.","a":["have","seen"],"fix":"I saw him yesterday.","e":"why"}`: `a` lists the word(s) that count as the error; each must appear exactly once in the sentence.
- `{"t":"tr","q":"original","hint":"instruction","a":["accepted sentence", "..."],"e":"why"}`

Reading questions use `mc`, `gap`, and `{"t":"tfng","q":"...","a":"T"|"F"|"NG","e":"why"}`.

Task 1 visuals: `type` is `line`, `bar`, `pie`, `table` or `process`; see `data/writing.json` for one of each.

## Privacy

The API key is stored only in the browser's localStorage and is sent only to `api.anthropic.com`. It is not included in backups. Nothing else leaves the device.
