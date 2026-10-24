import { useEffect, useState } from 'react';
import { Ban, Check, ChevronDown, Dumbbell, Ellipsis, Layers, Plus, Repeat, SkipForward, Sparkles, Trash2, TrendingDown, TrendingUp, Undo2 } from 'lucide-react';
import { cx, ProgressRing, Sheet } from '../../components/ui';
import { formatShort } from '../../domain/dates';
import { formatNumber, formatSet } from '../../domain/format';
import { plannedName } from '../../domain/plan';
import { nextStepAbove, nextStepBelow, round2 } from '../../domain/strength';
import type { RecommendationKind } from '../../domain/types';
import type { PlanItem } from '../../state/useDayPlan';
import type { DraftExercise, DraftSet } from '../../state/drafts';
import { NumberStepper } from './NumberStepper';

const KIND_STYLE: Record<RecommendationKind, string> = {
  increase: 'bg-success/12 text-success border-success/25',
  reps: 'bg-accent/15 text-accent-3 border-accent/30',
  decrease: 'bg-danger/12 text-danger border-danger/25',
  deload: 'bg-danger/12 text-danger border-danger/25',
  comeback: 'bg-accent-2/12 text-accent-2 border-accent-2/25',
  first: 'bg-glass-2 text-ink-2 border-line',
};

function KindIcon({ kind }: { kind: RecommendationKind }) {
  if (kind === 'increase') return <TrendingUp size={13} strokeWidth={2.5} />;
  if (kind === 'decrease' || kind === 'deload') return <TrendingDown size={13} strokeWidth={2.5} />;
  return <Sparkles size={13} strokeWidth={2.5} />;
}

