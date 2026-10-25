import { addDays, daysBetween, parseDateKey } from './dates';
import { CLASSIC_PLAN, planById, WEEK, type TrainingPlan } from './plan';
import type { Workout } from './types';

/**
 * Serien und Plantreue: Wie viele geplante Trainingstage am Stück hast du durchgezogen?
 *
 * - Geplant sind die Krafttage aus dem Plan, der an dem Tag galt (bisheriger Plan: Mo, Di, Do, Fr, Sa),
 *   und – ab deiner ersten Cardio-Einheit – die Cardio-Tage (Mi, So).
 * - Ruhetage unterbrechen keine Serie. Ein geplanter Tag ohne Training beendet sie.
 * - Heute zählt erst, wenn du trainiert hast – ein noch offener Tag bricht nichts ab.
 */

export interface StreakStats {
  current: number;
  /** erster Tag der aktuellen Serie */
  currentSince: string | null;
  longest: number;
  /** Zeitraum der längsten Serie (erster und letzter Trainingstag) */
  longestFrom: string | null;
  longestTo: string | null;
  /** Anteil erledigter geplanter Tage im Zeitraum (0–1), null ohne geplante Tage */
  adherence: number | null;
  plannedDays: number;
  doneDays: number;
  /** Zeitraum der Plantreue */
  adherenceFrom: string | null;
}

type PlanAt = (date: string) => TrainingPlan;

export function isPlannedDay(date: string, cardioSince: string | null, planAt: PlanAt = () => CLASSIC_PLAN): boolean {
  const kind = planAt(date).days[WEEK[(parseDateKey(date).getDay() + 6) % 7]].kind;
  if (kind === 'strength') return true;
  return kind === 'cardio' && cardioSince !== null && date >= cardioSince;
}

/**
 * Welcher Plan galt an einem Tag? Der Plan deines letzten Trainings bis zu diesem Tag;
 * nach deinem letzten Training gilt der aktuell gewählte Plan.
 */
export function planTimeline(workouts: Workout[], current: TrainingPlan): PlanAt {
  const changes = [...workouts]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((workout) => ({ date: workout.date, planId: workout.planId ?? 'classic' }));
  const lastDate = changes.at(-1)?.date ?? '';
  return (date) => {
    if (date > lastDate) return current;
    let planId = changes[0]?.planId ?? current.id;
    for (const change of changes) {
      if (change.date > date) break;
      planId = change.planId;
    }
    return planById(planId);
  };
}

export function streakStats(
  trainingDates: string[],
  cardioDates: string[],
  today: string,
  adherenceDays = 28,
  planAt: PlanAt = () => CLASSIC_PLAN,
): StreakStats {
  const trained = new Set([...trainingDates, ...cardioDates]);
  const cardioSince = cardioDates.length ? [...cardioDates].sort()[0] : null;
  const first = [...trained].sort()[0];
  if (!first)
    return { current: 0, currentSince: null, longest: 0, longestFrom: null, longestTo: null, adherence: null, plannedDays: 0, doneDays: 0, adherenceFrom: null };

  let run = 0;
  let runStart: string | null = null;
  let longest = 0;
  let longestFrom: string | null = null;
  let longestTo: string | null = null;
  for (let date = first; date <= today; date = addDays(date, 1)) {
    if (!isPlannedDay(date, cardioSince, planAt)) continue;
    if (trained.has(date)) {
      run += 1;
      if (run === 1) runStart = date;
      if (run > longest) {
        longest = run;
        longestFrom = runStart;
        longestTo = date;
      }
    } else if (date !== today) {
      run = 0;
      runStart = null;
    }
  }

  // Plantreue der letzten Wochen (heute nur, wenn schon trainiert)
  let plannedDays = 0;
  let doneDays = 0;
  const start = addDays(today, -(adherenceDays - 1));
  const adherenceFrom = start < first ? first : start;
  for (let date = adherenceFrom; date <= today; date = addDays(date, 1)) {
    if (!isPlannedDay(date, cardioSince, planAt)) continue;
    if (date === today && !trained.has(date)) continue;
    plannedDays += 1;
    if (trained.has(date)) doneDays += 1;
  }

  return {
    current: run,
    currentSince: run ? runStart : null,
    longest,
    longestFrom,
    longestTo,
    adherence: plannedDays ? doneDays / plannedDays : null,
    plannedDays,
    doneDays,
    adherenceFrom,
  };
}

/** Tage seit dem letzten Training (für Hinweise). */
export function daysSince(dates: string[], today: string): number | null {
  const last = [...dates].sort().at(-1);
  return last ? daysBetween(last, today) : null;
}
