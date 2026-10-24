import { TRAINING_PLAN } from '../domain/plan';
import { snapshotOf, type Recommendation } from '../domain/progression';
import type { DayKey, ExerciseEntry, RecommendationSnapshot, Workout } from '../domain/types';
import { createId } from '../data/legacy';

/** Laufendes Training eines Tages – überlebt App-Neustarts und wird geräteübergreifend gespeichert. */

export interface DraftSet {
  reps: number | null;
  weight: number | null;
  rir: number | null;
  done: boolean;
}

export interface DraftExercise {
  name: string;
  sets: DraftSet[];
  skipped: boolean;
  /** „Anderes Gerät/Studio“ – zählt nicht für Empfehlungen */
  excluded: boolean;
  recommendation: RecommendationSnapshot | null;
}

export interface DraftSession {
  day: DayKey;
  date: string;
  startedAt: string;
  exercises: DraftExercise[];
}

export function draftFromRecommendations(
  day: DayKey,
  date: string,
  items: { name: string; recommendation: Recommendation }[],
): DraftSession {
  return {
    day,
    date,
    startedAt: new Date().toISOString(),
    exercises: items.map(({ name, recommendation }) => ({
      name,
      sets: recommendation.sets.map((set) => ({ reps: set.reps, weight: set.weight, rir: null, done: false })),
      skipped: false,
      excluded: false,
      recommendation: snapshotOf(recommendation),
    })),
  };
}

export function doneSetCount(draft: DraftSession | undefined): number {
  if (!draft) return 0;
  return draft.exercises.reduce((sum, exercise) => sum + exercise.sets.filter((set) => set.done).length, 0);
}

export function isExerciseComplete(exercise: DraftExercise): boolean {
  return exercise.skipped || (exercise.sets.length > 0 && exercise.sets.every((set) => set.done));
}

/** Übungen ohne einen einzigen gespeicherten Satz (und nicht übersprungen). */
export function missingExercises(draft: DraftSession): string[] {
  return draft.exercises.filter((exercise) => !exercise.skipped && !exercise.sets.some((set) => set.done)).map((exercise) => exercise.name);
}

export interface FinishOptions {
  /** fehlende Übungen bewusst ausgelassen */
  skip: string[];
  /** Übungen, die heute an anderen Geräten liefen */
  exclude: string[];
  /** Übungen, die ab heute dauerhaft an einem neuen Gerät laufen */
  newEquipment?: string[];
}

export function workoutFromDraft(draft: DraftSession, options: FinishOptions): Workout {
  const skip = new Set(options.skip);
  const exclude = new Set(options.exclude);
  const exercises: ExerciseEntry[] = [];
  for (const exercise of draft.exercises) {
    const sets = exercise.sets
      .filter((set) => set.done && set.reps !== null)
      .map((set) => {
        const entry: { reps: number | null; weight: number | null; rir?: number | null } = {
          reps: set.reps,
          weight: set.weight,
        };
        if (set.rir !== null) entry.rir = set.rir;
        return entry;
      });
    if (sets.length) {
      const entry: ExerciseEntry = { name: exercise.name, sets };
      if (exercise.recommendation) entry.recommendation = exercise.recommendation;
      if (exercise.excluded || exclude.has(exercise.name)) {
        entry.excluded = true;
        entry.excludedBy = 'user';
      }
      exercises.push(entry);
    } else if (exercise.skipped || skip.has(exercise.name)) {
      exercises.push({ name: exercise.name, skipped: true, sets: [] });
    }
  }
  return {
    id: createId(),
    date: draft.date,
    completedAt: new Date().toISOString(),
    trainingDay: draft.day,
    trainingDayLabel: TRAINING_PLAN[draft.day].label,
    exercises,
  };
}
