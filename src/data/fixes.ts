import type { Workout } from '../domain/types';

/**
 * Von David bestätigte Korrekturen an alten Daten. Sie werden beim Import bzw. bei der
 * Übernahme aus dem alten Gym Tracker angewendet – nur wenn der Eintrag noch im alten
 * Zustand ist, also beliebig oft ohne Nebenwirkungen.
 */
interface DateFix {
  workoutId: string;
  from: string;
  to: string;
  reason: string;
}

const DATE_FIXES: DateFix[] = [
  {
    workoutId: '9067863c-65e3-4d9e-b44e-5dd598856018',
    from: '2026-10-16',
    to: '2026-10-09',
    reason: 'Freitagstraining vom 09.10. wurde erst am 16.10. gespeichert',
  },
];

export function applyDataFixes(workouts: Workout[]): Workout[] {
  return workouts.map((workout) => {
    const fix = DATE_FIXES.find((item) => item.workoutId === workout.id && item.from === workout.date);
    return fix ? { ...workout, date: fix.to } : workout;
  });
}
