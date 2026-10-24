import type { DayKey } from './types';

/**
 * Trainingsplan – Übungen, Satzzahlen und Wiederholungsbereiche unverändert aus dem
 * alten Gym Tracker (ursprünglich aus der Excel-Tabelle). Neu sind nur Metadaten für
 * Empfehlungen und Auswertung: Muskelgruppen, Übungstyp und Standard-Gerät.
 */

export type MuscleGroup =
  | 'Upper Chest'
  | 'Mid Chest'
  | 'Lower Chest'
  | 'Upper Back'
  | 'Lats'
  | 'Front Delts'
  | 'Side Delts'
  | 'Rear Delts'
  | 'Biceps'
  | 'Triceps'
  | 'Quads'
  | 'Hamstrings'
  | 'Glutes'
  | 'Calves'
  | 'Adductors'
  | 'Abs'
  | 'Lower Back';

export const MUSCLE_GROUPS: MuscleGroup[] = [
  'Upper Chest',
  'Mid Chest',
  'Lower Chest',
  'Upper Back',
  'Lats',
  'Front Delts',
  'Side Delts',
  'Rear Delts',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Adductors',
  'Calves',
  'Abs',
  'Lower Back',
];

/** Grundübung (mehrgelenkig) oder Isolationsübung – steuert die Wiederholungsbereiche der Profile. */
export type ExerciseCategory = 'compound' | 'isolation';

export type EquipmentId =
  | 'dumbbell'
  | 'barbell'
  | 'smith'
  | 'cable'
  | 'machine'
  | 'plates'
  | 'bodyweight';

export interface PlannedExercise {
  /** Schlüssel für Verlauf und Empfehlungen – gleiche Übung, gleicher Verlauf, egal in welchem Plan */
  name: string;
  /** optionaler Anzeigename im Plan, z. B. „Leg Press / V-Squat“ */
  label?: string;
  targetSets: number;
  repRange: { min: number; max: number | null };
}

export type DayKind = 'strength' | 'cardio' | 'rest';

export interface TrainingDay {
  key: DayKey;
  kind: DayKind;
  label: string;
  short: string;
  title: string;
  /** sehr kurzer Titel für die Tagesauswahl */
  tag: string;
  weekday: number;
  exercises: PlannedExercise[];
}

export interface TrainingPlan {
  id: string;
  name: string;
  days: Record<DayKey, TrainingDay>;
}

export const WEEK: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const WEEKDAY: Record<DayKey, { name: string; short: string; index: number }> = {
  monday: { name: 'Montag', short: 'Mo', index: 1 },
  tuesday: { name: 'Dienstag', short: 'Di', index: 2 },
  wednesday: { name: 'Mittwoch', short: 'Mi', index: 3 },
  thursday: { name: 'Donnerstag', short: 'Do', index: 4 },
  friday: { name: 'Freitag', short: 'Fr', index: 5 },
  saturday: { name: 'Samstag', short: 'Sa', index: 6 },
  sunday: { name: 'Sonntag', short: 'So', index: 0 },
};

function day(key: DayKey, kind: DayKind, title: string, tag: string, exercises: PlannedExercise[] = []): TrainingDay {
  return { key, kind, label: `${WEEKDAY[key].name} – ${title}`, short: WEEKDAY[key].short, title, tag, weekday: WEEKDAY[key].index, exercises };
}

const set = (name: string, targetSets: number, min: number, max: number | null, label?: string): PlannedExercise =>
  label ? { name, label, targetSets, repRange: { min, max } } : { name, targetSets, repRange: { min, max } };

/**
 * Dein bisheriger Plan – Sets und Rep-Ranges unverändert aus dem alten Gym Tracker
 * (ursprünglich aus der Excel-Tabelle). Gilt für „Individuell“, Maximalkraft und Kraftausdauer.
 */
