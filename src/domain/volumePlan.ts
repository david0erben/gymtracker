import { addDays, weekStart } from './dates';
import { weeklyVolume } from './analytics';
import { exerciseInfo, MUSCLE_GROUPS, strengthDays, type MuscleGroup, type PlannedExercise } from './plan';
import { activePlan, resolveExerciseConfig, type Settings } from './settings';
import type { DayKey, Workout } from './types';

/** Muskelgruppen zu Bereichen zusammengefasst – „Arms“ = Biceps + Triceps usw. */
export const REGIONS: { name: string; muscles: MuscleGroup[] }[] = [
  { name: 'Chest', muscles: ['Upper Chest', 'Mid Chest', 'Lower Chest'] },
  { name: 'Back', muscles: ['Upper Back', 'Lats'] },
  { name: 'Shoulders', muscles: ['Front Delts', 'Side Delts', 'Rear Delts'] },
  { name: 'Arms', muscles: ['Biceps', 'Triceps'] },
  { name: 'Legs', muscles: ['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves'] },
  { name: 'Core', muscles: ['Abs', 'Lower Back'] },
];

export interface Contribution {
  day: DayKey;
  name: string;
  sets: number;
  extraSets: number;
}

export interface MuscleVolume {
  muscle: MuscleGroup;
  /** geplante Sets pro Woche inkl. Zusatz-Sets */
  planned: number;
  /** davon Zusatz-Sets */
  extra: number;
  contributions: Contribution[];
}

/** Alle Übungen des gewählten Plans in Wochenreihenfolge. */
function planSlots(settings: Settings): { day: DayKey; planned: PlannedExercise }[] {
  const plan = activePlan(settings);
  return strengthDays(plan).flatMap((day) => plan.days[day].exercises.map((planned) => ({ day, planned })));
}

/** Geplante Sets pro Woche je Muskel – nur Übungen, in denen der Muskel Hauptmuskel ist. */
export function plannedWeeklyVolume(settings: Settings): Record<MuscleGroup, MuscleVolume> {
  const result = Object.fromEntries(
    MUSCLE_GROUPS.map((muscle) => [muscle, { muscle, planned: 0, extra: 0, contributions: [] as Contribution[] }]),
  ) as Record<MuscleGroup, MuscleVolume>;
  for (const { day, planned } of planSlots(settings)) {
    const config = resolveExerciseConfig(planned, settings, day);
    for (const muscle of exerciseInfo(planned.name).primary) {
      const entry = result[muscle];
      entry.planned += config.sets;
      entry.extra += config.extraSets;
      entry.contributions.push({ day, name: planned.name, sets: config.sets, extraSets: config.extraSets });
    }
  }
  return result;
}

/**
 * Geplante Sets pro Woche je Bereich. Jede Übung zählt pro Bereich nur einmal – die Beinpresse
 * trainiert Quads und Glutes, zählt für „Legs“ aber nicht doppelt.
 */
export function plannedRegionVolume(settings: Settings, muscles: MuscleGroup[]): { planned: number; extra: number } {
  let planned = 0;
  let extra = 0;
  for (const { day, planned: exercise } of planSlots(settings)) {
    if (!exerciseInfo(exercise.name).primary.some((muscle) => muscles.includes(muscle))) continue;
    const config = resolveExerciseConfig(exercise, settings, day);
    planned += config.sets;
    extra += config.extraSets;
  }
  return { planned, extra };
}

/** Tatsächlich trainierte Sets pro Woche je Bereich, ebenfalls ohne Doppelzählung (Schnitt der letzten 4 vollen Wochen). */
export function recentRegionVolume(workouts: Workout[], today: string, muscles: MuscleGroup[]): number {
  const thisWeek = weekStart(today);
  const start = addDays(thisWeek, -28);
  let sets = 0;
  for (const workout of workouts) {
    if (workout.date < start || workout.date >= thisWeek) continue;
    for (const entry of workout.exercises) {
      if (entry.skipped || !exerciseInfo(entry.name).primary.some((muscle) => muscles.includes(muscle))) continue;
      sets += entry.sets.filter((set) => set.reps !== null && set.reps > 0).length;
    }
  }
  return sets / 4;
}

/** Tatsächlich trainierte Sets pro Woche je Muskel – Schnitt der letzten 4 vollen Wochen. */
export function recentWeeklyVolume(workouts: Workout[], today: string): Record<MuscleGroup, number> {
  const thisWeek = weekStart(today);
  const weeks = weeklyVolume(workouts, addDays(thisWeek, -28), today).filter((week) => week.week < thisWeek);
  return Object.fromEntries(
    MUSCLE_GROUPS.map((muscle) => [muscle, weeks.length ? weeks.reduce((sum, week) => sum + week.sets[muscle], 0) / weeks.length : 0]),
  ) as Record<MuscleGroup, number>;
}

/** Summe aller geplanten Sets pro Woche (jedes Set einmal gezählt). */
export function totalWeeklySets(settings: Settings): number {
  return planSlots(settings).reduce((total, { day, planned }) => total + resolveExerciseConfig(planned, settings, day).sets, 0);
}
