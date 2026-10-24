import { CARDIO_DAYS, type CardioDayKey } from './cardio';
import type { DayKey } from './types';

/**
 * Trainingsplan – Übungen, Satzzahlen und Wiederholungsbereiche unverändert aus dem
 * alten Gym Tracker (ursprünglich aus der Excel-Tabelle). Neu sind nur Metadaten für
 * Empfehlungen und Auswertung: Muskelgruppen, Übungstyp und Standard-Gerät.
 */

export type MuscleGroup =
  | 'Chest'
  | 'Back'
  | 'Shoulders'
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
  'Chest',
  'Back',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Calves',
  'Adductors',
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
  name: string;
  targetSets: number;
  repRange: { min: number; max: number | null };
}

export interface TrainingDay {
  key: DayKey;
  label: string;
  short: string;
  title: string;
  /** sehr kurzer Titel für die Tagesauswahl */
  tag: string;
  weekday: number;
  exercises: PlannedExercise[];
}

export const TRAINING_PLAN: Record<DayKey, TrainingDay> = {
  monday: {
    key: 'monday',
    label: 'Montag – Anterior Chain',
    short: 'Mo',
    title: 'Anterior Chain',
    tag: 'Ant.',
    weekday: 1,
    exercises: [
      { name: 'Schrägbank Kurzhantel Bankdrücken', targetSets: 3, repRange: { min: 6, max: 10 } },
      { name: 'Dips', targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: 'Chest Flys', targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: 'Katana Extensions', targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: 'Beinstrecker', targetSets: 3, repRange: { min: 10, max: 15 } },
      { name: 'Seitheben Maschine/Schulter', targetSets: 3, repRange: { min: 12, max: 20 } },
    ],
  },
  tuesday: {
    key: 'tuesday',
    label: 'Dienstag – Posterior Chain',
    short: 'Di',
    title: 'Posterior Chain',
    tag: 'Post.',
    weekday: 2,
    exercises: [
      { name: 'T-Bar Row mit Brustauflage', targetSets: 3, repRange: { min: 6, max: 12 } },
      { name: 'Latzug', targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: 'RDLs', targetSets: 2, repRange: { min: 6, max: 10 } },
      { name: 'Beinbeuger', targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: 'Face Pulls', targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: 'Bicep Curls Ellenbogen hinter Körper', targetSets: 2, repRange: { min: 10, max: 12 } },
      { name: 'Hanging Leg Raises', targetSets: 3, repRange: { min: 6, max: 10 } },
    ],
  },
  thursday: {
    key: 'thursday',
    label: 'Donnerstag – Chest & Arms',
    short: 'Do',
    title: 'Chest & Arms',
    tag: 'Arms',
    weekday: 4,
    exercises: [
      { name: 'Schrägbank Bankdrücken Multipresse', targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: 'Brustpresse', targetSets: 2, repRange: { min: 8, max: 12 } },
      { name: 'Hammer Curls', targetSets: 2, repRange: { min: 10, max: 12 } },
      { name: 'Trizeps Pushdowns', targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: 'Preacher Curl', targetSets: 2, repRange: { min: 8, max: 12 } },
    ],
  },
  friday: {
    key: 'friday',
    label: 'Freitag – Lower Body',
    short: 'Fr',
    title: 'Lower Body',
    tag: 'Legs',
    weekday: 5,
    exercises: [
      { name: 'Beinpresse', targetSets: 2, repRange: { min: 8, max: 15 } },
      { name: 'Beinstrecker', targetSets: 2, repRange: { min: 10, max: 15 } },
      { name: 'Beinbeuger', targetSets: 2, repRange: { min: 8, max: 15 } },
      { name: 'Adduktoren', targetSets: 2, repRange: { min: 12, max: 15 } },
      { name: 'Waden', targetSets: 3, repRange: { min: 10, max: 12 } },
      { name: 'Cable Crunches', targetSets: 4, repRange: { min: 20, max: 30 } },
    ],
  },
  saturday: {
    key: 'saturday',
    label: 'Samstag – Shoulders & Back',
    short: 'Sa',
    title: 'Shoulders & Back',
    tag: 'Upper',
    weekday: 6,
    exercises: [
      { name: 'Kurzhantel Schulterdrücken', targetSets: 3, repRange: { min: 6, max: 10 } },
      { name: 'Rudern mit Brustauflage sitzend', targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: 'Latzug eng im Untergriff', targetSets: 3, repRange: { min: 8, max: 12 } },
      { name: 'Seitheben Kurzhantel', targetSets: 3, repRange: { min: 12, max: 20 } },
      { name: 'Back Extensions', targetSets: 3, repRange: { min: 12, max: 20 } },
    ],
  },
};

