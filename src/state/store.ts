import { create } from 'zustand';
import { normalizeAppData, createId, type AppData } from '../data/legacy';
import { applyDataFixes } from '../data/fixes';
import { analyzeHistory, applyOutlierFlags, shiftsByExercise } from '../domain/outliers';
import { todaysWeekDay, type WeekDayKey } from '../domain/plan';
import type { CardioEntry } from '../domain/cardio';
import { defaultSettings, normalizeSettings, type Settings } from '../domain/settings';
import { compareWorkouts } from '../domain/strength';
import type { BodyweightEntry, DayKey, Workout } from '../domain/types';
import { workoutFromDraft, type DraftSession, type FinishOptions } from './drafts';

export type Tab = 'training' | 'history' | 'analytics' | 'body' | 'goals';

export interface PersistedState {
  workouts: Workout[];
  bodyweight: BodyweightEntry[];
  cardio: CardioEntry[];
  settings: Settings;
  drafts: Partial<Record<DayKey, DraftSession>>;
}

export interface Account {
  status: 'loading' | 'signedOut' | 'signedIn';
  email: string | null;
  uid: string | null;
}

export interface SyncStatus {
  state: 'local' | 'syncing' | 'synced' | 'offline' | 'error';
  message?: string;
}

export interface Toast {
  id: number;
  message: string;
  tone: 'default' | 'success' | 'error';
  action?: { label: string; run: () => void };
}

interface AppStore extends PersistedState {
  hydrated: boolean;
  account: Account;
  sync: SyncStatus;
  setAccount: (account: Account) => void;
  setSync: (sync: SyncStatus) => void;
  /** Daten aus der Cloud übernehmen, ohne sie wieder hochzuladen */
  applyRemote: (patch: Partial<PersistedState>) => void;
  /** Schneller Start aus dem lokalen Zwischenspeicher des angemeldeten Kontos */
  hydrateFromCache: (uid: string) => void;
  resetData: () => void;
  tab: Tab;
  selectedDay: WeekDayKey;
  toast: Toast | null;
  hydrate: () => Promise<void>;
  setTab: (tab: Tab) => void;
  selectDay: (day: WeekDayKey) => void;
  setDraft: (day: DayKey, draft: DraftSession | undefined) => void;
  updateDraft: (day: DayKey, update: (draft: DraftSession) => DraftSession) => void;
  finishWorkout: (day: DayKey, options: FinishOptions) => Workout | null;
  saveWorkout: (workout: Workout) => void;
  deleteWorkout: (id: string) => Workout | null;
  addBodyweight: (date: string, weight: number) => void;
  deleteBodyweight: (id: string) => BodyweightEntry | null;
  saveCardio: (entry: CardioEntry) => void;
  deleteCardio: (id: string) => CardioEntry | null;
  updateSettings: (update: (settings: Settings) => Settings) => void;
  replaceData: (data: AppData) => void;
  showToast: (message: string, tone?: Toast['tone'], action?: Toast['action']) => void;
  dismissToast: () => void;
}

const STORAGE_KEY = 'gymtracker.v3';
/** Lokaler Zwischenspeicher – pro Konto getrennt, ohne Konto (Entwicklung) unter dem Basisschlüssel */
let storageKey = STORAGE_KEY;

let remoteDepth = 0;
/** true, während Cloud-Daten eingespielt werden – dann nichts zurück in die Cloud schreiben */
export function isApplyingRemote(): boolean {
  return remoteDepth > 0;
}

function sortWorkouts(workouts: Workout[]): Workout[] {
  return [...workouts].sort(compareWorkouts);
}

function sortCardio(entries: CardioEntry[]): CardioEntry[] {
  return [...entries].sort((a, b) => (a.date === b.date ? a.completedAt.localeCompare(b.completedAt) : a.date < b.date ? -1 : 1));
}

function loadLocal(): PersistedState | null {
  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    const data = normalizeAppData(parsed);
    return {
      workouts: sortWorkouts(data.workouts),
      bodyweight: data.bodyweight,
      cardio: sortCardio(data.cardio),
      settings: normalizeSettings(parsed.settings),
      drafts: parsed.drafts ?? {},
    };
  } catch (error) {
    console.warn('Lokale Daten konnten nicht gelesen werden.', error);
    return null;
  }
}

