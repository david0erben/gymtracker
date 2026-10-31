import { describe, expect, it } from 'vitest';
import { recommend, isPlateau, snapshotOf } from './progression';
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
    // ohne Verlauf ein Rep mehr auf dem schwächsten Satz
    expect(result.sets.map((set) => set.reps)).toEqual([8, 7, 7]);
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
    expect(result.sets.map((set) => set.reps)).toEqual([6, 6, 6]);
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
    expect(result.sets.slice(0, 2).map((set) => set.reps)).toEqual([10, 10]);
    expect(result.headline).toBe('Alle Sets');
  });

  it('zielt nach einer Steigerung mindestens aufs untere Ende des Bereichs', () => {
    const curls = config({ repMin: 10, repMax: 12, sets: 2, step: 2.5 });
    const result = recommend([session('2026-10-20', [[10, 12], [10, 12]])], curls, rules, '2026-10-27');
    expect(result.kind).toBe('increase');
    expect(result.weight).toBe(12.5);
    expect(result.sets.every((set) => set.reps >= 10)).toBe(true);
    expect(result.note).toMatch(/Großer Sprung/);
  });

  it('rechnet stark gemischte Gewichte auf ein einheitliches Gewicht um', () => {
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
    expect(result.sets.map((set) => set.reps)).toEqual([7, 6, 6]);
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

describe('Tempo: nicht jedes Training steigern', () => {
  const range = (sets = 2) => config({ repMin: 10, repMax: 12, sets, step: 2.5 });

  it('plant nach einer neuen Bestleistung erst die gleichen Reps', () => {
    const result = recommend(
      [session('2026-10-12', [[40, 10], [40, 10]]), session('2026-10-19', [[40, 11], [40, 11]])],
      range(),
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('hold');
    expect(result.headline).toBe('Halten');
    expect(result.weight).toBe(40);
    expect(result.sets.map((set) => set.reps)).toEqual([11, 11]);
  });

  it('steigert, sobald das Niveau bestätigt ist', () => {
    const result = recommend(
      [
        session('2026-10-05', [[40, 10], [40, 10]]),
        session('2026-10-12', [[40, 11], [40, 11]]),
        session('2026-10-19', [[40, 11], [40, 11]]),
      ],
      range(),
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('reps');
    expect(result.sets.map((set) => set.reps)).toEqual([12, 11]);
  });

  it('erhöht nach einem Ausreißer nach oben nicht sofort das Gewicht', () => {
    const result = recommend(
      [session('2026-10-12', [[40, 10], [40, 10], [40, 9]]), session('2026-10-19', [[40, 12], [40, 12], [40, 12]])],
      range(3),
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('hold');
    expect(result.weight).toBe(40);
    expect(result.reason).toMatch(/Starke Einheit/);
  });

  it('orientiert sich nach einem Einbruch an der letzten Einheit, nicht am Bestwert', () => {
    const result = recommend(
      [
        session('2026-10-05', [[40, 10], [40, 10], [40, 9]]),
        session('2026-10-12', [[40, 12], [40, 12], [40, 11]]),
        session('2026-10-19', [[40, 11], [40, 10], [40, 10]]),
      ],
      range(3),
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('reps');
    expect(result.sets.map((set) => set.reps)).toEqual([11, 11, 10]);
  });

  it('lernt: wer Steigerungen zuverlässig hält, muss nicht erst bestätigen', () => {
    const steady: Array<[number, number]> = [[10, 10], [11, 10], [11, 11], [12, 11], [12, 12], [13, 12], [13, 13]];
    const sessions = steady.map(([a, b], index) => session(`2026-09-${String(index + 7).padStart(2, '0')}`, [[40, a], [40, b]]));
    const result = recommend(sessions, config({ repMin: 8, repMax: 20, sets: 2 }), rules, '2026-09-16');
    expect(result.kind).toBe('reps');
    expect(result.note).toMatch(/Steigerungen/);
  });

  it('lernt deinen typischen Zuwachs pro Einheit', () => {
    const sessions = [
      session('2026-09-07', [[40, 8], [40, 8]]),
      session('2026-09-14', [[40, 9], [40, 9]]),
      session('2026-09-21', [[40, 9], [40, 9]]),
      session('2026-09-28', [[40, 10], [40, 10]]),
      session('2026-10-05', [[40, 10], [40, 10]]),
      session('2026-10-12', [[40, 11], [40, 11]]),
      session('2026-10-19', [[40, 11], [40, 11]]),
    ];
    const result = recommend(sessions, config({ repMin: 8, repMax: 15, sets: 2 }), rules, '2026-10-26');
    expect(result.sets.map((set) => set.reps)).toEqual([12, 12]);
    expect(result.headline).toBe('+2 Reps');
  });

  it('überspringt das Bestätigen, wenn laut RIR noch Luft war', () => {
    const easy = session('2026-10-19', [[40, 11], [40, 11]]);
    easy.sets = easy.sets.map((set) => ({ ...set, rir: 4 }));
    const result = recommend([session('2026-10-12', [[40, 10], [40, 10]]), easy], range(), rules, '2026-10-26');
    expect(result.kind).toBe('reps');
    expect(result.reason).toMatch(/noch Luft/);
  });

  it('rechnet unter dem Bereich nicht doppelt drauf', () => {
    const result = recommend(
      [session('2026-10-12', [[85, 7], [85, 7]]), session('2026-10-19', [[85, 7], [85, 6]])],
      config({ repMin: 8, repMax: 12, sets: 2 }),
      rules,
      '2026-10-26',
    );
    expect(result.sets.map((set) => set.reps)).toEqual([8, 8]);
    expect(result.reason).toMatch(/Zielbereich/);
  });

  it('wertet eine bestätigte Bestleistung nicht als Plateau', () => {
    const same = () => [[30, 6], [30, 6], [30, 6]] as Array<[number, number]>;
    const sessions = [session('2026-09-28', same()), session('2026-10-05', same()), session('2026-10-12', same()), session('2026-10-19', same())];
    expect(isPlateau(sessions, 3, 3)).toBe(false);
    expect(isPlateau([session('2026-09-21', same()), ...sessions], 3, 3)).toBe(true);
  });
});

describe('unterschiedliche Gewichte pro Satz', () => {
  const stack = config({ repMin: 10, repMax: 12, sets: 3, step: 5 });

  it('stellt Satz für Satz um, wenn das neue Gewicht nicht für alle Sätze reicht', () => {
    const result = recommend([session('2026-10-19', [[40, 12], [40, 12], [40, 12]])], stack, rules, '2026-10-26');
    expect(result.kind).toBe('increase');
    expect(result.weight).toBe(45);
    expect(result.sets).toEqual([{ reps: 10, weight: 45 }, { reps: 12, weight: 40 }, { reps: 12, weight: 40 }]);
    expect(snapshotOf(result).weights).toEqual([45, 40, 40]);
  });

  it('nimmt alle Sätze mit, wenn es laut Schätzung reicht', () => {
    const light = config({ repMin: 8, repMax: 12, sets: 3, step: 2.5 });
    const result = recommend([session('2026-10-19', [[60, 12], [60, 12], [60, 12]])], light, rules, '2026-10-26');
    expect(new Set(result.sets.map((set) => set.weight)).size).toBe(1);
    expect(snapshotOf(result).weights).toBeUndefined();
  });

  it('baut den schweren Satz erst auf, bevor der nächste Satz nachzieht', () => {
    const result = recommend(
      [session('2026-10-12', [[40, 12], [40, 12], [40, 12]]), session('2026-10-19', [[45, 10], [40, 12], [40, 12]])],
      stack,
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('reps');
    expect(result.sets).toEqual([{ reps: 11, weight: 45 }, { reps: 12, weight: 40 }, { reps: 12, weight: 40 }]);
  });

  it('zieht den nächsten Satz nach, sobald es laut Schätzung passt', () => {
    const result = recommend(
      [session('2026-10-12', [[45, 10], [40, 12], [40, 12]]), session('2026-10-19', [[45, 11], [40, 12], [40, 12]])],
      stack,
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('increase');
    expect(result.sets.map((set) => set.weight)).toEqual([45, 45, 40]);
  });

  it('geht zurück, wenn das schwerere Gewicht klar zu viel war', () => {
    const result = recommend(
      [session('2026-10-12', [[40, 12], [40, 12], [40, 12]]), session('2026-10-19', [[45, 7], [40, 12], [40, 12]])],
      stack,
      rules,
      '2026-10-26',
    );
    expect(result.kind).toBe('decrease');
    expect(result.sets.every((set) => set.weight === 40)).toBe(true);
  });

  it('hebt schwere Sätze unter dem Bereich nur bis in die Range', () => {
    const result = recommend(
      [session('2026-10-12', [[85, 7], [75, 10], [75, 10]]), session('2026-10-19', [[85, 7], [75, 10], [75, 10]])],
      config({ repMin: 8, repMax: 12, sets: 3, step: 5 }),
      rules,
      '2026-10-26',
    );
    expect(result.sets).toEqual([{ reps: 8, weight: 85 }, { reps: 10, weight: 75 }, { reps: 10, weight: 75 }]);
  });

  it('ignoriert einen leichten Zusatzsatz über die Planung hinaus', () => {
    const result = recommend(
      [session('2026-10-19', [[40, 11], [40, 10], [40, 10], [30, 15]])],
      stack,
      rules,
      '2026-10-26',
    );
    expect(result.sets.every((set) => set.weight === 40)).toBe(true);
  });
});
