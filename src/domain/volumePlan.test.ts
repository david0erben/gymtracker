import { describe, expect, it } from 'vitest';
import { HYPERTROPHY_PLAN, strengthDays, TRAINING_PLAN, WEEK } from './plan';
import { activePlan, defaultSettings, extraSetsMap, resolveExerciseConfig, slotKey } from './settings';
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

describe('Hypertrophie-Profil', () => {
  const settings = { ...defaultSettings(), activeProfileId: 'hypertrophy' };

  it('wechselt auf den eigenen Wochenplan: Mo Day 1, Di Day 2, Mi Cardio, Do Rest, Fr Day 3, Sa Day 4, So Cardio', () => {
    const plan = activePlan(settings);
    expect(plan.id).toBe('hypertrophy');
    expect(WEEK.map((day) => plan.days[day].kind)).toEqual(['strength', 'strength', 'cardio', 'rest', 'strength', 'strength', 'cardio']);
    expect(WEEK.map((day) => plan.days[day].tag)).toEqual(['Day 1', 'Day 2', 'Cardio', 'Rest', 'Day 3', 'Day 4', 'Cardio']);
    expect(plan.days.monday.exercises[0].name).toBe('Plate-Loaded Press');
    expect(activePlan(defaultSettings()).id).toBe('classic');
  });

  it('nimmt Sets und Reps genau aus dem Plan', () => {
    const plan = activePlan(settings);
    for (const day of strengthDays(plan)) {
      for (const exercise of plan.days[day].exercises) {
        const config = resolveExerciseConfig(exercise, settings, day);
        expect(config.sets).toBe(exercise.targetSets);
        expect([config.repMin, config.repMax]).toEqual([exercise.repRange.min, exercise.repRange.max]);
      }
    }
  });

  it('rechnet das Wochenvolumen mit dem Hypertrophie-Plan', () => {
    const profile = settings.profiles.find((item) => item.id === 'hypertrophy')!;
    const lines = (profile.volumeTargets ?? []).map(
      (target) => `${target.label}: ${plannedRegionVolume(settings, target.muscles).planned} (Ziel ${target.min}–${target.max})`,
    );
    console.log(lines.join('\n'));
    expect(plannedRegionVolume(settings, ['Upper Chest', 'Mid Chest', 'Lower Chest']).planned).toBe(8);
    expect(plannedRegionVolume(settings, ['Quads']).planned).toBe(10);
    expect(totalWeeklySets(settings)).toBe(2 * 26);
  });

  it('eigene Werte pro Tag gelten nur im jeweiligen Plan', () => {
    const custom = {
      ...settings,
      exercises: { [slotKey('saturday', 'Beinstrecker', 'hypertrophy')]: { sets: 3 } },
    };
    const extension = HYPERTROPHY_PLAN.days.saturday.exercises.find((exercise) => exercise.name === 'Beinstrecker')!;
    expect(resolveExerciseConfig(extension, custom, 'saturday').sets).toBe(3);
    const classic = { ...custom, activeProfileId: 'individual' };
    const classicExtension = TRAINING_PLAN.friday.exercises.find((exercise) => exercise.name === 'Beinstrecker')!;
    expect(resolveExerciseConfig(classicExtension, classic, 'friday').sets).toBe(classicExtension.targetSets);
  });

  it('lässt das Profil „Individuell“ unverändert', () => {
    const individual = defaultSettings();
    for (const exercise of TRAINING_PLAN.tuesday.exercises) {
      expect(resolveExerciseConfig(exercise, individual, 'tuesday').sets).toBe(exercise.targetSets);
    }
  });
});

describe('Sets nach Wochenzielen verteilen', () => {
  it('bringt jede Muskelgruppe ins Wochenziel', () => {
    const base = defaultSettings();
    const hypertrophy = base.profiles.find((item) => item.id === 'hypertrophy')!;
    const profile = { ...hypertrophy, id: 'volume-test', planId: 'classic', setsSource: 'volume' as const };
    const settings = { ...base, activeProfileId: profile.id, profiles: [...base.profiles, profile] };
    for (const target of profile.volumeTargets ?? []) {
      const { planned } = plannedRegionVolume(settings, target.muscles);
      expect(planned).toBeGreaterThanOrEqual(target.min);
      expect(planned).toBeLessThanOrEqual(target.max);
    }
  });
});
