import { CLASSIC_PLAN, isDayKey, planById, PLANS, WEEK } from '../domain/plan';
import { normalizeSettings, type Settings } from '../domain/settings';
import type { BodyweightEntry, DayKey, ExerciseEntry, SetEntry, Workout } from '../domain/types';
import { parseDateKey } from '../domain/dates';
import { normalizeCardio, type CardioEntry } from '../domain/cardio';

/**
 * Liest Daten aus dem alten Gym Tracker (JSON-Export bzw. Firestore-Dokument, Version 2)
 * und aus dem eigenen Export der neuen App. Nichts geht verloren: unbekannte Felder werden
 * ignoriert, aber vorhandene Trainings, Sätze und Körpergewichte bleiben vollständig erhalten.
 */

export interface AppData {
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  cardio: CardioEntry[];
  settings?: Settings;
}

export function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = typeof value === 'number' ? value : Number(String(value).replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

export function normalizeSet(raw: unknown): SetEntry {
  const value = (raw ?? {}) as Record<string, unknown>;
  const reps = toNumber(value.reps);
  let weight = toNumber(value.weight);
  // Platzhalter wie 0,1 kg stehen für „nur Körpergewicht“
  if (weight !== null && weight > 0 && weight <= 0.1) weight = 0;
  const set: SetEntry = {
    reps: reps === null ? null : Math.max(0, Math.trunc(reps)),
    weight: weight === null ? null : Math.max(0, weight),
  };
  const rir = toNumber(value.rir);
  if (rir !== null) set.rir = Math.max(0, Math.trunc(rir));
  return set;
}

function normalizeExercise(raw: unknown): ExerciseEntry | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (typeof value.name !== 'string' || !value.name.trim()) return null;
  const entry: ExerciseEntry = {
    name: value.name,
    sets: Array.isArray(value.sets) ? value.sets.map(normalizeSet) : [],
  };
  if (value.skipped === true) entry.skipped = true;
  if (value.excluded === true) {
    entry.excluded = true;
    entry.excludedBy = value.excludedBy === 'user' ? 'user' : 'auto';
  }
  if (value.recommendation && typeof value.recommendation === 'object') {
    entry.recommendation = value.recommendation as ExerciseEntry['recommendation'];
  }
  return entry;
}

function dayFromDate(date: string): DayKey {
  const weekday = parseDateKey(date).getDay();
  return WEEK.find((key) => CLASSIC_PLAN.days[key].weekday === weekday) ?? 'monday';
}

export function normalizeWorkout(raw: unknown): Workout | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  if (!Array.isArray(value.exercises)) return null;
  const completedAt = typeof value.completedAt === 'string' ? value.completedAt : '';
  const date =
    typeof value.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value.date)
      ? value.date
      : completedAt.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const trainingDay = isDayKey(value.trainingDay) ? value.trainingDay : dayFromDate(date);
  const planId = typeof value.planId === 'string' && PLANS[value.planId] ? value.planId : undefined;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : createId(),
    date,
    completedAt: completedAt || `${date}T12:00:00.000Z`,
    trainingDay,
    trainingDayLabel:
      typeof value.trainingDayLabel === 'string' && value.trainingDayLabel
        ? value.trainingDayLabel
        : planById(planId).days[trainingDay].label,
    ...(planId ? { planId } : {}),
    exercises: value.exercises.map(normalizeExercise).filter((entry): entry is ExerciseEntry => entry !== null),
  };
}

export function normalizeBodyweight(raw: unknown): BodyweightEntry | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const weight = toNumber(value.weight);
  if (typeof value.date !== 'string' || weight === null || weight <= 0) return null;
  return { id: typeof value.id === 'string' && value.id ? value.id : createId(), date: value.date, weight };
}

export function normalizeAppData(raw: unknown): AppData {
  const value = (raw ?? {}) as Record<string, unknown>;
  const workouts = Array.isArray(value.workouts)
    ? value.workouts.map(normalizeWorkout).filter((workout): workout is Workout => workout !== null)
    : [];
  const bodyweight = Array.isArray(value.bodyweight)
    ? value.bodyweight.map(normalizeBodyweight).filter((entry): entry is BodyweightEntry => entry !== null)
    : [];
  const cardio = Array.isArray(value.cardio)
    ? value.cardio.map(normalizeCardio).filter((entry): entry is CardioEntry => entry !== null)
    : [];
  const data: AppData = { workouts, bodyweight, cardio };
  if (value.settings) data.settings = normalizeSettings(value.settings);
  return data;
}

/** Export im eigenen Format – lässt sich in die neue App und (Workouts/Körpergewicht) auch ins alte Format zurücklesen. */
export function exportPayload(data: AppData & { settings: Settings }) {
  return {
    app: 'gymtracker',
    version: 2,
    schema: 3,
    exportedAt: new Date().toISOString(),
    workouts: data.workouts,
    bodyweight: data.bodyweight,
    cardio: data.cardio,
    settings: data.settings,
  };
}
