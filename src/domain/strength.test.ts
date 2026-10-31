import { describe, expect, it } from 'vitest';
import { weeklyVolume } from './analytics';
import { formatSet } from './format';
import { defaultSettings, resolveExerciseConfig } from './settings';
import { dropCount, exerciseSessions, firstStep, mainSetIndex, mainSetNumber, nextStepAbove, nextStepBelow, removeSetAt } from './strength';
import type { Workout } from './types';

describe('Gewichtsraster mit Startgewicht', () => {
  it('läuft vom Startgewicht aus in Stufen', () => {
    expect(nextStepAbove(3, 3.5, 3)).toBe(6.5);
    expect(nextStepAbove(6.5, 3.5, 3)).toBe(10);
    expect(nextStepBelow(10, 3.5, 3)).toBe(6.5);
  });

  it('geht nicht unter das Startgewicht', () => {
    expect(nextStepBelow(6.5, 3.5, 3)).toBe(3);
    expect(nextStepBelow(3, 3.5, 3)).toBe(3);
    expect(firstStep(3.5, 3)).toBe(3);
    expect(firstStep(2.5)).toBe(2.5);
  });

  it('übernimmt Stufe und Startgewicht pro Übung vor den Werten vom Gerät', () => {
    const settings = defaultSettings();
    const planned = { name: 'Cable Curl', targetSets: 2, repRange: { min: 7, max: 10 } };
    expect(resolveExerciseConfig(planned, settings).step).toBe(1.25);
    const custom = { ...settings, exercises: { 'Cable Curl': { step: 3.5, base: 3 } } };
    const config = resolveExerciseConfig(planned, custom);
    expect([config.step, config.base]).toEqual([3.5, 3]);
  });
});

describe('Dropsätze', () => {
  const sets = [{}, { drop: true }, { drop: true }, {}, { drop: true }, {}];

  it('findet Hauptsatz, Anzahl und Nummer', () => {
    expect(mainSetIndex(sets, 2)).toBe(0);
    expect(dropCount(sets, 0)).toBe(2);
    expect(dropCount(sets, 5)).toBe(0);
    expect(mainSetNumber(sets, 3)).toBe(2);
    expect(mainSetNumber(sets, 5)).toBe(3);
  });

  it('entfernt mit einem Hauptsatz auch seine Dropsätze', () => {
    expect(removeSetAt(sets, 0)).toHaveLength(3);
    expect(removeSetAt(sets, 1)).toHaveLength(5);
  });

  const workout: Workout = {
    id: 'w1',
    date: '2026-10-19',
    completedAt: '2026-10-19T17:00:00.000Z',
    trainingDay: 'monday',
    trainingDayLabel: 'Montag',
    exercises: [
      {
        name: 'Cable Curl',
        sets: [
          { reps: 10, weight: 20 },
          { reps: 8, weight: 15, drop: true },
          { reps: 10, weight: 20 },
        ],
      },
    ],
  };

  it('zählen nicht für Empfehlung und Kraftkurve', () => {
    expect(exerciseSessions([workout], 'Cable Curl')[0].sets).toHaveLength(2);
  });

  it('zählen beim Volumen voll mit, als Set und beim bewegten Gewicht', () => {
    const [week] = weeklyVolume([workout], '2026-10-19', '2026-10-19');
    expect(week.sets.Biceps).toBe(3);
    expect(week.tonnage.Biceps).toBe(10 * 20 + 8 * 15 + 10 * 20);
  });
});

describe('Anzeige', () => {
  it('zeigt erst die Reps, dann das Gewicht', () => {
    expect(formatSet(6, 40)).toBe('6 × 40');
    expect(formatSet(10, 42.5)).toBe('10 × 42,5');
    expect(formatSet(12, null)).toBe('12 Reps');
  });
});
