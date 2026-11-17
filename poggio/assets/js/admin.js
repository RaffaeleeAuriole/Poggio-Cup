/* Poggio Open Cup — back office */
(function () {
  'use strict';
  var esc = POC.esc, crest = POC.crest;
  var ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante', 'Jolly'];
  var ENDPOINT = 'api/admin.php';

  var state = { user: null, csrf: null, data: null, view: 'home', filterTeam: 0, search: '', statSearch: '' };
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var viewEl, modal, toastEl, toastTimer;

  /* ------------------------------ utilità ------------------------------ */
  function toast(msg, isErr) {
    toastEl.textContent = msg;
    toastEl.className = 'toast' + (isErr ? ' err' : '');
    toastEl.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.hidden = true; }, 3200);
  }
  function api(method, url, body) {
    return POC.request(method, url, body, state.csrf).catch(function (e) {
      if (e.status === 401) { state.user = null; render(); }
      throw e;
    });
  }
  function teamMap() {
    var m = {};
    state.data.teams.forEach(function (t) { m[t.id] = t; });
    return m;
  }
  function loadData() {
    return api('GET', ENDPOINT).then(function (d) { state.data = d; });
  }
  function rolesLabel(r) { return r === 'superadmin' ? 'Superadmin' : 'Admin'; }

  /* ------------------------------ login ------------------------------ */
  function renderLogin() {
    $('#admin-nav').hidden = true;
    $('#whoami').hidden = true;
    viewEl.innerHTML =
      '<section class="card login-card"><img data-logo class="login-logo" alt="" width="44" height="44">' +
      '<h1 class="h-display h-page">Back office</h1>' +
      '<p class="muted">Accedi con username e codice permanente per gestire giocatori, squadre, partite e statistiche.</p>' +
      '<form id="login-form" class="form" autocomplete="on">' +
      '<label>Username<input name="username" type="text" placeholder="Username" autocomplete="username" required></label>' +
      '<label>Codice di accesso<input name="code" type="password" placeholder="Codice di accesso" autocomplete="current-password" required></label>' +
      '<p class="notice err" id="login-err" hidden></p>' +
      '<button class="btn btn-primary" type="submit">Accedi</button></form></section>';
    viewEl.querySelectorAll('img[data-logo]').forEach(function (i) { i.src = 'assets/img/logo.png'; i.onerror = function () { i.onerror = null; i.src = 'assets/img/logo.svg'; }; });
    $('#login-form').addEventListener('submit', function (e) {
      e.preventDefault();
      var f = e.target, btn = f.querySelector('button'), err = $('#login-err');
      err.hidden = true; btn.disabled = true;
      POC.request('POST', 'api/auth.php?action=login', { username: f.username.value, code: f.code.value })
        .then(function (r) { state.user = r.user; state.csrf = r.csrf; state.view = 'home'; return loadData(); })
        .then(render)
        .catch(function (ex) { err.textContent = ex.message; err.hidden = false; })
        .then(function () { btn.disabled = false; });
    });
  }

  /* ------------------------------ viste ------------------------------ */
  function actionRow(id, icon, title, sub) {
    return '<button type="button" class="card action" data-act="' + id + '"><span class="ico">' + icon + '</span>' +
      '<span><strong>' + esc(title) + '</strong><small>' + esc(sub) + '</small></span></button>';
  }

  function viewHome() {
    var d = state.data;
    var played = d.matches.filter(function (m) { return m.home_goals !== null; });
    var goals = played.reduce(function (s, m) { return s + m.home_goals + m.away_goals; }, 0);
    return '<h1 class="h-display h-page">Panoramica</h1>' +
      '<div class="kpis">' +
      kpi(d.teams.length, 'Squadre') + kpi(d.players.length, 'Giocatori') +
      kpi(played.length, 'Partite giocate') + kpi(goals, 'Gol segnati') + '</div>' +
      '<div class="stack">' +
      actionRow('player', '+', 'Inserisci giocatore', 'Aggiungi un giocatore a mano') +
      actionRow('team', '⚑', 'Nuova squadra o logo', 'Nome, colore e logo della squadra') +
      actionRow('match', '⚽', 'Inserisci partita o risultato', 'Data, ora e punteggio') +
      actionRow('stats', '↗', 'Modifica statistiche', 'Gol, assist, MVP, cartellini') +
      '</div>';
  }
  function kpi(n, label) { return '<div class="card kpi"><b>' + n + '</b><span>' + label + '</span></div>'; }

  function viewTeams() {
    var d = state.data, counts = {};
    d.players.forEach(function (p) { counts[p.team_id] = (counts[p.team_id] || 0) + 1; });
    return head('Squadre', '+ Squadra', 'team') +
      '<div class="stack">' + (d.teams.length ? d.teams.map(function (t) {
        var n = counts[t.id] || 0;
        return '<div class="card row">' + crest(t, 'lg') +
          '<div class="grow"><strong>' + esc(t.name) + '</strong><small>' + n + (n === 1 ? ' giocatore' : ' giocatori') + '</small></div>' +
          '<button type="button" class="btn btn-ghost sm" data-edit="team" data-id="' + t.id + '">Modifica</button></div>';
      }).join('') : '<p class="empty">Nessuna squadra. Creane una!</p>') + '</div>';
  }

  function head(title, btn, act) {
    return '<div class="head-row"><h1 class="h-display h-page">' + title + '</h1>' +
      '<button type="button" class="btn btn-primary sm" data-act="' + act + '">' + btn + '</button></div>';
  }

  function teamChips() {
    return '<div class="pills">' + [{ id: 0, name: 'Tutte' }].concat(state.data.teams).map(function (t) {
      return '<button type="button" class="pill' + (state.filterTeam === t.id ? ' on' : '') + '" data-team="' + t.id + '">' + esc(t.name) + '</button>';
    }).join('') + '</div>';
  }

  function playerList() {
    var tm = teamMap(), q = state.search.toLowerCase();
    var list = state.data.players.filter(function (p) {
      return (!state.filterTeam || p.team_id === state.filterTeam) &&
        (!q || (p.first_name + ' ' + p.last_name).toLowerCase().indexOf(q) !== -1);
    });
    if (!list.length) return '<p class="empty">Nessun giocatore trovato.</p>';
    return list.map(function (p, i) {
      var t = tm[p.team_id];
      return '<div class="card row"><span class="rk">' + (p.number != null ? p.number : i + 1) + '</span>' +
        '<div class="grow"><strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong>' +
        '<small><span class="tag">' + esc(t ? t.name : '—') + '</span> ' + esc(p.role) + '</small></div>' +
        '<button type="button" class="btn btn-ghost sm" data-edit="player" data-id="' + p.id + '">Modifica</button></div>';
    }).join('');
  }

  function viewPlayers() {
    return head('Giocatori', '+ Giocatore', 'player') +
      '<input id="search" class="search" type="search" placeholder="Cerca giocatore" value="' + esc(state.search) + '" aria-label="Cerca giocatore">' +
      teamChips() + '<div class="stack" id="plist">' + playerList() + '</div>';
  }

  function viewMatches() {
    var tm = teamMap();
    return head('Partite', '+ Partita', 'match') + '<div class="stack">' + (state.data.matches.length ? state.data.matches.map(function (m) {
      var h = tm[m.home_team_id], a = tm[m.away_team_id], played = m.home_goals !== null;
      return '<article class="card match' + (played ? ' played' : '') + '"><div class="match-meta"><span>' +
        POC.fmtDay(m.match_date) + ' · ' + POC.fmtTime(m.match_date) + '</span>' + (m.matchday ? '<span>Giornata ' + m.matchday + '</span>' : '') + '</div>' +
        '<div class="match-body"><div class="side">' + crest(h) + '<span class="tname">' + esc(h ? h.name : '—') + '</span></div>' +
        '<div class="score">' + (played ? m.home_goals + '<i>:</i>' + m.away_goals : '<i>:</i>') + '</div>' +
        '<div class="side">' + crest(a) + '<span class="tname">' + esc(a ? a.name : '—') + '</span></div></div>' +
        adminScorers(m, tm) +
        '<button type="button" class="btn btn-ghost sm" data-edit="match" data-id="' + m.id + '">Modifica partita</button></article>';
    }).join('') : '<p class="empty">Nessuna partita in calendario.</p>') + '</div>';
  }

  function adminScorers(m, tm) {
    var gs = state.data.goals.filter(function (g) { return g.match_id === m.id; });
    if (!gs.length) return '';
    var pl = {}; state.data.players.forEach(function (p) { pl[p.id] = p; });
    return '<p class="adm-scorers">⚽ ' + gs.map(function (g) {
      var p = pl[g.player_id]; if (!p) return '';
      return esc(p.last_name) + (g.own_goal ? ' (aut.)' : '') + (g.minute != null ? ' ' + g.minute + '’' : '');
    }).join(', ') + '</p>';
  }

  var STAT_FIELDS = [['assists', 'Assist'], ['mvp', 'MVP'], ['yellow_cards', 'Cartellini']];

  function viewStats() {
    var tm = teamMap(), q = state.statSearch.toLowerCase();
    var list = state.data.players.filter(function (p) {
      return !q || (p.first_name + ' ' + p.last_name).toLowerCase().indexOf(q) !== -1;
    });
    return '<h1 class="h-display h-page">Statistiche</h1><p class="muted">Tocca + e − per correggere i valori. I gol si calcolano dai marcatori inseriti nelle partite.</p>' +
      '<input id="stat-search" class="search" type="search" placeholder="Cerca giocatore" value="' + esc(state.statSearch) + '" aria-label="Cerca giocatore">' +
      '<div class="stack">' + (list.length ? list.map(function (p) {
        var t = tm[p.team_id];
        var fields = STAT_FIELDS.slice();
        if (p.role === 'Portiere') fields.push(['clean_sheets', 'Porte inv.']);
        return '<div class="card stat-card"><strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong><small>' + esc(t ? t.name : '') + '</small>' +
          '<div class="steppers">' + fields.map(function (f) {
            return '<div class="stepper" data-pid="' + p.id + '" data-field="' + f[0] + '"><span class="lbl">' + f[1] + '</span>' +
              '<div class="ctl"><button type="button" data-d="-1" aria-label="Diminuisci ' + f[1] + '">−</button><output>' + p[f[0]] + '</output>' +
              '<button type="button" data-d="1" aria-label="Aumenta ' + f[1] + '">+</button></div></div>';
          }).join('') + '</div></div>';
      }).join('') : '<p class="empty">Nessun giocatore.</p>') + '</div>';
  }

  /* ------------------------------ render ------------------------------ */
  function render() {
    if (!state.user) { renderLogin(); return; }
    $('#admin-nav').hidden = false;
    $('#whoami').hidden = false;
    $('#who-role').textContent = rolesLabel(state.user.role);
    $('#who-name').textContent = state.user.username;
    document.querySelectorAll('#admin-nav [data-view]').forEach(function (b) {
      if (b.dataset.view === state.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    if (!state.data) { viewEl.innerHTML = '<p class="empty">Caricamento…</p>'; return; }
    var views = { home: viewHome, teams: viewTeams, players: viewPlayers, matches: viewMatches, stats: viewStats };
    viewEl.innerHTML = views[state.view]();
  }

  function go(v) { state.view = v; render(); window.scrollTo(0, 0); }

  /* ------------------------------ modali / form ------------------------------ */
  function field(f, v) {
    var val = v[f.name] == null ? '' : v[f.name];
    var cls = 'field' + (f.half ? ' half' : '');
    var lbl = '<span class="lbl">' + esc(f.label) + '</span>';
    var req = f.required ? ' required' : '';
    if (f.type === 'select') {
      return '<label class="' + cls + '">' + lbl + '<select name="' + f.name + '"' + req + '>' +
        (f.placeholder ? '<option value="">' + esc(f.placeholder) + '</option>' : '') +
        f.options.map(function (o) {
          return '<option value="' + esc(o.value) + '"' + (String(o.value) === String(val) ? ' selected' : '') + '>' + esc(o.label) + '</option>';
        }).join('') + '</select></label>';
    }
    if (f.type === 'image') {
      return '<div class="' + cls + ' full"><span class="lbl">' + esc(f.label) + '</span>' +
        '<label class="drop" data-kind="' + f.kind + '"><input type="file" accept="image/png,image/jpeg,image/webp" hidden>' +
        '<span class="plus">+</span><span class="drop-text">' + esc(f.hint) + '</span>' +
        '<img class="drop-prev"' + (val ? ' src="' + esc(val) + '"' : ' hidden') + ' alt=""></label>' +
        '<input type="hidden" name="' + f.name + '" value="' + esc(val) + '"></div>';
    }
    var extra = (f.min !== undefined ? ' min="' + f.min + '"' : '') + (f.max !== undefined ? ' max="' + f.max + '"' : '') +
      (f.maxlength ? ' maxlength="' + f.maxlength + '"' : '') + (f.type === 'number' ? ' inputmode="numeric"' : '');
    return '<label class="' + cls + '">' + lbl + '<input type="' + f.type + '" name="' + f.name + '" value="' + esc(val) + '"' + req + extra + '></label>';
  }

  function openForm(cfg) {
    var v = cfg.values || {};
    modal.innerHTML = '<form class="modal-card" novalidate><h2 class="h-modal">' + esc(cfg.title) + '</h2>' +
      '<p class="muted">' + esc(cfg.subtitle) + '</p><div class="grid-form">' + cfg.fields.map(function (f) { return field(f, v); }).join('') + '</div>' + (cfg.extraHtml || '') +
      '<p class="notice err" id="form-err" hidden></p>' +
      '<div class="modal-actions"><button type="button" class="btn btn-ghost" data-close>Annulla</button>' +
      '<button type="submit" class="btn btn-primary">Salva</button></div>' +
      (cfg.onDelete && state.user.role === 'superadmin' ? '<button type="button" class="link-btn danger" data-delete>Elimina</button>' : '') +
      '</form>';
    var form = $('form', modal), err = $('#form-err', modal);

    modal.querySelectorAll('.drop').forEach(function (drop) {
      var input = $('input[type=file]', drop), prev = $('.drop-prev', drop), txt = $('.drop-text', drop);
      var hidden = drop.parentNode.querySelector('input[type=hidden]');
      input.addEventListener('change', function () {
        var file = input.files[0];
        if (!file) return;
        txt.textContent = 'Caricamento…';
        shrink(file).then(function (blob) {
          var fd = new FormData();
          fd.append('file', blob, 'img');
          fd.append('kind', drop.dataset.kind);
          return fetch('api/upload.php', { method: 'POST', body: fd, credentials: 'same-origin', headers: { 'X-CSRF-Token': state.csrf } })
            .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'Upload fallito'); return j; }); });
        }).then(function (j) {
          hidden.value = j.url; prev.src = j.url; prev.hidden = false; txt.textContent = 'Cambia immagine';
        }).catch(function (e) { txt.textContent = 'Riprova'; err.textContent = e.message; err.hidden = false; });
      });
    });

    form.addEventListener('click', function (e) {
      if (e.target.closest('[data-close]')) modal.close();
      if (e.target.closest('[data-delete]') && confirm('Eliminare definitivamente?')) {
        cfg.onDelete().then(function () { modal.close(); return refresh('Eliminato'); })
          .catch(function (ex) { err.textContent = ex.message; err.hidden = false; });
      }
    });
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (!form.reportValidity()) return;
      var out = {};
      new FormData(form).forEach(function (val, k) { out[k] = val === '' ? null : val; });
      if (cfg.collect) Object.assign(out, cfg.collect(form));
      err.hidden = true;
      var btn = $('button[type=submit]', form); btn.disabled = true;
      cfg.onSave(out).then(function () { modal.close(); return refresh('Salvato'); })
        .catch(function (ex) { err.textContent = ex.message; err.hidden = false; })
        .then(function () { btn.disabled = false; });
    });
    if (cfg.onMount) cfg.onMount(form);
    modal.showModal();
    var first = $('input:not([type=hidden]):not([type=file]), select', form);
    if (first) first.focus();
  }

  /** Riduce le immagini (max 800px) prima dell'upload: più veloce e sotto il limite di 2 MB. */
  function shrink(file) {
    return createImageBitmap(file).then(function (bmp) {
      var r = Math.min(1, 800 / Math.max(bmp.width, bmp.height));
      var c = document.createElement('canvas');
      c.width = Math.round(bmp.width * r); c.height = Math.round(bmp.height * r);
      c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
      var png = file.type === 'image/png';
      return new Promise(function (res, rej) {
        c.toBlob(function (b) { b ? res(b) : rej(new Error('Immagine non valida')); }, png ? 'image/png' : 'image/jpeg', 0.86);
      });
    });
  }

  function refresh(msg) {
    return loadData().then(function () { render(); if (msg) toast(msg); });
  }

  function teamOptions() {
    return state.data.teams.map(function (t) { return { value: t.id, label: t.name }; });
  }
  function find(list, id) { return list.filter(function (x) { return x.id === Number(id); })[0]; }

  function formPlayer(p) {
    if (!state.data.teams.length) { toast('Crea prima una squadra.', true); return; }
    openForm({
      title: p ? 'Modifica giocatore' : 'Nuovo giocatore', subtitle: 'Inserisci i dati a mano.', values: p,
      fields: [
        { name: 'first_name', label: 'Nome', type: 'text', required: true, half: true, maxlength: 40 },
        { name: 'last_name', label: 'Cognome', type: 'text', required: true, half: true, maxlength: 40 },
        { name: 'team_id', label: 'Squadra', type: 'select', required: true, half: true, options: teamOptions() },
        { name: 'number', label: 'Numero maglia', type: 'number', half: true, min: 0, max: 999 },
        { name: 'role', label: 'Ruolo', type: 'select', required: true, options: ROLES.map(function (r) { return { value: r, label: r }; }) },
        { name: 'photo_url', label: 'Foto', type: 'image', kind: 'players', hint: 'Carica foto del giocatore' }
      ],
      onSave: function (o) {
        return p ? api('PATCH', ENDPOINT + '?resource=players&id=' + p.id, o) : api('POST', ENDPOINT + '?resource=players', o);
      },
      onDelete: p ? function () { return api('DELETE', ENDPOINT + '?resource=players&id=' + p.id); } : null
    });
  }

  function formTeam(t) {
    openForm({
      title: t ? 'Modifica squadra' : 'Nuova squadra', subtitle: 'Nome, colore e logo.', values: t || { color: '#1d2fe0' },
      fields: [
        { name: 'name', label: 'Nome squadra', type: 'text', required: true, maxlength: 40 },
        { name: 'color', label: 'Colore', type: 'color' },
        { name: 'logo_url', label: 'Logo', type: 'image', kind: 'teams', hint: 'Carica logo (PNG o JPG)' }
      ],
      onSave: function (o) {
        return t ? api('PATCH', ENDPOINT + '?resource=teams&id=' + t.id, o) : api('POST', ENDPOINT + '?resource=teams', o);
      },
      onDelete: t ? function () { return api('DELETE', ENDPOINT + '?resource=teams&id=' + t.id); } : null
    });
  }

  function formMatch(m) {
    if (state.data.teams.length < 2) { toast('Servono almeno due squadre.', true); return; }
    var v = m ? Object.assign({}, m, POC.toInputs(m.match_date)) : { date: POC.toInputs(new Date().toISOString()).date, time: '20:00' };
    var opts = teamOptions();
    var existing = m ? state.data.goals.filter(function (g) { return g.match_id === m.id; }) : [];

    function playerOptions(form, selected) {
      var h = Number(form.home_team_id.value), a = Number(form.away_team_id.value), tm = teamMap();
      var list = state.data.players.filter(function (p) { return p.team_id === h || p.team_id === a; });
      return '<option value="">Giocatore…</option>' + list.map(function (p) {
        return '<option value="' + p.id + '"' + (p.id === Number(selected) ? ' selected' : '') + '>' +
          esc(p.last_name + ' ' + p.first_name + ' (' + (tm[p.team_id] ? tm[p.team_id].name : '') + ')') + '</option>';
      }).join('');
    }
    function addRow(form, g) {
      g = g || {};
      var row = document.createElement('div');
      row.className = 'sc-row';
      row.innerHTML = '<select class="sc-p" aria-label="Marcatore">' + playerOptions(form, g.player_id) + '</select>' +
        '<input class="sc-m" type="number" min="0" max="130" inputmode="numeric" placeholder="Min" aria-label="Minuto" value="' + (g.minute == null ? '' : g.minute) + '">' +
        '<label class="sc-og"><input type="checkbox"' + (g.own_goal ? ' checked' : '') + '> aut.</label>' +
        '<button type="button" class="x" aria-label="Rimuovi marcatore">×</button>';
      $('#srows', modal).appendChild(row);
    }

    openForm({
      title: m ? 'Modifica partita' : 'Nuova partita', subtitle: 'Squadre, data, risultato e marcatori.', values: v,
      fields: [
        { name: 'home_team_id', label: 'Casa', type: 'select', required: true, half: true, options: opts },
        { name: 'away_team_id', label: 'Ospite', type: 'select', required: true, half: true, options: opts },
        { name: 'date', label: 'Data', type: 'date', required: true, half: true },
        { name: 'time', label: 'Ora', type: 'time', required: true, half: true },
        { name: 'matchday', label: 'Giornata', type: 'number', half: true, min: 1, max: 99 },
        { name: 'home_goals', label: 'Gol casa', type: 'number', half: true, min: 0, max: 99 },
        { name: 'away_goals', label: 'Gol ospite', type: 'number', half: true, min: 0, max: 99 }
      ],
      extraHtml: '<div class="scorers-edit"><span class="lbl">Marcatori <small>(facoltativo, dopo aver inserito il risultato)</small></span>' +
        '<div id="srows"></div><button type="button" class="btn btn-ghost sm" id="add-sc">+ Marcatore</button></div>',
      onMount: function (form) {
        existing.forEach(function (g) { addRow(form, g); });
        $('#add-sc', modal).addEventListener('click', function () { addRow(form); });
        $('#srows', modal).addEventListener('click', function (e) {
          if (e.target.closest('.x')) e.target.closest('.sc-row').remove();
        });
        // se cambiano le squadre, aggiorna l'elenco dei giocatori selezionabili
        ['home_team_id', 'away_team_id'].forEach(function (n) {
          form[n].addEventListener('change', function () {
            modal.querySelectorAll('.sc-row .sc-p').forEach(function (sel) { sel.innerHTML = playerOptions(form, sel.value); });
          });
        });
      },
      collect: function () {
        var out = [];
        modal.querySelectorAll('.sc-row').forEach(function (r) {
          var pid = $('.sc-p', r).value;
          if (!pid) return;
          var min = $('.sc-m', r).value;
          out.push({ player_id: Number(pid), minute: min === '' ? null : Number(min), own_goal: $('.sc-og input', r).checked });
        });
        return { scorers: out };
      },
      onSave: function (o) {
        return m ? api('PATCH', ENDPOINT + '?resource=matches&id=' + m.id, o) : api('POST', ENDPOINT + '?resource=matches', o);
      },
      onDelete: m ? function () { return api('DELETE', ENDPOINT + '?resource=matches&id=' + m.id); } : null
    });
  }

  /* ------------------------------ stepper statistiche ------------------------------ */
  var pending = {};
  function bump(stepper, delta) {
    var pid = Number(stepper.dataset.pid), field = stepper.dataset.field;
    var p = find(state.data.players, pid);
    var next = Math.max(0, Math.min(9999, (p[field] || 0) + delta));
    if (next === p[field]) return;
    p[field] = next;
    $('output', stepper).textContent = next;
    var key = pid + ':' + field;
    clearTimeout(pending[key]);
    pending[key] = setTimeout(function () {
      var body = {}; body[field] = p[field];
      api('PATCH', ENDPOINT + '?resource=players&id=' + pid, body).catch(function (e) {
        toast(e.message, true); refresh();
      });
    }, 400);
  }

  /* ------------------------------ eventi ------------------------------ */
  function openAction(a, id) {
    if (a === 'player') formPlayer(id ? find(state.data.players, id) : null);
    if (a === 'team') formTeam(id ? find(state.data.teams, id) : null);
    if (a === 'match') formMatch(id ? find(state.data.matches, id) : null);
    if (a === 'stats') go('stats');
  }

  document.addEventListener('DOMContentLoaded', function () {
    viewEl = $('#view'); modal = $('#modal'); toastEl = $('#toast');

    $('#admin-nav').addEventListener('click', function (e) {
      var b = e.target.closest('[data-view]'); if (b) go(b.dataset.view);
    });
    $('#logout').addEventListener('click', function () {
      api('POST', 'api/auth.php?action=logout', {}).catch(function () {}).then(function () {
        state.user = null; state.data = null; state.csrf = null; render();
      });
    });
    viewEl.addEventListener('click', function (e) {
      var a = e.target.closest('[data-act]'); if (a) return openAction(a.dataset.act);
      var ed = e.target.closest('[data-edit]'); if (ed) return openAction(ed.dataset.edit, ed.dataset.id);
      var tm = e.target.closest('[data-team]');
      if (tm) { state.filterTeam = Number(tm.dataset.team); render(); return; }
      var st = e.target.closest('.stepper button');
      if (st) bump(st.closest('.stepper'), Number(st.dataset.d));
    });
    viewEl.addEventListener('input', function (e) {
      if (e.target.id === 'search') {
        state.search = e.target.value; $('#plist').innerHTML = playerList();
      }
      if (e.target.id === 'stat-search') {
        state.statSearch = e.target.value;
        var pos = e.target.selectionStart;
        render();
        var el = $('#stat-search'); el.focus(); el.setSelectionRange(pos, pos);
      }
    });
    modal.addEventListener('click', function (e) { if (e.target === modal) modal.close(); });

    // sessione già attiva?
    POC.request('GET', 'api/auth.php?action=me').then(function (r) {
      if (r.user) {
        state.user = r.user; state.csrf = r.csrf; render();
        return loadData().then(render);
      }
      render();
    }).catch(function () { render(); });
  });
})();
