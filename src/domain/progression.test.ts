import { describe, expect, it } from 'vitest';
import { recommend, isPlateau } from './progression';
import { defaultSettings, resolveExerciseConfig, type ExerciseConfig } from './settings';
import type { ExerciseSession } from './strength';
import type { SetEntry } from './types';

const settings = defaultSettings();
const rules = { ...settings.rules };

function config(overrides: Partial<ExerciseConfig> = {}): ExerciseConfig {
  const base = resolveExerciseConfig(
    { name: 'Schrägbank Kurzhantel Bankdrücken', targetSets: 3, repRange: { min: 6, max: 10 } },
    settings,
  );
  return { ...base, ...overrides };
}

let counter = 0;
function session(date: string, sets: Array<[number | null, number]>): ExerciseSession {
  counter += 1;
  return {
    workoutId: `w${counter}`,
    date,
    completedAt: `${date}T17:00:00.000Z`,
    sets: sets.map(([weight, reps]): SetEntry => ({ weight, reps })),
    excluded: false,
  };
}

describe('recommend', () => {
  it('gibt ohne Verlauf eine Erst-Empfehlung ohne Gewicht', () => {
    const result = recommend([], config(), rules, '2026-10-26');
    expect(result.kind).toBe('first');
    expect(result.sets).toHaveLength(3);
    expect(result.sets[0].weight).toBeNull();
  });

  it('steigert die Wiederholungen bei gleichem Gewicht', () => {
    const result = recommend([session('2026-10-19', [[40, 8], [40, 7], [40, 6]])], config(), rules, '2026-10-26');
    expect(result.kind).toBe('reps');
    expect(result.weight).toBe(40);
    expect(result.sets.map((set) => set.reps)).toEqual([9, 8, 7]);
  });

  it('erhöht das Gewicht, wenn alle Sätze am oberen Ende waren', () => {
    const result = recommend([session('2026-10-19', [[37.5, 10], [37.5, 10], [37.5, 10]])], config(), rules, '2026-10-26');
    expect(result.kind).toBe('increase');
    expect(result.weight).toBe(40);
    expect(result.weight! % 2.5).toBe(0);
    // landet wieder am unteren Ende des Bereichs (6–10)
    expect(result.sets[0].reps).toBeGreaterThanOrEqual(6);
    expect(result.sets[0].reps).toBeLessThan(10);
  });

  it('steigert bis zum schwersten Gewicht, mit dem alle Sätze noch im Bereich liegen', () => {
    const wide = config({ repMin: 8, repMax: 12, step: 2.5 });
    const result = recommend([session('2026-10-19', [[60, 12], [60, 12], [60, 12]])], wide, rules, '2026-10-26');
    expect(result.kind).toBe('increase');
    // schwerstes Gewicht, mit dem noch alle 3 Sätze mindestens 8 Wdh schaffen
    expect(result.weight).toBe(62.5);
    expect(result.sets.every((set) => set.reps >= 8)).toBe(true);
  });

  it('geht runter, wenn die Mehrheit der Sätze klar unter dem Bereich liegt', () => {
    const result = recommend([session('2026-10-19', [[40, 5], [40, 4], [40, 3]])], config(), rules, '2026-10-26');
    expect(result.kind).toBe('decrease');
    expect(result.weight).toBeLessThan(40);
  });

  it('toleriert eine Wiederholung unter dem Bereich, Ziele bleiben aber in der Range', () => {
    const result = recommend([session('2026-10-19', [[40, 6], [40, 5], [40, 4]])], config(), rules, '2026-10-26');
    expect(result.kind).toBe('reps');
    expect(result.sets.map((set) => set.reps)).toEqual([7, 6, 6]);
  });

  it('empfiehlt nie Reps außerhalb der Range und nie andere Set-Zahlen', () => {
    const cases: Array<Array<[number, number]>> = [
      [[40, 5], [40, 4], [40, 3]],
      [[37.5, 10], [37.5, 10], [37.5, 10]],
      [[40, 6], [40, 4], [20, 15], [20, 15]],
      [[30, 12], [30, 11]],
    ];
    for (const sets of cases) {
      const result = recommend([session('2026-10-19', sets)], config(), rules, '2026-10-26');
      expect(result.sets).toHaveLength(3);
      for (const set of result.sets) {
        expect(set.reps).toBeGreaterThanOrEqual(6);
        expect(set.reps).toBeLessThanOrEqual(10);
      }
    }
  });

  it('füllt fehlende Sätze auf, wenn letztes Mal weniger Sätze gemacht wurden', () => {
    const result = recommend([session('2026-10-23', [[90, 10], [90, 10]])], config({ repMin: 10, repMax: 15 }), rules, '2026-10-26');
    expect(result.kind).toBe('reps');
    expect(result.weight).toBe(90);
    expect(result.sets).toHaveLength(3);
    expect(result.sets.slice(0, 2).map((set) => set.reps)).toEqual([11, 11]);
  });

  it('zielt nach einer Steigerung mindestens aufs untere Ende des Bereichs', () => {
    const curls = config({ repMin: 10, repMax: 12, sets: 2, step: 2.5 });
    const result = recommend([session('2026-10-20', [[10, 12], [10, 12]])], curls, rules, '2026-10-27');
    expect(result.kind).toBe('increase');
    expect(result.weight).toBe(12.5);
    expect(result.sets.every((set) => set.reps >= 10)).toBe(true);
    expect(result.note).toMatch(/Großer Sprung/);
  });

  it('rechnet gemischte Gewichte auf ein einheitliches Gewicht um', () => {
    const result = recommend(
      [session('2026-10-19', [[40, 6], [40, 4], [20, 15], [20, 15]])],
      config(),
      rules,
      '2026-10-26',
    );
    expect(result.sets.every((set) => set.weight === result.weight)).toBe(true);
    expect(result.weight).toBe(37.5);
  });

  it('steigt nach langer Pause leichter ein', () => {
    const result = recommend([session('2026-09-01', [[40, 8], [40, 8], [40, 8]])], config(), rules, '2026-10-26');
    expect(result.kind).toBe('comeback');
    expect(result.weight).toBe(35);
  });

  it('erkennt ein Plateau und empfiehlt einen Neuanlauf', () => {
    const sessions = [
      session('2026-09-28', [[30, 6], [30, 6], [30, 6]]),
      session('2026-10-05', [[30, 6], [30, 6], [30, 5]]),
      session('2026-10-12', [[30, 6], [30, 6], [30, 6]]),
      session('2026-10-19', [[30, 6], [30, 5], [30, 5]]),
    ];
    expect(isPlateau(sessions, 3, 3)).toBe(true);
    const result = recommend(sessions, config(), rules, '2026-10-26');
    expect(result.kind).toBe('deload');
    expect(result.weight).toBe(27.5);
  });

  it('steigert bei Körpergewicht die Wiederholungen', () => {
    const bodyweight = config({ bodyweight: true, repMin: 6, repMax: 10 });
    const result = recommend([session('2026-10-20', [[null, 6], [null, 6], [null, 6]])], bodyweight, rules, '2026-10-27');
    expect(result.kind).toBe('reps');
    expect(result.sets.map((set) => set.reps)).toEqual([7, 7, 7]);
    expect(result.weight).toBeNull();
  });

  it('nutzt RIR für die Schätzung', () => {
    const withRir = recommend(
      [{ ...session('2026-10-19', [[37.5, 10], [37.5, 10], [37.5, 10]]), sets: [{ weight: 37.5, reps: 10, rir: 3 }, { weight: 37.5, reps: 10, rir: 3 }, { weight: 37.5, reps: 10, rir: 3 }] }],
      config(),
      rules,
      '2026-10-26',
    );
    const withoutRir = recommend([session('2026-10-19', [[37.5, 10], [37.5, 10], [37.5, 10]])], config(), rules, '2026-10-26');
    expect(withRir.weight!).toBeGreaterThanOrEqual(withoutRir.weight!);
  });

  it('respektiert ein Geräteraster mit Startgewicht', () => {
    const cable = config({ step: 2.5, base: 1.25, repMin: 10, repMax: 15, sets: 2 });
    const result = recommend([session('2026-10-20', [[33.75, 15], [33.75, 15]])], cable, rules, '2026-10-27');
    expect(result.kind).toBe('increase');
    expect(((result.weight! - 1.25) / 2.5) % 1).toBeCloseTo(0);
  });
});