export const CLASSIC_PLAN: TrainingPlan = {
  id: 'classic',
  name: 'Dein Plan',
  days: {
    monday: day('monday', 'strength', 'Anterior Chain', 'Ant.', [
      set('Schrägbank Kurzhantel Bankdrücken', 3, 6, 10),
      set('Dips', 3, 8, 12),
      set('Chest Flys', 2, 12, 15),
      set('Katana Extensions', 2, 10, 15),
      set('Beinstrecker', 3, 10, 15),
      set('Seitheben Maschine/Schulter', 3, 12, 20),
    ]),
    tuesday: day('tuesday', 'strength', 'Posterior Chain', 'Post.', [
      set('T-Bar Row mit Brustauflage', 3, 6, 12),
      set('Latzug', 3, 8, 12),
      set('RDLs', 2, 6, 10),
      set('Beinbeuger', 2, 10, 15),
      set('Face Pulls', 2, 12, 15),
      set('Bicep Curls Ellenbogen hinter Körper', 2, 10, 12),
      set('Hanging Leg Raises', 3, 6, 10),
    ]),
    wednesday: day('wednesday', 'cardio', 'Cardio', 'Cardio'),
    thursday: day('thursday', 'strength', 'Chest & Arms', 'Arms', [
      set('Schrägbank Bankdrücken Multipresse', 3, 8, 12),
      set('Brustpresse', 2, 8, 12),
      set('Hammer Curls', 2, 10, 12),
      set('Trizeps Pushdowns', 2, 10, 15),
      set('Preacher Curl', 2, 8, 12),
    ]),
    friday: day('friday', 'strength', 'Lower Body', 'Legs', [
      set('Beinpresse', 2, 8, 15),
      set('Beinstrecker', 2, 10, 15),
      set('Beinbeuger', 2, 8, 15),
      set('Adduktoren', 2, 12, 15),
      set('Waden', 3, 10, 12),
      set('Cable Crunches', 4, 20, 30),
    ]),
    saturday: day('saturday', 'strength', 'Shoulders & Back', 'Upper', [
      set('Kurzhantel Schulterdrücken', 3, 6, 10),
      set('Rudern mit Brustauflage sitzend', 3, 8, 12),
      set('Latzug eng im Untergriff', 3, 8, 12),
      set('Seitheben Kurzhantel', 3, 12, 20),
      set('Back Extensions', 3, 12, 20),
    ]),
    sunday: day('sunday', 'cardio', 'Cardio', 'Cardio'),
  },
};

/** Hypertrophie-Plan: 4 Trainingstage mit je 2 Sets, Do Ruhetag, Mi und So Cardio. */
export const HYPERTROPHY_PLAN: TrainingPlan = {
  id: 'hypertrophy',
  name: 'Hypertrophie',
  days: {
    monday: day('monday', 'strength', 'Upper Body', 'Day 1', [
      set('Plate-Loaded Press', 2, 7, 10),
      set('Upper-Chest Fly', 2, 7, 10),
      set('Mid-Chest Fly', 2, 7, 10),
      set('Unilateral Seated Row/Pull', 2, 7, 10),
      set('Lying Cable Lat Pulldown', 2, 7, 10),
      set('Low/Triceps Pulldown', 2, 7, 10),
      set('Cable Curl', 2, 7, 10),
    ]),
    tuesday: day('tuesday', 'strength', 'Legs', 'Day 2', [
      set('Hack Squat', 2, 7, 10),
      set('Hack Squat / Hack Sit', 2, 7, 10),
      set('Bulgarian Split Squat', 2, 7, 10),
      set('Seated Hamstring Curl', 2, 8, 10),
      set('Hack Calf Raise', 2, 7, 10),
      set('Cable Crunches', 2, 7, 10, 'Cable Crunch'),
    ]),
    wednesday: day('wednesday', 'cardio', 'Cardio', 'Cardio'),
    thursday: day('thursday', 'rest', 'Rest Day', 'Rest'),
    friday: day('friday', 'strength', 'Pull', 'Day 3', [
      set('Lat Row', 2, 7, 10),
      set('Unilateral Pulldown', 2, 7, 10),
      set('Low Row', 2, 7, 10),
      set('Reverse Fly', 2, 7, 10),
      set('Cable Y-Raise', 2, 7, 10),
      set('Incline Dumbbell Curl', 2, 7, 10),
    ]),
    saturday: day('saturday', 'strength', 'Legs + Shoulders/Arms', 'Day 4', [
      set('Beinstrecker', 2, 7, 10),
      set('Beinpresse', 2, 7, 10, 'Leg Press / V-Squat'),
      set('Deficit Romanian Deadlift', 2, 7, 10),
      set('Weighted GHD', 2, 7, 10),
      set('DB Stretch Fly', 2, 7, 10),
      set('Cable Front Raise', 2, 7, 10),
      set('Overhead Triceps Extension', 2, 7, 10),
    ]),
    sunday: day('sunday', 'cardio', 'Cardio', 'Cardio'),
  },
};

