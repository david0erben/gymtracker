import { useEffect, useMemo, useState } from 'react';
import { CircleCheck, Flag, RotateCcw } from 'lucide-react';
import { Button } from '../../components/ui';
import { todayKey } from '../../domain/dates';
import type { TrainingPlan } from '../../domain/plan';
import type { DayKey } from '../../domain/types';
import { mainSetIndex, removeSetAt } from '../../domain/strength';
import {
  draftFromRecommendations,
  draftKey,
  doneSetCount,
  insertDropSet,
  isExerciseComplete,
  sessionProgress,
  type DraftExercise,
  type DraftSession,
  type DraftSet,
  type FinishOptions,
} from '../../state/drafts';
import { useStore } from '../../state/store';
import { useDayPlan } from '../../state/useDayPlan';
import { ExerciseCard } from './ExerciseCard';
import { FinishSheet } from './FinishSheet';
import { TrainingHeader } from './TrainingHeader';

function sameExercises(a: DraftSession, b: DraftSession): boolean {
  return a.exercises.length === b.exercises.length && a.exercises.every((exercise, index) => exercise.name === b.exercises[index].name);
}

function firstIncomplete(session: DraftSession, after = -1): number | null {
  const index = session.exercises.findIndex((exercise, position) => position > after && !isExerciseComplete(exercise));
  return index === -1 ? null : index;
}

