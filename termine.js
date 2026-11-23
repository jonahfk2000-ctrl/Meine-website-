/* =========================================
   Terminbuchung
   Zeigt einen Wochenkalender (Mo–Fr, 9–14 Uhr) und schickt
   Buchungen an das Google-Apps-Script (siehe backend/Code.gs).
   ========================================= */

// Hier kommt die Web-App-URL deines Google-Apps-Scripts hinein.
// Solange sie leer ist, zeigt die Seite „wird gerade eingerichtet“.
const SKRIPT_URL = "";

const ERSTE_STUNDE = 9;    // erster Termin 9–10 Uhr
const LETZTE_STUNDE = 13;  // letzter Termin 13–14 Uhr
const TAGE_VORAUS = 28;    // 4 Wochen
const ZEITZONE = "Europe/Berlin";

const TAGE_KURZ = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];
const TAGE_LANG = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];

let belegt = new Set();  // z. B. "2026-11-24T09"
let woche = 0;           // 0 = diese Woche, 1 = nächste, …
let gewaehlt = null;     // { datum, stunde }

// ----- Datum-Helfer (alles in deutscher Zeit) -----
function jetztInBerlin() {
  const teile = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZEITZONE, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", hourCycle: "h23"
  }).formatToParts(new Date());
  const t = Object.fromEntries(teile.map(p => [p.type, p.value]));
  return { datum: `${t.year}-${t.month}-${t.day}`, stunde: Number(t.hour) };
}