function saveLocal(state: PersistedState) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch (error) {
    console.warn('Lokale Daten konnten nicht gespeichert werden.', error);
  }
}

/** Bereitet importierte Daten auf: Ausreißer markieren und Gerätewechsel erkennen, ohne Werte zu verändern. */
export function prepareImported(data: AppData, current?: Settings): AppData {
  const settings = data.settings ?? current ?? defaultSettings();
  const workouts = applyDataFixes(data.workouts);
  const { findings, shifts } = analyzeHistory(workouts, settings.rules.outlierThreshold);
  const detected = shiftsByExercise(shifts);
  const levelShifts = { ...detected, ...settings.levelShifts };
  return {
    ...data,
    workouts: sortWorkouts(applyOutlierFlags(workouts, findings)),
    settings: { ...settings, levelShifts },
  };
}

async function loadDevSeed(): Promise<AppData | null> {
  const url = import.meta.env.VITE_DEV_SEED as string | undefined;
  if (!import.meta.env.DEV || !url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    return prepareImported(normalizeAppData(await response.json()));
  } catch {
    return null;
  }
}

let toastCounter = 0;
let saveTimer: ReturnType<typeof setTimeout> | undefined;

export const useStore = create<AppStore>((set, get) => ({
  workouts: [],
  bodyweight: [],
  cardio: [],
  settings: defaultSettings(),
  drafts: {},
  hydrated: false,
  account: { status: 'loading', email: null, uid: null },
  sync: { state: 'local' },
  tab: 'training',
  selectedDay: todaysWeekDay(),
  toast: null,

  hydrate: async () => {
    // Nur in der Entwicklung: ?reset lädt die Ausgangsdaten neu
    if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('reset')) {
      localStorage.removeItem(storageKey);
      window.history.replaceState(null, '', window.location.pathname);
    }
    const local = loadLocal();
    if (local) {
      set({ ...local, hydrated: true });
      return;
    }
    const seed = await loadDevSeed();
    set({
      workouts: seed?.workouts ?? [],
      bodyweight: seed?.bodyweight ?? [],
      cardio: seed?.cardio ?? [],
      settings: seed?.settings ?? defaultSettings(),
      drafts: {},
      hydrated: true,
    });
  },

  setAccount: (account) => set({ account }),
  setSync: (sync) => set((state) => (state.sync.state === sync.state && state.sync.message === sync.message ? {} : { sync })),

  applyRemote: (patch) => {
    // Unveränderte Daten nicht neu setzen (spart unnötiges Neuzeichnen)
    const current = get();
    const changed = Object.fromEntries(
      Object.entries(patch).filter(([key, value]) => JSON.stringify(current[key as keyof PersistedState]) !== JSON.stringify(value)),
    ) as Partial<PersistedState>;
    if (!Object.keys(changed).length) return;
    remoteDepth += 1;
    try {
      set(changed);
    } finally {
      remoteDepth -= 1;
    }
  },

  hydrateFromCache: (uid) => {
    storageKey = `${STORAGE_KEY}.${uid}`;
    const local = loadLocal();
    remoteDepth += 1;
    try {
      set({
        workouts: local?.workouts ?? [],
        bodyweight: local?.bodyweight ?? [],
        cardio: local?.cardio ?? [],
        settings: local?.settings ?? defaultSettings(),
        drafts: local?.drafts ?? {},
        hydrated: true,
      });
    } finally {
      remoteDepth -= 1;
    }
  },

  resetData: () => {
    storageKey = STORAGE_KEY;
    remoteDepth += 1;
    try {
      set({ workouts: [], bodyweight: [], cardio: [], settings: defaultSettings(), drafts: {}, hydrated: true });
    } finally {
      remoteDepth -= 1;
    }
  },

  setTab: (tab) => set({ tab }),
  selectDay: (day) => set({ selectedDay: day }),

  setDraft: (day, draft) =>
    set((state) => {
      const drafts = { ...state.drafts };
      if (draft) drafts[day] = draft;
      else delete drafts[day];
      return { drafts };
    }),

  updateDraft: (day, update) =>
    set((state) => {
      const current = state.drafts[day];
      if (!current) return {};
      return { drafts: { ...state.drafts, [day]: update(current) } };
    }),

  finishWorkout: (day, options) => {
    const draft = get().drafts[day];
    if (!draft) return null;
    const workout = workoutFromDraft(draft, options);
    if (!workout.exercises.some((exercise) => exercise.sets.length)) return null;
    set((state) => {
      const drafts = { ...state.drafts };
      delete drafts[day];
      return { workouts: sortWorkouts([...state.workouts, workout]), drafts };
    });
    return workout;
  },

  saveWorkout: (workout) =>
    set((state) => ({
      workouts: sortWorkouts(
        state.workouts.some((item) => item.id === workout.id)
          ? state.workouts.map((item) => (item.id === workout.id ? workout : item))
          : [...state.workouts, workout],
      ),
    })),

  deleteWorkout: (id) => {
    const workout = get().workouts.find((item) => item.id === id) ?? null;
    set((state) => ({ workouts: state.workouts.filter((item) => item.id !== id) }));
    return workout;
  },

  addBodyweight: (date, weight) =>
    set((state) => ({
      bodyweight: [...state.bodyweight.filter((entry) => entry.date !== date), { id: createId(), date, weight }].sort((a, b) =>
        a.date.localeCompare(b.date),
      ),
    })),

  deleteBodyweight: (id) => {
    const entry = get().bodyweight.find((item) => item.id === id) ?? null;
    set((state) => ({ bodyweight: state.bodyweight.filter((item) => item.id !== id) }));
    return entry;
  },

  saveCardio: (entry) =>
    set((state) => ({
      cardio: sortCardio(state.cardio.some((item) => item.id === entry.id) ? state.cardio.map((item) => (item.id === entry.id ? entry : item)) : [...state.cardio, entry]),
    })),

  deleteCardio: (id) => {
    const entry = get().cardio.find((item) => item.id === id) ?? null;
    set((state) => ({ cardio: state.cardio.filter((item) => item.id !== id) }));
    return entry;
  },

  updateSettings: (update) => set((state) => ({ settings: update(state.settings) })),

  replaceData: (data) =>
    set((state) => ({
      workouts: sortWorkouts(data.workouts),
      bodyweight: [...data.bodyweight].sort((a, b) => a.date.localeCompare(b.date)),
      cardio: sortCardio(data.cardio),
      settings: data.settings ?? state.settings,
    })),

  showToast: (message, tone = 'default', action) => {
    toastCounter += 1;
    const id = toastCounter;
    set({ toast: { id, message, tone, action } });
    setTimeout(() => {
      if (get().toast?.id === id) set({ toast: null });
    }, action ? 6000 : 3200);
  },

  dismissToast: () => set({ toast: null }),
}));

// Alles Persistente lokal sichern (kurz entprellt, damit Tippen nicht jedes Mal schreibt)
useStore.subscribe((state, previous) => {
  if (!state.hydrated || state.account.status === 'signedOut') return;
  if (
    state.workouts === previous.workouts &&
    state.bodyweight === previous.bodyweight &&
    state.cardio === previous.cardio &&
    state.settings === previous.settings &&
    state.drafts === previous.drafts
  ) {
    return;
  }
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const { workouts, bodyweight, cardio, settings, drafts } = useStore.getState();
    saveLocal({ workouts, bodyweight, cardio, settings, drafts });
  }, 250);
});

// Beim Verlassen/Verstecken der App sofort sichern (iOS beendet Web-Apps im Hintergrund gern)
if (typeof window !== 'undefined') {
  const flush = () => {
    const { hydrated, account, workouts, bodyweight, cardio, settings, drafts } = useStore.getState();
    if (!hydrated || account.status === 'signedOut') return;
    clearTimeout(saveTimer);
    saveLocal({ workouts, bodyweight, cardio, settings, drafts });
  };
  window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
}
