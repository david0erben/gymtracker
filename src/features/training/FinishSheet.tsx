import { useEffect, useMemo, useState } from 'react';
import { Ban, Check, SkipForward } from 'lucide-react';
import { Button, cx, Sheet } from '../../components/ui';
import { formatNumber } from '../../domain/format';
import { exerciseLabel } from '../../domain/plan';
import { missingExercises, type DraftSession, type FinishOptions } from '../../state/drafts';

type DeviationChoice = 'today' | 'new' | 'keep';

/** Ab dieser Abweichung von der Empfehlung fragen wir, ob es ein anderes Gerät war. */
const DEVIATION = 0.3;

export function FinishSheet({
  open,
  draft,
  onClose,
  onConfirm,
}: {
  open: boolean;
  draft: DraftSession;
  onClose: () => void;
  onConfirm: (options: FinishOptions) => void;
}) {
  const missing = useMemo(() => missingExercises(draft), [draft]);
  const deviations = useMemo(
    () =>
      draft.exercises
        .map((exercise) => {
          const done = exercise.sets.filter((set) => set.done && set.weight);
          const recommended = exercise.recommendation?.weight;
          if (!done.length || !recommended || exercise.excluded) return null;
          const top = Math.max(...done.map((set) => set.weight as number));
          const ratio = top / recommended - 1;
          return Math.abs(ratio) > DEVIATION ? { name: exercise.name, top, recommended } : null;
        })
        .filter((item): item is { name: string; top: number; recommended: number } => item !== null),
    [draft],
  );

  const [skip, setSkip] = useState<Set<string>>(new Set());
  const [choices, setChoices] = useState<Record<string, DeviationChoice>>({});

  useEffect(() => {
    if (!open) return;
    setSkip(new Set(missing));
    setChoices(Object.fromEntries(deviations.map((item) => [item.name, 'today' as DeviationChoice])));
  }, [open, missing, deviations]);

  const namesWith = (choice: DeviationChoice) => Object.entries(choices).filter(([, value]) => value === choice).map(([name]) => name);

  const doneSets = draft.exercises.flatMap((exercise) => exercise.sets.filter((set) => set.done));
  const volume = doneSets.reduce((sum, set) => sum + (set.weight ?? 0) * (set.reps ?? 0), 0);
  const exercisesDone = draft.exercises.filter((exercise) => exercise.sets.some((set) => set.done)).length;

  const toggle = (set: Set<string>, name: string, update: (next: Set<string>) => void) => {
    const next = new Set(set);
    if (next.has(name)) next.delete(name);
    else next.add(name);
    update(next);
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Training abschließen"
      footer={
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={() => onConfirm({ skip: [...skip], exclude: namesWith('today'), newEquipment: namesWith('new') })}>
            <Check size={18} strokeWidth={3} /> Training speichern
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Weiter trainieren
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Übungen', value: String(exercisesDone) },
          { label: 'Sets', value: String(doneSets.length) },
          { label: 'Volumen', value: `${formatNumber(Math.round(volume))} kg` },
        ].map((stat) => (
          <div key={stat.label} className="rounded-2xl border border-line bg-glass px-3 py-3">
            <p className="eyebrow">{stat.label}</p>
            <p className="display tabular mt-1 whitespace-nowrap text-[18px]">{stat.value}</p>
          </div>
        ))}
      </div>

      {missing.length > 0 && (
        <section className="mt-5">
          <h3 className="text-[15px] font-semibold">Nicht eingetragen</h3>
          <p className="mt-1 text-[13px] text-ink-3">Markierte Übungen werden als bewusst ausgelassen gespeichert.</p>
          <ul className="mt-2.5 flex flex-col gap-1.5">
            {missing.map((name) => (
              <ToggleRow key={name} checked={skip.has(name)} onToggle={() => toggle(skip, name, setSkip)} icon={<SkipForward size={15} />}>
                {exerciseLabel(name, draft.planId, draft.day)}
              </ToggleRow>
            ))}
          </ul>
        </section>
      )}

      {deviations.length > 0 && (
        <section className="mt-5">
          <h3 className="text-[15px] font-semibold">Anderes Gerät?</h3>
          <p className="mt-1 text-[13px] text-ink-3">
            Hier weicht dein Gewicht stark von der Empfehlung ab. „Nur heute“ zählt nicht für Empfehlungen und Kraftkurve. „Neues Gerät“ heißt: ab jetzt ist das dein Standard.
          </p>
          <ul className="mt-2.5 flex flex-col gap-2">
            {deviations.map((item) => (
              <li key={item.name} className="rounded-2xl border border-line bg-glass px-3.5 py-3">
                <div className="flex items-center gap-2 text-[14px]">
                  <Ban size={15} className="shrink-0 text-ink-3" />
                  <span className="min-w-0 flex-1 truncate font-medium">{exerciseLabel(item.name, draft.planId, draft.day)}</span>
                  <span className="tabular text-[12.5px] text-ink-3">
                    {formatNumber(item.top)} statt {formatNumber(item.recommended)} kg
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.04] p-1">
                  {(
                    [
                      ['today', 'Nur heute'],
                      ['new', 'Neues Gerät'],
                      ['keep', 'Passt so'],
                    ] as [DeviationChoice, string][]
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setChoices({ ...choices, [item.name]: value })}
                      className={cx(
                        'h-8 rounded-lg text-[12.5px] font-semibold transition',
                        choices[item.name] === value ? 'bg-glass-3 text-ink' : 'text-ink-3 hover:text-ink-2',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </Sheet>
  );
}

function ToggleRow({
  checked,
  onToggle,
  icon,
  children,
}: {
  checked: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <li>
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        onClick={onToggle}
        className={cx(
          'flex min-h-12 w-full items-center gap-3 rounded-2xl border px-3.5 text-left text-[14px] transition',
          checked ? 'border-accent/40 bg-accent/10 text-ink' : 'border-line bg-glass text-ink-2',
        )}
      >
        <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-md border', checked ? 'border-accent bg-accent text-on-accent' : 'border-line-2')}>
          {checked && <Check size={13} strokeWidth={3.5} />}
        </span>
        <span className="text-ink-3">{icon}</span>
        <span className="flex min-w-0 flex-1 items-center">{children}</span>
      </button>
    </li>
  );
}
