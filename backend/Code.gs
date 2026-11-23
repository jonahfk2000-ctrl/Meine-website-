/**
 * Terminbuchung für die Website von Jonah Köppe
 * ==============================================
 * Dieses Skript läuft bei Google (Google Apps Script) und hängt an einer
 * Google-Tabelle. Es macht zwei Dinge:
 *
 *   doGet  – sagt der Website, welche Termine schon belegt sind
 *            (nur Datum + Uhrzeit, niemals Namen oder E-Mail-Adressen)
 *   doPost – nimmt eine Buchung an, prüft sie, speichert sie in der
 *            Tabelle und verschickt die Bestätigungsmail
 *
 * Einrichtung: siehe README.md, Abschnitt „Terminbuchung einrichten“.
 */

// ===== Einstellungen =====
var ZEITZONE = 'Europe/Berlin';
var BLATT_NAME = 'Buchungen';
var ERSTE_STUNDE = 9;     // erster Termin beginnt um 9 Uhr
var LETZTE_STUNDE = 13;   // letzter Termin beginnt um 13 Uhr (endet 14 Uhr)
var TAGE_VORAUS = 28;     // so weit im Voraus kann man buchen (4 Wochen)
var ABSENDER_NAME = 'Jonah Köppe';
var BENACHRICHTIGUNG_AN_MICH = true;  // bei jeder Buchung eine Mail an dich

var WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];


// ===== Belegte Termine abfragen =====
function doGet() {
  var heute = heuteAlsText();
  var bis = tagePlus(heute, TAGE_VORAUS);
  var belegt = alleBuchungen()
    .filter(function (b) { return b.datum >= heute && b.datum <= bis; })
    .map(function (b) { return schluessel(b.datum, b.stunde); });
  return alsJson({ belegt: belegt });
}


// ===== Termin buchen =====
function doPost(e) {
  var daten;
  try {
    daten = JSON.parse(e.postData.contents);
  } catch (fehler) {
    return alsJson({ ok: false, fehler: 'ungueltig', text: 'Die Anfrage konnte nicht gelesen werden.' });
  }

  var pruefung = pruefen(daten);
  if (pruefung) return alsJson({ ok: false, fehler: 'ungueltig', text: pruefung });

  var datum = daten.datum;
  var stunde = Number(daten.stunde);
  var name = String(daten.name).trim();
  var email = String(daten.email).trim();

  // Sperre: Solange wir prüfen und speichern, kann niemand anderes buchen.
  // So kann ein Termin garantiert nur einmal vergeben werden.
  var sperre = LockService.getScriptLock();
  sperre.waitLock(15000);
  try {
    var schonBelegt = alleBuchungen().some(function (b) {
      return b.datum === datum && b.stunde === stunde;
    });
    if (schonBelegt) {
      return alsJson({ ok: false, fehler: 'belegt', text: 'Dieser Termin ist leider schon vergeben.' });
    }
    // Das ' davor sorgt dafür, dass Google Sheets alles als reinen Text speichert
    blatt().appendRow([new Date(), "'" + datum, stunde, "'" + name, "'" + email]);
    SpreadsheetApp.flush();
  } finally {
    sperre.releaseLock();
  }

  mailsVerschicken(datum, stunde, name, email);
  return alsJson({ ok: true });
}