export const DAY_KEYS: DayKey[] = ['monday', 'tuesday', 'thursday', 'friday', 'saturday'];

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
  'Schrägbank Kurzhantel Bankdrücken': { category: 'compound', equipment: 'dumbbell', primary: ['Chest'], secondary: ['Shoulders', 'Triceps'], short: 'Incline Dumbbell Press' },
  'Dips': { category: 'compound', equipment: 'machine', primary: ['Chest', 'Triceps'], secondary: ['Shoulders'], short: 'Dips' },
  'Chest Flys': { category: 'isolation', equipment: 'machine', primary: ['Chest'], secondary: [], short: 'Chest Fly' },
  'Katana Extensions': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [], short: 'Katana Extensions' },
  'Beinstrecker': { category: 'isolation', equipment: 'machine', primary: ['Quads'], secondary: [], short: 'Leg Extension' },
  'Seitheben Maschine/Schulter': { category: 'isolation', equipment: 'machine', primary: ['Shoulders'], secondary: [], short: 'Machine Lateral Raise' },
  'T-Bar Row mit Brustauflage': { category: 'compound', equipment: 'plates', primary: ['Back'], secondary: ['Biceps', 'Shoulders'], short: 'Chest-Supported T-Bar Row' },
  'Latzug': { category: 'compound', equipment: 'machine', primary: ['Back'], secondary: ['Biceps'], short: 'Lat Pulldown' },
  'RDLs': { category: 'compound', equipment: 'barbell', primary: ['Hamstrings', 'Glutes'], secondary: ['Lower Back'], short: 'Romanian Deadlift' },
  'Beinbeuger': { category: 'isolation', equipment: 'machine', primary: ['Hamstrings'], secondary: [], short: 'Leg Curl' },
  'Face Pulls': { category: 'isolation', equipment: 'cable', primary: ['Shoulders'], secondary: ['Back'], short: 'Face Pulls' },
  'Bicep Curls Ellenbogen hinter Körper': { category: 'isolation', equipment: 'cable', primary: ['Biceps'], secondary: [], short: 'Bayesian Curl' },
  'Hanging Leg Raises': { category: 'isolation', equipment: 'bodyweight', primary: ['Abs'], secondary: [], short: 'Hanging Leg Raises' },
  'Schrägbank Bankdrücken Multipresse': { category: 'compound', equipment: 'smith', primary: ['Chest'], secondary: ['Shoulders', 'Triceps'], short: 'Incline Smith Machine Press' },
  'Brustpresse': { category: 'compound', equipment: 'machine', primary: ['Chest'], secondary: ['Triceps', 'Shoulders'], short: 'Chest Press' },
  'Hammer Curls': { category: 'isolation', equipment: 'dumbbell', primary: ['Biceps'], secondary: [], short: 'Hammer Curls' },
  'Trizeps Pushdowns': { category: 'isolation', equipment: 'cable', primary: ['Triceps'], secondary: [], short: 'Triceps Pushdown' },
  'Preacher Curl': { category: 'isolation', equipment: 'dumbbell', primary: ['Biceps'], secondary: [], short: 'Preacher Curl' },
  'Beinpresse': { category: 'compound', equipment: 'plates', primary: ['Quads', 'Glutes'], secondary: ['Adductors'], short: 'Leg Press' },
  'Adduktoren': { category: 'isolation', equipment: 'machine', primary: ['Adductors'], secondary: [], short: 'Hip Adduction' },
  'Waden': { category: 'isolation', equipment: 'machine', primary: ['Calves'], secondary: [], short: 'Calf Raises' },
  'Cable Crunches': { category: 'isolation', equipment: 'cable', primary: ['Abs'], secondary: [], short: 'Cable Crunches' },
  'Kurzhantel Schulterdrücken': { category: 'compound', equipment: 'dumbbell', primary: ['Shoulders'], secondary: ['Triceps'], short: 'Dumbbell Shoulder Press' },
  'Rudern mit Brustauflage sitzend': { category: 'compound', equipment: 'machine', primary: ['Back'], secondary: ['Biceps', 'Shoulders'], short: 'Chest-Supported Seated Row' },
  'Latzug eng im Untergriff': { category: 'compound', equipment: 'machine', primary: ['Back'], secondary: ['Biceps'], short: 'Close-Grip Underhand Pulldown' },
  'Seitheben Kurzhantel': { category: 'isolation', equipment: 'dumbbell', primary: ['Shoulders'], secondary: [], short: 'Dumbbell Lateral Raise' },
  'Back Extensions': { category: 'isolation', equipment: 'bodyweight', primary: ['Lower Back'], secondary: ['Glutes', 'Hamstrings'], short: 'Back Extensions' },
};

