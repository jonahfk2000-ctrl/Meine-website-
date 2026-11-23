# Meine-website-

Persönliche Website von Jonah Köppe – HTML und CSS, veröffentlicht über GitHub Pages.

- `index.html` – Inhalt der Seite (Über mich, Meine Hobbys, Termine)
- `style.css` – Design im Farbkonzept „Wald & Erde“ (Farben für Hell und Dunkel stehen ganz oben)
- `theme.js` – Schalter für Hell/Dunkel; merkt sich die Wahl im Browser
- `termine.js` – Kalender und Buchungsformular
- `backend/Code.gs` – Google-Apps-Script für die Terminbuchung (läuft bei Google, nicht auf GitHub)
- `bilder/` – Fotos der Hobbys

## Terminbuchung einrichten

GitHub Pages kann nichts speichern und keine Mails verschicken. Das übernimmt ein
kostenloses Google-Apps-Script: Buchungen landen in einer Google-Tabelle, die
Bestätigungsmail geht von deinem Gmail-Konto raus.

1. **Tabelle anlegen:** Auf [sheets.google.com](https://sheets.google.com) eine neue, leere Tabelle
   erstellen (z. B. „Terminbuchungen“). Das Blatt „Buchungen“ legt das Skript selbst an.
2. **Skript einfügen:** In der Tabelle **Erweiterungen → Apps Script** öffnen. Den vorhandenen
   Inhalt löschen, den kompletten Inhalt von `backend/Code.gs` einfügen und speichern (💾).
3. **Als Web-App bereitstellen:** Oben rechts **Bereitstellen → Neue Bereitstellung**.
   Beim Zahnrad **Web-App** wählen und einstellen:
   - Ausführen als: **Ich**
   - Zugriff: **Jeder**

   Auf **Bereitstellen** klicken und Google den Zugriff erlauben. Google warnt dabei,
   dass die App „nicht überprüft“ ist – das ist bei eigenen Skripten normal:
   **Erweitert → Zu … wechseln (unsicher) → Zulassen**.
4. **URL eintragen:** Die angezeigte **Web-App-URL** (endet auf `/exec`) kopieren und in
   `termine.js` ganz oben bei `const SKRIPT_URL = "";` zwischen die Anführungszeichen einfügen.
5. **Testen:** Auf der Website einen Termin buchen. Die Buchung erscheint in der Tabelle,
   und die Bestätigungsmail kommt an.

**Später etwas am Skript ändern?** Nach dem Speichern **Bereitstellen → Bereitstellungen verwalten →
✏️ → Version: Neue Version → Bereitstellen**. So bleibt die URL gleich.

**Termin absagen?** Einfach die Zeile in der Tabelle löschen – dann ist der Termin wieder frei.

**Einstellungen** (Uhrzeiten, Vorlauf, Benachrichtigung an dich) stehen oben in `backend/Code.gs`.
Werden Uhrzeiten oder Vorlauf geändert, müssen sie auch oben in `termine.js` angepasst werden.