export const PLANS: Record<string, TrainingPlan> = {
  classic: CLASSIC_PLAN,
  hypertrophy: HYPERTROPHY_PLAN,
};

export function planById(id: string | undefined): TrainingPlan {
  return (id && PLANS[id]) || CLASSIC_PLAN;
}

/** Krafttage eines Plans in Wochenreihenfolge. */
export function strengthDays(plan: TrainingPlan): DayKey[] {
  return WEEK.filter((key) => plan.days[key].kind === 'strength');
}

/** Kompatibilität: Tage und Übungen deines bisherigen Plans. */
export const TRAINING_PLAN = CLASSIC_PLAN.days;
export const DAY_KEYS: DayKey[] = strengthDays(CLASSIC_PLAN);

export interface ExerciseInfo {
  category: ExerciseCategory;
  equipment: EquipmentId;
  /** Hauptmuskeln zählen fürs Volumen, Hilfsmuskeln dienen nur der Info. */
  primary: MuscleGroup[];
  secondary: MuscleGroup[];
  short?: string;
}

// Schlüssel = gespeicherter Name (bleibt für alte Daten gleich), `short` = englischer Anzeigename
export const EXERCISE_INFO: Record<string, ExerciseInfo> = {
  'Schrägbank Kurzhantel Bankdrücken': { category: 'compound', equipment: 'dumbbell', primary: ['Upper Chest'], secondary: ['Front Delts', 'Triceps'], short: 'Incline Dumbbell Press' },
  'Dips': { category: 'compound', equipment: 'machine', primary: ['Lower Chest', 'Triceps'], secondary: ['Front Delts'], short: 'Dips' },
  'Chest Flys': { category: 'isolation', equipment: 'machine', primary: ['Mid Chest'], secondary: [], short: 'Chest Fly' },
  'Katana Extensions': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [], short: 'Katana Extensions' },
  'Beinstrecker': { category: 'isolation', equipment: 'machine', primary: ['Quads'], secondary: [], short: 'Leg Extension' },
  'Seitheben Maschine/Schulter': { category: 'isolation', equipment: 'machine', primary: ['Side Delts'], secondary: [], short: 'Machine Lateral Raise' },
  'T-Bar Row mit Brustauflage': { category: 'compound', equipment: 'plates', primary: ['Upper Back'], secondary: ['Lats', 'Biceps', 'Rear Delts'], short: 'Chest-Supported T-Bar Row' },
  'Latzug': { category: 'compound', equipment: 'machine', primary: ['Lats'], secondary: ['Upper Back', 'Biceps'], short: 'Lat Pulldown' },
  'RDLs': { category: 'compound', equipment: 'barbell', primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'], short: 'Romanian Deadlift' },
  'Beinbeuger': { category: 'isolation', equipment: 'machine', primary: ['Hamstrings'], secondary: [], short: 'Leg Curl' },
  'Face Pulls': { category: 'isolation', equipment: 'cable', primary: ['Rear Delts'], secondary: ['Upper Back'], short: 'Face Pulls' },
  'Bicep Curls Ellenbogen hinter Körper': { category: 'isolation', equipment: 'cable', primary: ['Biceps'], secondary: [], short: 'Bayesian Curl' },
  'Hanging Leg Raises': { category: 'isolation', equipment: 'bodyweight', primary: ['Abs'], secondary: [], short: 'Hanging Leg Raises' },
  'Schrägbank Bankdrücken Multipresse': { category: 'compound', equipment: 'smith', primary: ['Upper Chest'], secondary: ['Front Delts', 'Triceps'], short: 'Incline Smith Machine Press' },
  'Brustpresse': { category: 'compound', equipment: 'machine', primary: ['Mid Chest'], secondary: ['Triceps', 'Front Delts'], short: 'Chest Press' },
  'Hammer Curls': { category: 'isolation', equipment: 'dumbbell', primary: ['Biceps'], secondary: [], short: 'Hammer Curls' },
  'Trizeps Pushdowns': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [], short: 'Triceps Pushdown' },
  'Preacher Curl': { category: 'isolation', equipment: 'dumbbell', primary: ['Biceps'], secondary: [], short: 'Preacher Curl' },
  'Beinpresse': { category: 'compound', equipment: 'plates', primary: ['Quads', 'Glutes'], secondary: ['Adductors'], short: 'Leg Press' },
  'Adduktoren': { category: 'isolation', equipment: 'machine', primary: ['Adductors'], secondary: [], short: 'Hip Adduction' },
  'Waden': { category: 'isolation', equipment: 'machine', primary: ['Calves'], secondary: [], short: 'Calf Raises' },
  'Cable Crunches': { category: 'isolation', equipment: 'cable', primary: ['Abs'], secondary: [], short: 'Cable Crunches' },
  'Kurzhantel Schulterdrücken': { category: 'compound', equipment: 'dumbbell', primary: ['Front Delts'], secondary: ['Side Delts', 'Triceps'], short: 'Dumbbell Shoulder Press' },
  'Rudern mit Brustauflage sitzend': { category: 'compound', equipment: 'machine', primary: ['Upper Back'], secondary: ['Lats', 'Biceps', 'Rear Delts'], short: 'Chest-Supported Seated Row' },
  'Latzug eng im Untergriff': { category: 'compound', equipment: 'machine', primary: ['Lats'], secondary: ['Biceps'], short: 'Close-Grip Underhand Pulldown' },
  'Seitheben Kurzhantel': { category: 'isolation', equipment: 'dumbbell', primary: ['Side Delts'], secondary: [], short: 'Dumbbell Lateral Raise' },
  'Back Extensions': { category: 'isolation', equipment: 'bodyweight', primary: ['Lower Back'], secondary: ['Glutes', 'Hamstrings'], short: 'Back Extensions' },

  // Hypertrophie-Plan (Day 1–4)
  'Plate-Loaded Press': { category: 'compound', equipment: 'plates', primary: ['Mid Chest'], secondary: ['Front Delts', 'Triceps'] },
  'Upper-Chest Fly': { category: 'isolation', equipment: 'cable', primary: ['Upper Chest'], secondary: [] },
  'Mid-Chest Fly': { category: 'isolation', equipment: 'machine', primary: ['Mid Chest'], secondary: [] },
  'Unilateral Seated Row/Pull': { category: 'compound', equipment: 'machine', primary: ['Upper Back'], secondary: ['Lats', 'Biceps', 'Rear Delts'] },
  'Lying Cable Lat Pulldown': { category: 'compound', equipment: 'cable', primary: ['Lats'], secondary: ['Biceps'] },
  'Low/Triceps Pulldown': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [] },
  'Cable Curl': { category: 'isolation', equipment: 'cable', primary: ['Biceps'], secondary: [] },
  'Hack Squat': { category: 'compound', equipment: 'plates', primary: ['Quads'], secondary: ['Glutes'] },
  'Hack Squat / Hack Sit': { category: 'compound', equipment: 'plates', primary: ['Quads'], secondary: ['Glutes'] },
  'Bulgarian Split Squat': { category: 'compound', equipment: 'dumbbell', primary: ['Quads', 'Glutes'], secondary: ['Adductors'] },
  'Seated Hamstring Curl': { category: 'isolation', equipment: 'machine', primary: ['Hamstrings'], secondary: [] },
  'Hack Calf Raise': { category: 'isolation', equipment: 'plates', primary: ['Calves'], secondary: [] },
  'Lat Row': { category: 'compound', equipment: 'machine', primary: ['Lats'], secondary: ['Upper Back', 'Biceps'] },
  'Unilateral Pulldown': { category: 'compound', equipment: 'machine', primary: ['Lats'], secondary: ['Biceps'] },
  'Low Row': { category: 'compound', equipment: 'cable', primary: ['Upper Back'], secondary: ['Lats', 'Biceps', 'Rear Delts'] },
  'Reverse Fly': { category: 'isolation', equipment: 'machine', primary: ['Rear Delts'], secondary: ['Upper Back'] },
  'Cable Y-Raise': { category: 'isolation', equipment: 'cable', primary: ['Side Delts'], secondary: ['Rear Delts'] },
  'Incline Dumbbell Curl': { category: 'isolation', equipment: 'dumbbell', primary: ['Biceps'], secondary: [] },
  'Deficit Romanian Deadlift': { category: 'compound', equipment: 'barbell', primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'] },
  'Weighted GHD': { category: 'isolation', equipment: 'bodyweight', primary: ['Glutes', 'Lower Back'], secondary: ['Hamstrings'] },
  'DB Stretch Fly': { category: 'isolation', equipment: 'dumbbell', primary: ['Mid Chest'], secondary: [] },
  'Cable Front Raise': { category: 'isolation', equipment: 'cable', primary: ['Front Delts'], secondary: [] },
  'Overhead Triceps Extension': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [] },
};

