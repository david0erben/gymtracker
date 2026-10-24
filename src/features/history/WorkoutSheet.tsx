import { useEffect, useState } from 'react';
import { Ban, Plus, SkipForward, Trash2, X } from 'lucide-react';
import { Button, cx, Sheet } from '../../components/ui';
import { formatFull } from '../../domain/dates';
import { formatNumber, parseDecimal, parseInteger } from '../../domain/format';
import { exerciseLabel, workoutTitle } from '../../domain/plan';
import type { ExerciseEntry, SetEntry, Workout } from '../../domain/types';
import { useStore } from '../../state/store';

/** Ein vergangenes Training ansehen, korrigieren oder löschen. */
export function WorkoutSheet({ workout, onClose }: { workout: Workout | null; onClose: () => void }) {
  const saveWorkout = useStore((state) => state.saveWorkout);
  const deleteWorkout = useStore((state) => state.deleteWorkout);
  const showToast = useStore((state) => state.showToast);
  const [edited, setEdited] = useState<Workout | null>(workout);

  useEffect(() => setEdited(workout), [workout]);

  if (!workout || !edited) return null;
  const dirty = JSON.stringify(edited) !== JSON.stringify(workout);

  const updateExercise = (index: number, update: (entry: ExerciseEntry) => ExerciseEntry) =>
    setEdited({ ...edited, exercises: edited.exercises.map((entry, position) => (position === index ? update(entry) : entry)) });

  const updateSet = (index: number, setIndex: number, patch: Partial<SetEntry>) =>
    updateExercise(index, (entry) => ({ ...entry, sets: entry.sets.map((set, position) => (position === setIndex ? { ...set, ...patch } : set)) }));

  const save = () => {
    const cleaned: Workout = {
      ...edited,
      exercises: edited.exercises.map((entry) => ({ ...entry, sets: entry.sets.filter((set) => set.reps !== null || set.weight !== null) })),
    };
    saveWorkout(cleaned);
    showToast('Training aktualisiert.', 'success');
    onClose();
  };

  const remove = () => {
    if (!window.confirm(`Training vom ${formatFull(workout.date)} wirklich löschen?`)) return;
    const removed = deleteWorkout(workout.id);
    onClose();
    showToast('Training gelöscht.', 'default', removed ? { label: 'Rückgängig', run: () => saveWorkout(removed) } : undefined);
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={workoutTitle(workout)}
      footer={
        <div className="flex gap-2">
          <Button variant="danger" onClick={remove} aria-label="Training löschen">
            <Trash2 size={17} />
          </Button>
          <Button variant="primary" className="flex-1" onClick={save} disabled={!dirty}>
            Änderungen speichern
          </Button>
        </div>
      }
    >
      <label className="mb-4 flex items-center justify-between rounded-2xl border border-line bg-glass px-4 py-3">
        <span className="text-[14px] text-ink-2">Datum</span>
        <input
          type="date"
          value={edited.date}
          onChange={(event) => event.target.value && setEdited({ ...edited, date: event.target.value })}
          className="bg-transparent text-right text-[15px] font-semibold text-ink outline-none [color-scheme:dark]"
        />
      </label>

      <div className="flex flex-col gap-3">
        {edited.exercises.map((entry, index) => (
          <section key={`${entry.name}-${index}`} className={cx('rounded-2xl border border-line bg-glass px-3.5 pb-2.5 pt-3', entry.excluded && 'border-line-2')}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="text-[15px] font-semibold leading-snug">{exerciseLabel(entry.name, workout.planId, workout.trainingDay)}</h3>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {entry.skipped && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-glass-2 px-2 py-0.5 text-[11px] font-semibold text-ink-3">
                      <SkipForward size={11} /> Bewusst ausgelassen
                    </span>
                  )}
                  {entry.excluded && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-glass-2 px-2 py-0.5 text-[11px] font-semibold text-ink-2">
                      <Ban size={11} /> Nicht gewertet{entry.excludedBy === 'auto' ? ' (automatisch)' : ''}
                    </span>
                  )}
                </div>
              </div>
              {!entry.skipped && (
                <button
                  type="button"
                  onClick={() =>
                    updateExercise(index, (item) =>
                      item.excluded ? { ...item, excluded: false, excludedBy: undefined } : { ...item, excluded: true, excludedBy: 'user' },
                    )
                  }
                  className="shrink-0 rounded-xl border border-line px-2.5 py-1.5 text-[12px] font-medium text-ink-2 hover:bg-glass-2"
                >
                  {entry.excluded ? 'Werten' : 'Nicht werten'}
                </button>
              )}
            </div>

            {!entry.skipped && (
              <div className="mt-2">
                <div className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] gap-1.5 pb-1 text-center">
                  {['Set', 'Reps', 'Weight', 'RIR', ''].map((label) => (
                    <span key={label} className="display text-[12px] text-ink-3">
                      {label}
                    </span>
                  ))}
                </div>
                {entry.sets.map((set, setIndex) => (
                  <div key={setIndex} className="grid grid-cols-[2rem_1fr_1fr_1fr_2rem] items-center gap-1.5 py-0.5">
                    <span className="tabular text-center text-[14px] text-ink-3">{setIndex + 1}</span>
                    <CellInput value={set.reps} onChange={(reps) => updateSet(index, setIndex, { reps })} label={`Set ${setIndex + 1} Reps`} />
                    <CellInput decimal value={set.weight} onChange={(weight) => updateSet(index, setIndex, { weight })} label={`Set ${setIndex + 1} Weight`} />
                    <CellInput value={set.rir ?? null} onChange={(rir) => updateSet(index, setIndex, { rir })} label={`Set ${setIndex + 1} RIR`} />
                    <button
                      type="button"
                      aria-label={`Set ${setIndex + 1} entfernen`}
                      onClick={() => updateExercise(index, (item) => ({ ...item, sets: item.sets.filter((_, position) => position !== setIndex) }))}
                      className="flex h-9 w-8 items-center justify-center rounded-lg text-ink-4 hover:text-danger"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    updateExercise(index, (item) => {
                      const last = item.sets.at(-1);
                      return { ...item, sets: [...item.sets, { reps: last?.reps ?? null, weight: last?.weight ?? null }] };
                    })
                  }
                  className="mt-1 inline-flex h-8 items-center gap-1 rounded-lg px-2 text-[12.5px] font-medium text-ink-3 hover:text-ink"
                >
                  <Plus size={14} /> Set
                </button>
              </div>
            )}
          </section>
        ))}
      </div>
    </Sheet>
  );
}

function CellInput({
  value,
  onChange,
  decimal = false,
  label,
}: {
  value: number | null;
  onChange: (value: number | null) => void;
  decimal?: boolean;
  label: string;
}) {
  const display = value === null ? '' : formatNumber(value);
  const [text, setText] = useState(display);
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setText(display);
  }, [display, focused]);
  return (
    <input
      aria-label={label}
      inputMode={decimal ? 'decimal' : 'numeric'}
      value={text}
      placeholder="–"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onChange={(event) => {
        const next = event.target.value.replace(/[^\d.,]/g, '');
        setText(next);
        if (next.trim() === '') onChange(null);
        else {
          const parsed = decimal ? parseDecimal(next) : parseInteger(next);
          if (parsed !== null) onChange(parsed);
        }
      }}
      className="number-input tabular h-9 rounded-lg border border-line bg-white/[0.04] text-[15px] font-semibold focus:border-accent/60"
    />
  );
}
