import { describe, expect, it } from 'vitest';
import { TRAINING_PLAN } from './plan';
import { defaultSettings, extraSetsMap, resolveExerciseConfig } from './settings';
import { plannedRegionVolume, plannedWeeklyVolume, totalWeeklySets } from './volumePlan';

describe('Wochenvolumen', () => {
  it('zählt nur Übungen, in denen der Muskel Hauptmuskel ist', () => {
    const volume = plannedWeeklyVolume(defaultSettings());
    // Biceps: Bayesian Curl 2, Hammer Curls 2, Preacher Curl 2 – Rudern & Co. zählen nicht mit
    expect(volume.Biceps.planned).toBe(6);
    expect(volume.Biceps.contributions).toHaveLength(3);
  });

  it('zählt jede Übung pro Bereich nur einmal', () => {
    const settings = defaultSettings();
    const legs = plannedRegionVolume(settings, ['Quads', 'Hamstrings', 'Glutes', 'Adductors', 'Calves']);
    const volume = plannedWeeklyVolume(settings);
    const perMuscle = volume.Quads.planned + volume.Hamstrings.planned + volume.Glutes.planned + volume.Adductors.planned + volume.Calves.planned;
    // Leg Press (Quads + Glutes) und RDL (Hamstrings + Glutes) würden sonst doppelt zählen
    expect(legs.planned).toBeLessThan(perMuscle);
    expect(legs.planned).toBe(3 + 2 + 2 + 2 + 2 + 2 + 2 + 3);
  });

  it('verteilt selbst gewählte Zusatz-Sets auf die gezieltesten Übungen', () => {
    const settings = { ...defaultSettings(), volumeExtras: { Biceps: 2 } };
    const extras = extraSetsMap(settings);
    expect(extras['tuesday:Bicep Curls Ellenbogen hinter Körper']).toBe(1);
    expect(extras['thursday:Hammer Curls']).toBe(1);
    const curls = TRAINING_PLAN.tuesday.exercises.find((exercise) => exercise.name === 'Bicep Curls Ellenbogen hinter Körper')!;
    expect(resolveExerciseConfig(curls, settings, 'tuesday').sets).toBe(3);
    expect(totalWeeklySets(settings)).toBe(totalWeeklySets(defaultSettings()) + 2);
  });

  it('ohne eigene Anpassung bleibt die Set-Zahl genau wie im Plan', () => {
    const settings = defaultSettings();
    for (const exercise of TRAINING_PLAN.monday.exercises) {
      expect(resolveExerciseConfig(exercise, settings, 'monday').sets).toBe(exercise.targetSets);
    }
  });

  it('zieht Sets ab, aber nie unter 1 Set pro Übung', () => {
    const settings = { ...defaultSettings(), volumeExtras: { Calves: -5 } };
    const calves = TRAINING_PLAN.friday.exercises.find((exercise) => exercise.name === 'Waden')!;
    expect(resolveExerciseConfig(calves, settings, 'friday').sets).toBe(1);
  });
});
