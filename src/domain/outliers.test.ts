import { describe, expect, it } from 'vitest';
import { detectOutliers, applyOutlierFlags } from './outliers';
import { exerciseSessions, plausibleSets } from './strength';
import type { Workout } from './types';

function workout(id: string, date: string, entries: Array<[string, Array<[number, number]>]>): Workout {
  return {
    id,
    date,
    completedAt: `${date}T17:00:00.000Z`,
    trainingDay: 'friday',
    trainingDayLabel: 'Freitag',
    exercises: entries.map(([name, sets]) => ({ name, sets: sets.map(([weight, reps]) => ({ weight, reps })) })),
  };
}

describe('plausibleSets', () => {
  it('entfernt einen Tippfehler-Satz', () => {
    const sets = plausibleSets([{ weight: 33.8, reps: 12 }, { weight: 96.3, reps: 12 }]);
    expect(sets).toEqual([{ weight: 33.8, reps: 12 }]);
  });

  it('lässt echte schwere Sätze mit weniger Wiederholungen stehen', () => {
    const input = [{ weight: 40, reps: 6 }, { weight: 40, reps: 4 }, { weight: 20, reps: 15 }];
    expect(plausibleSets(input)).toEqual(input);
  });
});

describe('detectOutliers', () => {
  const press = (weight: number) => [[weight, 12], [weight, 12]] as Array<[number, number]>;
  const workouts = [
    workout('a', '2026-07-03', [['Beinpresse', press(200)]]),
    workout('b', '2026-07-10', [['Beinpresse', press(205)]]),
    workout('c', '2026-07-17', [['Beinpresse', press(210)]]),
    workout('d', '2026-07-24', [['Beinpresse', press(20)]]),
    workout('e', '2026-07-31', [['Beinpresse', press(25)]]),
    workout('f', '2026-08-07', [['Beinpresse', press(210)]]),
    workout('g', '2026-08-14', [['Beinpresse', press(215)]]),
    workout('h', '2026-08-21', [['Beinpresse', press(220)]]),
  ];

  it('findet mehrere Ausreißer in Folge (anderes Gerät)', () => {
    const findings = detectOutliers(workouts);
    expect(findings.map((finding) => finding.workoutId).sort()).toEqual(['d', 'e']);
  });

  it('nimmt markierte Einheiten aus der Kraftauswertung, aber nicht aus der Historie', () => {
    const flagged = applyOutlierFlags(workouts, detectOutliers(workouts));
    expect(flagged).toHaveLength(workouts.length);
    expect(exerciseSessions(flagged, 'Beinpresse')).toHaveLength(6);
    expect(exerciseSessions(flagged, 'Beinpresse', { includeExcluded: true })).toHaveLength(8);
  });

  it('wertet einen dauerhaften Sprung nicht als Ausreißer', () => {
    const shifted = [
      workout('a', '2026-09-01', [['Brustpresse', press(30)]]),
      workout('b', '2026-09-08', [['Brustpresse', press(30)]]),
      workout('c', '2026-09-15', [['Brustpresse', press(32.5)]]),
      workout('d', '2026-09-22', [['Brustpresse', press(30)]]),
      workout('e', '2026-10-06', [['Brustpresse', press(75)]]),
      workout('f', '2026-10-13', [['Brustpresse', press(80)]]),
      workout('g', '2026-10-20', [['Brustpresse', press(85)]]),
    ];
    expect(detectOutliers(shifted)).toEqual([]);
  });
});
