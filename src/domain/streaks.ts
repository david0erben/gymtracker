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
  longest: number;
  /** Anteil erledigter geplanter Tage im Zeitraum (0–1), null ohne geplante Tage */
  adherence: number | null;
  plannedDays: number;
  doneDays: number;
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
  if (!first) return { current: 0, longest: 0, adherence: null, plannedDays: 0, doneDays: 0 };

  let run = 0;
  let longest = 0;
  for (let date = first; date <= today; date = addDays(date, 1)) {
    if (!isPlannedDay(date, cardioSince, planAt)) continue;
    if (trained.has(date)) {
      run += 1;
      longest = Math.max(longest, run);
    } else if (date !== today) {
      run = 0;
    }
  }

  // Plantreue der letzten Wochen (heute nur, wenn schon trainiert)
  let plannedDays = 0;
  let doneDays = 0;
  const start = addDays(today, -(adherenceDays - 1));
  for (let date = start < first ? first : start; date <= today; date = addDays(date, 1)) {
    if (!isPlannedDay(date, cardioSince, planAt)) continue;
    if (date === today && !trained.has(date)) continue;
    plannedDays += 1;
    if (trained.has(date)) doneDays += 1;
  }

  return {
    current: run,
    longest,
    adherence: plannedDays ? doneDays / plannedDays : null,
    plannedDays,
    doneDays,
  };
}

/** Tage seit dem letzten Training (für Hinweise). */
export function daysSince(dates: string[], today: string): number | null {
  const last = [...dates].sort().at(-1);
  return last ? daysBetween(last, today) : null;
}
