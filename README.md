# Gym Tracker

Trainings-App fürs Handy und den Mac: Sets eintragen, Empfehlungen fürs nächste Training,
Auswertungen, Körpergewicht und Cardio. Läuft als Web-App (zum Home-Bildschirm hinzufügbar,
offline nutzbar) und synchronisiert über Firebase.

Live: https://david0erben.github.io/gymtracker/

## Funktionen

- **Training** – Sets mit vorausgefüllter Empfehlung (doppelte Progression innerhalb deiner Rep-Range,
  neue Bestleistungen werden erst bestätigt, schwerere Gewichte kommen Satz für Satz), Dropsätze,
  Eingabe per −/+ oder eigenem Ziffernfeld, Cardio-Tage (Laufen/Radfahren mit Pace)
- **Verlauf** – Kalender (Monat/Jahr), Serien, Plantreue, alle Trainings bearbeiten
- **Analyse** – Kraftentwicklung (geschätztes 1RM) und Volumen pro Muskel
- **Körper** – Körpergewicht mit Verlauf
- **Ziele** – Wochenvolumen, Einstellungen pro Übung, Trainingsziele (Hypertrophie mit eigenem Wochenplan), Gewichtsstufen und Startgewicht pro Gerät und pro Übung

## Technik

React + TypeScript + Vite, Tailwind CSS, Recharts, Zustand, Firebase (Auth + Firestore mit
Offline-Cache), vite-plugin-pwa. Die Empfehlungslogik liegt in `src/domain/` und ist mit Vitest getestet.

Firestore-Aufbau unter `users/{uid}/`: `workouts/{id}`, `bodyweight/{id}`, `cardio/{id}`,
`data/settings`, `data/session`, `data/meta`. Das Dokument `data/main` des alten Trackers bleibt als
Backup erhalten und wird beim ersten Login automatisch übernommen.

## Entwicklung

```sh
npm install
npm run dev        # lokal mit Testdaten im Browser (ohne Cloud)
npm test           # Tests der Empfehlungslogik
npm run build      # Produktions-Build nach dist/
```

Mit Firebase-Emulator (benötigt Java 21):

```sh
firebase emulators:start --only auth,firestore
node scripts/seed-emulator.mjs <backup.json>
VITE_FIREBASE_EMULATOR=1 npx vite --port 5174
```

## Veröffentlichung

Jeder Push auf `main` baut, testet und veröffentlicht die App über GitHub Actions auf GitHub Pages.
Sicherheitsregeln: `firebase deploy --only firestore:rules`.
