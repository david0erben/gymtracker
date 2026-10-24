// Nur für lokale Tests: legt im Firebase-Emulator einen Test-Account an und speichert dort
// eine Kopie des alten Gym-Tracker-Dokuments (users/{uid}/data/main). Berührt keine echten Daten.
// Aufruf: node scripts/seed-emulator.mjs <backup.json>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, createUserWithEmailAndPassword, getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { connectFirestoreEmulator, doc, getFirestore, serverTimestamp, setDoc, terminate } from 'firebase/firestore';

const CREDENTIALS = 'dev-data/emulator-test-user.json';
const backup = JSON.parse(readFileSync(process.argv[2], 'utf-8'));
const credentials = existsSync(CREDENTIALS)
  ? JSON.parse(readFileSync(CREDENTIALS, 'utf-8'))
  : { email: 'test-athlet@gym.test', password: randomBytes(9).toString('base64url') };
writeFileSync(CREDENTIALS, JSON.stringify(credentials, null, 2));

const app = initializeApp({ apiKey: 'emulator', projectId: 'gym-tracker-5f06a', authDomain: 'localhost' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

let user;
try {
  user = (await createUserWithEmailAndPassword(auth, credentials.email, credentials.password)).user;
} catch {
  user = (await signInWithEmailAndPassword(auth, credentials.email, credentials.password)).user;
}

await setDoc(doc(db, 'users', user.uid, 'data', 'main'), {
  version: 2,
  workouts: backup.workouts,
  bodyweight: backup.bodyweight,
  draftWorkout: backup.draftWorkout ?? {},
  updatedAt: serverTimestamp(),
});
console.log(`Emulator vorbereitet: ${backup.workouts.length} Trainings, ${backup.bodyweight.length} Gewichte für ${credentials.email} (uid ${user.uid}).`);
await terminate(db);
process.exit(0);
