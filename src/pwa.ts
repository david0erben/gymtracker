import { useStore } from './state/store';

/**
 * Offline-Fähigkeit und Updates der installierten App (Homescreen).
 * Gibt es eine neue Version, erscheint ein Hinweis – aktualisiert wird erst auf Tippen,
 * damit ein laufendes Training nie mittendrin neu lädt.
 */
export function registerUpdates() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return;
  void import('virtual:pwa-register').then(({ registerSW }) => {
    const update = registerSW({
      onNeedRefresh() {
        useStore.getState().showToast('Neue Version verfügbar.', 'default', { label: 'Aktualisieren', run: () => void update(true) });
      },
    });
  });
}
