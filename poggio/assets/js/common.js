/* Poggio Open Cup — utilità condivise (sito pubblico + back office) */
(function () {
  'use strict';

  // Tema chiaro/scuro (ricordato nel browser)
  function getTheme() {
    try { return localStorage.getItem('poc-theme') || 'light'; } catch (e) { return 'light'; }
  }
  function setTheme(t) {
    document.documentElement.setAttribute('data-theme', t);
    try { localStorage.setItem('poc-theme', t); } catch (e) { /* ignora */ }
  }
  setTheme(getTheme());

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /** Stemma squadra: logo caricato oppure scudetto colorato con la lettera. */
  function crest(team, cls) {
    cls = cls || '';
    if (!team) return '<span class="crest ' + cls + '"></span>';
    if (team.logo_url) {
      return '<img class="crest ' + cls + '" src="' + esc(team.logo_url) + '" alt="" loading="lazy">';
    }
    var words = String(team.name || '?').trim().split(/\s+/);
    var letter = esc((words[words.length - 1] || '?').charAt(0).toUpperCase());
    var color = /^#[0-9a-f]{6}$/i.test(team.color || '') ? team.color : '#1d2fe0';
    return '<svg class="crest ' + cls + '" viewBox="0 0 24 26" aria-hidden="true">' +
      '<path d="M12 1.5 21.5 5v8c0 5.4-4 9.2-9.5 11C6.5 22.2 2.5 18.4 2.5 13V5z" fill="' + color + '"/>' +
      '<text x="12" y="16.5" text-anchor="middle" font-family="Archivo Black,Arial,sans-serif" font-size="10" fill="#fff">' + letter + '</text></svg>';
  }

  var TZ = 'Europe/Rome';
  function fmtDay(iso) {
    var d = new Date(iso);
    var day = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, day: '2-digit' }).format(d);
    var mon = new Intl.DateTimeFormat('it-IT', { timeZone: TZ, month: 'short' }).format(d).replace('.', '');
    return day + ' ' + mon.toUpperCase();
  }
  function fmtTime(iso) {
    return new Intl.DateTimeFormat('it-IT', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
  }
  /** Ritorna {date:'YYYY-MM-DD', time:'HH:MM'} nel fuso di Roma, per i campi del form. */
  function toInputs(iso) {
    var p = {};
    new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false
    }).formatToParts(new Date(iso)).forEach(function (x) { p[x.type] = x.value; });
    return { date: p.year + '-' + p.month + '-' + p.day, time: (p.hour === '24' ? '00' : p.hour) + ':' + p.minute };
  }

  /** fetch JSON con gestione errori. */
  function request(method, url, body, csrf) {
    var opts = { method: method, credentials: 'same-origin', headers: { 'Accept': 'application/json' } };
    if (body !== undefined) {
      opts.headers['Content-Type'] = 'application/json';
      opts.body = JSON.stringify(body);
    }
    if (csrf) opts.headers['X-CSRF-Token'] = csrf;
    return fetch(url, opts).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) {
          var e = new Error(j.error || 'Errore di rete (' + r.status + ')');
          e.status = r.status;
          throw e;
        }
        return j;
      });
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    // Logo: usa assets/img/logo.png se presente, altrimenti il segnaposto SVG
    document.querySelectorAll('img[data-logo]').forEach(function (img) {
      img.addEventListener('error', function () {
        if (img.dataset.fb) return;
        img.dataset.fb = '1';
        img.src = 'assets/img/logo.svg';
      });
      img.src = 'assets/img/logo.png';
    });
    var t = document.getElementById('theme-toggle');
    if (t) t.addEventListener('click', function () {
      setTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  });

  window.POC = { esc: esc, crest: crest, fmtDay: fmtDay, fmtTime: fmtTime, toInputs: toInputs, request: request };
})();
