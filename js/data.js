// Loads all built-in content from /data. To add content, edit the JSON files only.

export const data = { lessons: [], drills: {}, reading: [], writing: { task1: [], task2: [] } };

async function getJSON(path) {
  const res = await fetch(path);
  if (!res.ok) throw new Error('Could not load ' + path);
  return res.json();
}

export async function loadData() {
  const [lessons, reading, writing] = await Promise.all([
    getJSON('data/lessons.json'), getJSON('data/reading.json'), getJSON('data/writing.json')
  ]);
  data.lessons = lessons;
  data.reading = reading;
  data.writing = writing;
  const drills = await Promise.all(lessons.map(l => getJSON(`data/drills/${l.id}.json`)));
  lessons.forEach((l, i) => { data.drills[l.id] = drills[i]; });
}
