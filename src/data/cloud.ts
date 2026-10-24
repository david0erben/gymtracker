import { onAuthStateChanged, sendPasswordResetEmail, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDocFromServer,
  getDocsFromServer,
  onSnapshot,
  serverTimestamp,
  setDoc,
  writeBatch,
  type DocumentData,
  type Firestore,
} from 'firebase/firestore';
import { normalizeCardio, type CardioEntry } from '../domain/cardio';
import { normalizeSettings } from '../domain/settings';
import { compareWorkouts } from '../domain/strength';
import type { BodyweightEntry, Workout } from '../domain/types';
import { prepareImported, useStore, isApplyingRemote, type PersistedState } from '../state/store';
import { firebase } from './firebase';
import { normalizeAppData, normalizeBodyweight, normalizeWorkout, type AppData } from './legacy';

/**
 * Cloud-Synchronisierung über Firestore.
 *
 * Aufbau unter users/{uid}/:
 *   workouts/{id}, bodyweight/{id}, cardio/{id}  – je Eintrag ein Dokument
 *   data/settings                                – Einstellungen
 *   data/session                                 – laufende Trainings (Entwürfe)
 *   data/meta                                    – Version und Übernahme-Zeitpunkt
 *   data/main                                    – Daten des alten Trackers (bleibt als Backup unverändert)
 *
 * Firestore speichert alles zusätzlich offline im Browser: Eintragen klappt ohne Netz,
 * synchronisiert wird automatisch, sobald wieder Verbindung besteht.
 */

const SCHEMA = 3;
type Collection = 'workouts' | 'bodyweight' | 'cardio';

let uid: string | null = null;
let listeners: (() => void)[] = [];
let storeUnsubscribe: (() => void) | null = null;
let settingsTimer: ReturnType<typeof setTimeout> | undefined;
let sessionTimer: ReturnType<typeof setTimeout> | undefined;
let draftsEditedAt = 0;

const db = (): Firestore => firebase().db;
const userDoc = (...path: string[]) => doc(db(), 'users', uid as string, ...path);
const userCollection = (name: Collection) => collection(db(), 'users', uid as string, name);

/** Firestore verträgt kein `undefined` – JSON-Kopie entfernt solche Felder. */
function clean<T>(value: T): DocumentData {
  return JSON.parse(JSON.stringify(value)) as DocumentData;
}

function setSync(state: PersistedSyncState, message?: string) {
  useStore.getState().setSync({ state, message });
}

type PersistedSyncState = 'syncing' | 'synced' | 'offline' | 'error';

/* ---------------- Login ---------------- */

export function startCloud() {
  const { auth } = firebase();
  onAuthStateChanged(auth, (user) => {
    stopSync();
    const store = useStore.getState();
    if (!user) {
      store.setAccount({ status: 'signedOut', email: null, uid: null });
      store.resetData();
      return;
    }
    store.setAccount({ status: 'signedIn', email: user.email, uid: user.uid });
    store.hydrateFromCache(user.uid);
    void startSync(user.uid);
  });
  window.addEventListener('online', () => uid && setSync('syncing'));
  window.addEventListener('offline', () => uid && setSync('offline'));
}

export async function login(email: string, password: string) {
  await signInWithEmailAndPassword(firebase().auth, email.trim(), password);
}

export async function logout() {
  flushPending();
  await signOut(firebase().auth);
}

export async function resetPassword(email: string) {
  await sendPasswordResetEmail(firebase().auth, email.trim());
}

/* ---------------- Synchronisierung ---------------- */

async function startSync(userId: string) {
  uid = userId;
  setSync(navigator.onLine ? 'syncing' : 'offline');
  try {
    await ensureMigrated();
  } catch (error) {
    // Ohne Verbindung klappt die Übernahme nicht – beim nächsten Start erneut versuchen
    console.warn('Übernahme aus dem alten Tracker verschoben.', error);
  }
  if (uid !== userId) return;
  listen();
  storeUnsubscribe = useStore.subscribe(onStoreChange);
}

function stopSync() {
  flushPending();
  listeners.forEach((unsubscribe) => unsubscribe());
  listeners = [];
  storeUnsubscribe?.();
  storeUnsubscribe = null;
  uid = null;
}

