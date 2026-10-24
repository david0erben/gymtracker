import { addDays, addMonths, daysBetween, parseDateKey, weekStart } from './dates';
import { exerciseInfo, MUSCLE_GROUPS, type MuscleGroup } from './plan';
import type { StrengthGoal } from './settings';
import { exerciseSessions, hasLoad, isWorkingSet, median, plausibleSets, sessionE1rm } from './strength';
import type { SetEntry, Workout } from './types';

/* ---------- Kraftentwicklung ---------- */

export type StrengthMetric = 'e1rm' | 'reps';

export interface StrengthPoint {
  date: string;
  t: number;
  /** geschätztes 1RM in kg – oder Wiederholungen gesamt bei Körpergewichtsübungen */
  value: number;
  /** Originalwert, falls auf ein neueres Gerät umgerechnet */
  raw?: number;
  best: SetEntry;
}

export interface StrengthSeries {
  metric: StrengthMetric;
  points: StrengthPoint[];
  /** Gerätewechsel innerhalb der Daten */
  shifts: { date: string; t: number; factor: number }[];
}

function bestSet(sets: SetEntry[]): SetEntry {
  return sets.reduce((best, set) => {
    const weight = set.weight ?? 0;
    const bestWeight = best.weight ?? 0;
    if (weight > bestWeight || (weight === bestWeight && (set.reps ?? 0) > (best.reps ?? 0))) return set;
    return best;
  }, sets[0]);
}

/**
 * Verlauf einer Übung. Nicht gewertete Einheiten fehlen – die Linie verbindet dann die Nachbarn.
 * Bei dauerhaften Gerätewechseln werden ältere Werte auf das aktuelle Gerät umgerechnet,
 * damit kein künstlicher Sprung entsteht und der Trend vergleichbar bleibt.
 */
export function strengthSeries(workouts: Workout[], name: string, shiftDates: string[] = []): StrengthSeries {
  const sessions = exerciseSessions(workouts, name);
  const loaded = sessions.some((session) => session.sets.some(hasLoad));
  const metric: StrengthMetric = loaded ? 'e1rm' : 'reps';
  const points: StrengthPoint[] = [];
  for (const session of sessions) {
    const value = metric === 'e1rm' ? sessionE1rm(session.sets) : session.sets.reduce((sum, set) => sum + (set.reps ?? 0), 0);
    if (value === null || value <= 0) continue;
    points.push({ date: session.date, t: parseDateKey(session.date).getTime(), value: Math.round(value * 10) / 10, best: bestSet(session.sets) });
  }
  const shifts: StrengthSeries['shifts'] = [];
  if (metric === 'e1rm') {
    for (const date of [...shiftDates].sort()) {
      const before = points.filter((point) => point.date < date).slice(-5).map((point) => point.raw ?? point.value);
      const after = points.filter((point) => point.date >= date).slice(0, 5).map((point) => point.raw ?? point.value);
      if (!before.length || !after.length) continue;
      shifts.push({ date, t: parseDateKey(date).getTime(), factor: (median(after) as number) / (median(before) as number) });
    }
    for (const point of points) {
      const scale = shifts.reduce((product, shift) => (point.date < shift.date ? product * shift.factor : product), 1);
      if (Math.abs(scale - 1) < 1e-9) continue;
      point.raw = point.value;
      point.value = Math.round(point.value * scale * 10) / 10;
    }
  }
  return { metric, points, shifts };
}

export type Range = '3m' | '6m' | '1y' | 'all';

export function rangeStart(range: Range, today: string): string | null {
  if (range === '3m') return addMonths(today, -3);
  if (range === '6m') return addMonths(today, -6);
  if (range === '1y') return addMonths(today, -12);
  return null;
}

export function inRange<T extends { date: string }>(items: T[], start: string | null): T[] {
  return start ? items.filter((item) => item.date >= start) : items;
}

/**
 * Trend in Prozent: Mittel der ersten zwei vs. der letzten zwei Einheiten im Zeitraum
 * (glättet einzelne Ausreißer-Tage).
 */
export function trendPercent(points: { value: number }[]): number | null {
  if (points.length < 2) return null;
  const head = points.slice(0, Math.min(2, points.length - 1));
  const tail = points.slice(-Math.min(2, points.length - 1));
  const start = head.reduce((sum, point) => sum + point.value, 0) / head.length;
  const end = tail.reduce((sum, point) => sum + point.value, 0) / tail.length;
  if (start <= 0) return null;
  return ((end - start) / start) * 100;
}