const FALLBACK_INFO: ExerciseInfo = { category: 'isolation', equipment: 'machine', primary: [], secondary: [] };

export function exerciseInfo(name: string): ExerciseInfo {
  return EXERCISE_INFO[name] ?? FALLBACK_INFO;
}

export function shortName(name: string): string {
  return EXERCISE_INFO[name]?.short ?? name;
}

/** Alle Übungsnamen aus dem Plan, alphabetisch nach Anzeigenamen. */
export const ALL_EXERCISE_NAMES: string[] = [
  ...new Set(DAY_KEYS.flatMap((day) => TRAINING_PLAN[day].exercises.map((exercise) => exercise.name))),
].sort((a, b) => shortName(a).localeCompare(shortName(b), 'en'));

/** Trainingstag, der heute dran ist – sonst der nächste im Plan. */
export function suggestedDay(date = new Date()): DayKey {
  const weekday = date.getDay();
  const today = DAY_KEYS.find((key) => TRAINING_PLAN[key].weekday === weekday);
  if (today) return today;
  const next = DAY_KEYS.find((key) => TRAINING_PLAN[key].weekday > weekday);
  return next ?? DAY_KEYS[0];
}

export function isDayKey(value: unknown): value is DayKey {
  return typeof value === 'string' && value in TRAINING_PLAN;
}

/* ---------- Ganze Woche: Kraft- und Cardio-Tage ---------- */

export type WeekDayKey = DayKey | CardioDayKey;

export const WEEK: WeekDayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

export interface WeekDayInfo {
  key: WeekDayKey;
  short: string;
  tag: string;
  title: string;
  kind: 'strength' | 'cardio';
}

export function weekDayInfo(key: WeekDayKey): WeekDayInfo {
  if (key === 'wednesday' || key === 'sunday') {
    const day = CARDIO_DAYS[key];
    return { key, short: day.short, tag: day.tag, title: 'Cardio', kind: 'cardio' };
  }
  const day = TRAINING_PLAN[key];
  return { key, short: day.short, tag: day.tag, title: day.title, kind: 'strength' };
}

/** Wochentag von heute (Mo–So). */
export function todaysWeekDay(date = new Date()): WeekDayKey {
  return WEEK[(date.getDay() + 6) % 7];
}
