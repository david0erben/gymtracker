import { describe, expect, it } from 'vitest';
import { formatPace, normalizeCardio, paceMinPerKm, speedKmh } from './cardio';

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