/**
 * Beim ersten Login: Daten aus dem alten Tracker (users/{uid}/data/main) übernehmen.
 * Ausreißer werden markiert, Werte nicht verändert. Das alte Dokument bleibt bestehen.
 */
async function ensureMigrated() {
  const meta = await getDocFromServer(userDoc('data', 'meta'));
  if (meta.exists() && (meta.data().schema ?? 0) >= SCHEMA) return;

  const legacy = await getDocFromServer(userDoc('data', 'main'));
  const local = useStore.getState();
  let data: AppData;
  if (legacy.exists()) {
    data = prepareImported(normalizeAppData(legacy.data()), local.settings);
  } else {
    data = { workouts: local.workouts, bodyweight: local.bodyweight, cardio: local.cardio, settings: local.settings };
  }

  await writeAll([
    ...data.workouts.map((workout) => ({ path: ['workouts', workout.id], value: clean(workout) })),
    ...data.bodyweight.map((entry) => ({ path: ['bodyweight', entry.id], value: clean(entry) })),
    ...data.cardio.map((entry) => ({ path: ['cardio', entry.id], value: clean(entry) })),
    { path: ['data', 'settings'], value: { ...clean(data.settings ?? local.settings), updatedAt: serverTimestamp() } },
  ]);
  await setDoc(userDoc('data', 'meta'), {
    schema: SCHEMA,
    migratedAt: serverTimestamp(),
    migratedFrom: legacy.exists() ? 'data/main' : 'local',
    workouts: data.workouts.length,
    bodyweight: data.bodyweight.length,
  });
}

/** Schreibt viele Dokumente in Paketen (Firestore erlaubt max. 500 pro Paket). */
async function writeAll(items: { path: string[]; value: DocumentData }[]) {
  for (let start = 0; start < items.length; start += 400) {
    const batch = writeBatch(db());
    for (const item of items.slice(start, start + 400)) batch.set(userDoc(...item.path), item.value);
    await batch.commit();
  }
}

function listen() {
  const onError = (error: Error) => {
    console.warn('Synchronisierung fehlgeschlagen.', error);
    setSync('error', 'Synchronisierung fehlgeschlagen');
  };

  const watchCollection = <T extends { id: string }>(name: Collection, normalize: (raw: unknown) => T | null, apply: (items: T[]) => Partial<PersistedState>) => {
    listeners.push(
      onSnapshot(
        userCollection(name),
        (snapshot) => {
          // Eigene, noch nicht bestätigte Änderungen nicht zurückspielen
          if (snapshot.metadata.hasPendingWrites) return;
          const items = snapshot.docs.map((entry) => normalize({ id: entry.id, ...entry.data() })).filter((item): item is T => item !== null);
          useStore.getState().applyRemote(apply(items));
          if (!snapshot.metadata.fromCache) setSync('synced');
        },
        onError,
      ),
    );
  };

  watchCollection<Workout>('workouts', normalizeWorkout, (items) => ({ workouts: [...items].sort(compareWorkouts) }));
  watchCollection<BodyweightEntry>('bodyweight', normalizeBodyweight, (items) => ({ bodyweight: [...items].sort((a, b) => a.date.localeCompare(b.date)) }));
  watchCollection<CardioEntry>('cardio', normalizeCardio, (items) => ({ cardio: [...items].sort((a, b) => (a.date === b.date ? a.completedAt.localeCompare(b.completedAt) : a.date < b.date ? -1 : 1)) }));

  listeners.push(
    onSnapshot(
      userDoc('data', 'settings'),
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
        useStore.getState().applyRemote({ settings: normalizeSettings(snapshot.data()) });
      },
      onError,
    ),
  );

  listeners.push(
    onSnapshot(
      userDoc('data', 'session'),
      (snapshot) => {
        if (snapshot.metadata.hasPendingWrites || !snapshot.exists()) return;
        // Während du gerade tippst, keine Entwürfe von anderen Geräten übernehmen
        if (Date.now() - draftsEditedAt < 4000) return;
        const drafts = (snapshot.data().drafts ?? {}) as PersistedState['drafts'];
        useStore.getState().applyRemote({ drafts });
      },
      onError,
    ),
  );
}

