import { lazy, Suspense, useEffect } from 'react';
import { Dumbbell } from 'lucide-react';
import { Keypad } from './components/Keypad';
import { TabBar } from './components/TabBar';
import { ToastHost } from './components/ToastHost';
import { cx } from './components/ui';
import { GoalsScreen } from './features/goals/GoalsScreen';
import { HistoryScreen } from './features/history/HistoryScreen';
import { TrainingScreen } from './features/training/TrainingScreen';
import { useStore } from './state/store';
import { CLOUD_ENABLED } from './data/firebase';
import { startCloud } from './data/cloud';
import { LoginScreen } from './features/settings/LoginScreen';

// Diagramme erst laden, wenn sie gebraucht werden – das Training startet so schneller
const AnalyticsScreen = lazy(() => import('./features/analytics/AnalyticsScreen').then((module) => ({ default: module.AnalyticsScreen })));
const BodyScreen = lazy(() => import('./features/body/BodyScreen').then((module) => ({ default: module.BodyScreen })));

export function App() {
  const hydrated = useStore((state) => state.hydrated);
  const hydrate = useStore((state) => state.hydrate);
  const tab = useStore((state) => state.tab);
  const account = useStore((state) => state.account);

  useEffect(() => {
    // Veröffentlichte App: Login + Cloud. Lokale Entwicklung: Testdaten im Browser.
    if (CLOUD_ENABLED) startCloud();
    else void hydrate();
  }, [hydrate]);

  if (CLOUD_ENABLED && account.status === 'signedOut') {
    return (
      <>
        <div className="app-backdrop" />
        <LoginScreen />
        <ToastHost />
      </>
    );
  }

  return (
    <>
      <div className="app-backdrop" />
      {hydrated ? (
        <main className={cx('relative z-10 mx-auto min-h-dvh w-full', tab === 'analytics' || tab === 'history' ? 'max-w-5xl' : 'max-w-xl')}>
          {tab === 'training' && <TrainingScreen />}
          {tab === 'history' && <HistoryScreen />}
          <Suspense fallback={null}>
            {tab === 'analytics' && <AnalyticsScreen />}
            {tab === 'body' && <BodyScreen />}
          </Suspense>
          {tab === 'goals' && <GoalsScreen />}
        </main>
      ) : (
        <div className="relative z-10 flex min-h-dvh items-center justify-center">
          <div className="accent-gradient flex h-16 w-16 animate-pulse items-center justify-center rounded-3xl text-on-accent shadow-[var(--shadow-glow)]">
            <Dumbbell size={30} />
          </div>
        </div>
      )}
      {hydrated && <TabBar />}
      <Keypad />
      <ToastHost />
    </>
  );
}
