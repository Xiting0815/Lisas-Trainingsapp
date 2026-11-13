# SPEC – Lisas Trainings-App

Zielgruppe: Lisa, 35, untrainiert, iPhone, Nackenschmerzen/Schultern/oberer Rücken, Hohlkreuz beim Bücken.
Gesamte UI auf Deutsch, Anrede „du“. Vanilla JS (ES-Module), kein Build, Hash-Router, offline (Service Worker).
Repo/Pages: `Lisas-Trainingsapp`, Pfad `/Lisas-Trainingsapp/`. localStorage-Schlüssel `lisa.v1`.
Vorlage (nur lesen!): `/home/user/Physiotraining-` (PhysioBogen). Dort NICHTS ändern.

## 1. Arbeitsbereiche (Dateibesitz – nur eigene Dateien ändern, keine Commits; der Koordinator committet)

| Bereich | Dateien |
|---|---|
| **DATA** | `data/*.json`, `js/content.js`, `tools/*`, `tests/data*.test.js`, `tests/exercise-texts*.test.js`, `tests/figure*.test.js` |
| **LOGIC** | `js/logic/*`, `js/store.js`, `js/types.js`, `js/util/date.js`, `js/util/export-import.js`, `tests/logic-*.test.js` |
| **UI** | `index.html`, `manifest.webmanifest`, `sw.js`, `css/*`, `icons/*`, `js/app.js`, `js/router.js`, `js/render.js`, `js/views/*`, `js/components/*`, `js/util/audio.js`, `js/util/voice.js`, `tests/e2e-*.test.js`, `tests/views*.test.js` |

Wer ein Modul aus einem fremden Bereich braucht, nutzt nur die hier dokumentierte API. Fehlt etwas, kurz in `docs/REQUESTS.md` eintragen (anhängen) und mit einer vernünftigen Annahme weiterarbeiten.
Entfernte Dinge wirklich löschen (Sync/Drive, Ausrüstungsseite, eigene Workouts, Phasen/OP, Knie, Bogen, Kalorien/Gewicht, Rudern als eigene Einheit, Badges/XP). Aus der Vorlage lesen darf man alles.

## 2. Übungsdaten (`data/exercises.json`, Format `{version, exercises:[…]}`)

Felder wie in der Vorlage: `id, name, short, setup, steps[3-4], feel, category, type ('reps'|'hold'|'timed'), side ('both'|'each'|'alternate'), cues, cueWords, figure{poses,view,props,band,arrows,labels,mirror,tempo,loop}, instructions, mistakes`.
Entfernt: `block, equipment(Array), kneeNote, postOpNote, phaseMin, levels(alt), upgrades, setupByEquipment, shoulder*`.
Neu/Pflicht:
- `role`: `"mobil" | "kraft" | "rumpf" | "dehnen" | "atmung"` (Block im Training).
- `focus`: Array aus `"row"` (Schulterblatt-Rückzug: Rudern/Face Pull/Pull-Apart), `"rot"` (Außenrotation/unterer Trapez), `"hohlkreuz"` (Beckenkippen, Hüftbeuger, Rumpf), `"nacken"`, `"brust"`, `"entspannung"`, `"stehend-ohne-geraet"` (für Nacken-Reset).
- `levelRange`: `[min,max]` (1–8), in welchen Leveln die Übung vorkommen darf.
- `doses`: Array mit **8** Einträgen (Index 0 = Level 1): `{sets, reps?, seconds?, band?: 'yellow'|'red'|'green'|'blue'|'loop-orange'|'loop-blue', rest?}`; `reps` für type reps, `seconds` für hold/timed. Level 1 sehr leicht (1–2 Sätze, 8 Wdh., gelb).
- `gentler`: ID einer sanfteren Übung derselben `role` (für „Das tut weh“), oder `null`.
- `gear`: kurzer Text, was gebraucht wird (z. B. „Therabänder, Tür“, „Matte“, „Wärmekissen“); Pflicht-Bestandteil von `setup`.
- `warn` (optional): Sicherheitshinweis (Massagestab).
Verfügbare Ausrüstung (fest): Matte, Therabänder (gelb, rot, grün, blau), Blackroll-Loops (orange, blau), Massagestab, Wärmekissen, Rudergerät, Sling-Trainer mit Türanker + Griffen, Treppenstufe, Bürostuhl mit Rollen (also KEIN fester Stuhl → nichts, was einen stabilen Stuhl braucht), Tür. Keine Faszienrolle, kein Massageball.

Weitere Dateien (DATA):
- `data/routines.json`: `{reset:{name,minutes:2,items:[{exerciseId,seconds?|reps?,sets?}]}, evening:{name,minutes:5,items:[…]}}` (Inhalt siehe Auftrag: Nacken-Reset = Kinn zurück → Schultern hochziehen/fallen lassen → Schulterblätter setzen → Brust öffnen tief → 3 tiefe Atemzüge; Abend = Wärmekissen mit Bauchatmung → Nacken sanft dehnen → Kindhaltung oder Rückenlage 4-7-8).
- `data/tips.json`: `{tips:[{id,topic,title,text,icon}]}` – Alltagstipps (Handtasche, Bücken, Wischen/Saugen, Überkopf, Tragen, Mikropausen, Abends), mind. 21, warm, nie belehrend. `icon` ist ein einzelnes Emoji.
- `data/quotes.json`: `{quotes:[string]}` – liebevolle Sprüche, mind. 30.
- `data/poses.json`, `data/figure-overrides.json`: erzeugt/gepflegt über `tools/gen-poses.mjs`.