export function ExerciseCard({
  index,
  item,
  exercise,
  expanded,
  onToggle,
  onChangeSet,
  onSaveSet,
  onAddSet,
  onRemoveSet,
  onToggleSkip,
  onToggleExcluded,
}: {
  index: number;
  item: PlanItem;
  exercise: DraftExercise;
  expanded: boolean;
  onToggle: () => void;
  onChangeSet: (setIndex: number, patch: Partial<DraftSet>) => void;
  onSaveSet: (setIndex: number) => void;
  onAddSet: () => void;
  onRemoveSet: (setIndex: number) => void;
  onToggleSkip: () => void;
  onToggleExcluded: () => void;
}) {
  const { recommendation, config, info } = item;
  const doneCount = exercise.sets.filter((set) => set.done).length;
  const complete = exercise.skipped || (exercise.sets.length > 0 && doneCount === exercise.sets.length);
  const firstOpen = exercise.sets.findIndex((set) => !set.done);
  const [activeIndex, setActiveIndex] = useState<number>(firstOpen === -1 ? 0 : firstOpen);
  const [menuOpen, setMenuOpen] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const active = Math.min(activeIndex, Math.max(0, exercise.sets.length - 1));
  const activeSet = exercise.sets[active];
  const muscle = info.primary.join(' · ');

  // Beim Aufklappen auf den ersten offenen Satz springen
  useEffect(() => {
    if (expanded) setActiveIndex(firstOpen === -1 ? 0 : firstOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expanded]);

  const changeWeight = (direction: 1 | -1) => {
    const current = activeSet.weight;
    if (current === null || current === 0) {
      if (direction === 1) onChangeSet(active, { weight: round2(config.base + config.step) });
      return;
    }
    const next = direction === 1 ? nextStepAbove(current, config.step, config.base) : nextStepBelow(current, config.step, config.base);
    onChangeSet(active, { weight: next <= 0 ? (config.bodyweight ? null : 0) : next });
  };

  // Tippfehler-Schutz: deutlich mehr als empfohlen oder zuletzt gemacht
  const reference = recommendation.weight ?? recommendation.last?.sets.reduce((max, set) => Math.max(max, set.weight ?? 0), 0) ?? null;
  const suspicious =
    activeSet &&
    ((reference && activeSet.weight !== null && (activeSet.weight > reference * 1.6 || activeSet.weight < reference * 0.4)) ||
      (activeSet.reps !== null && activeSet.reps > Math.max(40, (config.repMax ?? config.repMin) * 2.5)));

  const save = () => {
    onSaveSet(active);
    const nextOpen = exercise.sets.findIndex((set, setIndex) => setIndex > active && !set.done);
    if (nextOpen !== -1) setActiveIndex(nextOpen);
  };

  return (
    <article
      className={cx(
        'glass animate-pop-in overflow-hidden rounded-[var(--radius-card)] transition',
        expanded && 'border-line-2',
        exercise.skipped && 'opacity-60',
      )}
      style={{ animationDelay: `${index * 35}ms` }}
    >
      {/* Kopf: Übung, Sets, Gewicht, Empfehlung – die Plakette öffnet die Begründung */}
      <div className="relative">
        <button type="button" onClick={onToggle} className="flex w-full items-start gap-3.5 px-4 pb-3.5 pt-4 text-left" aria-expanded={expanded}>
          <ProgressRing value={complete ? exercise.sets.length || 1 : doneCount} max={exercise.sets.length || 1} complete={complete}>
            {complete ? (
              exercise.skipped ? <SkipForward size={16} className="text-ink-3" /> : <Check size={18} strokeWidth={3} className="text-success" />
            ) : (
              <span className="display text-[14px] text-ink">{String(index + 1).padStart(2, '0')}</span>
            )}
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="eyebrow truncate pr-28">{muscle}</p>
            <h3 className="mt-0.5 line-clamp-2 text-[17px] font-semibold leading-snug">{plannedName(item.planned)}</h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 pr-6 text-[12.5px] text-ink-2">
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Layers size={13} className="text-accent" />
                {exercise.sets.length} Sets
                {config.extraSets !== 0 && (
                  <span className={cx('font-semibold', config.extraSets > 0 ? 'text-success' : 'text-danger')} title="Aus deinem Wochenvolumen unter Ziele">
                    ({config.extraSets > 0 ? '+' : ''}
                    {config.extraSets})
                  </span>
                )}
              </span>
              {recommendation.weight !== null && (
                <span className="inline-flex items-center gap-1 whitespace-nowrap">
                  <Dumbbell size={13} className="text-accent" />
                  {formatNumber(recommendation.weight)} kg
                </span>
              )}
              <span className="inline-flex items-center gap-1 whitespace-nowrap">
                <Repeat size={13} className="text-accent" />
                {config.repMax === null ? `${config.repMin}+` : `${config.repMin}–${config.repMax}`} Reps
              </span>
            </div>
          </div>
        </button>
        <ChevronDown size={18} className={cx('pointer-events-none absolute bottom-[1.1rem] right-4 text-ink-3 transition', expanded && 'rotate-180')} />
        <div className="absolute right-4 top-3.5">
          {exercise.skipped ? (
            <span className="rounded-full border border-line bg-glass-2 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-3">Ausgelassen</span>
          ) : exercise.excluded ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-line-2 bg-glass-2 px-2.5 py-0.5 text-[11.5px] font-semibold text-ink-2">
              <Ban size={12} /> Anderes Gerät
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label={`Empfehlung: ${recommendation.headline} – Begründung anzeigen`}
              className={cx('inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11.5px] font-semibold transition active:scale-95', KIND_STYLE[recommendation.mixed ? 'reps' : recommendation.kind])}
            >
              <KindIcon kind={recommendation.mixed ? 'reps' : recommendation.kind} />
              {recommendation.headline}
            </button>
          )}
        </div>
      </div>

      {expanded && !exercise.skipped && (
        <div className="animate-fade-in px-4 pb-3">
          {/* Satztabelle im MCI-Stil */}
          <div className="relative">
            <div className="pointer-events-none absolute inset-y-0 left-1/4 w-px bg-line-2" />
            <div className="pointer-events-none absolute inset-y-0 left-2/4 w-px bg-line-2" />
            <div className="pointer-events-none absolute inset-y-0 left-3/4 w-px bg-line-2" />
            <div className="grid grid-cols-4 pb-1.5 text-center">
              {['Sets', 'Reps', 'Weight', 'RIR'].map((label) => (
                <span key={label} className="display text-[14px] text-ink">
                  {label}
                </span>
              ))}
            </div>
            {exercise.sets.map((set, setIndex) => {
              const isActive = setIndex === active;
              return (
                <button
                  key={setIndex}
                  type="button"
                  onClick={() => setActiveIndex(setIndex)}
                  className={cx(
                    'tabular relative grid h-11 w-full grid-cols-4 items-center rounded-xl text-center text-[17px] font-semibold transition',
                    isActive && 'bg-white/[0.13]',
                    set.done || isActive ? 'text-ink' : 'text-ink-3',
                  )}
                  aria-label={`Set ${setIndex + 1}${set.done ? ', gespeichert' : ', Empfehlung'}`}
                  aria-pressed={isActive}
                >
                  <span>{setIndex + 1}</span>
                  <span>{set.reps ?? '–'}</span>
                  <span>{set.weight === null ? '–' : formatNumber(set.weight)}</span>
                  <span>{set.rir ?? '–'}</span>
                  {set.done && <span className="absolute right-1.5 h-1.5 w-1.5 rounded-full bg-success" />}
                </button>
              );
            })}
          </div>

          {/* Eingabe für den aktiven Satz */}
          {activeSet && (
            <div className="mt-3 border-t border-line-2 pt-3">
              <div className="grid grid-cols-[1fr_1.25fr_1fr] gap-2">
                <NumberStepper
                  label="Reps"
                  value={activeSet.reps}
                  onChange={(reps) => onChangeSet(active, { reps })}
                  onIncrement={() => onChangeSet(active, { reps: (activeSet.reps ?? 0) + 1 })}
                  onDecrement={() => onChangeSet(active, { reps: Math.max(0, (activeSet.reps ?? 1) - 1) })}
                />
                <NumberStepper
                  label="Weight"
                  decimal
                  value={activeSet.weight}
                  placeholder={config.bodyweight ? 'KG' : '–'}
                  onChange={(weight) => onChangeSet(active, { weight })}
                  onIncrement={() => changeWeight(1)}
                  onDecrement={() => changeWeight(-1)}
                />
                <NumberStepper
                  label="RIR"
                  value={activeSet.rir}
                  onChange={(rir) => onChangeSet(active, { rir })}
                  onIncrement={() => onChangeSet(active, { rir: activeSet.rir === null ? (config.targetRir ?? 2) : Math.min(10, activeSet.rir + 1) })}
                  onDecrement={() => onChangeSet(active, { rir: activeSet.rir === null || activeSet.rir <= 0 ? null : activeSet.rir - 1 })}
                />
              </div>
              {suspicious && (
                <p className="mb-1 mt-0.5 rounded-xl bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
                  Ungewöhnlicher Wert – Tippfehler? Du kannst trotzdem speichern.
                </p>
              )}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={save}
                  disabled={activeSet.reps === null || activeSet.reps < 1}
                  aria-label={activeSet.done ? `Änderung an Set ${active + 1} speichern` : `Set ${active + 1} speichern`}
                  className="accent-gradient flex h-13 flex-1 items-center justify-center rounded-2xl text-on-accent shadow-[var(--shadow-glow)] transition active:scale-[0.98] disabled:opacity-40"
                >
                  <Check size={26} strokeWidth={3} />
                </button>
                <button
                  type="button"
                  onClick={() => setMenuOpen(true)}
                  aria-label="Weitere Aktionen"
                  className="flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl border border-line bg-glass-2 text-ink-2 transition hover:text-ink active:scale-95"
                >
                  <Ellipsis size={20} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {expanded && exercise.skipped && (
        <div className="px-4 pb-4">
          <button type="button" onClick={onToggleSkip} className="inline-flex h-10 items-center gap-2 rounded-xl px-3 text-[14px] font-medium text-ink-2 hover:bg-glass-2">
            <Undo2 size={15} /> Doch machen
          </button>
        </div>
      )}

      {!expanded && doneCount > 0 && !exercise.skipped && (
        <p className="tabular -mt-1 truncate px-4 pb-3.5 pl-[4.6rem] text-[12.5px] text-ink-3">
          {exercise.sets.filter((set) => set.done).map((set) => formatSet(set.reps, set.weight)).join(' · ')}
        </p>
      )}

      <Sheet open={infoOpen} onClose={() => setInfoOpen(false)} title="Empfehlung">
        <div className="pb-3">
          <span className={cx('inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-semibold', KIND_STYLE[recommendation.mixed ? 'reps' : recommendation.kind])}>
            <KindIcon kind={recommendation.mixed ? 'reps' : recommendation.kind} />
            {recommendation.headline}
          </span>
          <p className="mt-3 text-[15px] leading-relaxed text-ink">{recommendation.reason}</p>
          {recommendation.note && <p className="mt-2 text-[13px] leading-relaxed text-ink-2">{recommendation.note}</p>}
          {recommendation.last && (
            <div className="mt-4 rounded-2xl border border-line bg-white/[0.03] px-3.5 py-3">
              <p className="eyebrow">Letztes Mal · {formatShort(recommendation.last.date)}</p>
              <p className="tabular mt-1 text-[15px] text-ink-2">{recommendation.last.sets.map((set) => formatSet(set.reps, set.weight)).join(' · ')}</p>
            </div>
          )}
        </div>
      </Sheet>

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={plannedName(item.planned)}>
        <div className="flex flex-col gap-1.5 pb-2">
          <MenuItem
            icon={<Plus size={18} />}
            label="Set hinzufügen"
            onClick={() => {
              onAddSet();
              setActiveIndex(exercise.sets.length);
              setMenuOpen(false);
            }}
          />
          {exercise.sets.length > 1 && (
            <MenuItem
              icon={<Trash2 size={18} />}
              label={`Set ${active + 1} entfernen`}
              onClick={() => {
                onRemoveSet(active);
                setActiveIndex(Math.max(0, active - 1));
                setMenuOpen(false);
              }}
            />
          )}
          <MenuItem
            icon={<Ban size={18} />}
            label={exercise.excluded ? 'Doch normal werten' : 'Heute anderes Gerät / Studio'}
            description="Zählt dann nicht für Empfehlungen und Kraftkurve."
            onClick={() => {
              onToggleExcluded();
              setMenuOpen(false);
            }}
          />
          <MenuItem
            icon={<SkipForward size={18} />}
            label="Übung auslassen"
            onClick={() => {
              onToggleSkip();
              setMenuOpen(false);
            }}
          />
        </div>
      </Sheet>
    </article>
  );
}

function MenuItem({ icon, label, description, onClick }: { icon: React.ReactNode; label: string; description?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex min-h-14 items-center gap-3.5 rounded-2xl border border-line bg-glass px-4 py-3 text-left transition hover:bg-glass-2 active:scale-[0.99]">
      <span className="text-accent-2">{icon}</span>
      <span>
        <span className="block text-[15px] font-medium">{label}</span>
        {description && <span className="block text-[12.5px] text-ink-3">{description}</span>}
      </span>
    </button>
  );
}