// ===== Eingaben prüfen (gibt einen Fehlertext zurück oder null) =====
function pruefen(d) {
  if (!d || typeof d !== 'object') return 'Die Anfrage ist leer.';
  if (d.webseite) return 'Die Anfrage wurde abgelehnt.';   // verstecktes Feld gegen Bots

  var name = String(d.name || '').trim();
  var email = String(d.email || '').trim();
  if (name.length < 1 || name.length > 100) return 'Bitte gib einen Namen an (höchstens 100 Zeichen).';
  if (email.length > 200 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Bitte gib eine gültige E-Mail-Adresse an.';

  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(d.datum || ''))) return 'Das Datum ist ungültig.';
  var stunde = Number(d.stunde);
  if (!(stunde % 1 === 0) || stunde < ERSTE_STUNDE || stunde > LETZTE_STUNDE) return 'Diese Uhrzeit kann man nicht buchen.';

  var wochentag = new Date(d.datum + 'T12:00:00Z').getUTCDay();
  if (isNaN(wochentag) || wochentag === 0 || wochentag === 6) return 'Termine gibt es nur von Montag bis Freitag.';

  var jetzt = Utilities.formatDate(new Date(), ZEITZONE, "yyyy-MM-dd'T'HH");
  if (schluessel(d.datum, stunde) <= jetzt) return 'Dieser Termin liegt in der Vergangenheit.';
  if (d.datum > tagePlus(heuteAlsText(), TAGE_VORAUS)) return 'So weit im Voraus kann man noch nicht buchen.';

  return null;
}


// ===== Mails =====
function mailsVerschicken(datum, stunde, name, email) {
  var termin = terminText(datum, stunde);

  MailApp.sendEmail({
    to: email,
    name: ABSENDER_NAME,
    subject: 'Terminbestätigung: ' + termin,
    body:
      'Hallo ' + name + ',\n\n' +
      'dein Termin ist gebucht:\n\n' +
      '    ' + termin + '\n\n' +
      'Ich freue mich auf dich!\n\n' +
      'Viele Grüße\n' + ABSENDER_NAME + '\n\n' +
      '—\nDiese Mail wurde automatisch verschickt.'
  });

  if (BENACHRICHTIGUNG_AN_MICH) {
    var ich = Session.getEffectiveUser().getEmail();
    if (ich) {
      MailApp.sendEmail({
        to: ich,
        subject: 'Neue Buchung: ' + termin,
        body: 'Neue Buchung über deine Website:\n\n' +
              'Termin: ' + termin + '\nName:   ' + name + '\nE-Mail: ' + email
      });
    }
  }
}


// ===== Hilfsfunktionen =====
function blatt() {
  var tabelle = SpreadsheetApp.getActiveSpreadsheet();
  var b = tabelle.getSheetByName(BLATT_NAME);
  if (!b) {
    b = tabelle.insertSheet(BLATT_NAME);
  }
  if (b.getLastRow() === 0) {
    b.appendRow(['Gebucht am', 'Datum', 'Uhrzeit', 'Name', 'E-Mail']);
  }
  return b;
}

// Liest alle Buchungen als Liste von { datum: 'YYYY-MM-DD', stunde: 9 }
function alleBuchungen() {
  var werte = blatt().getDataRange().getValues();
  var liste = [];
  for (var i = 1; i < werte.length; i++) {   // Zeile 0 = Überschriften
    var datum = werte[i][1];
    if (datum instanceof Date) datum = Utilities.formatDate(datum, ZEITZONE, 'yyyy-MM-dd');
    datum = String(datum).replace(/^'/, '');
    var stunde = Number(werte[i][2]);
    if (/^\d{4}-\d{2}-\d{2}$/.test(datum) && stunde) liste.push({ datum: datum, stunde: stunde });
  }
  return liste;
}

function heuteAlsText() {
  return Utilities.formatDate(new Date(), ZEITZONE, 'yyyy-MM-dd');
}

function tagePlus(datum, tage) {
  var d = new Date(datum + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function schluessel(datum, stunde) {
  return datum + 'T' + (stunde < 10 ? '0' : '') + stunde;
}

// z. B. „Dienstag, 24.11.2026, 10:00–11:00 Uhr“
function terminText(datum, stunde) {
  var t = datum.split('-');
  var wochentag = WOCHENTAGE[new Date(datum + 'T12:00:00Z').getUTCDay()];
  return wochentag + ', ' + t[2] + '.' + t[1] + '.' + t[0] + ', ' +
         stunde + ':00–' + (stunde + 1) + ':00 Uhr';
}

function alsJson(objekt) {
  return ContentService.createTextOutput(JSON.stringify(objekt))
    .setMimeType(ContentService.MimeType.JSON);
}
