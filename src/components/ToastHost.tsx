import { CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useStore } from '../state/store';
import { cx } from './ui';

export function ToastHost() {
  const toast = useStore((state) => state.toast);
  const dismiss = useStore((state) => state.dismissToast);
  if (!toast) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4" role="status" aria-live="polite">
      <div
        key={toast.id}
        className={cx(
          'glass-strong animate-pop-in pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[14px] shadow-2xl',
          toast.tone === 'error' && 'border-danger/40',
          toast.tone === 'success' && 'border-success/30',
        )}
      >
        {toast.tone === 'success' ? (
          <CircleCheck size={18} className="shrink-0 text-success" />
        ) : toast.tone === 'error' ? (
          <TriangleAlert size={18} className="shrink-0 text-danger" />
        ) : (
          <Info size={18} className="shrink-0 text-accent-2" />
        )}
        <span className="text-ink">{toast.message}</span>
        {toast.action && (
          <button
            type="button"
            onClick={() => {
              toast.action?.run();
              dismiss();
            }}
            className="ml-1 shrink-0 rounded-lg px-2 py-1 font-semibold text-accent-2 hover:bg-glass-2"
          >
            {toast.action.label}
          </button>
        )}
      </div>
    </div>
  );
}
