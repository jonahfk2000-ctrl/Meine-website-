/* =========================================
   Hell/Dunkel-Modus
   - merkt sich deine Wahl im Browser (localStorage)
   - ohne gespeicherte Wahl gilt die Einstellung des Geräts
   ========================================= */
(function () {
  var SCHLUESSEL = 'theme';
  var geraetDunkel = window.matchMedia('(prefers-color-scheme: dark)');

  // Gespeicherte Wahl lesen/schreiben. try/catch, weil das z. B. im
  // privaten Fenster blockiert sein kann – dann klappt der Schalter
  // trotzdem, merkt sich die Wahl aber nicht.
  function gespeichert() {
    try { return localStorage.getItem(SCHLUESSEL); } catch (e) { return null; }
  }
  function speichern(modus) {
    try { localStorage.setItem(SCHLUESSEL, modus); } catch (e) {}
  }

  function setzen(modus) {
    document.documentElement.setAttribute('data-theme', modus);
    var schalter = document.getElementById('theme-schalter');
    if (schalter) schalter.checked = (modus === 'dark');
  }

  // 1. Sofort beim Laden den richtigen Modus setzen
  setzen(gespeichert() || (geraetDunkel.matches ? 'dark' : 'light'));

  // 2. Wenn die Seite fertig ist: Schalter einstellen und auf Klicks hören
  document.addEventListener('DOMContentLoaded', function () {
    var schalter = document.getElementById('theme-schalter');
    schalter.checked = document.documentElement.getAttribute('data-theme') === 'dark';
    schalter.addEventListener('change', function () {
      var modus = schalter.checked ? 'dark' : 'light';
      setzen(modus);
      speichern(modus);
    });
  });

  // 3. Ändert sich die Geräte-Einstellung und du hast nichts gewählt: mitgehen
  geraetDunkel.addEventListener('change', function (e) {
    if (!gespeichert()) setzen(e.matches ? 'dark' : 'light');
  });
})();