/* ---------- Ziel: z. B. +5 % in 6 Monaten ---------- */

export interface GoalLine {
  start: { date: string; t: number; value: number };
  end: { date: string; t: number; value: number };
  /** Sollwert heute */
  expected: number;
  /** aktueller (geglätteter) Wert */
  current: number;
  /** Abstand zum Soll in Prozentpunkten (positiv = vor dem Plan) */
  delta: number;
  onTrack: boolean;
  progress: number;
}

function smoothedAt(points: StrengthPoint[], date: string): number | null {
  const before = points.filter((point) => point.date <= date).slice(-2);
  const source = before.length ? before : points.slice(0, 2);
  if (!source.length) return null;
  return source.reduce((sum, point) => sum + point.value, 0) / source.length;
}

export function goalLine(points: StrengthPoint[], goal: StrengthGoal, today: string): GoalLine | null {
  if (points.length < 2 || goal.percent <= 0 || goal.months <= 0) return null;
  const baseline = smoothedAt(points, goal.startDate);
  const current = smoothedAt(points, today);
  if (!baseline || !current) return null;
  const endDate = addMonths(goal.startDate, goal.months);
  const target = baseline * (1 + goal.percent / 100);
  const total = Math.max(1, daysBetween(goal.startDate, endDate));
  const elapsed = Math.min(total, Math.max(0, daysBetween(goal.startDate, today)));
  const expected = baseline + (target - baseline) * (elapsed / total);
  const achieved = (current / baseline - 1) * 100;
  const expectedPercent = (expected / baseline - 1) * 100;
  return {
    start: { date: goal.startDate, t: parseDateKey(goal.startDate).getTime(), value: Math.round(baseline * 10) / 10 },
    end: { date: endDate, t: parseDateKey(endDate).getTime(), value: Math.round(target * 10) / 10 },
    expected,
    current,
    delta: achieved - expectedPercent,
    onTrack: current >= expected - 0.005 * baseline,
    progress: Math.max(0, Math.min(1, achieved / goal.percent)),
  };
}

/* ---------- Volumen pro Muskelgruppe ---------- */

export type VolumeMetric = 'sets' | 'tonnage';

export interface WeekVolume {
  week: string;
  t: number;
  sets: Record<MuscleGroup, number>;
  tonnage: Record<MuscleGroup, number>;
}

function emptyRecord(): Record<MuscleGroup, number> {
  return Object.fromEntries(MUSCLE_GROUPS.map((muscle) => [muscle, 0])) as Record<MuscleGroup, number>;
}

/**
 * Wöchentliches Volumen je Muskel: Sets und bewegte Kilos – nur Übungen, in denen der Muskel
 * Hauptmuskel ist (keine halben Sets für Hilfsmuskeln).
 * Nicht gewertete Einträge zählen bei den Sets mit (sie wurden ja trainiert), nicht aber bei den Kilos.
 */
export function weeklyVolume(workouts: Workout[], start: string | null, today: string): WeekVolume[] {
  const weeks = new Map<string, WeekVolume>();
  const first = start ?? workouts.reduce<string | null>((min, workout) => (!min || workout.date < min ? workout.date : min), null);
  if (!first) return [];
  for (let week = weekStart(first); week <= weekStart(today); week = addDays(week, 7)) {
    weeks.set(week, { week, t: parseDateKey(week).getTime(), sets: emptyRecord(), tonnage: emptyRecord() });
  }
  for (const workout of workouts) {
    if (start && workout.date < start) continue;
    const bucket = weeks.get(weekStart(workout.date));
    if (!bucket) continue;
    for (const entry of workout.exercises) {
      if (entry.skipped) continue;
      const sets = plausibleSets(entry.sets.filter(isWorkingSet));
      const kg = entry.excluded ? 0 : sets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
      for (const muscle of exerciseInfo(entry.name).primary) {
        bucket.sets[muscle] += sets.length;
        bucket.tonnage[muscle] += kg;
      }
    }
  }
  return [...weeks.values()];
}

/** Gleitender Durchschnitt über `size` Wochen. */
export function movingAverage(values: number[], size = 4): number[] {
  return values.map((_, index) => {
    const window = values.slice(Math.max(0, index - size + 1), index + 1);
    return window.reduce((sum, value) => sum + value, 0) / window.length;
  });
}
