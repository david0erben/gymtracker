import { describe, expect, it } from 'vitest';
import { goalLine, movingAverage, strengthSeries, trendPercent, weeklyVolume } from './analytics';
import type { Workout } from './types';

function workout(id: string, date: string, name: string, sets: Array<[number | null, number]>, excluded = false): Workout {
  return {
    id,
    date,
    completedAt: `${date}T17:00:00.000Z`,
    trainingDay: 'monday',
    trainingDayLabel: 'Montag',
    exercises: [{ name, excluded, sets: sets.map(([weight, reps]) => ({ weight, reps })) }],
  };
}

describe('strengthSeries', () => {
  it('lässt nicht gewertete Einheiten aus, damit die Linie die Nachbarn verbindet', () => {
    const series = strengthSeries(
      [
        workout('a', '2026-09-01', 'Beinpresse', [[200, 12]]),
        workout('b', '2026-09-08', 'Beinpresse', [[20, 12]], true),
        workout('c', '2026-09-15', 'Beinpresse', [[210, 12]]),
      ],
      'Beinpresse',
    );
    expect(series.metric).toBe('e1rm');
    expect(series.points.map((point) => point.date)).toEqual(['2026-09-01', '2026-09-15']);
  });

  it('nutzt Wiederholungen bei Körpergewichtsübungen', () => {
    const series = strengthSeries([workout('a', '2026-09-01', 'Hanging Leg Raises', [[null, 6], [null, 6]])], 'Hanging Leg Raises');
    expect(series.metric).toBe('reps');
    expect(series.points[0].value).toBe(12);
  });
});

describe('Gerätewechsel', () => {
  it('rechnet ältere Werte auf das neue Gerät um', () => {
    const workouts = [
      workout('a', '2026-09-01', 'Brustpresse', [[30, 10]]),
      workout('b', '2026-09-08', 'Brustpresse', [[30, 10]]),
      workout('c', '2026-10-08', 'Brustpresse', [[75, 10]]),
      workout('d', '2026-10-15', 'Brustpresse', [[80, 10]]),
    ];
    const series = strengthSeries(workouts, 'Brustpresse', ['2026-10-08']);
    expect(series.shifts).toHaveLength(1);
    expect(series.points[0].raw).toBe(40);
    // umgerechnet: kein Sprung mehr zwischen alt und neu
    expect(series.points[1].value / series.points[2].value).toBeGreaterThan(0.9);
    expect(series.points[3].raw).toBeUndefined();
  });
});

describe('trendPercent', () => {
  it('vergleicht geglättete Anfangs- und Endwerte', () => {
    expect(trendPercent([{ value: 100 }, { value: 100 }, { value: 110 }, { value: 110 }])).toBeCloseTo(10);
  });
});

describe('goalLine', () => {
  it('berechnet Sollwert und Status', () => {
    const points = [
      { date: '2026-09-01', t: 0, value: 100, best: { weight: 75, reps: 10 } },
      { date: '2026-09-08', t: 0, value: 100, best: { weight: 75, reps: 10 } },
      { date: '2026-10-20', t: 0, value: 104, best: { weight: 78, reps: 10 } },
      { date: '2026-10-22', t: 0, value: 104, best: { weight: 78, reps: 10 } },
    ];
    const line = goalLine(points, { percent: 5, months: 6, startDate: '2026-09-08' }, '2026-10-24');
    expect(line?.end.value).toBe(105);
    expect(line?.onTrack).toBe(true);
  });
});

describe('weeklyVolume', () => {
  it('zählt nur Hauptmuskeln, keine halben Sets für Hilfsmuskeln', () => {
    const weeks = weeklyVolume([workout('a', '2026-10-19', 'Schrägbank Kurzhantel Bankdrücken', [[40, 8], [40, 7]])], '2026-10-19', '2026-10-24');
    expect(weeks).toHaveLength(1);
    expect(weeks[0].sets.Chest).toBe(2);
    expect(weeks[0].sets.Triceps).toBe(0);
  });
});

it('movingAverage', () => {
  expect(movingAverage([4, 8, 12], 2)).toEqual([4, 6, 10]);
});
