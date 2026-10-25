import { CalendarDays, ChartSpline, Dumbbell, Scale, Target } from 'lucide-react';
import type { ReactNode } from 'react';
import { useStore, type Tab } from '../state/store';
import { cx } from './ui';

const ITEMS: { tab: Tab; label: string; icon: ReactNode }[] = [
  { tab: 'history', label: 'Verlauf', icon: <CalendarDays size={22} /> },
  { tab: 'analytics', label: 'Analyse', icon: <ChartSpline size={22} /> },
  { tab: 'training', label: 'Training', icon: <Dumbbell size={24} /> },
  { tab: 'body', label: 'Körper', icon: <Scale size={22} /> },
  { tab: 'goals', label: 'Ziele', icon: <Target size={22} /> },
];

export function TabBar() {
  const tab = useStore((state) => state.tab);
  const setTab = useStore((state) => state.setTab);

  return (
    <nav
      className="glass-strong tabbar-bottom fixed inset-x-0 bottom-0 z-40 rounded-t-[1.75rem] border-b-0 shadow-[0_-12px_40px_-20px_rgb(0_0_0_/_0.9)]"
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex w-full max-w-md items-center justify-between px-3 pt-1.5">
        {ITEMS.map((item) => {
          const active = item.tab === tab;
          if (item.tab === 'training') {
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => {
                  setTab(item.tab);
                  window.scrollTo({ top: 0 });
                }}
                aria-label={item.label}
                aria-current={active ? 'page' : undefined}
                className={cx(
                  'accent-gradient -mt-7 flex h-15 w-15 items-center justify-center rounded-full border-4 border-bg text-on-accent shadow-[var(--shadow-glow)] transition active:scale-95',
                  !active && 'opacity-90',
                )}
              >
                {item.icon}
              </button>
            );
          }
          return (
            <button
              key={item.tab}
              type="button"
              onClick={() => {
                setTab(item.tab);
                window.scrollTo({ top: 0 });
              }}
              aria-current={active ? 'page' : undefined}
              className={cx('flex h-14 w-16 flex-col items-center justify-center gap-0.5 rounded-2xl transition', active ? 'text-ink' : 'text-ink-3 hover:text-ink-2')}
            >
              {item.icon}
              <span className="text-[10.5px] font-semibold">{item.label}</span>
              <span className={cx('h-1 w-1 rounded-full', active ? 'bg-accent-2' : 'bg-transparent')} />
            </button>
          );
        })}
      </div>
    </nav>
  );
}
