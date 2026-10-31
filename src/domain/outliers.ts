import { classifySeries } from './levels';
import { compareWorkouts, hasLoad, isMainSet, median, plausibleSets, sessionE1rm } from './strength';
import type { Workout } from './types';

/**
 * Findet Kraftwerte, die nicht zum Verlauf passen – z. B. ein Training in einem anderen
 * Studio mit ganz anderen Maschinen oder ein Tippfehler. Solche Einträge bleiben in der
 * Historie, zählen aber nicht für Kraftkurve und Empfehlungen (die Kurve verbindet dann
 * einfach die Nachbarpunkte).
 *
 * - Tippfehler: ein einzelner Satz mit fast doppeltem Gewicht bei gleichen Wiederholungen.
 * - Vorübergehend anderes Gerät: Niveau springt und kehrt zurück (z. B. Pendulum statt Beinpresse).
 * - Ausreißer: ein Wert weicht von den Einheiten davor UND danach deutlich ab.
 * - Anderes Studio: an einem Tag weichen mehrere Übungen gleichzeitig ab.
 * - Dauerhafter Gerätewechsel ist kein Ausreißer, sondern eine Niveau-Grenze (siehe levels.ts).
 */

export interface OutlierFinding {
  workoutId: string;
  date: string;
  exercise: string;
  /** Gewicht (Tippfehler) bzw. geschätztes 1RM */
  value: number;
  /** erwarteter Wert aus den Nachbar-Einheiten */
  reference: number;
  deviation: number;
  reason: 'typo' | 'spike' | 'temporary' | 'gym-day';
}

export interface LevelShiftFinding {
  exercise: string;
  /** erste Einheit auf dem neuen Niveau */
  date: string;
  factor: number;
}

export interface HistoryAnalysis {
  findings: OutlierFinding[];
  shifts: LevelShiftFinding[];
}

interface Point {
  workoutId: string;
  date: string;
  value: number;
}

/** Einheiten je Seite für den Vergleich – 4, damit auch 2–3 Ausreißer in Folge auffallen. */
const WINDOW = 4;

function seriesByExercise(workouts: Workout[]): Map<string, Point[]> {
  const series = new Map<string, Point[]>();
  for (const workout of [...workouts].sort(compareWorkouts)) {
    for (const entry of workout.exercises) {
      if (entry.skipped) continue;
      const value = sessionE1rm(plausibleSets(entry.sets.filter(isMainSet)));
      if (value === null) continue;
      const list = series.get(entry.name) ?? [];
      list.push({ workoutId: workout.id, date: workout.date, value });
      series.set(entry.name, list);
    }
  }
  return series;
}

