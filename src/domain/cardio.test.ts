import { describe, expect, it } from 'vitest';
import { cardioWeeks, formatPace, normalizeCardio, paceMinPerKm, speedKmh } from './cardio';

describe('cardio', () => {
  it('berechnet Pace und Geschwindigkeit', () => {
    expect(formatPace(paceMinPerKm({ durationMin: 28.5, distanceKm: 5 }))).toBe('5:42');
    expect(speedKmh({ durationMin: 60, distanceKm: 27.4 })).toBeCloseTo(27.4);
    expect(paceMinPerKm({ durationMin: 30, distanceKm: null })).toBeNull();
  });

  it('liest Einträge robust ein', () => {
    expect(normalizeCardio({ date: '2026-10-25', type: 'bike', durationMin: '45', avgHr: 132 })).toMatchObject({
      type: 'bike',
      durationMin: 45,
      distanceKm: null,
      avgHr: 132,
    });
    expect(normalizeCardio({ date: 'x', durationMin: 30 })).toBeNull();
  });
});

describe('cardioWeeks', () => {
  it('summiert Minuten je Art und Kilometer pro Woche', () => {
    const entry = (date: string, type: 'run' | 'bike', durationMin: number, distanceKm: number | null) =>
      ({ id: date + type, date, completedAt: date, type, durationMin, distanceKm, avgHr: null }) as const;
    const weeks = cardioWeeks(
      [entry('2026-10-14', 'run', 30, 5), entry('2026-10-18', 'bike', 60, 25), entry('2026-10-21', 'run', 40, 7)],
      '2026-10-12',
      '2026-10-25',
    );
    expect(weeks.map((week) => week.week)).toEqual(['2026-10-12', '2026-10-19']);
    expect(weeks[0]).toMatchObject({ run: 30, bike: 60, km: 30, sessions: 2 });
    expect(weeks[1]).toMatchObject({ run: 40, bike: 0, km: 7, sessions: 1 });
  });
});