const FALLBACK_INFO: ExerciseInfo = { category: 'isolation', equipment: 'machine', primary: [], secondary: [] };

export function exerciseInfo(name: string): ExerciseInfo {
  return EXERCISE_INFO[name] ?? FALLBACK_INFO;
}

export function shortName(name: string): string {
  return EXERCISE_INFO[name]?.short ?? name;
}

/** Anzeigename einer Übung im Plan (eigener Name im Plan hat Vorrang). */
export function plannedName(planned: PlannedExercise): string {
  return planned.label ?? shortName(planned.name);
}

/** Anzeigename einer Übung so, wie sie im Plan an diesem Tag heißt (z. B. „Leg Press / V-Squat“). */
export function exerciseLabel(name: string, planId?: string, day?: DayKey): string {
  const planned = day ? planById(planId).days[day]?.exercises.find((exercise) => exercise.name === name) : undefined;
  return planned ? plannedName(planned) : shortName(name);
}

/** Titel eines gespeicherten Trainings nach dem Plan, mit dem es gemacht wurde. */
export function workoutTitle(workout: { planId?: string; trainingDay: DayKey; trainingDayLabel?: string }): string {
  return planById(workout.planId).days[workout.trainingDay]?.title ?? workout.trainingDayLabel ?? 'Training';
}

/** Alle Übungsnamen aus allen Plänen, alphabetisch nach Anzeigenamen. */
export const ALL_EXERCISE_NAMES: string[] = [
  ...new Set(Object.values(PLANS).flatMap((plan) => strengthDays(plan).flatMap((key) => plan.days[key].exercises.map((exercise) => exercise.name)))),
].sort((a, b) => shortName(a).localeCompare(shortName(b), 'en'));

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && (WEEK as string[]).includes(value);
}

/* ---------- Ganze Woche ---------- */

export type WeekDayKey = DayKey;

export interface WeekDayInfo {
  key: DayKey;
  short: string;
  tag: string;
  title: string;
  kind: DayKind;
}

export function weekDayInfo(plan: TrainingPlan, key: DayKey): WeekDayInfo {
  const entry = plan.days[key];
  return { key, short: entry.short, tag: entry.tag, title: entry.title, kind: entry.kind };
}

/** Wochentag von heute (Mo–So). */
export function todaysWeekDay(date = new Date()): DayKey {
  return WEEK[(date.getDay() + 6) % 7];
}
