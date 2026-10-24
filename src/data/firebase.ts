import { initializeApp, type FirebaseApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, type Auth } from 'firebase/auth';
import {
  connectFirestoreEmulator,
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  type Firestore,
} from 'firebase/firestore';

/**
 * Firebase-Projekt des Gym Trackers – dasselbe wie in der alten App.
 * Die Web-Konfiguration ist öffentlich (kein Geheimnis); geschützt wird über Login und Security Rules.
 */
const firebaseConfig = {
  apiKey: 'AIzaSyCeepsqscIyVCFohnV7mRB01E0aXpqPD6g',
  authDomain: 'gym-tracker-5f06a.firebaseapp.com',
  projectId: 'gym-tracker-5f06a',
  storageBucket: 'gym-tracker-5f06a.firebasestorage.app',
  messagingSenderId: '6355345398',
  appId: '1:6355345398:web:8f9e8088a80eda597671d7',
};

/** In der Entwicklung läuft die App ohne Cloud – außer der lokale Firebase-Emulator ist eingeschaltet. */
export const USE_EMULATOR = import.meta.env.DEV && import.meta.env.VITE_FIREBASE_EMULATOR === '1';
export const CLOUD_ENABLED = !import.meta.env.DEV || USE_EMULATOR;

export interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
}

let services: FirebaseServices | null = null;

export function firebase(): FirebaseServices {
  if (services) return services;
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  let db: Firestore;
  try {
    // Offline-Speicher im Browser: Trainings lassen sich ohne Netz eintragen und werden später synchronisiert
    db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
  } catch (error) {
    console.warn('Offline-Speicher nicht verfügbar, nutze Standard-Cache.', error);
    db = getFirestore(app);
  }
  if (USE_EMULATOR) {
    connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  services = { app, auth, db };
  return services;
}