`js/content.js` (DATA): `loadContent()` → `{exercises, byId(Map-ähnlich: use getExercise), routines, tips, quotes, poses, figureOverrides}`; Exporte `getContent(), getExercise(id), _setContent(c)`, plus `loadContentSync(obj)` für Tests (Node: Dateien aus `data/` lesen via `fs`, siehe `tests/helpers/content-node.js` – DATA legt diesen Helper an: `export function readContentFromDisk(): Content`).

## 3. Daten im Speicher (`lisa.v1`, Schema-Version 1)

```
{
  schemaVersion: 1,
  settings: {
    voice: true, volume: 0.8,               // 0..1
    theme: 'auto'|'light'|'dark',
    reminder: { days:[1,3,5], time:'18:30', reset:false, resetTime:'12:30' }, // days: 0=So..6=Sa
    lastExportAt: null|ISO, exportHintDismissedAt: null|ISO
  },
  state: {
    level: 1,                 // 1..8
    levelSince: ISO|null,     // Zeitpunkt der letzten Level-Änderung
    trainingsAtLevel: 0,      // abgeschlossene Trainings seit levelSince
    lastExerciseIds: [],      // IDs des letzten Trainings (Abwechslung)
    lastUsed: { [exerciseId]: ISO },
    firstRunAt: ISO,
    installHintDismissed: false,
    activeSession: null|{...} // UI-eigenes Format, wird nach jedem Tipp gespeichert
  },
  sessions: [Session]         // neueste zuletzt
}
Session = {
  id, date: ISO, kind: 'training'|'reset'|'evening',
  minutes, level, light: 'green'|'yellow'|'red',
  painBefore: 0..10|null, painAfter: 0..10|null,
  effort: 'leicht'|'richtig'|'anstrengend'|'zuviel'|null,   // nur bei kind==='training'
  exerciseIds: [], skipped: [], swaps: [{from,to|null}],
  durationSec, levelChange: 'up'|'down'|'hold'|'pause-down'|null
}
```
Mini-Pause = Session mit `kind` `reset` oder `evening`. Trainings ändern das Level, Mini-Pausen nie.

**store.js (LOGIC)** – API: `STORAGE_KEY`, `SCHEMA_VERSION`, `defaults()`, `load()`, `get()`, `update(fn)` (fn bekommt mutierbare Kopie, wird gespeichert, Subscriber werden benachrichtigt), `save()`, `subscribe(fn)→unsub`, `exportData()→string(JSON)`, `importData(stringOrObj)→{ok, error?}`, `reset()`, `sanitize(data)`, `migrate(data)`, `rawSnapshot()`, `requestPersistentStorage()`, `lastSaveOk()`, `onSaveError(cb)`, `nowISO()`, `_setStorage(fake)`, `_setNow(fn)`. Robust gegen kaputte/fehlende Daten (Sanitize), Schema-Version + Migration, Backup einer korrupten Version unter `lisa.v1.corrupt-<ts>`.

## 4. Logik-API (LOGIC, alles rein/pur, ohne DOM, mit injizierbarem `now`/`rng`)

