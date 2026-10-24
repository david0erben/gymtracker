import type { SetEntry, Workout } from './types';

/** Rundet auf 2 Nachkommastellen (gegen Gleitkomma-Artefakte wie 37.499999). */
export const round2 = (value: number): number => Math.round(value * 100) / 100;

const EPS = 1e-6;

export function isWorkingSet(set: SetEntry): boolean {
  return typeof set.reps === 'number' && set.reps >= 1;
}

export function hasLoad(set: SetEntry): boolean {
  return isWorkingSet(set) && typeof set.weight === 'number' && set.weight > 0;
}

/** Epley-Formel. Mit RIR zählen die Wiederholungen „im Tank“ mit. */
export function epley(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function setE1rm(set: SetEntry): number | null {
  if (!hasLoad(set)) return null;
  return epley(set.weight as number, (set.reps as number) + (set.rir ?? 0));
}

/** Geschätzte Wiederholungen bei Gewicht `weight`, wenn das 1RM `e1rm` ist (Epley umgestellt). */
export function predictedReps(e1rm: number, weight: number): number {
  if (weight <= 0) return 0;
  return 30 * (e1rm / weight - 1);
}

/** Höchstes geschätztes 1RM einer Einheit. */
export function sessionE1rm(sets: SetEntry[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    const value = setE1rm(set);
    if (value !== null && (best === null || value > best)) best = value;
  }
  return best;
}

/** Schwerstes Gewicht, mit dem mindestens eine Wiederholung geschafft wurde. */
export function topWeight(sets: SetEntry[]): number | null {
  let best: number | null = null;
  for (const set of sets) {
    if (hasLoad(set) && (best === null || (set.weight as number) > best)) best = set.weight as number;
  }
  return best;
}

export function sameWeight(a: number | null, b: number | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.abs(a - b) < 0.01;
}

/* ---------- Gewichtsraster (Gerätestufen) ---------- */

export function snapDown(value: number, step: number, base = 0): number {
  return round2(base + Math.floor((value - base) / step + EPS) * step);
}

export function snapUp(value: number, step: number, base = 0): number {
  return round2(base + Math.ceil((value - base) / step - EPS) * step);
}

export function snapNearest(value: number, step: number, base = 0): number {
  return round2(base + Math.round((value - base) / step) * step);
}

/** Nächste Stufe echt über `weight` (auch wenn `weight` nicht auf dem Raster liegt). */
export function nextStepAbove(weight: number, step: number, base = 0): number {
  const snapped = snapUp(weight, step, base);
  return snapped > weight + EPS ? snapped : round2(snapped + step);
}

/** Nächste Stufe echt unter `weight`, nie unter 0. */
export function nextStepBelow(weight: number, step: number, base = 0): number {
  const snapped = snapDown(weight, step, base);
  const below = snapped < weight - EPS ? snapped : round2(snapped - step);
  return Math.max(0, below);
}

/* ---------- Verlauf einer Übung ---------- */

export interface ExerciseSession {
  workoutId: string;
  date: string;
  completedAt: string;
  sets: SetEntry[];
  excluded: boolean;
}

export function compareWorkouts(a: Pick<Workout, 'date' | 'completedAt'>, b: Pick<Workout, 'date' | 'completedAt'>): number {
  if (a.date !== b.date) return a.date < b.date ? -1 : 1;
  return (a.completedAt ?? '').localeCompare(b.completedAt ?? '');
}

/**
 * Entfernt offensichtliche Tippfehler: ein Satz mit fast doppeltem Gewicht der übrigen Sätze
 * bei gleich vielen oder mehr Wiederholungen (z. B. 96,3 × 12 neben 33,8 × 12).
 */
export function plausibleSets(sets: SetEntry[]): SetEntry[] {
  const loaded = sets.filter(hasLoad);
  if (loaded.length < 2) return sets;
  return sets.filter((set) => {
    if (!hasLoad(set)) return true;
    const others = loaded.filter((other) => other !== set);
    const otherWeight = median(others.map((other) => other.weight as number)) as number;
    const otherReps = median(others.map((other) => other.reps as number)) as number;
    return !((set.weight as number) > otherWeight * 1.8 && (set.reps as number) >= otherReps);
  });
}

/** Alle Einheiten einer Übung, älteste zuerst. Übersprungene und leere Einträge fallen raus. */
export function exerciseSessions(
  workouts: Workout[],
  name: string,
  options: { includeExcluded?: boolean } = {},
): ExerciseSession[] {
  const sessions: ExerciseSession[] = [];
  for (const workout of [...workouts].sort(compareWorkouts)) {
    for (const entry of workout.exercises) {
      if (entry.name !== name || entry.skipped) continue;
      const sets = plausibleSets(entry.sets.filter(isWorkingSet));
      if (!sets.length) continue;
      if (entry.excluded && !options.includeExcluded) continue;
      sessions.push({
        workoutId: workout.id,
        date: workout.date,
        completedAt: workout.completedAt,
        sets,
        excluded: Boolean(entry.excluded),
      });
    }
  }
  return sessions;
}

/**
 * Typischer Wiederholungsverlust von Satz zu Satz bei gleichem Gewicht (Median),
 * gelernt aus den letzten Einheiten. Begrenzt auf 0–3, ohne Daten 1.
 */
export function fatigueDrop(sessions: ExerciseSession[], lookback = 10): number {
  const drops: number[] = [];
  for (const session of sessions.slice(-lookback)) {
    for (let index = 1; index < session.sets.length; index += 1) {
      const previous = session.sets[index - 1];
      const current = session.sets[index];
      if (!sameWeight(previous.weight, current.weight)) continue;
      drops.push((previous.reps as number) - (current.reps as number));
    }
  }
  if (drops.length < 3) return 1;
  drops.sort((a, b) => a - b);
  const middle = Math.floor(drops.length / 2);
  const median = drops.length % 2 ? drops[middle] : (drops[middle - 1] + drops[middle]) / 2;
  return Math.min(3, Math.max(0, median));
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}
