'use strict';

/* ============================================================
   TRAININGS-TRACKER
   Alle Daten werden nur hier im Browser gespeichert (localStorage).
   Kein Server, kein Login.
   ============================================================ */

const STORAGE_KEY = 'trainings-tracker';
const BENCH_ID = 'bankdruecken';            // feste ID für Bankdrücken (für den Fortschrittsbalken)
const DAYS_PER_MONTH = 30.44;

// Muskelgruppen auf dem Startbildschirm (in dieser Reihenfolge)
const CATEGORIES = [
  { id: 'brust',    name: 'Brust' },
  { id: 'ruecken',  name: 'Rücken' },
  { id: 'schulter', name: 'Schulter' },
  { id: 'beine',    name: 'Beine' },
  { id: 'bizeps',   name: 'Bizeps' },
  { id: 'trizeps',  name: 'Trizeps' }
];
// Für Übungen ohne passende Kategorie (wird nur angezeigt, wenn es welche gibt)
const OTHER_CATEGORY = { id: 'sonstige', name: 'Sonstige' };

// Übungen, die beim ersten Start angelegt werden
const DEFAULT_EXERCISES = [
  { category: 'brust',    name: 'Bankdrücken LH', id: BENCH_ID },
  { category: 'brust',    name: 'KH Schrägbankdrücken' },
  { category: 'ruecken',  name: 'Rudern' },
  { category: 'ruecken',  name: 'Klimmzüge/Latzug' },
  { category: 'ruecken',  name: 'Kreuzheben' },
  { category: 'schulter', name: 'Schulterdrücken KH' },
  { category: 'schulter', name: 'Seitheben' },
  { category: 'beine',    name: 'Kniebeugen' },
  { category: 'beine',    name: 'Ausfallschritte' },
  { category: 'beine',    name: 'Beinstrecker' },
  { category: 'bizeps',   name: 'Bizeps-Curls' },
  { category: 'bizeps',   name: 'Hammer-Curls' },
  { category: 'trizeps',  name: 'Trizepsdrücken Kabel' },
  { category: 'trizeps',  name: 'French Press' }
];

const DEFAULT_SETTINGS = {
  benchStart: 60,             // kg, Startwert für den Fortschrittsbalken
  benchGoal: 100,             // kg, Ziel
  benchMeasure: 'heaviest',   // 'heaviest' = schwerster Satz, 'e1rm' = geschätztes 1RM
  targetBodyweight: 72,       // kg
  monthlyGain: 0.5,           // kg Zunahme pro Monat (Ziel-Tempo)
  reminderTime: '07:00'
};

// Farben für die Diagramme (gleich wie in style.css)
const COLORS = {
  accent: '#ff8a3d', blue: '#5ab4ff', green: '#4cd08a',
  muted: '#98a2b0', grid: '#2a303b', text: '#98a2b0'
};

let data = loadData();
let editMode = false;          // Übungen bearbeiten (löschen/hinzufügen)
let currentExerciseId = null;  // welche Übung ist gerade offen
let currentCategoryId = null;  // welche Muskelgruppe ist gerade offen
let redrawChart = null;        // Funktion zum Neuzeichnen des sichtbaren Diagramms
let navigatedInApp = false;    // für den Zurück-Button


/* ============================================================
   DATEN LADEN & SPEICHERN
   ============================================================ */

function loadData() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return normalizeData(JSON.parse(saved));
  } catch (err) {
    console.error('Daten konnten nicht geladen werden', err);
  }
  return normalizeData({});
}

// Sorgt dafür, dass alle Felder vorhanden und gültig sind
// (wichtig beim ersten Start und beim Importieren eines Backups).
function normalizeData(d) {
  d = (d && typeof d === 'object') ? d : {};

  const sets = Array.isArray(d.sets)
    ? d.sets.filter(s => s && typeof s.exId === 'string' && isFinite(s.time) && isFinite(s.weight) && isFinite(s.reps))
    : [];
  sets.forEach(s => { if (!s.id) s.id = makeId(); });

  let exercises = Array.isArray(d.exercises)
    ? d.exercises.filter(e => e && typeof e.id === 'string' && typeof e.name === 'string')
    : DEFAULT_EXERCISES.map(e => ({ id: e.id || makeId(), name: e.name, category: e.category }));

  // Daten aus Version 1 (noch ohne Kategorien) umsortieren
  if (Array.isArray(d.exercises) && !(d.version >= 2)) exercises = migrateToCategories(exercises, sets);

  const validCategories = CATEGORIES.map(c => c.id);
  exercises.forEach(e => { if (!validCategories.includes(e.category)) e.category = OTHER_CATEGORY.id; });

  const bodyweights = Array.isArray(d.bodyweights)
    ? d.bodyweights.filter(b => b && /^\d{4}-\d{2}-\d{2}$/.test(b.day) && isFinite(b.kg))
    : [];

  return {
    version: 2,
    exercises,
    sets,
    bodyweights,
    settings: Object.assign({}, DEFAULT_SETTINGS, d.settings),
    lastExport: d.lastExport || null
  };
}