function tagePlus(datum, tage) {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

function wochentag(datum) {
  return new Date(datum + "T12:00:00Z").getUTCDay();
}

function schluessel(datum, stunde) {
  return `${datum}T${String(stunde).padStart(2, "0")}`;
}

function kurzDatum(datum) {
  const [, m, d] = datum.split("-");
  return `${d}.${m}.`;
}

function terminText(datum, stunde) {
  const [j, m, d] = datum.split("-");
  return `${TAGE_LANG[wochentag(datum)]}, ${d}.${m}.${j}, ${stunde}:00–${stunde + 1}:00 Uhr`;
}

// Montag der Woche, in der „heute“ liegt
function montagDieserWoche() {
  const heute = jetztInBerlin().datum;
  const wt = wochentag(heute);
  return tagePlus(heute, wt === 0 ? -6 : 1 - wt);
}

function letzteWoche() {
  const bis = tagePlus(jetztInBerlin().datum, TAGE_VORAUS);
  let w = 0;
  while (tagePlus(montagDieserWoche(), (w + 1) * 7) <= bis) w++;
  return w;
}

// ----- Kalender zeichnen -----
function zeichnen() {
  const raster = document.getElementById("kalender-raster");
  const montag = tagePlus(montagDieserWoche(), woche * 7);
  const freitag = tagePlus(montag, 4);
  const jetzt = jetztInBerlin();
  const bis = tagePlus(jetzt.datum, TAGE_VORAUS);
  const eingerichtet = SKRIPT_URL !== "";

  document.getElementById("kalender-woche").textContent =
    `${kurzDatum(montag)} – ${kurzDatum(freitag)}${freitag.slice(0, 4)}`;
  document.getElementById("woche-zurueck").disabled = woche === 0;
  document.getElementById("woche-vor").disabled = woche >= letzteWoche();

  raster.innerHTML = "";
  raster.appendChild(document.createElement("div")); // leere Ecke oben links

  const tage = [0, 1, 2, 3, 4].map(i => tagePlus(montag, i));
  for (const tag of tage) {
    const kopf = document.createElement("div");
    kopf.className = "kalender-tag";
    kopf.innerHTML = `<strong>${TAGE_KURZ[wochentag(tag)]}</strong><span>${kurzDatum(tag)}</span>`;
    raster.appendChild(kopf);
  }

  for (let stunde = ERSTE_STUNDE; stunde <= LETZTE_STUNDE; stunde++) {
    const zeit = document.createElement("div");
    zeit.className = "kalender-zeit";
    zeit.textContent = `${stunde}:00`;
    raster.appendChild(zeit);

    for (const tag of tage) {
      const knopf = document.createElement("button");
      knopf.type = "button";
      knopf.className = "termin";
      const key = schluessel(tag, stunde);
      const vorbei = key <= schluessel(jetzt.datum, jetzt.stunde) || tag > bis;

      if (vorbei) {
        knopf.classList.add("vorbei");
        knopf.disabled = true;
        knopf.textContent = "–";
        knopf.setAttribute("aria-label", `${terminText(tag, stunde)}: nicht verfügbar`);
      } else if (belegt.has(key)) {
        knopf.classList.add("belegt");
        knopf.disabled = true;
        knopf.textContent = "belegt";
        knopf.setAttribute("aria-label", `${terminText(tag, stunde)}: belegt`);
      } else {
        knopf.classList.add("frei");
        knopf.disabled = !eingerichtet;
        knopf.textContent = "frei";
        knopf.setAttribute("aria-label", `${terminText(tag, stunde)}: frei – buchen`);
        knopf.addEventListener("click", () => fensterOeffnen(tag, stunde));
      }
      raster.appendChild(knopf);
    }
  }
}

function hinweis(text, art) {
  const el = document.getElementById("kalender-hinweis");
  el.textContent = text || "";
  el.className = "kalender-hinweis" + (art ? " " + art : "");
  el.hidden = !text;
}

// ----- Belegte Termine laden -----
async function laden() {
  if (!SKRIPT_URL) {
    hinweis("Die Terminbuchung wird gerade eingerichtet – bald kannst du hier buchen.", "info");
    zeichnen();
    return;
  }
  hinweis("Lade Termine …", "info");
  try {
    const antwort = await fetch(SKRIPT_URL);
    const daten = await antwort.json();
    belegt = new Set(daten.belegt || []);
    hinweis("");
  } catch (e) {
    hinweis("Die Termine konnten gerade nicht geladen werden. Bitte versuche es später noch einmal.", "fehler");
  }
  zeichnen();
}

// ----- Buchungsfenster -----
function fensterOeffnen(datum, stunde) {
  gewaehlt = { datum, stunde };
  const fenster = document.getElementById("termin-fenster");
  const formular = document.getElementById("termin-formular");
  formular.reset();
  formular.hidden = false;
  document.getElementById("termin-erfolg").hidden = true;
  document.getElementById("termin-meldung").hidden = true;
  document.getElementById("termin-gewaehlt").textContent = terminText(datum, stunde);
  fenster.showPopover();
  document.getElementById("termin-name").focus();
}

function meldung(text) {
  const el = document.getElementById("termin-meldung");
  el.textContent = text;
  el.hidden = false;
}

async function buchen(ereignis) {
  ereignis.preventDefault();
  const formular = ereignis.target;
  const knopf = formular.querySelector("button[type=submit]");
  const felder = formular.elements;
  const daten = {
    datum: gewaehlt.datum,
    stunde: gewaehlt.stunde,
    name: felder.namedItem("name").value.trim(),
    email: felder.namedItem("email").value.trim(),
    webseite: felder.namedItem("webseite").value   // verstecktes Feld gegen Bots
  };

  knopf.disabled = true;
  knopf.textContent = "Wird gebucht …";
  try {
    // als text/plain, damit Google die Anfrage ohne Umwege annimmt
    const antwort = await fetch(SKRIPT_URL, { method: "POST", body: JSON.stringify(daten) });
    const ergebnis = await antwort.json();

    if (ergebnis.ok) {
      formular.hidden = true;
      document.getElementById("termin-erfolg-text").textContent =
        `${terminText(daten.datum, daten.stunde)} – eine Bestätigung ist an ${daten.email} unterwegs.`;
      document.getElementById("termin-erfolg").hidden = false;
      belegt.add(schluessel(daten.datum, daten.stunde));
      zeichnen();
    } else if (ergebnis.fehler === "belegt") {
      meldung("Dieser Termin wurde gerade vergeben – bitte wähle einen anderen.");
      laden();
    } else {
      meldung(ergebnis.text || "Die Buchung hat nicht geklappt. Bitte prüfe deine Angaben.");
    }
  } catch (e) {
    meldung("Die Buchung konnte nicht gesendet werden. Bitte versuche es später noch einmal.");
  } finally {
    knopf.disabled = false;
    knopf.textContent = "Termin buchen";
  }
}

// ----- Start -----
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("woche-zurueck").addEventListener("click", () => { woche--; zeichnen(); });
  document.getElementById("woche-vor").addEventListener("click", () => { woche++; zeichnen(); });
  document.getElementById("termin-formular").addEventListener("submit", buchen);
  laden();
});
