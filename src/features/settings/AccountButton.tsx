import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { cx, IconButton } from '../../components/ui';
import { useStore } from '../../state/store';
import { AccountSheet } from './AccountSheet';

export function AccountButton() {
  const [open, setOpen] = useState(false);
  const sync = useStore((state) => state.sync.state);
  return (
    <>
      <IconButton label="Konto und Daten" onClick={() => setOpen(true)} className="glass relative h-11 w-11 shrink-0">
        <UserRound size={20} />
        {sync !== 'local' && (
          <span
            className={cx(
              'absolute right-0.5 top-0.5 h-2.5 w-2.5 rounded-full border-2 border-bg',
              sync === 'synced' ? 'bg-success' : sync === 'error' ? 'bg-danger' : sync === 'offline' ? 'bg-ink-3' : 'bg-accent',
            )}
          />
        )}
      </IconButton>
      <AccountSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
