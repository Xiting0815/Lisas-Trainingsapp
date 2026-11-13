// JSDoc-Typen für Lisas Trainings-App (nur Dokumentation, keine Laufzeit-Logik). Siehe docs/SPEC.md §2–§4.

/** @typedef {'mobil'|'kraft'|'rumpf'|'dehnen'|'atmung'} Role Rolle einer Übung im Training. */
/** @typedef {'mobil'|'kraft'|'dehnen'|'atmung'} Block Block im Training (Rumpf zählt zum Kraftblock). */
/** @typedef {'row'|'rot'|'hohlkreuz'|'nacken'|'brust'|'entspannung'|'stehend-ohne-geraet'} Focus */
/** @typedef {'green'|'yellow'|'red'} Light Schmerz-Ampel. */
/** @typedef {'leicht'|'richtig'|'anstrengend'|'zuviel'} Effort Rückmeldung „Wie anstrengend war's?“. */
/** @typedef {'training'|'reset'|'evening'} SessionKind */
/** @typedef {'up'|'down'|'hold'|'pause-down'} LevelChange */

/**
 * Dosis einer Übung pro Level (data/exercises.json: `doses[level-1]`).
 * `reps` für type reps; `seconds` für hold (Haltedauer, optional `reps` = Anzahl Halten) und timed.
 * @typedef {{sets: number, reps?: number, seconds?: number, band?: 'yellow'|'red'|'green'|'blue'|'loop-orange'|'loop-blue', rest?: number}} Dose
 */

/**
 * Übung (Daten aus data/exercises.json).
 * @typedef {Object} Exercise
 * @property {string} id
 * @property {string} name
 * @property {string} short
 * @property {string} setup
 * @property {string[]} steps
 * @property {string} feel
 * @property {string} category
 * @property {'reps'|'hold'|'timed'} type
 * @property {'both'|'each'|'alternate'} side
 * @property {Role} role
 * @property {Focus[]} focus
 * @property {[number, number]} levelRange
 * @property {Dose[]} doses 8 Einträge, Index 0 = Level 1
 * @property {string|null} gentler ID einer sanfteren Übung derselben Rolle
 * @property {string} gear
 * @property {string} [warn]
 * @property {number} [setupSec]
 * @property {Object} [cueWords]
 * @property {Object} [figure]
 */

/**
 * Ein Eintrag im Plan.
 * @typedef {Object} PlanItem
 * @property {string} exerciseId
 * @property {Block} block
 * @property {Role} role
 * @property {number} sets
 * @property {number} [reps]
 * @property {number} [seconds]
 * @property {string} [band]
 * @property {number} [rest]
 * @property {'both'|'each'|'alternate'} side
 * @property {number} estSec geschätzte Dauer in Sekunden (inkl. Vorbereitung)
 */

/**
 * Trainingsplan (von composePlan / routinePlan).
 * @typedef {Object} Plan
 * @property {string} id
 * @property {SessionKind} kind
 * @property {number} minutes
 * @property {number} level
 * @property {Light} light
 * @property {string[]} notes
 * @property {PlanItem[]} items
 * @property {number} estSec
 * @property {boolean} [rowWarmup] ab Level 3 bei 20 Min als Option
 * @property {number} [kraftLevel] Level, das für Kraft/Rumpf-Dosen benutzt wurde (bei Gelb höchstens 2)
 */

/**
 * Abgeschlossene Einheit (Training oder Mini-Pause).
 * @typedef {Object} Session
 * @property {string} id
 * @property {string} date ISO-Zeitstempel
 * @property {SessionKind} kind
 * @property {number} minutes
 * @property {number} level
 * @property {Light} light
 * @property {number|null} painBefore 0..10
 * @property {number|null} painAfter 0..10
 * @property {Effort|null} effort nur bei kind === 'training'
 * @property {string[]} exerciseIds
 * @property {string[]} skipped
 * @property {{from: string, to: string|null}[]} swaps
 * @property {number} durationSec
 * @property {LevelChange|null} levelChange
 */

/**
 * @typedef {Object} Settings
 * @property {boolean} voice
 * @property {number} volume 0..1
 * @property {'auto'|'light'|'dark'} theme
 * @property {{days: number[], time: string, reset: boolean, resetTime: string}} reminder days: 0=So..6=Sa
 * @property {string|null} lastExportAt
 * @property {string|null} exportHintDismissedAt
 */

/**
 * @typedef {Object} State
 * @property {number} level 1..8
 * @property {string|null} levelSince
 * @property {number} trainingsAtLevel
 * @property {string[]} lastExerciseIds
 * @property {Record<string, string>} lastUsed
 * @property {string} firstRunAt
 * @property {boolean} installHintDismissed
 * @property {Object|null} activeSession UI-eigenes Format
 */

/**
 * Alles, was unter `lisa.v1` gespeichert wird.
 * @typedef {Object} Data
 * @property {number} schemaVersion
 * @property {Settings} settings
 * @property {State} state
 * @property {Session[]} sessions neueste zuletzt
 */

/**
 * Ein Schritt eines Ansage-Plans (cues.exerciseCuePlan). `say` wird zu Beginn gesprochen ('' = still).
 * @typedef {Object} CuePhase
 * @property {string} phase
 * @property {number} seconds
 * @property {string} say
 * @property {number|null} setIndex
 * @property {number|null} repIndex
 * @property {number|null} side
 */

/**
 * Geladene Inhalte (js/content.js).
 * @typedef {Object} Content
 * @property {Exercise[]} exercises
 * @property {{reset: any, evening: any}} routines
 * @property {{id: string, topic: string, title: string, text: string, icon: string}[]} tips
 * @property {string[]} quotes
 * @property {any} poses
 * @property {any} figureOverrides
 */

export {};
