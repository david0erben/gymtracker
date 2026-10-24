import { Moon } from 'lucide-react';
import { WEEK } from '../../domain/plan';
import { useActivePlan, useStore } from '../../state/store';
import { TrainingHeader } from './TrainingHeader';

/** Ruhetag im Plan: nichts einzutragen, nur ein Hinweis aufs nächste Training. */
export function RestDay() {
  const plan = useActivePlan();
  const day = useStore((state) => state.selectedDay);
  const selectDay = useStore((state) => state.selectDay);
  const start = WEEK.indexOf(day);
  const next = [...WEEK.slice(start + 1), ...WEEK.slice(0, start)].map((key) => plan.days[key]).find((entry) => entry.kind !== 'rest');

  return (
    <div className="pb-36">
      <TrainingHeader title="Rest Day" />
      <section className="glass mx-4 mt-5 flex flex-col items-center rounded-[var(--radius-card)] px-6 py-10 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/[0.06] text-accent-2">
          <Moon size={26} />
        </span>
        <h2 className="display mt-4 text-[22px]">Ruhetag</h2>
        <p className="mt-2 max-w-[30ch] text-[14px] leading-relaxed text-ink-3">Kein Training geplant. Erholung gehört dazu – die Muskeln wachsen in der Pause.</p>
        {next && (
          <button
            type="button"
            onClick={() => selectDay(next.key)}
            className="mt-5 rounded-2xl border border-line bg-glass px-4 py-2.5 text-[13.5px] text-ink-2 transition hover:text-ink active:scale-[0.98]"
          >
            Nächstes Training: <span className="font-semibold text-ink">{next.short} · {next.title}</span>
          </button>
        )}
      </section>
    </div>
  );
}
