import { useState, type FormEvent } from 'react';
import { Dumbbell, LogIn } from 'lucide-react';
import { login, resetPassword } from '../../data/cloud';

function message(error: unknown): string {
  const code = (error as { code?: string })?.code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found') || code.includes('invalid-email')) {
    return 'E-Mail oder Passwort stimmt nicht.';
  }
  if (code.includes('too-many-requests')) return 'Zu viele Versuche. Bitte kurz warten.';
  if (code.includes('network')) return 'Keine Verbindung. Für den ersten Login brauchst du Internet.';
  return 'Anmeldung fehlgeschlagen. Bitte erneut versuchen.';
}

/** Einmaliger Login mit dem bestehenden Konto aus dem alten Gym Tracker. */
export function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setInfo(null);
    try {
      await login(email, password);
    } catch (reason) {
      setError(message(reason));
      setPassword('');
    } finally {
      setBusy(false);
    }
  };

  const forgot = async () => {
    if (!email.trim()) {
      setError('Trag zuerst deine E-Mail-Adresse ein.');
      return;
    }
    try {
      await resetPassword(email);
      setInfo('Wir haben dir eine E-Mail zum Zurücksetzen geschickt.');
      setError(null);
    } catch (reason) {
      setError(message(reason));
    }
  };

  return (
    <div className="safe-top relative z-10 mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="accent-gradient mb-6 flex h-16 w-16 items-center justify-center rounded-3xl shadow-[var(--shadow-glow)]">
        <Dumbbell size={30} />
      </div>
      <h1 className="display text-[34px] leading-tight">Gym Tracker</h1>
      <p className="mt-2 text-[14px] leading-relaxed text-ink-3">
        Melde dich mit deinem bisherigen Konto an. Deine Trainings werden dann automatisch übernommen und zwischen deinen Geräten synchronisiert.
      </p>

      <form onSubmit={submit} className="mt-8 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">E-Mail</span>
          <input
            type="email"
            autoComplete="username"
            inputMode="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="h-12 rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none focus:border-accent/60"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="eyebrow">Passwort</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="h-12 rounded-2xl border border-line bg-surface px-4 text-[16px] text-ink outline-none focus:border-accent/60"
          />
        </label>
        {error && <p className="rounded-xl bg-danger/10 px-3 py-2 text-[13px] text-danger">{error}</p>}
        {info && <p className="rounded-xl bg-success/10 px-3 py-2 text-[13px] text-success">{info}</p>}
        <button
          type="submit"
          disabled={busy}
          className="accent-gradient mt-2 flex h-13 items-center justify-center gap-2 rounded-2xl text-[15px] font-semibold shadow-[var(--shadow-glow)] transition active:scale-[0.98] disabled:opacity-60"
        >
          <LogIn size={18} /> {busy ? 'Anmelden …' : 'Anmelden'}
        </button>
        <button type="button" onClick={forgot} className="mt-1 text-[13px] text-ink-3 hover:text-ink-2">
          Passwort vergessen?
        </button>
      </form>
    </div>
  );
}