export function analyzeHistory(workouts: Workout[], threshold = 0.35): HistoryAnalysis {
  const findings: OutlierFinding[] = [];
  const shifts: LevelShiftFinding[] = [];
  const flagged = new Set<string>();
  const key = (workoutId: string, exercise: string) => `${workoutId}::${exercise}`;

  // 1. Tippfehler innerhalb einer Einheit
  for (const workout of workouts) {
    for (const entry of workout.exercises) {
      const working = entry.sets.filter(isMainSet);
      const kept = plausibleSets(working);
      if (kept.length === working.length) continue;
      const reference = median(kept.filter(hasLoad).map((set) => set.weight as number)) ?? 0;
      for (const set of working.filter((item) => !kept.includes(item))) {
        findings.push({
          workoutId: workout.id,
          date: workout.date,
          exercise: entry.name,
          value: set.weight as number,
          reference,
          deviation: reference ? (set.weight as number) / reference - 1 : 0,
          reason: 'typo',
        });
      }
    }
  }

  const dayVotes = new Map<string, { exercise: string; point: Point; deviation: number; reference: number }[]>();

  for (const [exercise, points] of seriesByExercise(workouts)) {
    const values = points.map((point) => point.value);
    const { shifts: boundaries, temporary } = classifySeries(values);

    // 2. Vorübergehend anderes Gerät
    for (const index of temporary) {
      const point = points[index];
      const neighbours = values.filter((_, position) => !temporary.has(position) && Math.abs(position - index) <= WINDOW);
      const reference = median(neighbours) ?? point.value;
      findings.push({ workoutId: point.workoutId, date: point.date, exercise, value: point.value, reference, deviation: point.value / reference - 1, reason: 'temporary' });
      flagged.add(key(point.workoutId, exercise));
    }

    // 3. Dauerhafte Gerätewechsel merken
    for (const boundary of boundaries) {
      shifts.push({ exercise, date: points[boundary.index].date, factor: boundary.factor });
    }

    // 4. Einzelne Ausreißer – nur innerhalb desselben Niveau-Abschnitts vergleichen
    const edges = [0, ...boundaries.map((boundary) => boundary.index), points.length];
    for (let segment = 0; segment < edges.length - 1; segment += 1) {
      const indices: number[] = [];
      for (let index = edges[segment]; index < edges[segment + 1]; index += 1) if (!temporary.has(index)) indices.push(index);
      if (indices.length < 3) continue;
      indices.forEach((index, position) => {
        const point = points[index];
        const before = median(indices.slice(Math.max(0, position - WINDOW), position).map((item) => values[item]));
        const after = median(indices.slice(position + 1, position + 1 + WINDOW).map((item) => values[item]));
        if (!before || !after) return;
        const devBefore = point.value / before - 1;
        const devAfter = point.value / after - 1;
        if (Math.sign(devBefore) !== Math.sign(devAfter) && !(Math.abs(devBefore) > 0.5 && Math.abs(devAfter) > 0.5)) return;
        const reference = (before + after) / 2;
        const deviation = point.value / reference - 1;
        if (Math.abs(devBefore) > threshold && Math.abs(devAfter) > threshold) {
          findings.push({ workoutId: point.workoutId, date: point.date, exercise, value: point.value, reference, deviation, reason: 'spike' });
          flagged.add(key(point.workoutId, exercise));
          return;
        }
        if (Math.abs(devBefore) > 0.2 && Math.abs(devAfter) > 0.2) {
          const votes = dayVotes.get(point.workoutId) ?? [];
          votes.push({ exercise, point, deviation, reference });
          dayVotes.set(point.workoutId, votes);
        }
      });
    }
  }

  // 5. Mehrere Übungen am selben Tag gleichzeitig daneben → vermutlich anderes Studio
  const loadedEntries = new Map<string, number>();
  for (const workout of workouts) {
    loadedEntries.set(workout.id, workout.exercises.filter((entry) => !entry.skipped && entry.sets.some(hasLoad)).length);
  }
  for (const [workoutId, votes] of dayVotes) {
    const flaggedThatDay = [...flagged].filter((item) => item.startsWith(`${workoutId}::`)).length;
    const total = loadedEntries.get(workoutId) ?? 0;
    if (votes.length + flaggedThatDay < 3 || votes.length + flaggedThatDay < total / 2) continue;
    for (const vote of votes) {
      if (flagged.has(key(workoutId, vote.exercise))) continue;
      findings.push({ workoutId, date: vote.point.date, exercise: vote.exercise, value: vote.point.value, reference: vote.reference, deviation: vote.deviation, reason: 'gym-day' });
      flagged.add(key(workoutId, vote.exercise));
    }
  }

  findings.sort((a, b) => (a.date === b.date ? a.exercise.localeCompare(b.exercise) : a.date < b.date ? -1 : 1));
  return { findings, shifts };
}

export function detectOutliers(workouts: Workout[], threshold = 0.35): OutlierFinding[] {
  return analyzeHistory(workouts, threshold).findings;
}

/**
 * Markiert Ausreißer als „nicht werten“ (excluded), ohne Werte zu verändern.
 * Tippfehler werden nur gemeldet – die Auswertung ignoriert den einzelnen Satz ohnehin.
 */
export function applyOutlierFlags(workouts: Workout[], findings: OutlierFinding[]): Workout[] {
  const keys = new Set(
    findings.filter((finding) => finding.reason !== 'typo').map((finding) => `${finding.workoutId}::${finding.exercise}`),
  );
  return workouts.map((workout) => ({
    ...workout,
    exercises: workout.exercises.map((entry) =>
      keys.has(`${workout.id}::${entry.name}`) && !entry.excluded
        ? { ...entry, excluded: true, excludedBy: 'auto' as const }
        : entry,
    ),
  }));
}

/** Gerätewechsel als Datumsliste pro Übung (für die Einstellungen). */
export function shiftsByExercise(shifts: LevelShiftFinding[]): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const shift of shifts) (result[shift.exercise] ??= []).push(shift.date);
  for (const dates of Object.values(result)) dates.sort();
  return result;
}
