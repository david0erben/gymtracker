/* Firebase Web SDK, Firestore und persistenter Multi-Tab-Offline-Cache. */

export const firebaseConfig = {
  apiKey: "AIzaSyCeepsqscIyVCFohnV7mRB01E0aXpqPD6g",
  authDomain: "gym-tracker-5f06a.firebaseapp.com",
  projectId: "gym-tracker-5f06a",
  storageBucket: "gym-tracker-5f06a.firebasestorage.app",
  messagingSenderId: "6355345398",
  appId: "1:6355345398:web:8f9e8088a80eda597671d7"
};

const FIREBASE_SDK_VERSION = "12.15.0";
let servicesPromise = null;

export function firebaseIsConfigured() {
  return [
    "apiKey",
    "authDomain",
    "projectId",
    "storageBucket",
    "messagingSenderId",
    "appId"
  ].every(key =>
    typeof firebaseConfig[key] === "string" && firebaseConfig[key].length > 0
  );
}

export function initializeFirebase() {
  if (!servicesPromise) servicesPromise = loadFirebaseServices();
  return servicesPromise;
}

async function loadFirebaseServices() {
  if (!firebaseIsConfigured()) throw new Error("Firebase-Konfiguration fehlt.");

  const baseUrl = `https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}`;
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import(`${baseUrl}/firebase-app.js`),
    import(`${baseUrl}/firebase-auth.js`),
    import(`${baseUrl}/firebase-firestore.js`)
  ]);

  const app = appModule.initializeApp(firebaseConfig);
  const auth = authModule.getAuth(app);
  let db;
  try {
    db = firestoreModule.initializeFirestore(app, {
      localCache: firestoreModule.persistentLocalCache({
        tabManager: firestoreModule.persistentMultipleTabManager()
      })
    });
  } catch (persistenceError) {
    console.warn("Persistenter Firestore-Cache nicht verfügbar.", persistenceError);
    db = firestoreModule.getFirestore(app);
  }

  return {
    app,
    auth,
    db,
    authApi: {
      browserLocalPersistence: authModule.browserLocalPersistence,
      onAuthStateChanged: authModule.onAuthStateChanged,
      setPersistence: authModule.setPersistence,
      signInWithEmailAndPassword: authModule.signInWithEmailAndPassword,
      signOut: authModule.signOut
    },
    firestoreApi: {
      deleteDoc: firestoreModule.deleteDoc,
      doc: firestoreModule.doc,
      getDoc: firestoreModule.getDoc,
      onSnapshot: firestoreModule.onSnapshot,
      serverTimestamp: firestoreModule.serverTimestamp,
      setDoc: firestoreModule.setDoc
    }
  };
}
