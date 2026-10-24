/** Lokale Datumsfunktionen – Daten werden als YYYY-MM-DD ohne Zeitzone gespeichert. */

export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseDateKey(value: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return new Date(value);
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function daysBetween(from: string, to: string): number {
  const ms = parseDateKey(to).getTime() - parseDateKey(from).getTime();
  return Math.round(ms / 86_400_000);
}

export function addDays(value: string, days: number): string {
  const date = parseDateKey(value);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function addMonths(value: string, months: number): string {
  const date = parseDateKey(value);
  date.setMonth(date.getMonth() + months);
  return toDateKey(date);
}

/** Montag der Woche (ISO-Woche) als Datumsschlüssel. */
export function weekStart(value: string): string {
  const date = parseDateKey(value);
  const weekday = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - weekday);
  return toDateKey(date);
}

const longFormat = new Intl.DateTimeFormat('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit' });
const fullFormat = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const monthFormat = new Intl.DateTimeFormat('de-DE', { month: 'long', year: 'numeric' });
const monthShortFormat = new Intl.DateTimeFormat('de-DE', { month: 'short' });
const weekdayShort = new Intl.DateTimeFormat('de-DE', { weekday: 'short' });

export const formatLong = (value: string) => longFormat.format(parseDateKey(value));
export const formatShort = (value: string) => shortFormat.format(parseDateKey(value));
export const formatFull = (value: string) => fullFormat.format(parseDateKey(value));
export const formatMonth = (value: string) => monthFormat.format(parseDateKey(value));
export const formatMonthShort = (value: string) => monthShortFormat.format(parseDateKey(value)).replace('.', '');
export const formatWeekdayShort = (value: string) => weekdayShort.format(parseDateKey(value)).replace('.', '');

export function relativeDay(value: string, today = todayKey()): string {
  const diff = daysBetween(value, today);
  if (diff === 0) return 'Heute';
  if (diff === 1) return 'Gestern';
  if (diff > 1 && diff < 7) return `vor ${diff} Tagen`;
  return formatFull(value);
}
