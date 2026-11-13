# Lisas Trainings-App 💗

Eine kleine, ruhige Trainings-App für Nacken, Schultern und oberen Rücken. Offline nutzbar, ohne Konto, ohne Server.
Alle Daten bleiben auf dem Handy.

**So funktioniert sie:** Lisa sagt, wie es ihrem Nacken geht und wie viel Zeit sie hat (10, 15 oder 20 Minuten). Die App stellt das Training zusammen und steigert sich behutsam anhand ihrer Rückmeldung.

## Installation auf dem iPhone (für Lisa)

1. **Safari** öffnen (nicht Chrome!) und den Link zur App aufrufen: `https://xiting0815.github.io/Lisas-Trainingsapp/`
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. Nach unten scrollen und **„Zum Home-Bildschirm“** wählen, dann **„Hinzufügen“**.
4. Ab jetzt startet die App wie jede andere App vom Home-Bildschirm – auch ohne Internet.

Die App zeigt diese Anleitung mit Bildern auch selbst (Einstellungen → „App installieren“).

**Erinnerungen:** Einstellungen → Erinnerung → „In Kalender eintragen“. Die Datei öffnen und „Hinzufügen“ tippen, dann erinnert die iPhone-Kalender-App an die Trainings.

**Kein Ton?** Lautlos-Schalter seitlich am iPhone und Lautstärke prüfen.

**Datensicherung:** Einstellungen → „Daten sichern“ (alle 2 Wochen erinnert die App daran).

## Entwicklung

Vanilla JS mit ES-Modulen, kein Build.

```
npm test                      # alle Tests (Logik, Daten, E2E im iPhone-Viewport)
npm start                     # lokaler Server (Pfad / → http://localhost:8000)
node tools/gen-precache.mjs   # nach jeder Änderung an Dateien: Service-Worker-Precache neu erzeugen
node tools/gen-precache.mjs --check
```

Konzept, Datenformat und Logik: [docs/SPEC.md](docs/SPEC.md).
Hinweis: Die App ersetzt keinen ärztlichen Rat. Warnzeichen stehen in der App unter „Info“.