// Version 1 hatte noch keine Muskelgruppen. Alte Übungen werden hier einsortiert,
// alte Standard-Übungen ohne Einträge fliegen raus, neue Standard-Übungen kommen dazu.
// Eingetragene Sätze bleiben immer erhalten.
function migrateToCategories(exercises, sets) {
  const OLD = {   // alter Name: [Kategorie, neuer Name]
    'Bankdrücken': ['brust', 'Bankdrücken LH'],
    'Enges Bankdrücken': ['brust'],
    'Schulterdrücken': ['schulter', 'Schulterdrücken KH'],
    'Rudern': ['ruecken'],
    'Klimmzüge/Latzug': ['ruecken'],
    'Dips': ['trizeps'],
    'Trizepsdrücken': ['trizeps', 'Trizepsdrücken Kabel'],
    'Überkopf-Trizepsstrecken': ['trizeps'],
    'Bizeps-Curls': ['bizeps'],
    'Hammer-Curls': ['bizeps']
  };
  const used = new Set(sets.map(s => s.exId));
  const findDefault = name => DEFAULT_EXERCISES.find(x => x.name.toLowerCase() === name.toLowerCase());

  const kept = exercises.filter(e => {
    const old = OLD[e.name];
    if (!old || used.has(e.id)) return true;
    return Boolean(findDefault(old[1] || e.name));   // nur behalten, wenn es sie noch als Standard gibt
  });

  kept.forEach(e => {
    const old = OLD[e.name];
    if (old) { e.category = old[0]; e.name = old[1] || e.name; }
    const def = findDefault(e.name);
    if (def) e.category = def.category;
  });

  for (const def of DEFAULT_EXERCISES) {
    const exists = kept.some(e => e.name.toLowerCase() === def.name.toLowerCase() || (def.id && e.id === def.id));
    if (!exists) kept.push({ id: def.id || makeId(), name: def.name, category: def.category });
  }

  // Reihenfolge wie in der Standardliste, eigene Übungen dahinter
  const order = e => { const i = DEFAULT_EXERCISES.findIndex(x => x.name === e.name); return i < 0 ? 999 : i; };
  return kept.sort((a, b) => order(a) - order(b));
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (err) {
    alert('Speichern hat nicht geklappt: ' + err.message);
  }
}


/* ============================================================
   KLEINE HELFER
   ============================================================ */

const $ = id => document.getElementById(id);

function makeId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const pad = n => String(n).padStart(2, '0');

