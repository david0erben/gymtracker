/** Cardio-Einheiten (laut Plan Mittwoch und Sonntag): Laufen oder Radfahren. */

import { addDays, daysBetween, parseDateKey, weekStart } from './dates';

export type CardioType = 'run' | 'bike';

export interface CardioEntry {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  completedAt: string;
  type: CardioType;
  durationMin: number;
  distanceKm: number | null;
  avgHr: number | null;
}

export const CARDIO_TYPES: Record<CardioType, { label: string }> = {
  run: { label: 'Laufen' },
  bike: { label: 'Radfahren' },
};

/** Pace in Minuten pro Kilometer, z. B. 5,7 → „5:42“. */
export function paceMinPerKm(entry: Pick<CardioEntry, 'durationMin' | 'distanceKm'>): number | null {
  if (!entry.distanceKm || entry.distanceKm <= 0 || entry.durationMin <= 0) return null;
  return entry.durationMin / entry.distanceKm;
}

export function formatPace(minutes: number | null): string {
  if (minutes === null || !Number.isFinite(minutes)) return '–';
  let whole = Math.floor(minutes);
  let seconds = Math.round((minutes - whole) * 60);
  if (seconds === 60) {
    whole += 1;
    seconds = 0;
  }
  return `${whole}:${String(seconds).padStart(2, '0')}`;
}

export function speedKmh(entry: Pick<CardioEntry, 'durationMin' | 'distanceKm'>): number | null {
  if (!entry.distanceKm || entry.distanceKm <= 0 || entry.durationMin <= 0) return null;
  return entry.distanceKm / (entry.durationMin / 60);
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = Math.round(minutes - hours * 60);
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
}

export function normalizeCardio(raw: unknown): CardioEntry | null {
  const value = (raw ?? {}) as Record<string, unknown>;
  const number = (input: unknown) => {
    const parsed = typeof input === 'number' ? input : Number(String(input ?? '').replace(',', '.'));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };
  if (typeof value.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.date)) return null;
  const durationMin = number(value.durationMin);
  if (durationMin === null) return null;
  return {
    id: typeof value.id === 'string' && value.id ? value.id : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
    date: value.date,
    completedAt: typeof value.completedAt === 'string' ? value.completedAt : `${value.date}T12:00:00.000Z`,
    type: value.type === 'bike' ? 'bike' : 'run',
    durationMin,
    distanceKm: number(value.distanceKm),
    avgHr: number(value.avgHr),
  };
}

export interface CardioWeek {
  /** Montag der Woche */
  week: string;
  t: number;
  /** Minuten Laufen / Radfahren */
  run: number;
  bike: number;
  km: number;
  sessions: number;
}

/** Cardio pro Woche (Minuten je Art, Kilometer, Einheiten) vom Start bis heute. */
export function cardioWeeks(entries: CardioEntry[], start: string | null, today: string): CardioWeek[] {
  const first = start ?? entries.map((entry) => entry.date).sort()[0];
  if (!first) return [];
  const firstWeek = weekStart(first);
  const weeks: CardioWeek[] = [];
  for (let week = firstWeek; week <= today; week = addDays(week, 7)) {
    weeks.push({ week, t: parseDateKey(week).getTime(), run: 0, bike: 0, km: 0, sessions: 0 });
  }
  for (const entry of entries) {
    const target = weeks[Math.round(daysBetween(firstWeek, weekStart(entry.date)) / 7)];
    if (!target || entry.date < first || entry.date > today) continue;
    target[entry.type] += entry.durationMin;
    target.km += entry.distanceKm ?? 0;
    target.sessions += 1;
  }
  return weeks;
}
