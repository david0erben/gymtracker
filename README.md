# Gym Tracker

Eine mobile-first Gym-Tracking-Web-App ohne Build-System. Sie läuft als
statische Website auf GitHub Pages und synchronisiert Daten über Firebase.

## Funktionen

- Fester Trainingsplan mit Ziel-Sätzen und Wiederholungsbereichen
- Firebase Authentication mit dauerhafter Anmeldung
- Automatische Synchronisierung über Cloud Firestore
- Lokaler Cache und Firestore Offline Persistence
- Trainingsauswertung mit interaktiven Canvas-Diagrammen
- Körpergewichtsverlauf
- JSON-Export und -Import
- Kein eigener Server und kein Build-Schritt

## Firebase-Synchronisierung

Die App kann Trainingsdaten über Firebase Authentication und Cloud Firestore
zwischen Geräten synchronisieren. Ohne Firebase-Konfiguration funktioniert sie
weiterhin vollständig mit dem lokalen Browser-Cache.

Für die Einrichtung werden benötigt:

- eine registrierte Firebase Web-App
- Cloud Firestore im Spark Plan
- aktivierte E-Mail/Passwort-Authentifizierung
- mindestens ein Firebase-Auth-Benutzer
- Firestore Security Rules aus `firestore.rules`

Die öffentliche Firebase Web Config liegt im markierten Block in `firebase.js`.
Die Daten jedes angemeldeten Benutzers
liegen unter `users/{uid}/data/main`; die UID kommt automatisch aus Firebase
Authentication. Passwörter oder Service-Account-Keys gehören nicht in das
Repository.

## Projektstruktur

- `index.html` – semantisches HTML, Navigation und Layout
- `style.css` – vollständiges Styling
- `app.js` – App-Start, Navigation und Verbindung der Module
- `firebase.js` – Firebase-Konfiguration, Initialisierung und Offline Cache
- `auth.js` – Login, Logout, Sitzung und Auth-State-Listener
- `storage.js` – lokaler Cache, Firestore-Sync und JSON-Backups
- `training.js` – Trainingseingabe, Übungen, Sätze und Workout-Abschluss
- `analytics.js` – Trainingsstatistiken, Volumen und 1RM-Berechnungen
- `charts.js` – Canvas-Diagramme, Hover und Tooltips
- `bodyweight.js` – Körpergewichtseingabe und Verlauf
- `utils.js` – Trainingsplan, Datumsformatierung und Hilfsfunktionen

Die JavaScript-Dateien verwenden native ES6-Module. Alle Datenzugriffe laufen
über `storage.js`; die Feature-Module bleiben dadurch unabhängig von Firebase.

## Nutzung

Die veröffentlichte App kann direkt im Browser verwendet werden. Alle neu
eingetragenen Daten werden zunächst lokal gespeichert und bei konfiguriertem
Firebase automatisch synchronisiert. JSON-Export und -Import bleiben als
zusätzliche Backup-Funktion erhalten.

Für die lokale Entwicklung muss die App wegen der ES6-Module über einen
statischen Webserver ausgeliefert werden, zum Beispiel:

```sh
python3 -m http.server 8000
```

Danach ist sie unter `http://localhost:8000` erreichbar.