/** Krafttag: Übungen aus dem Plan mit vorausgefüllten Empfehlungen. */
export function StrengthDay({ plan: trainingPlan, day }: { plan: TrainingPlan; day: DayKey }) {
  const drafts = useStore((state) => state.drafts);
  const setDraft = useStore((state) => state.setDraft);
  const updateDraft = useStore((state) => state.updateDraft);
  const finishWorkout = useStore((state) => state.finishWorkout);
  const updateSettings = useStore((state) => state.updateSettings);
  const workouts = useStore((state) => state.workouts);
  const showToast = useStore((state) => state.showToast);

  const key = draftKey(trainingPlan.id, day);
  const plan = useDayPlan(trainingPlan, day);
  const today = todayKey();
  const virtual = useMemo(
    () => draftFromRecommendations(day, today, plan.map((item) => ({ name: item.planned.name, recommendation: item.recommendation })), trainingPlan.id),
    [day, today, plan, trainingPlan.id],
  );
  // Ein angefangenes Training passt nur, wenn es noch dieselben Übungen hat wie der Plan
  const stored = drafts[key];
  const draft = stored && sameExercises(stored, virtual) ? stored : undefined;
  const session = draft ?? virtual;

  const [expanded, setExpanded] = useState<number | null>(() => firstIncomplete(session));
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    setExpanded(firstIncomplete(draft ?? virtual));
    // nur beim Tageswechsel neu ausrichten
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day]);

  const mutate = (update: (current: DraftSession) => DraftSession) => {
    const current = useStore.getState().drafts[key];
    if (current && sameExercises(current, virtual)) updateDraft(key, update);
    else setDraft(key, update(virtual));
  };

  const mutateExercise = (index: number, update: (exercise: DraftExercise) => DraftExercise) =>
    mutate((current) => ({ ...current, exercises: current.exercises.map((exercise, position) => (position === index ? update(exercise) : exercise)) }));

  const changeSet = (index: number, setIndex: number, patch: Partial<DraftSet>) =>
    mutateExercise(index, (exercise) => ({
      ...exercise,
      sets: exercise.sets.map((set, position) => (position === setIndex ? { ...set, ...patch } : set)),
    }));

  const saveSet = (index: number, setIndex: number) => {
    const exercise = session.exercises[index];
    // Ein Dropsatz setzt den Satz darüber voraus – der gilt damit als gemacht
    const main = mainSetIndex(exercise.sets, setIndex);
    const saved = (position: number) => position === setIndex || position === main;
    mutateExercise(index, (current) => ({ ...current, sets: current.sets.map((set, position) => (saved(position) ? { ...set, done: true } : set)) }));
    const willComplete = exercise.sets.every((set, position) => saved(position) || set.done);
    if (willComplete) {
      const nextSession = { ...session, exercises: session.exercises.map((item, position) => (position === index ? { ...item, sets: item.sets.map((set) => ({ ...set, done: true })) } : item)) };
      setExpanded(firstIncomplete(nextSession, index) ?? firstIncomplete(nextSession));
    }
  };

  const addSet = (index: number) =>
    mutateExercise(index, (exercise) => {
      const main = exercise.sets.filter((set) => !set.drop);
      const template = [...main].reverse().find((set) => set.done) ?? main.at(-1);
      return {
        ...exercise,
        sets: [...exercise.sets, { reps: template?.reps ?? null, weight: template?.weight ?? null, rir: null, done: false }],
      };
    });

  const removeSet = (index: number, setIndex: number) =>
    mutateExercise(index, (exercise) => ({ ...exercise, sets: removeSetAt(exercise.sets, setIndex) }));

  const addDrop = (index: number, mainIndex: number) =>
    mutateExercise(index, (exercise) => ({ ...exercise, sets: insertDropSet(exercise.sets, mainIndex) }));

  const doneSets = doneSetCount(draft);
  const progress = sessionProgress(session);
  const completedExercises = session.exercises.filter(isExerciseComplete).length;
  const total = session.exercises.length;

  const startFinish = () => {
    if (doneSets === 0) {
      showToast('Speichere zuerst mindestens ein Set.', 'error');
      return;
    }
    setFinishing(true);
  };

  const confirmFinish = (options: FinishOptions) => {
    const finished = sessionProgress(session);
    const workout = finishWorkout(key, options);
    setFinishing(false);
    if (!workout) {
      showToast('Keine Sets gespeichert.', 'error');
      return;
    }
    if (options.newEquipment?.length) {
      updateSettings((current) => {
        const levelShifts = { ...current.levelShifts };
        for (const name of options.newEquipment ?? []) levelShifts[name] = [...new Set([...(levelShifts[name] ?? []), workout.date])].sort();
        return { ...current, levelShifts };
      });
    }
    showToast(finished.open === 0 ? 'Stark! Alle geplanten Sets erledigt.' : `Stark! ${finished.done} von ${finished.planned} geplanten Sets erledigt.`, 'success');
    setExpanded(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const resetDay = () => {
    const previous = draft;
    setDraft(key, undefined);
    setExpanded(firstIncomplete(virtual));
    showToast('Training zurückgesetzt.', 'default', previous ? { label: 'Rückgängig', run: () => setDraft(key, previous) } : undefined);
  };

  const changeDate = (value: string) => {
    if (!value) return;
    mutate((current) => ({ ...current, date: value }));
  };

  return (
    <div className="pb-36">
      <TrainingHeader date={session.date} onDateChange={changeDate} title={trainingPlan.days[day].title} />

      {!draft && workouts.some((workout) => workout.date === today && workout.trainingDay === day && (workout.planId ?? 'classic') === trainingPlan.id) && (
        <div className="mx-4 mt-4 flex items-center gap-3 rounded-2xl border border-success/25 bg-success/[0.07] px-4 py-3 text-[13.5px] text-success">
          <CircleCheck size={18} className="shrink-0" />
          <span>Heute erledigt – stark! Die Empfehlungen unten gelten schon fürs nächste Mal.</span>
        </div>
      )}

      <div className="mt-5 px-5">
        <div className="flex items-center justify-between text-[13px]">
          <span className="text-ink-2">
            <span className="font-semibold text-ink">{completedExercises}</span> von {total} Übungen
          </span>
          {draft && (
            <button type="button" onClick={resetDay} className="inline-flex items-center gap-1.5 rounded-lg px-1.5 py-1 text-ink-3 hover:text-ink-2">
              <RotateCcw size={13} /> Zurücksetzen
            </button>
          )}
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
          <div className="accent-gradient h-full rounded-full transition-all duration-500" style={{ width: `${total ? (completedExercises / total) * 100 : 0}%` }} />
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 px-4">
        {session.exercises.map((exercise, index) => (
          <ExerciseCard
            key={`${day}-${exercise.name}`}
            index={index}
            item={plan[index]}
            exercise={exercise}
            expanded={expanded === index}
            onToggle={() => setExpanded(expanded === index ? null : index)}
            onChangeSet={(setIndex, patch) => changeSet(index, setIndex, patch)}
            onSaveSet={(setIndex) => saveSet(index, setIndex)}
            onAddSet={() => addSet(index)}
            onRemoveSet={(setIndex) => removeSet(index, setIndex)}
            onAddDrop={(mainIndex) => addDrop(index, mainIndex)}
            onToggleSkip={() => {
              const skipping = !exercise.skipped;
              mutateExercise(index, (item) => ({ ...item, skipped: !item.skipped }));
              if (skipping) setExpanded(firstIncomplete({ ...session, exercises: session.exercises.map((item, position) => (position === index ? { ...item, skipped: true } : item)) }, index));
            }}
            onToggleExcluded={() => mutateExercise(index, (item) => ({ ...item, excluded: !item.excluded }))}
          />
        ))}
      </div>

      <div className="mt-6 px-4">
        <Button variant="primary" className="w-full" onClick={startFinish}>
          <Flag size={18} /> Training abschließen
        </Button>
        {doneSets > 0 && (
          <p className="mt-2 text-center text-[12.5px] text-ink-3">
            {progress.open === 0 ? 'Alle geplanten Sets erledigt' : `${progress.done} von ${progress.planned} geplanten Sets erledigt`} – wird automatisch gesichert.
          </p>
        )}
      </div>

      <FinishSheet open={finishing} draft={session} onClose={() => setFinishing(false)} onConfirm={confirmFinish} />
    </div>
  );
}