- `js/logic/traffic.js`: `lightFor(pain0to10) → 'green'|'yellow'|'red'` (0–3 / 4–6 / 7–10), `LIGHT_INFO = {green:{label,hint}, yellow:{label:'Heute sanft', hint:'Heute sanft – das hilft auch!'}, red:{label, hint:'Wenn das mehrere Tage so bleibt oder Warnzeichen dazukommen, lass es bitte ärztlich anschauen.'}}`, `WARNING_SIGNS` (Array deutscher Warnzeichen laut Auftrag).
- `js/logic/levels.js`: `LEVELS` (8 Einträge `{n, title, text}`; Text z. B. „Level 3 von 8 – …“), `nextLevel({state, sessions, now}) → {level, change:'up'|'hold'|'down'|'pause-down'|null, reason}` – Regeln: Steigern wenn letzte 2 Trainings effort ∈ {leicht, richtig} UND Schmerz danach ≤ davor+1 (pro Training) UND ≥ 2 Trainings auf Level UND ≥ 7 Tage seit `levelSince`; halten bei anstrengend; zurück um 1 bei zuviel oder Schmerzanstieg ≥ 2; nach > 14 Tagen ohne Training startet ein Training 1 Level niedriger (`pause-down`, wird vor dem Training berechnet: `effectiveLevel({state, sessions, now})`). Level bleibt in 1..8. `applyTrainingResult(data, session, now) → data` (pure; schreibt Session, Level, lastUsed, lastExerciseIds).
- `js/logic/compose.js`:
  - `composePlan({minutes:10|15|20, level, pain, exercises, lastExerciseIds, lastUsed, rng=Math.random, now}) → Plan`
  - `routinePlan(kind:'reset'|'evening', {routines, exercises, level}) → Plan`
  - `swapExercise(plan, index, {exercises, level, lastUsed, rng}) → {plan, replacement: id|null}` („Das tut weh“: `gentler`, sonst andere Übung gleicher `role` mit niedrigerem/gleichem Anspruch, sonst entfernen).
  - Plan = `{id, kind, minutes, level, light, notes:[string], items:[{exerciseId, block:'mobil'|'kraft'|'dehnen'|'atmung', role, sets, reps?, seconds?, band?, rest?, side, estSec}], estSec}`. Block-Zeiten laut Tabelle (10: 2/4/2/2, 15: 3/6/3/3, 20: 3/9/4/4 Min; Kraft 2/3/4 Übungen, 20 Min inkl. genau 1 Rumpf), Zeitbudget via `duration.js`.
  - Regeln: Übungen des letzten Trainings nicht wiederholen (soweit Pool es erlaubt), sonst „am längsten nicht dran“ zuerst; Kraftblock enthält ≥1 `focus` `row` und ≥1 `rot`; 15/20 Min: ≥1 `hohlkreuz`-Übung, Hüftbeuger-Dehnung regelmäßig; nur Übungen mit passender `levelRange`; Ampel gelb → Kraft-Level höchstens 2, mehr Mobilisation/Atmung, Notiz „Heute sanft – das hilft auch!“; rot → liefert den Abend-Entspannungs-Plan (`kind:'evening'`) mit Rot-Hinweis; ab Level 3 bei 20 Min optional `rowWarmup:true` (nur als Option im Plan, kein Timer).
- `js/logic/duration.js` – aus Vorlage übernommen und verschlankt: `estimateExerciseSeconds(item, exercise)`, `estimatePlanSeconds(plan, exerciseById)`.
- `js/logic/tips.js`: `tipOfDay(tips, date) → tip` (deterministisch rotierend nach Tag).
- `js/logic/week.js`: `weekSummary(sessions, now) → {trainings, breaks, text}` (Wochenstart Montag; text z. B. „Diese Woche: 2 Trainings, 4 Mini-Pausen 💗“), `daysSinceLast(sessions, now) → number|null`, `needsNudge(sessions, now) → bool` (≥3 Tage nichts), `needsExportHint(settings, now) → bool` (alle 14 Tage), `painSeries(sessions) → [{date, before, after}]`.
- `js/logic/reminders.js`: `buildICS({days, time, title, description, kind:'training'|'reset', now}) → string` (RFC 5545, CRLF, `RRULE:FREQ=WEEKLY;BYDAY=…`, `VALARM` 0 Min, `UID`, `DTSTAMP`, lokale Zeit ohne feste TZ = „floating“), `icsFileName(kind)`.
- `js/logic/cues.js`, `js/logic/exercise-text.js`: aus Vorlage, bereinigt (DATA/LOGIC einigen sich nicht – LOGIC besitzt beides).

## 5. UI-Verträge (UI)

Routen: `#/` (Heute), `#/session` (Training, aktive Session wird fortgesetzt), `#/summary/<id>` (nach dem Training), `#/history`, `#/settings`, `#/info` (Hinweise + Warnzeichen), `#/install` (iPhone-Installation bebildert). Tabs unten: Heute · Verlauf · Einstellungen (während Training ausgeblendet).
Sessions-Ablauf: Plan (von `composePlan`/`routinePlan`) → pro Übung: Figur + „Wofür“ (`short`) + 3–4 Schritte, „Mehr Details“ aufklappbar; Timer (5 s Vorbereitung, 5 s Entspannen; `pt-timer` aus Vorlage); Sprachansagen (`voice.js`); „Das tut weh“-Knopf → `swapExercise`; Nachher: Anstrengung (😌 leicht · 🙂 genau richtig · 😅 anstrengend · 😣 zu viel; nur bei Training), Schmerz 0–10 (`pt-pain-scale`), Feier + Spruch aus `quotes`. Speichern über `applyTrainingResult` bzw. bei Mini-Pausen nur Session anhängen.
Design: siehe Auftrag §10 (Rosé/Pink, Beere für Hauptknöpfe, Creme/Sand, Ampel sanft, ≥18 px, Knöpfe ≥56 px, WCAG AA, Dark = Aubergine). iOS-Head-Tags und Safe-Areas, Wake-Lock, Sprach-/Audio-Unlock nach Nutzergeste.

## 6. Tests
`node --test` (LOGIC: compose, duration, levels, traffic, week, reminders, store; DATA: Schema-/Referenz-Validierung aller Übungen; UI: Playwright-E2E im iPhone-Viewport `devices['iPhone 15']`: Start → Training → Rückmeldung → Verlauf). Playwright/Chromium sind vorinstalliert (`require('playwright')`). Vor jedem Abschluss `node tools/gen-precache.mjs` (UI) und `--check`.