// Datum -> "2026-11-18"
function dayKey(date = new Date()) {
  const d = new Date(date);
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

// "2026-11-18" -> Date (Mitternacht, Ortszeit)
function dayToDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function addDays(key, n) {
  const d = dayToDate(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
}

function daysBetween(fromKey, toKey) {
  return Math.round((dayToDate(toKey) - dayToDate(fromKey)) / 86400000);
}

const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

// "2026-11-18" -> "Mi, 18.11."
function formatDay(key) {
  const d = dayToDate(key);
  const year = d.getFullYear() !== new Date().getFullYear() ? d.getFullYear() : '';
  return WEEKDAYS[d.getDay()] + ', ' + pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.' + year;
}

// "heute", "gestern", "vor 3 Tagen"
function relativeDay(key) {
  const diff = daysBetween(key, dayKey());
  if (diff <= 0) return 'heute';
  if (diff === 1) return 'gestern';
  return 'vor ' + diff + ' Tagen';
}

// Zahl schön auf Deutsch anzeigen: 62.5 -> "62,5"
function fmt(n, maxDecimals = 2, minDecimals = 0) {
  return Number(n).toLocaleString('de-DE', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
    useGrouping: false
  });
}

// Mit Vorzeichen: +0,4 / −0,2
function fmtSigned(n, decimals = 1) {
  const rounded = Math.round(n * 10 ** decimals) / 10 ** decimals;
  if (rounded === 0) return '±0';
  return (rounded > 0 ? '+' : '−') + fmt(Math.abs(rounded), decimals, decimals);
}

// Eingabe lesen, Komma oder Punkt erlaubt: "62,5" -> 62.5
function parseNum(text) {
  return parseFloat(String(text).replace(',', '.').trim());
}

// Schutz vor HTML in selbst eingegebenen Übungsnamen
function esc(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const clamp = (v, min, max) => Math.min(max, Math.max(min, v));

// Geschätztes Maximalgewicht für 1 Wiederholung (Epley-Formel)
function epley(weight, reps) {
  return reps <= 1 ? weight : weight * (1 + reps / 30);
}

let toastTimer;
function toast(message) {
  const t = $('toast');
  t.textContent = message;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}


/* ============================================================
   ÜBUNGS-DATEN AUSWERTEN
   ============================================================ */

function getExercise(id) {
  return data.exercises.find(e => e.id === id);
}

function setsFor(exId) {
  return data.sets.filter(s => s.exId === exId).sort((a, b) => a.time - b.time);
}

// Sätze nach Trainingstag gruppieren, neuester Tag zuerst:
// [{ day: '2026-11-18', sets: [...] }, ...]
function sessionsFor(exId) {
  const byDay = new Map();
  for (const s of setsFor(exId)) {
    const key = dayKey(s.time);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(s);
  }
  return [...byDay].map(([day, sets]) => ({ day, sets })).reverse();
}

// Schwerster Satz (bei gleichem Gewicht der mit mehr Wiederholungen)
function heaviestSet(sets) {
  return sets.reduce((best, s) =>
    (!best || s.weight > best.weight || (s.weight === best.weight && s.reps > best.reps)) ? s : best, null);
}

function best1RM(sets) {
  return Math.max(...sets.map(s => epley(s.weight, s.reps)));
}

const setText = s => fmt(s.weight) + ' kg × ' + s.reps;


/* ============================================================
   NAVIGATION ZWISCHEN DEN SEITEN
   Die Adresse hinter dem # bestimmt, was angezeigt wird:
   #/                -> Startbildschirm
   #/kategorie/<id>  -> Übungen einer Muskelgruppe
   #/uebung/<id>     -> Übung
   #/gewicht         -> Körpergewicht
   #/einstellungen   -> Einstellungen & Backup
   ============================================================ */

function route() {
  const hash = location.hash || '#/';
  document.querySelectorAll('.view').forEach(v => { v.hidden = true; });
  redrawChart = null;

  if (hash.startsWith('#/uebung/')) {
    const id = decodeURIComponent(hash.slice('#/uebung/'.length));
    if (getExercise(id)) return showExercise(id);
  } else if (hash.startsWith('#/kategorie/')) {
    const id = decodeURIComponent(hash.slice('#/kategorie/'.length));
    if (getCategory(id)) return showCategory(id);
  } else if (hash === '#/gewicht') {
    return showBodyweight();
  } else if (hash === '#/einstellungen') {
    return showSettings();
  }
  showHome();
}

function showView(name) {
  $('view-' + name).hidden = false;
  window.scrollTo(0, 0);
}

function goBack() {
  if (navigatedInApp) return history.back();
  // App wurde direkt auf einer Unterseite geöffnet: eine Ebene nach oben
  const ex = location.hash.startsWith('#/uebung/') && getExercise(currentExerciseId);
  location.hash = ex ? '#/kategorie/' + ex.category : '#/';
}


/* ============================================================
   STARTBILDSCHIRM
   ============================================================ */

function showHome() {
  showView('home');
  renderBenchCard();
  renderBodyweightButton();
  renderCategoryGrid();
  renderBackupHint();
}

function renderBenchCard() {
  const card = $('bench-card');
  if (!getExercise(BENCH_ID)) { card.hidden = true; return; }
  card.hidden = false;

  const s = data.settings;
  const sets = setsFor(BENCH_ID);
  let current = 0;
  let detail = 'Noch keine Sätze eingetragen – tippe hier, um loszulegen.';

  if (sets.length) {
    const top = heaviestSet(sets);
    const oneRM = best1RM(sets);
    current = s.benchMeasure === 'e1rm' ? oneRM : top.weight;
    detail = 'Schwerster Satz: ' + setText(top) + ' · geschätztes 1RM: ' + fmt(oneRM, 1) + ' kg';
  }

  const range = s.benchGoal - s.benchStart;
  const pct = range > 0 ? clamp((current - s.benchStart) / range * 100, 0, 100) : 100;
  const remaining = Math.max(0, s.benchGoal - current);
  const label = s.benchMeasure === 'e1rm' ? 'geschätztes 1RM' : 'schwerster Satz';

  card.innerHTML = `
    <a class="goal" href="#/uebung/${BENCH_ID}">
      <div class="goal-head">
        <span>Ziel: ${fmt(s.benchGoal)} kg Bankdrücken</span>
        <strong>${Math.round(pct)} %</strong>
      </div>
      <div class="progress"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div class="goal-sub">${sets.length ? fmt(current, 1) + ' kg ' + label + ' · noch ' + fmt(remaining, 1) + ' kg' : 'Start: ' + fmt(s.benchStart) + ' kg'}</div>
      <div class="goal-sub muted">${detail}</div>
    </a>`;
}

function renderBodyweightButton() {
  const entries = sortedBodyweights();
  const last = entries[entries.length - 1];
  const weighedToday = last && last.day === dayKey();
  let sub;
  if (!last) sub = '<span class="bw-sub todo">Noch kein Eintrag – tippen zum Eintragen</span>';
  else if (weighedToday) sub = `<span class="bw-sub">Heute: ${fmt(last.kg, 1, 1)} kg ✓</span>`;
  else sub = `<span class="bw-sub todo">Heute noch nicht gewogen · zuletzt ${fmt(last.kg, 1, 1)} kg (${relativeDay(last.day)})</span>`;

  $('bw-button').innerHTML = '<span class="bw-title">⚖️ Körpergewicht</span>' + sub;
}

/* ---------- Muskelgruppen ---------- */

// Alle Kategorien, "Sonstige" nur wenn dort Übungen liegen
function allCategories() {
  const hasOther = data.exercises.some(e => e.category === OTHER_CATEGORY.id);
  return hasOther ? CATEGORIES.concat(OTHER_CATEGORY) : CATEGORIES;
}

function getCategory(id) {
  return allCategories().find(c => c.id === id);
}

function exercisesIn(categoryId) {
  return data.exercises.filter(e => e.category === categoryId);
}

// Letzter Trainingstag einer Muskelgruppe ("2026-11-18" oder null)
function lastDayInCategory(categoryId) {
  const ids = new Set(exercisesIn(categoryId).map(e => e.id));
  const times = data.sets.filter(s => ids.has(s.exId)).map(s => s.time);
  return times.length ? dayKey(Math.max(...times)) : null;
}

function renderCategoryGrid() {
  $('category-grid').innerHTML = allCategories().map(cat => {
    const count = exercisesIn(cat.id).length;
    const last = lastDayInCategory(cat.id);
    return `<a class="ex-btn cat-btn" href="#/kategorie/${cat.id}">
              <span class="cat-name">${esc(cat.name)}</span>
              <span class="ex-sub">${count} ${count === 1 ? 'Übung' : 'Übungen'}</span>
              <span class="ex-sub ${last ? '' : 'faint'}">${last ? 'zuletzt ' + relativeDay(last) : 'noch nicht trainiert'}</span>
            </a>`;
  }).join('');
}

function showCategory(id) {
  editMode = false;
  currentCategoryId = id;
  showView('category');
  $('cat-title').textContent = getCategory(id).name;
  renderExerciseGrid();
}

function renderExerciseGrid() {
  const grid = $('exercise-grid');
  const exercises = exercisesIn(currentCategoryId);

  if (!exercises.length) {
    grid.innerHTML = '<p class="hint grid-wide">Noch keine Übungen in dieser Gruppe. Tippe auf „Bearbeiten“, um welche hinzuzufügen.</p>';
  } else {
    grid.innerHTML = exercises.map(ex => {
      if (editMode) {
        return `<button class="ex-btn editing" data-action="delete-exercise" data-id="${esc(ex.id)}">
                  <span class="ex-name">${esc(ex.name)}</span>
                  <span class="ex-sub">✕ Löschen</span>
                </button>`;
      }
      return `<a class="ex-btn" href="#/uebung/${encodeURIComponent(ex.id)}">
                <span class="ex-name">${esc(ex.name).replace(/\//g, '/<wbr>')}</span>
                <span class="ex-sub">${lastSessionSummary(ex.id)}</span>
              </a>`;
    }).join('');
  }

  $('add-exercise-form').hidden = !editMode;
  $('edit-toggle').textContent = editMode ? 'Fertig' : 'Bearbeiten';
}

// Kurztext für den Übungs-Button: "60 kg × 10 · gestern"
function lastSessionSummary(exId) {
  const sessions = sessionsFor(exId);
  if (!sessions.length) return 'noch nichts eingetragen';
  return setText(heaviestSet(sessions[0].sets)) + ' · ' + relativeDay(sessions[0].day);
}

function renderBackupHint() {
  const box = $('backup-hint');
  const entries = data.sets.length + data.bodyweights.length;
  const daysSince = data.lastExport ? daysBetween(dayKey(data.lastExport), dayKey()) : null;
  const needed = (daysSince === null && entries >= 20) || (daysSince !== null && daysSince > 30);
  box.innerHTML = needed
    ? `<a class="backup-hint" href="#/einstellungen">💾 Letztes Backup: ${daysSince === null ? 'noch nie' : 'vor ' + daysSince + ' Tagen'} – jetzt sichern</a>`
    : '';
}

function addExercise(name) {
  name = name.trim();
  if (!name) return;
  if (data.exercises.some(e => e.name.toLowerCase() === name.toLowerCase())) {
    toast('Diese Übung gibt es schon');
    return;
  }
  // Wer Bankdrücken gelöscht hat und neu anlegt, bekommt wieder den Fortschrittsbalken
  const isBench = ['bankdrücken', 'bankdrücken lh'].includes(name.toLowerCase()) && !getExercise(BENCH_ID);
  data.exercises.push({ id: isBench ? BENCH_ID : makeId(), name, category: currentCategoryId });
  saveData();
  $('new-exercise-name').value = '';
  renderExerciseGrid();
  toast('„' + name + '“ hinzugefügt');
}

function deleteExercise(id) {
  const ex = getExercise(id);
  if (!ex) return;
  const count = data.sets.filter(s => s.exId === id).length;
  const question = count
    ? `„${ex.name}“ und alle ${count} eingetragenen Sätze löschen?`
    : `„${ex.name}“ löschen?`;
  if (!confirm(question)) return;
  data.exercises = data.exercises.filter(e => e.id !== id);
  data.sets = data.sets.filter(s => s.exId !== id);
  saveData();
  renderExerciseGrid();
}


/* ============================================================
   ÜBUNG: SATZ EINTRAGEN
   ============================================================ */

function showExercise(id) {
  currentExerciseId = id;
  showView('exercise');
  $('ex-title').textContent = getExercise(id).name;
  prefillExercise();
  renderExercise();
}

// Felder mit den Werten vom letzten Mal füllen:
// - Heute schon Sätze gemacht?  -> Werte vom letzten Satz heute
// - Sonst                       -> erster Satz vom letzten Training
function prefillExercise() {
  const sessions = sessionsFor(currentExerciseId);
  let weight = currentExerciseId === BENCH_ID ? data.settings.benchStart : 20;
  let reps = 10;

  if (sessions.length) {
    const latest = sessions[0];
    const set = latest.day === dayKey() ? latest.sets[latest.sets.length - 1] : latest.sets[0];
    weight = set.weight;
    reps = set.reps;
  }
  $('ex-weight').value = fmt(weight);
  $('ex-reps').value = reps;
}

function renderExercise() {
  const id = currentExerciseId;
  const sessions = sessionsFor(id);
  const today = dayKey();
  const todaySession = sessions.find(s => s.day === today);
  const lastSession = sessions.find(s => s.day !== today);

  // --- Letztes Training ---
  $('ex-last').innerHTML = lastSession
    ? `<div class="label">Letztes Training · ${formatDay(lastSession.day)} (${relativeDay(lastSession.day)})</div>
       <div class="big">${lastSession.sets.map(s => fmt(s.weight) + ' × ' + s.reps).join(' · ')}</div>
       <div class="hint">kg × Wiederholungen · ${lastSession.sets.length} ${lastSession.sets.length === 1 ? 'Satz' : 'Sätze'}</div>`
    : `<div class="label">Letztes Training</div>
       <div class="muted">Noch nichts eingetragen – das hier wird dein erster Eintrag.</div>`;

  // --- Heute ---
  $('ex-today').innerHTML = todaySession
    ? `<div class="label">Heute: ${todaySession.sets.length} ${todaySession.sets.length === 1 ? 'Satz' : 'Sätze'}</div>
       <div class="chips">${todaySession.sets.map(setChip).join('')}</div>`
    : '';

  // --- Alle Trainings ---
  $('ex-history').innerHTML = sessions.length
    ? sessions.map(sess => `
        <div class="history-day">
          <div class="label">${formatDay(sess.day)} · bestes 1RM ${fmt(best1RM(sess.sets), 1)} kg</div>
          <div class="chips">${sess.sets.map(setChip).join('')}</div>
        </div>`).join('')
    : '<p class="muted">Noch keine Einträge.</p>';

  // --- Diagramm: bestes Gewicht und geschätztes 1RM pro Tag ---
  const perDay = sessions.slice().reverse().map(sess => ({
    x: dayToDate(sess.day).getTime(),
    weight: heaviestSet(sess.sets).weight,
    oneRM: best1RM(sess.sets)
  }));
  const isBench = id === BENCH_ID;

  $('ex-legend').innerHTML =
    `<span style="--c: ${COLORS.accent}">Bestes Gewicht</span>
     <span class="dashed" style="--c: ${COLORS.blue}">Geschätztes 1RM</span>` +
    (isBench ? `<span class="dashed" style="--c: ${COLORS.green}">Ziel ${fmt(data.settings.benchGoal)} kg</span>` : '');

  redrawChart = () => drawChart($('ex-chart'), [
    { points: perDay.map(p => ({ x: p.x, y: p.oneRM })), color: COLORS.blue, dash: [6, 4], dots: true },
    { points: perDay.map(p => ({ x: p.x, y: p.weight })), color: COLORS.accent, dots: true, width: 2.5 }
  ], {
    hLines: isBench ? [{ y: data.settings.benchGoal, color: COLORS.green }] : [],
    emptyText: 'Noch keine Daten – trag deinen ersten Satz ein'
  });
  redrawChart();
}

function setChip(s) {
  return `<button class="chip" data-action="delete-set" data-id="${esc(s.id)}">${fmt(s.weight)} × ${s.reps}</button>`;
}

function saveSet() {
  const weight = parseNum($('ex-weight').value);
  const reps = Math.round(parseNum($('ex-reps').value));
  if (!(weight >= 0 && weight <= 1000)) return toast('Bitte ein gültiges Gewicht eingeben');
  if (!(reps >= 1 && reps <= 200)) return toast('Bitte gültige Wiederholungen eingeben');

  const previous = setsFor(currentExerciseId);
  const isRecord = previous.length > 0 && epley(weight, reps) > best1RM(previous) + 0.01;

  data.sets.push({ id: makeId(), exId: currentExerciseId, time: Date.now(), weight, reps });
  saveData();

  $('ex-weight').value = fmt(weight);
  $('ex-reps').value = reps;
  renderExercise();
  toast(isRecord ? '🏆 Neuer Rekord! ' + fmt(weight) + ' kg × ' + reps : 'Gespeichert: ' + fmt(weight) + ' kg × ' + reps + ' ✓');
  if (navigator.vibrate) navigator.vibrate(isRecord ? [40, 60, 40] : 30);
}

function deleteSet(id) {
  const set = data.sets.find(s => s.id === id);
  if (!set) return;
  if (!confirm(`Satz ${setText(set)} vom ${formatDay(dayKey(set.time))} löschen?`)) return;
  data.sets = data.sets.filter(s => s.id !== id);
  saveData();
  renderExercise();
}

// Plus/Minus-Buttons
function stepValue(button) {
  const input = $(button.dataset.target);
  const step = parseFloat(button.dataset.step);
  const min = parseFloat(input.dataset.min || '0');
  const decimals = parseInt(input.dataset.decimals || '2', 10);
  const minDecimals = parseInt(input.dataset.minDecimals || '0', 10);
  const factor = 10 ** decimals;

  let value = parseNum(input.value);
  if (isNaN(value)) value = min;
  value = Math.max(min, Math.round((value + step) * factor) / factor);
  input.value = fmt(value, decimals, minDecimals);
}


/* ============================================================
   KÖRPERGEWICHT
   ============================================================ */

function sortedBodyweights() {
  return data.bodyweights.slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}

// Durchschnitt aller Einträge der 7 Tage bis einschließlich "day"
function avg7(entries, day) {
  const from = addDays(day, -6);
  const values = entries.filter(e => e.day >= from && e.day <= day).map(e => e.kg);
  return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
}

function showBodyweight() {
  showView('bodyweight');
  const entries = sortedBodyweights();
  const last = entries[entries.length - 1];
  $('bw-input').value = fmt(last ? last.kg : 61.5, 1, 1);
  $('bw-date').value = dayKey();
  $('bw-reminder-time').value = data.settings.reminderTime;
  renderBodyweight();
}

function renderBodyweightNote() {
  const day = $('bw-date').value || dayKey();
  const existing = data.bodyweights.find(b => b.day === day);
  $('bw-note').textContent = existing
    ? `Für ${day === dayKey() ? 'heute' : formatDay(day)} ist schon ${fmt(existing.kg, 1, 1)} kg eingetragen – Speichern überschreibt den Wert.`
    : 'Tipp: Am besten morgens nach dem Aufstehen wiegen.';
}

function renderBodyweight() {
  const entries = sortedBodyweights();
  const s = data.settings;
  renderBodyweightNote();

  // --- Statistik ---
  if (!entries.length) {
    $('bw-stats').innerHTML = '<p class="muted">Trag dein erstes Gewicht ein, dann siehst du hier deine Entwicklung.</p>';
  } else {
    const lastDay = entries[entries.length - 1].day;
    const current = avg7(entries, lastDay);
    const weekAgo = avg7(entries, addDays(lastDay, -7));
    const monthAgo = avg7(entries, addDays(lastDay, -30));
    const perWeek = weekAgo === null ? null : current - weekAgo;
    const perMonth = monthAgo === null ? null : current - monthAgo;
    const remaining = s.targetBodyweight - current;

    const tile = (value, label) =>
      `<div class="stat"><div class="stat-value">${value}</div><div class="stat-label">${label}</div></div>`;

    let goalText = 'noch ' + fmt(remaining, 1, 1) + ' kg';
    let etaText = '';
    if (remaining <= 0) {
      goalText = 'Erreicht! 🎉';
    } else if (s.monthlyGain > 0) {
      const eta = new Date();
      eta.setDate(eta.getDate() + Math.round(remaining / s.monthlyGain * DAYS_PER_MONTH));
      etaText = `Bei ${fmtSigned(s.monthlyGain, 1)} kg/Monat erreichst du ${fmt(s.targetBodyweight, 1)} kg etwa im ${eta.toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })}.`;
    }

    // Tempo bewerten (Monatswert, sonst Wochenwert hochgerechnet)
    const rate = perMonth !== null ? perMonth : (perWeek !== null ? perWeek / 7 * DAYS_PER_MONTH : null);
    let status = '';
    if (rate !== null && s.monthlyGain > 0 && remaining > 0) {
      const rateText = fmtSigned(rate, 2) + ' kg/Monat';
      if (rate < s.monthlyGain * 0.5) status = `<p class="status warn">Aktuelles Tempo ${rateText} – langsamer als dein Ziel (${fmtSigned(s.monthlyGain, 1)} kg).</p>`;
      else if (rate > s.monthlyGain * 1.5) status = `<p class="status warn">Aktuelles Tempo ${rateText} – schneller als dein Ziel (${fmtSigned(s.monthlyGain, 1)} kg).</p>`;
      else status = `<p class="status good">Aktuelles Tempo ${rateText} – im Zielbereich ✓</p>`;
    }

    $('bw-stats').innerHTML =
      '<div class="stats">' +
        tile(fmt(current, 1, 1) + ' kg', '7-Tage-Durchschnitt') +
        tile(goalText, 'bis Ziel ' + fmt(s.targetBodyweight, 1) + ' kg') +
        tile(perWeek === null ? '–' : fmtSigned(perWeek, 2) + ' kg', perWeek === null ? 'pro Woche (noch zu wenig Daten)' : 'Veränderung pro Woche') +
        tile(perMonth === null ? '–' : fmtSigned(perMonth, 2) + ' kg', perMonth === null ? 'pro Monat (noch zu wenig Daten)' : 'Veränderung pro Monat') +
      '</div>' + status +
      (etaText ? `<p class="hint">${etaText}</p>` : '');
  }

  // --- Diagramm ---
  const singles = entries.map(e => ({ x: dayToDate(e.day).getTime(), y: e.kg }));
  const averages = entries.map(e => ({ x: dayToDate(e.day).getTime(), y: avg7(entries, e.day) }));
  let targetLine = [];
  if (entries.length >= 2 && s.monthlyGain > 0) {
    const first = entries[0], last = entries[entries.length - 1];
    const days = daysBetween(first.day, last.day);
    targetLine = [
      { x: dayToDate(first.day).getTime(), y: first.kg },
      { x: dayToDate(last.day).getTime(), y: first.kg + s.monthlyGain * days / DAYS_PER_MONTH }
    ];
  }
  redrawChart = () => drawChart($('bw-chart'), [
    { points: singles, color: COLORS.muted, line: false, dots: true, dotSize: 2.5 },
    { points: targetLine, color: COLORS.accent, dash: [6, 4], width: 1.5 },
    { points: averages, color: COLORS.green, width: 2.5 }
  ], { decimals: 1, emptyText: 'Noch keine Daten' });
  redrawChart();

  // --- Liste ---
  $('bw-history').innerHTML = entries.length
    ? entries.slice().reverse().map(e => `
        <div class="list-row">
          <span>${formatDay(e.day)}</span>
          <span><strong>${fmt(e.kg, 1, 1)} kg</strong>
            <button class="del-btn" data-action="delete-bodyweight" data-day="${e.day}" aria-label="Eintrag löschen">✕</button>
          </span>
        </div>`).join('')
    : '<p class="muted">Noch keine Einträge.</p>';
}

function saveBodyweight() {
  const kg = parseNum($('bw-input').value);
  if (!(kg >= 20 && kg <= 300)) return toast('Bitte ein gültiges Gewicht eingeben');
  const day = $('bw-date').value || dayKey();

  const existing = data.bodyweights.find(b => b.day === day);
  if (existing) existing.kg = kg;
  else data.bodyweights.push({ day, kg });
  saveData();

  $('bw-input').value = fmt(kg, 1, 1);
  renderBodyweight();
  toast((existing ? 'Aktualisiert: ' : 'Gespeichert: ') + fmt(kg, 1, 1) + ' kg ✓');
  if (navigator.vibrate) navigator.vibrate(30);
}

function deleteBodyweight(day) {
  const entry = data.bodyweights.find(b => b.day === day);
  if (!entry) return;
  if (!confirm(`Eintrag ${fmt(entry.kg, 1, 1)} kg vom ${formatDay(day)} löschen?`)) return;
  data.bodyweights = data.bodyweights.filter(b => b.day !== day);
  saveData();
  renderBodyweight();
}

// Erzeugt eine Kalender-Datei (.ics) mit täglichem Termin + Erinnerung.
// Das Handy fragt dann, ob der Termin in den Kalender soll.
function downloadReminder() {
  const time = $('bw-reminder-time').value || '07:00';
  data.settings.reminderTime = time;
  saveData();

  const [h, m] = time.split(':');
  const start = addDays(dayKey(), 1).replace(/-/g, '') + 'T' + h + m + '00';
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Trainings-Tracker//DE',
    'BEGIN:VEVENT',
    'UID:wiegen-' + makeId() + '@trainings-tracker',
    'DTSTAMP:' + stamp,
    'DTSTART:' + start,
    'DURATION:PT5M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Wiegen ⚖️',
    'DESCRIPTION:Morgens wiegen und in der Trainings-App eintragen.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Wiegen',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  downloadFile('wiegen-erinnerung.ics', ics, 'text/calendar');
  toast('Kalender-Datei erstellt – öffnen und hinzufügen');
}


/* ============================================================
   DIAGRAMM (einfaches Liniendiagramm auf einem <canvas>)
   series: [{ points: [{x, y}], color, dash, dots, line, width, dotSize }]
   ============================================================ */

function drawChart(canvas, series, options = {}) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.font = '12px system-ui, sans-serif';

  const points = series.flatMap(s => s.points);
  if (!points.length) {
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(options.emptyText || 'Noch keine Daten', w / 2, h / 2);
    return;
  }

  // Wertebereich bestimmen
  const hLines = options.hLines || [];
  const ys = points.map(p => p.y).concat(hLines.map(l => l.y));
  let minX = Math.min(...points.map(p => p.x)), maxX = Math.max(...points.map(p => p.x));
  let minY = Math.min(...ys), maxY = Math.max(...ys);
  if (minX === maxX) { minX -= 86400000; maxX += 86400000; }
  if (maxY - minY < 1) { minY -= 0.5; maxY += 0.5; }

  // "Runde" Abstände für die Gitterlinien wählen (z. B. 0,5 / 1 / 2 / 5 / 10 kg)
  const rough = (maxY - minY) / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].map(f => f * magnitude).find(v => v >= rough);
  minY = Math.floor(minY / step) * step;
  maxY = Math.ceil(maxY / step) * step;
  if (maxY === minY) maxY += step;

  const left = 42, right = 10, top = 10, bottom = 26;
  const sx = x => left + (x - minX) / (maxX - minX) * (w - left - right);
  const sy = y => top + (1 - (y - minY) / (maxY - minY)) * (h - top - bottom);

  // Gitterlinien + Beschriftung links
  const decimals = Number.isInteger(step) ? 0 : Number.isInteger(step * 10) ? 1 : 2;
  ctx.strokeStyle = COLORS.grid;
  ctx.fillStyle = COLORS.text;
  ctx.lineWidth = 1;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let value = minY; value <= maxY + step / 2; value += step) {
    const y = sy(value);
    ctx.beginPath(); ctx.moveTo(left, y); ctx.lineTo(w - right, y); ctx.stroke();
    ctx.fillText(fmt(value, decimals, decimals), left - 6, y);
  }

  // Datum unten (Anfang und Ende)
  const shortDate = x => { const d = new Date(x); return pad(d.getDate()) + '.' + pad(d.getMonth() + 1) + '.'; };
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.fillText(shortDate(minX), left, h - bottom + 8);
  ctx.textAlign = 'right';
  ctx.fillText(shortDate(maxX), w - right, h - bottom + 8);

  // Waagerechte Ziellinien
  for (const line of hLines) {
    ctx.strokeStyle = line.color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.beginPath(); ctx.moveTo(left, sy(line.y)); ctx.lineTo(w - right, sy(line.y)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Datenreihen
  for (const s of series) {
    if (!s.points.length) continue;
    ctx.strokeStyle = s.color;
    ctx.fillStyle = s.color;
    ctx.lineWidth = s.width || 2;
    ctx.lineJoin = 'round';

    if (s.line !== false && s.points.length > 1) {
      ctx.setLineDash(s.dash || []);
      ctx.beginPath();
      s.points.forEach((p, i) => (i ? ctx.lineTo(sx(p.x), sy(p.y)) : ctx.moveTo(sx(p.x), sy(p.y))));
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (s.dots || s.points.length === 1) {
      for (const p of s.points) {
        ctx.beginPath();
        ctx.arc(sx(p.x), sy(p.y), s.dotSize || 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}


/* ============================================================
   EINSTELLUNGEN, EXPORT & IMPORT
   ============================================================ */

function showSettings() {
  showView('settings');
  document.querySelectorAll('[data-setting]').forEach(input => {
    const value = data.settings[input.dataset.setting];
    input.value = typeof value === 'number' ? fmt(value) : value;
  });
  renderBackupInfo();
}

function renderBackupInfo() {
  $('backup-info').textContent =
    `${data.sets.length} Sätze und ${data.bodyweights.length} Gewichtseinträge gespeichert. ` +
    (data.lastExport ? 'Letzter Export: ' + formatDay(dayKey(data.lastExport)) + '.' : 'Noch kein Export gemacht.');
}

function changeSetting(input) {
  const key = input.dataset.setting;
  if (input.tagName === 'SELECT') {
    data.settings[key] = input.value;
  } else {
    const n = parseNum(input.value);
    if (isNaN(n) || n < 0) {
      toast('Bitte eine gültige Zahl eingeben');
      input.value = fmt(data.settings[key]);
      return;
    }
    data.settings[key] = n;
    input.value = fmt(n);
  }
  saveData();
  toast('Gespeichert ✓');
}

// Datei speichern: auf dem Handy über "Teilen" (z. B. "In Dateien sichern"
// oder Google Drive), am Computer als normaler Download.
async function saveFile(filename, content, type) {
  const file = new File([content], filename, { type });
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (isTouch && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: filename });
      return;
    } catch (err) {
      if (err.name === 'AbortError') return;   // abgebrochen
    }
  }
  downloadFile(filename, content, type);
}

function downloadFile(filename, content, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

function exportJson() {
  data.lastExport = new Date().toISOString();
  saveData();
  const backup = Object.assign({ app: 'trainings-tracker', exportiertAm: data.lastExport }, data);
  saveFile('training-backup-' + dayKey() + '.json', JSON.stringify(backup, null, 2), 'application/json');
  renderBackupInfo();
}

function exportCsv() {
  const num = n => String(Math.round(n * 100) / 100).replace('.', ',');
  const cell = v => (/[;"\n]/.test(String(v)) ? '"' + String(v).replace(/"/g, '""') + '"' : String(v));
  const rows = [['Typ', 'Datum', 'Uhrzeit', 'Muskelgruppe', 'Übung', 'Gewicht (kg)', 'Wiederholungen', 'Geschätztes 1RM (kg)']];

  data.sets.slice().sort((a, b) => a.time - b.time).forEach(s => {
    const d = new Date(s.time);
    const ex = getExercise(s.exId);
    const cat = ex && getCategory(ex.category);
    rows.push(['Satz', dayKey(d), pad(d.getHours()) + ':' + pad(d.getMinutes()),
      cat ? cat.name : '', ex ? ex.name : '?', num(s.weight), s.reps, num(epley(s.weight, s.reps))]);
  });
  sortedBodyweights().forEach(b => rows.push(['Körpergewicht', b.day, '', '', '', num(b.kg), '', '']));

  // ﻿ am Anfang sorgt dafür, dass Excel die Umlaute richtig anzeigt
  const csv = '﻿' + rows.map(r => r.map(cell).join(';')).join('\r\n');
  saveFile('training-' + dayKey() + '.csv', csv, 'text/csv');
}

function importFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed.exercises) || !Array.isArray(parsed.sets)) throw new Error('Falsches Format');
      const bwCount = Array.isArray(parsed.bodyweights) ? parsed.bodyweights.length : 0;
      if (!confirm(`Backup mit ${parsed.sets.length} Sätzen und ${bwCount} Gewichtseinträgen laden?\n\nDeine aktuellen Daten auf diesem Gerät werden dabei ersetzt.`)) return;
      data = normalizeData(parsed);
      saveData();
      showSettings();
      toast('Backup geladen ✓');
    } catch (err) {
      alert('Die Datei konnte nicht gelesen werden. Bitte eine JSON-Backup-Datei dieser App auswählen.');
    } finally {
      $('import-file').value = '';
    }
  };
  reader.readAsText(file);
}

function resetAll() {
  if (!confirm('Wirklich ALLE Daten löschen? Das kann nicht rückgängig gemacht werden.\n\nTipp: Vorher ein Backup exportieren.')) return;
  localStorage.removeItem(STORAGE_KEY);
  data = loadData();
  saveData();
  location.hash = '#/';
  toast('Alle Daten gelöscht');
}


/* ============================================================
   KLICKS & EINGABEN
   Jeder Button hat ein data-action="..." – hier steht, was dann passiert.
   ============================================================ */

document.addEventListener('click', event => {
  const el = event.target.closest('[data-action]');
  if (!el) return;

  switch (el.dataset.action) {
    case 'back':              goBack(); break;
    case 'toggle-edit':       editMode = !editMode; renderExerciseGrid(); break;
    case 'delete-exercise':   deleteExercise(el.dataset.id); break;
    case 'step':              stepValue(el); break;
    case 'save-set':          saveSet(); break;
    case 'delete-set':        deleteSet(el.dataset.id); break;
    case 'save-bodyweight':   saveBodyweight(); break;
    case 'delete-bodyweight': deleteBodyweight(el.dataset.day); break;
    case 'reminder':          downloadReminder(); break;
    case 'export-json':       exportJson(); break;
    case 'export-csv':        exportCsv(); break;
    case 'reset-all':         resetAll(); break;
  }
});

document.addEventListener('change', event => {
  const el = event.target;
  if (el.dataset.setting) changeSetting(el);
  if (el.id === 'import-file') importFile(el.files[0]);
  if (el.id === 'bw-date') renderBodyweightNote();
});

// Beim Antippen eines Zahlenfelds alles markieren -> direkt überschreiben
document.addEventListener('focusin', event => {
  if (event.target.classList.contains('step-input')) {
    setTimeout(() => event.target.select(), 0);
  }
});

$('add-exercise-form').addEventListener('submit', event => {
  event.preventDefault();
  addExercise($('new-exercise-name').value);
});

window.addEventListener('hashchange', () => {
  navigatedInApp = true;
  route();
});

// Diagramm neu zeichnen, wenn sich die Breite ändert (z. B. Handy gedreht)
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (window.innerWidth !== lastWidth && redrawChart) redrawChart();
  lastWidth = window.innerWidth;
});

// Wenn die App aus dem Hintergrund zurückkommt (neuer Tag?), Ansicht aktualisieren
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && (location.hash === '' || location.hash === '#/')) showHome();
});


/* ============================================================
   START
   ============================================================ */

saveData();   // beim allerersten Start die Standard-Übungen speichern
route();

// Browser bitten, die Daten dauerhaft aufzuheben
if (navigator.storage && navigator.storage.persist) navigator.storage.persist();

// Service Worker = macht die App installierbar und offline nutzbar
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('Service Worker:', err));
  });
}
