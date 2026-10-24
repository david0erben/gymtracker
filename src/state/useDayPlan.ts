import { useMemo } from 'react';
import { todayKey } from '../domain/dates';
import { exerciseInfo, TRAINING_PLAN, type ExerciseInfo, type PlannedExercise } from '../domain/plan';
import { recommend, type Recommendation } from '../domain/progression';
import { resolveExerciseConfig, type ExerciseConfig, type Settings } from '../domain/settings';
import { exerciseSessions } from '../domain/strength';
import type { DayKey, Workout } from '../domain/types';
import { useStore } from './store';

export interface PlanItem {
  planned: PlannedExercise;
  config: ExerciseConfig;
  info: ExerciseInfo;
  recommendation: Recommendation;
}

export function computeDayPlan(day: DayKey, workouts: Workout[], settings: Settings, today: string): PlanItem[] {
  return TRAINING_PLAN[day].exercises.map((planned) => {
    const config = resolveExerciseConfig(planned, settings, day);
    const sessions = exerciseSessions(workouts, planned.name);
    return {
      planned,
      config,
      info: exerciseInfo(planned.name),
      recommendation: recommend(sessions, config, settings.rules, today),
    };
  });
}

export function useDayPlan(day: DayKey): PlanItem[] {
  const workouts = useStore((state) => state.workouts);
  const settings = useStore((state) => state.settings);
  const today = todayKey();
  return useMemo(() => computeDayPlan(day, workouts, settings, today), [day, workouts, settings, today]);
}