/** Lokale Änderungen erkennen und als einzelne Dokumente hochladen. */
function onStoreChange(state: PersistedState, previous: PersistedState) {
  if (!uid || isApplyingRemote()) return;
  syncCollection('workouts', previous.workouts, state.workouts);
  syncCollection('bodyweight', previous.bodyweight, state.bodyweight);
  syncCollection('cardio', previous.cardio, state.cardio);

  if (state.settings !== previous.settings) {
    clearTimeout(settingsTimer);
    settingsTimer = setTimeout(writeSettings, 400);
  }
  if (state.drafts !== previous.drafts) {
    draftsEditedAt = Date.now();
    clearTimeout(sessionTimer);
    sessionTimer = setTimeout(writeSession, 800);
  }
}

function syncCollection<T extends { id: string }>(name: Collection, before: T[], after: T[]) {
  if (before === after) return;
  const previous = new Map(before.map((item) => [item.id, item]));
  const next = new Set<string>();
  for (const item of after) {
    next.add(item.id);
    if (previous.get(item.id) !== item) track(setDoc(userDoc(name, item.id), clean(item)));
  }
  for (const id of previous.keys()) if (!next.has(id)) track(deleteDoc(userDoc(name, id)));
}

function writeSettings() {
  if (!uid) return;
  track(setDoc(userDoc('data', 'settings'), { ...clean(useStore.getState().settings), updatedAt: serverTimestamp() }));
}

function writeSession() {
  if (!uid) return;
  track(setDoc(userDoc('data', 'session'), { drafts: clean(useStore.getState().drafts), updatedAt: serverTimestamp() }));
}

function flushPending() {
  if (settingsTimer) {
    clearTimeout(settingsTimer);
    settingsTimer = undefined;
    writeSettings();
  }
  if (sessionTimer) {
    clearTimeout(sessionTimer);
    sessionTimer = undefined;
    writeSession();
  }
}

let inFlight = 0;
function track(promise: Promise<void>) {
  inFlight += 1;
  if (navigator.onLine) setSync('syncing');
  promise
    .then(() => {
      inFlight -= 1;
      if (inFlight === 0) setSync('synced');
    })
    .catch((error: Error) => {
      inFlight -= 1;
      console.warn('Speichern in der Cloud fehlgeschlagen.', error);
      setSync('error', 'Speichern in der Cloud fehlgeschlagen');
    });
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushPending);
  document.addEventListener('visibilitychange', () => document.visibilityState === 'hidden' && flushPending());
}

/**
 * Sicherheitsnetz: Trainings, die nach der Umstellung noch im alten Tracker eingetragen wurden,
 * nachträglich übernehmen. Bereits vorhandene Einträge bleiben unverändert.
 */
export async function importFromLegacy(): Promise<{ workouts: number; bodyweight: number }> {
  if (!uid) throw new Error('Nicht angemeldet');
  const legacy = await getDocFromServer(userDoc('data', 'main'));
  if (!legacy.exists()) return { workouts: 0, bodyweight: 0 };
  const store = useStore.getState();
  const data = prepareImported(normalizeAppData(legacy.data()), store.settings);
  const knownWorkouts = new Set(store.workouts.map((workout) => workout.id));
  const knownBodyweight = new Set(store.bodyweight.map((entry) => entry.id));
  const newWorkouts = data.workouts.filter((workout) => !knownWorkouts.has(workout.id));
  const newBodyweight = data.bodyweight.filter((entry) => !knownBodyweight.has(entry.id));
  for (const workout of newWorkouts) store.saveWorkout(workout);
  for (const entry of newBodyweight) store.addBodyweight(entry.date, entry.weight);
  return { workouts: newWorkouts.length, bodyweight: newBodyweight.length };
}

/** Anzahl der Trainings direkt vom Server – für die Kontoansicht. */
export async function serverWorkoutCount(): Promise<number | null> {
  if (!uid) return null;
  try {
    return (await getDocsFromServer(userCollection('workouts'))).size;
  } catch {
    return null;
  }
}
