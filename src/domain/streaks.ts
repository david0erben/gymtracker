import { CARDIO_DAYS } from './cardio';
import { addDays, daysBetween, parseDateKey } from './dates';
import { DAY_KEYS, TRAINING_PLAN } from './plan';

/**
 * Serien und Plantreue: Wie viele geplante Trainingstage am Stück hast du durchgezogen?
 *
 * - Geplant sind die Krafttage aus dem Plan (Mo, Di, Do, Fr, Sa) und – ab deiner ersten
 *   Cardio-Einheit – die Cardio-Tage (Mi, So).
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

const STRENGTH_WEEKDAYS = new Set(DAY_KEYS.map((day) => TRAINING_PLAN[day].weekday));
const CARDIO_WEEKDAYS = new Set(Object.values(CARDIO_DAYS).map((day) => day.weekday));

export function isPlannedDay(date: string, cardioSince: string | null): boolean {
  const weekday = parseDateKey(date).getDay();
  if (STRENGTH_WEEKDAYS.has(weekday)) return true;
  return cardioSince !== null && date >= cardioSince && CARDIO_WEEKDAYS.has(weekday);
}

export function streakStats(
  trainingDates: string[],
  cardioDates: string[],
  today: string,
  adherenceDays = 28,
): StreakStats {
  const trained = new Set([...trainingDates, ...cardioDates]);
  const cardioSince = cardioDates.length ? [...cardioDates].sort()[0] : null;
  const first = [...trained].sort()[0];
  if (!first) return { current: 0, longest: 0, adherence: null, plannedDays: 0, doneDays: 0 };

  let run = 0;
  let longest = 0;
  for (let date = first; date <= today; date = addDays(date, 1)) {
    if (!isPlannedDay(date, cardioSince)) continue;
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
    if (!isPlannedDay(date, cardioSince)) continue;
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
