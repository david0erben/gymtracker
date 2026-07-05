# Gym Tracker

Eine lokale, mobile-first Gym-Tracking-Web-App als einzelne `index.html`.

## Funktionen

- Fester Trainingsplan mit Ziel-Sätzen und Wiederholungsbereichen
- Automatische Speicherung im Browser (`localStorage`)
- Trainingsauswertung mit interaktiven Canvas-Diagrammen
- Körpergewichtsverlauf
- JSON-Export und -Import
- Keine externen Bibliotheken und kein Backend

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

Die öffentliche Firebase Web Config wird im markierten Block am Anfang des
JavaScripts in `index.html` eingetragen. Die Daten jedes angemeldeten Benutzers
liegen unter `users/{uid}/data/main`; die UID kommt automatisch aus Firebase
Authentication. Passwörter oder Service-Account-Keys gehören nicht in das
Repository.

## Nutzung

Die veröffentlichte App kann direkt im Browser verwendet werden. Alle neu
eingetragenen Daten werden zunächst lokal gespeichert und bei konfiguriertem
Firebase automatisch synchronisiert. JSON-Export und -Import bleiben als
zusätzliche Backup-Funktion erhalten.

Alternativ kann `index.html` direkt lokal geöffnet werden.
