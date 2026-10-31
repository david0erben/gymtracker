import { describe, expect, it } from 'vitest';
import { insertDropSet, sessionProgress, workoutFromDraft, type DraftExercise, type DraftSession, type DraftSet } from './drafts';

const set = (done: boolean, extra: Partial<DraftSet> = {}): DraftSet => ({ reps: 10, weight: 40, rir: null, done, ...extra });
const exercise = (name: string, sets: DraftSet[], planned = sets.length): DraftExercise => ({
  name,
  sets,
  skipped: false,
  excluded: false,
  recommendation: { kind: 'reps', weight: 40, reps: Array.from({ length: planned }, () => 10) },
});
const draft = (exercises: DraftExercise[]): DraftSession => ({ day: 'monday', planId: 'hypertrophy', date: '2026-10-26', startedAt: '', exercises });

describe('sessionProgress', () => {
  it('meldet, wenn alle geplanten Sets erledigt sind', () => {
    expect(sessionProgress(draft([exercise('A', [set(true), set(true)]), exercise('B', [set(true)])]))).toMatchObject({ planned: 3, done: 3, open: 0 });
  });

  it('zählt offene Sets und übersprungene Übungen als nicht erledigt', () => {
    const skipped = { ...exercise('B', [set(false)]), skipped: true };
    expect(sessionProgress(draft([exercise('A', [set(true), set(false)]), skipped]))).toMatchObject({ planned: 3, done: 1, open: 2 });
  });

  it('rechnet Zusatz-Sets und Dropsätze nicht gegen offene Sets auf', () => {
    const progress = sessionProgress(draft([exercise('A', [set(true), set(true), set(true), set(true, { drop: true })], 2), exercise('B', [set(false)])]));
    expect(progress).toMatchObject({ planned: 3, done: 2, open: 1, extra: 1, drops: 1 });
  });
});

describe('Dropsätze im Training', () => {
  it('fügt Dropsätze direkt unter dem Hauptsatz ein, jeweils leichter', () => {
    const first = insertDropSet([set(true), set(false)], 0, 2.5, 0);
    expect(first.map((item) => Boolean(item.drop))).toEqual([false, true, false]);
    expect(first[1]).toMatchObject({ weight: 32.5, reps: 10, done: false });
    const second = insertDropSet(first, 0, 2.5, 0);
    expect(second.map((item) => item.weight)).toEqual([40, 32.5, 25, 40]);
  });

  it('speichert Dropsätze als solche', () => {
    const workout = workoutFromDraft(draft([exercise('A', [set(true), set(true, { drop: true, weight: 30 })], 1)]), { skip: [], exclude: [] });
    expect(workout.exercises[0].sets).toEqual([{ reps: 10, weight: 40 }, { reps: 10, weight: 30, drop: true }]);
  });
});
