import { planById } from '../domain/plan';
import { snapshotOf, type Recommendation } from '../domain/progression';
import { dropCount, dropWeight } from '../domain/strength';
import type { DayKey, ExerciseEntry, RecommendationSnapshot, SetEntry, Workout } from '../domain/types';
import { createId } from '../data/legacy';

/** Laufendes Training eines Tages – überlebt App-Neustarts und wird geräteübergreifend gespeichert. */

export interface DraftSet {
  reps: number | null;
  weight: number | null;
  rir: number | null;
  done: boolean;
  /** Dropsatz zum Satz darüber */
  drop?: boolean;
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
  /** Plan, zu dem dieses Training gehört (fehlt = bisheriger Plan) */
  planId?: string;
  date: string;
  startedAt: string;
  exercises: DraftExercise[];
}

/** Angefangene Trainings je Plan und Tag getrennt speichern (bisheriger Plan: nur der Tag – wie früher). */
export function draftKey(planId: string, day: DayKey): string {
  return planId === 'classic' ? day : `${planId}:${day}`;
}

export function draftFromRecommendations(
  day: DayKey,
  date: string,
  items: { name: string; recommendation: Recommendation }[],
  planId = 'classic',
): DraftSession {
  return {
    day,
    planId,
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

/** Bis zu so viele Dropsätze pro Set. */
export const MAX_DROPS = 3;

/** Fügt unter einem Hauptsatz einen Dropsatz ein – etwas leichter als der Satz darüber. */
export function insertDropSet(sets: DraftSet[], mainIndex: number, step: number, base: number): DraftSet[] {
  const index = mainIndex + dropCount(sets, mainIndex) + 1;
  const previous = sets[index - 1];
  const weight = previous.weight ? dropWeight(previous.weight, step, base) : previous.weight;
  return [...sets.slice(0, index), { reps: previous.reps, weight, rir: null, done: false, drop: true }, ...sets.slice(index)];
}

export interface SessionProgress {
  /** geplante Sets (ohne Dropsätze) */
  planned: number;
  /** davon erledigt */
  done: number;
  /** noch offen */
  open: number;
  /** zusätzlich zum Plan gemachte Sets */
  extra: number;
  drops: number;
}

/** Stand des Trainings im Vergleich zum Plan. */
export function sessionProgress(draft: DraftSession): SessionProgress {
  const progress: SessionProgress = { planned: 0, done: 0, open: 0, extra: 0, drops: 0 };
  for (const exercise of draft.exercises) {
    const main = exercise.sets.filter((set) => !set.drop);
    const planned = exercise.recommendation?.reps.length ?? main.length;
    const done = main.filter((set) => set.done).length;
    progress.planned += planned;
    progress.done += Math.min(done, planned);
    progress.open += Math.max(0, planned - done);
    progress.extra += Math.max(0, done - planned);
    progress.drops += exercise.sets.filter((set) => set.drop && set.done).length;
  }
  return progress;
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
        const entry: SetEntry = { reps: set.reps, weight: set.weight };
        if (set.rir !== null) entry.rir = set.rir;
        if (set.drop) entry.drop = true;
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
    trainingDayLabel: planById(draft.planId).days[draft.day].label,
    planId: draft.planId ?? 'classic',
    exercises,
  };
}
