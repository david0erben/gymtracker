import { useMemo, useState } from 'react';
import { ChevronDown, Minus, Plus, RotateCcw } from 'lucide-react';
import { cx } from '../../components/ui';
import { todayKey } from '../../domain/dates';
import { formatNumber } from '../../domain/format';
import { shortName, TRAINING_PLAN, type MuscleGroup } from '../../domain/plan';
import {
  plannedRegionVolume,
  plannedWeeklyVolume,
  recentRegionVolume,
  recentWeeklyVolume,
  REGIONS,
  totalWeeklySets,
  type MuscleVolume,
} from '../../domain/volumePlan';
import { useStore } from '../../state/store';

const MIN_EXTRA = -6;
const MAX_EXTRA = 10;

/**
 * Wochenvolumen: geplante Sets pro Bereich und Muskel – nur Übungen, in denen der Muskel
 * Hauptmuskel ist, und pro Bereich jede Übung nur einmal. Sets ändern sich ausschließlich,
 * wenn du sie hier selbst mit −/+ anpasst.
 */
export function WeeklyVolume() {
  const settings = useStore((state) => state.settings);
  const workouts = useStore((state) => state.workouts);
  const updateSettings = useStore((state) => state.updateSettings);
  const today = todayKey();
  const [open, setOpen] = useState<string | null>(null);

  const planned = useMemo(() => plannedWeeklyVolume(settings), [settings]);
  const recent = useMemo(() => recentWeeklyVolume(workouts, today), [workouts, today]);
  const total = useMemo(() => totalWeeklySets(settings), [settings]);
  const extras = settings.volumeExtras ?? {};
  const anyExtra = Object.values(extras).some((value) => value);

  const regions = useMemo(
    () =>
      REGIONS.map((region) => ({
        ...region,
        ...plannedRegionVolume(settings, region.muscles),
        recent: recentRegionVolume(workouts, today, region.muscles),
      })),
    [settings, workouts, today],
  );
  const max = Math.max(...regions.map((region) => region.planned), 1);

  const setExtra = (muscle: MuscleGroup, value: number) =>
    updateSettings((current) => {
      const next = { ...(current.volumeExtras ?? {}) };
      const clamped = Math.max(MIN_EXTRA, Math.min(MAX_EXTRA, value));
      if (clamped === 0) delete next[muscle];
      else next[muscle] = clamped;
      return { ...current, volumeExtras: next };
    });

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[var(--radius-card)] p-4">
        <h2 className="display text-[20px]">Wochenvolumen</h2>
        <p className="mt-1 text-[13px] leading-relaxed text-ink-3">
          Geplante Sets pro Woche – gezählt werden nur Übungen, in denen der Muskel Hauptmuskel ist. Tippe einen Bereich an, um die Übungen zu
          sehen. Mit −/+ kannst du selbst Sets hinzufügen oder wegnehmen.
        </p>
        <div className="mt-3 flex items-end gap-2">
          <p className="display tabular text-[34px] leading-none">{total}</p>
          <p className="pb-1 text-[13px] text-ink-3">Sets pro Woche geplant</p>
        </div>
        {anyExtra && (
          <button
            type="button"
            onClick={() => updateSettings((current) => ({ ...current, volumeExtras: {} }))}
            className="mt-2 inline-flex items-center gap-1.5 text-[12.5px] text-ink-3 hover:text-ink-2"
          >
            <RotateCcw size={13} /> Eigene Anpassungen zurücksetzen
          </button>
        )}
      </section>

      <section className="glass rounded-[var(--radius-card)] p-2">
        {regions.map((region) => {
          const expanded = open === region.name;
          return (
            <div key={region.name} className={cx('rounded-2xl transition', expanded && 'bg-white/[0.03]')}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : region.name)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-[15px] font-semibold">{region.name}</span>
                    <span className="tabular text-[15px] font-semibold">
                      {region.planned} <span className="text-[12px] font-medium text-ink-3">Sets</span>
                      {region.extra !== 0 && (
                        <span className={cx('ml-1 text-[12px]', region.extra > 0 ? 'text-success' : 'text-danger')}>
                          ({region.extra > 0 ? '+' : ''}
                          {region.extra})
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                    <div className="accent-gradient h-full rounded-full transition-all" style={{ width: `${(region.planned / max) * 100}%` }} />
                  </div>
                  <p className="tabular mt-1 text-[11.5px] text-ink-3">zuletzt Ø {formatNumber(region.recent, 1)} Sets pro Woche trainiert</p>
                </div>
                <ChevronDown size={18} className={cx('shrink-0 text-ink-3 transition', expanded && 'rotate-180')} />
              </button>

              {expanded && (
                <div className="animate-fade-in flex flex-col gap-2 px-3 pb-3">
                  {region.muscles.map((muscle) => (
                    <MuscleRow
                      key={muscle}
                      volume={planned[muscle]}
                      recent={recent[muscle]}
                      extra={extras[muscle] ?? 0}
                      showName={region.muscles.length > 1}
                      onChange={(value) => setExtra(muscle, value)}
                    />
                  ))}
                  {region.muscles.length > 1 && (
                    <p className="px-1 text-[11.5px] text-ink-3">
                      Übungen mit mehreren Hauptmuskeln (z. B. Leg Press für Quads und Glutes) stehen bei jedem Muskel, zählen für {region.name} aber nur
                      einmal.
                    </p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </section>
    </div>
  );
}

function MuscleRow({
  volume,
  recent,
  extra,
  showName,
  onChange,
}: {
  volume: MuscleVolume;
  recent: number;
  extra: number;
  showName: boolean;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-surface px-3.5 py-3">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          {showName && <p className="text-[14px] font-semibold">{volume.muscle}</p>}
          <p className="tabular text-[12.5px] text-ink-3">
            {volume.planned} Sets geplant · Ø {formatNumber(recent, 1)} trainiert
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1 rounded-xl border border-line bg-white/[0.04]">
          <button
            type="button"
            aria-label={`${volume.muscle}: ein Set weniger pro Woche`}
            onClick={() => onChange(extra - 1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:text-ink active:scale-90"
          >
            <Minus size={15} strokeWidth={2.75} />
          </button>
          <span className={cx('tabular w-9 text-center text-[15px] font-bold', extra > 0 ? 'text-success' : extra < 0 ? 'text-danger' : 'text-ink-3')}>
            {extra > 0 ? `+${extra}` : extra}
          </span>
          <button
            type="button"
            aria-label={`${volume.muscle}: ein Set mehr pro Woche`}
            onClick={() => onChange(extra + 1)}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-ink-2 hover:text-ink active:scale-90"
          >
            <Plus size={15} strokeWidth={2.75} />
          </button>
        </div>
      </div>
      <ul className="mt-2.5 flex flex-col gap-1 border-t border-line pt-2.5">
        {volume.contributions.map((item) => (
          <li key={`${item.day}-${item.name}`} className="flex items-center gap-2 text-[13px]">
            <span className="w-6 shrink-0 text-[11px] font-semibold text-ink-3">{TRAINING_PLAN[item.day].short}</span>
            <span className="min-w-0 flex-1 truncate text-ink">{shortName(item.name)}</span>
            <span className="tabular shrink-0 text-ink-2">
              {item.sets} Sets
              {item.extraSets !== 0 && (
                <span className={cx('ml-1', item.extraSets > 0 ? 'text-success' : 'text-danger')}>
                  ({item.extraSets > 0 ? '+' : ''}
                  {item.extraSets})
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
