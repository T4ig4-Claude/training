# Trainings-Tracker – Anleitung

## Was ist in diesem Ordner?

| Datei | Wofür |
|---|---|
| `index.html` | Aufbau der Seiten (Startbildschirm, Übung, Körpergewicht, Einstellungen) |
| `style.css` | Aussehen (dunkles Design, große Buttons) |
| `app.js` | Die ganze Logik: Speichern, Diagramme, Export/Import |
| `manifest.json` | Name und Icon, damit man die App installieren kann |
| `sw.js` | „Service Worker“: sorgt dafür, dass die App offline läuft |
| `icons/` | App-Icons (Hantel) |

**Kurz ausprobieren am PC:** Doppelklick auf `index.html` öffnet die App im Browser.
(Offline-Modus und Installieren gehen erst, wenn sie online ist, siehe unten.)

---

## Schritt 1: Kostenlos online stellen mit GitHub Pages

Du brauchst dafür kein Programm und keine Kommandozeile, nur den Browser am PC.

1. **Konto anlegen:** Auf <https://github.com/signup> ein kostenloses Konto erstellen.
   Dein Benutzername steckt später in der Adresse der App.
2. **Neues Projekt („Repository“) anlegen:**
   Oben rechts auf **+** und dann **New repository** klicken.
   - *Repository name:* `training`
   - **Public** auswählen (GitHub Pages ist für öffentliche Projekte kostenlos.
     Öffentlich ist nur der Programmcode, **deine Trainingsdaten nicht**, die bleiben auf deinem Handy.)
   - Auf **Create repository** klicken.
3. **Dateien hochladen:**
   Auf der neuen Seite den Link **„uploading an existing file“** anklicken.
   Dann im Windows-Explorer den Ordner `trainings-tracker` öffnen, **alle Dateien und den Ordner `icons`**
   markieren (Strg + A) und ins Browserfenster ziehen.
   Danach unten auf **Commit changes** klicken.
   Prüfe danach, ob in der Liste auch der Ordner `icons` auftaucht.
4. **Website einschalten:**
   Im Projekt oben auf **Settings**, links auf **Pages** klicken.
   Unter *Build and deployment*: *Source* = **Deploy from a branch**, *Branch* = **main** und **/ (root)**, dann **Save**.
5. **1–2 Minuten warten** und die Seite neu laden. Oben steht dann:
   *„Your site is live at `https://DEIN-NAME.github.io/training/`“*
   Das ist die Adresse deiner App.

> **Wichtig:** Lass Adresse und Projektnamen danach gleich. Die Daten sind an die Adresse gebunden.
> Unter einer neuen Adresse wäre die App leer (dann hilft ein Backup-Import).

---

## Schritt 2: Auf dem Handy zum Startbildschirm hinzufügen

### Android (Chrome)
1. Die Adresse `https://DEIN-NAME.github.io/training/` in **Chrome** öffnen.
2. Oben rechts auf **⋮** tippen und dann **„App installieren“** oder **„Zum Startbildschirm hinzufügen“** wählen.
3. Bestätigen. Das Hantel-Icon liegt jetzt auf dem Startbildschirm.

### iPhone (Safari)
1. Die Adresse in **Safari** öffnen (nicht in Chrome, das klappt auf dem iPhone nur mit Safari).
2. Unten auf das **Teilen-Symbol** tippen (Quadrat mit Pfeil nach oben).
3. Runterscrollen und **„Zum Home-Bildschirm“** wählen, dann **Hinzufügen**.

### Offline testen
App einmal öffnen, schließen, Flugmodus an, App wieder öffnen. Sie sollte ganz normal starten.

---

## So benutzt du die App

- **Übung antippen**: Gewicht und Wiederholungen sind schon mit den Werten vom letzten Mal ausgefüllt.
  Meistens reicht ein Tipp auf **Satz speichern**.
  - Erster Satz des Tages: Werte vom ersten Satz des letzten Trainings
  - Weitere Sätze: Werte vom letzten Satz heute
- **− / +** ändert das Gewicht in 2,5-kg-Schritten. Du kannst die Zahl auch antippen und direkt eintippen.
- **Falsch eingetragen?** Den Satz (die „Pille“ mit z. B. `60 × 10`) antippen, dann wird er nach einer Rückfrage gelöscht.
- **Übungen hinzufügen/löschen:** Auf dem Startbildschirm auf **Bearbeiten** tippen.
- **Körpergewicht:** in 0,1-kg-Schritten. Pro Tag gibt es einen Wert, ein zweites Speichern überschreibt ihn.
  Über das Datumsfeld kannst du vergessene Tage nachtragen.
- **Erinnerung zum Wiegen:** Auf der Körpergewicht-Seite Uhrzeit wählen und auf **In Kalender eintragen** tippen.
  Die Datei öffnen, dann trägt das Handy einen täglichen Termin mit Erinnerung ein.
  (Ohne Server kann eine Web-App keine eigenen Erinnerungen schicken. Der Kalender ist der zuverlässige Weg.
  Ein normaler Handy-Wecker geht natürlich auch.)
- **Fortschrittsbalken 100 kg:** Unter ⚙ Einstellungen kannst du wählen, ob er am **schwersten Satz**
  oder am **geschätzten 1RM** (Epley: Gewicht × (1 + Wdh/30)) gemessen wird.

---

## Backup (wichtig!)

Die Daten liegen **nur auf deinem Handy**. Sie gehen verloren, wenn du die Browserdaten löschst,
die App vom Startbildschirm entfernst (iPhone) oder das Handy wechselst.

- ⚙ → **Backup exportieren (JSON)** → Datei z. B. in Google Drive speichern. Etwa einmal im Monat.
  Die App erinnert dich auf dem Startbildschirm, wenn das letzte Backup über 30 Tage her ist.
- **Backup importieren** lädt so eine Datei wieder (z. B. auf einem neuen Handy).
- **CSV exportieren** ist zum Anschauen in Excel/Google Sheets gedacht (nicht zum Wieder-Importieren).

---

## Die App später ändern

1. Datei hier im Ordner ändern (oder Claude Code bitten, sie zu ändern).
2. Auf GitHub im Projekt **Add file → Upload files**, die geänderten Dateien hineinziehen, **Commit changes**.
3. Auf dem Handy die App **zweimal** öffnen. Beim ersten Öffnen lädt sie die neue Version im Hintergrund,
   beim zweiten Öffnen ist sie da. Deine Daten bleiben dabei erhalten.

---

## Alternative: Netlify

1. Auf <https://app.netlify.com/drop> gehen und den ganzen Ordner `trainings-tracker` ins Fenster ziehen.
2. Netlify zeigt sofort eine Adresse an. Damit sie dauerhaft bleibt, musst du ein kostenloses Konto anlegen
   und die Seite übernehmen („claim“).

GitHub Pages ist für dich wahrscheinlich einfacher, weil Updates per Hochladen gehen und die Adresse fest bleibt.
