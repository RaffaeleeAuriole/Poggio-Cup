/* Poggio Open Cup — sito pubblico (home, classifica, statistiche) */
(function () {
  'use strict';
  var esc = POC.esc, crest = POC.crest;

  function $(s, r) { return (r || document).querySelector(s); }

  function teamsById(data) {
    var m = {};
    data.teams.forEach(function (t) { m[t.id] = t; });
    return m;
  }

  /* ---------- Classifica ---------- */
  function standingsTable(rows) {
    if (!rows.length) return '<p class="empty">Nessuna squadra iscritta.</p>';
    var h = '<div class="table-wrap"><table class="table"><thead><tr>' +
      '<th>#</th><th class="l">Squadra</th><th>PG</th><th>V</th><th>N</th><th>P</th><th>GF</th><th>GS</th><th>DR</th><th>Pt</th>' +
      '</tr></thead><tbody>';
    rows.forEach(function (r) {
      var dr = r.dr > 0 ? '+' + r.dr : String(r.dr);
      h += '<tr class="' + (r.pos <= 2 ? 'qual' : '') + '">' +
        '<td><span class="pos">' + String(r.pos).padStart(2, '0') + '</span></td>' +
        '<td class="l team-cell">' + crest(r, 'sm') + '<span>' + esc(r.name) + '</span></td>' +
        '<td>' + r.pg + '</td><td>' + r.v + '</td><td>' + r.n + '</td><td>' + r.p + '</td>' +
        '<td>' + r.gf + '</td><td>' + r.gs + '</td><td>' + dr + '</td><td class="pts">' + r.pt + '</td></tr>';
    });
    return h + '</tbody></table></div>';
  }

  /* ---------- Partite ---------- */
  function scorersHtml(m, ctx) {
    var list = (ctx.goalsByMatch[m.id] || []);
    if (!list.length) return '';
    var cols = { h: [], a: [] };
    list.forEach(function (g) {
      var pl = ctx.players[g.player_id];
      if (!pl) return;
      var isHomePlayer = pl.team_id === m.home_team_id;
      var side = (isHomePlayer !== !!g.own_goal) ? 'h' : 'a';   // autogol: va all'avversario
      cols[side].push('<li>' + esc(pl.first_name.charAt(0) + '. ' + pl.last_name) +
        (g.own_goal ? ' <em>(aut.)</em>' : '') + (g.minute != null ? ' <i>' + g.minute + '\u2019</i>' : '') + '</li>');
    });
    return '<div class="scorers"><ul>' + cols.h.join('') + '</ul><span class="ball" aria-hidden="true">\u26BD</span><ul class="r">' + cols.a.join('') + '</ul></div>';
  }

  function matchCard(m, tm, ctx) {
    var home = tm[m.home_team_id], away = tm[m.away_team_id];
    var played = m.home_goals !== null && m.away_goals !== null;
    return '<article class="card match' + (played ? ' played' : '') + '">' +
      '<div class="match-meta"><span>' + POC.fmtDay(m.match_date) + ' · ' + POC.fmtTime(m.match_date) + '</span>' +
      (m.matchday ? '<span>Giornata ' + m.matchday + '</span>' : '') + '</div>' +
      '<div class="match-body">' +
      '<div class="side">' + crest(home) + '<span class="tname">' + esc(home ? home.name : '—') + '</span></div>' +
      '<div class="score">' + (played ? m.home_goals + '<i>:</i>' + m.away_goals : '<span class="vs">VS</span>') + '</div>' +
      '<div class="side">' + crest(away) + '<span class="tname">' + esc(away ? away.name : '—') + '</span></div>' +
      '</div>' + scorersHtml(m, ctx) + '</article>';
  }

  function buildCtx(data) {
    var ctx = { players: {}, goalsByMatch: {} };
    data.players.forEach(function (p) { ctx.players[p.id] = p; });
    (data.goals || []).forEach(function (g) { (ctx.goalsByMatch[g.match_id] = ctx.goalsByMatch[g.match_id] || []).push(g); });
    return ctx;
  }

  function renderMatches(data) {
    var tm = teamsById(data), box = $('#matches'), pills = $('#matchdays'), ctx = buildCtx(data);
    if (!data.matches.length) {
      pills.innerHTML = '';
      box.innerHTML = '<p class="empty">Il calendario sarà pubblicato a breve.</p>';
      return;
    }
    var days = [];
    data.matches.forEach(function (m) {
      var d = m.matchday || 0;
      if (days.indexOf(d) === -1) days.push(d);
    });
    days.sort(function (a, b) { return a - b; });

    // giornata iniziale: la prima con partite ancora da giocare
    var current = days[days.length - 1];
    for (var i = 0; i < days.length; i++) {
      var pending = data.matches.some(function (m) {
        return (m.matchday || 0) === days[i] && (m.home_goals === null || m.away_goals === null);
      });
      if (pending) { current = days[i]; break; }
    }

    function draw() {
      pills.innerHTML = days.map(function (d) {
        return '<button type="button" class="pill' + (d === current ? ' on' : '') + '" data-d="' + d + '">' +
          (d ? 'Giornata ' + d : 'Calendario') + '</button>';
      }).join('');
      box.innerHTML = data.matches.filter(function (m) { return (m.matchday || 0) === current; })
        .map(function (m) { return matchCard(m, tm, ctx); }).join('');
    }
    pills.addEventListener('click', function (e) {
      var b = e.target.closest('[data-d]');
      if (!b) return;
      current = Number(b.dataset.d);
      draw();
    });
    draw();
  }

  /* ---------- Top 7 ---------- */
  function renderTop7(data) {
    var box = $('#top7');
    if (!box) return;
    var tm = teamsById(data), h = '';
    for (var i = 0; i < 7; i++) {
      var p = data.top7[i];
      if (p) {
        var t = tm[p.team_id];
        h += '<article class="top-card filled"><span class="rank">' + (i + 1) + '</span>' +
          (p.photo_url ? '<img class="avatar" src="' + esc(p.photo_url) + '" alt="" loading="lazy">'
            : '<span class="avatar ph">' + esc((p.first_name || '?').charAt(0)) + '</span>') +
          '<strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong>' +
          '<small>' + esc(t ? t.name : '') + '</small></article>';
      } else {
        h += '<article class="top-card"><span class="rank">' + (i + 1) + '</span>' +
          '<span class="avatar ph">?</span><strong>In attesa</strong></article>';
      }
    }
    box.innerHTML = h;
  }

  /* ---------- Statistiche ---------- */
  var STAT_TABS = {
    goals:   { label: 'gol',    filter: null },
    assists: { label: 'assist', filter: null },
    mvp:     { label: 'MVP',    filter: null },
    clean_sheets: { label: 'porte inv.', filter: function (p) { return p.role === 'Portiere'; } }
  };

  function renderStats(data) {
    var tm = teamsById(data), box = $('#stat-list'), tabs = $('#stat-tabs'), key = 'goals';
    function draw() {
      var cfg = STAT_TABS[key];
      var rows = data.players.filter(function (p) {
        return (!cfg.filter || cfg.filter(p)) && p[key] > 0;
      }).sort(function (a, b) { return b[key] - a[key] || a.last_name.localeCompare(b.last_name); }).slice(0, 30);
      if (!rows.length) { box.innerHTML = '<p class="empty">Nessun dato ancora.</p>'; return; }
      box.innerHTML = rows.map(function (p, i) {
        var t = tm[p.team_id];
        return '<article class="card row-stat"><span class="rk">' + (i + 1) + '</span>' +
          '<div class="who"><strong>' + esc(p.first_name + ' ' + p.last_name) + '</strong>' +
          '<small>' + esc(t ? t.name : '') + '</small></div>' +
          '<div class="val">' + p[key] + '<small>' + cfg.label + '</small></div></article>';
      }).join('');
    }
    tabs.addEventListener('click', function (e) {
      var b = e.target.closest('[data-k]');
      if (!b) return;
      key = b.dataset.k;
      tabs.querySelectorAll('.pill').forEach(function (x) { x.classList.toggle('on', x === b); });
      draw();
    });
    draw();
  }

  /* ---------- Squadre e giocatori ---------- */
  function renderTeams(data) {
    var box = $('#teams-box'), id = Number(new URLSearchParams(location.search).get('id')) || 0;
    var tm = teamsById(data);
    if (id && tm[id]) { renderTeamDetail(data, tm[id], box); return; }
    var counts = {};
    data.players.forEach(function (p) { counts[p.team_id] = (counts[p.team_id] || 0) + 1; });
    if (!data.teams.length) { box.innerHTML = '<p class="empty">Nessuna squadra iscritta.</p>'; return; }
    box.innerHTML = '<div class="stack">' + data.teams.map(function (t) {
      var n = counts[t.id] || 0;
      return '<a class="card team-row" href="squadre.html?id=' + t.id + '">' + crest(t, 'lg') +
        '<div class="who"><strong>' + esc(t.name) + '</strong><small>' + n + (n === 1 ? ' giocatore' : ' giocatori') + '</small></div><b>\u2197</b></a>';
    }).join('') + '</div>';
  }

  function renderTeamDetail(data, team, box) {
    document.title = team.name + ' \u2014 Poggio Open Cup';
    var head = $('#teams-head'); if (head) head.hidden = true;
    var st = data.standings.filter(function (r) { return r.team_id === team.id; })[0];
    var roster = data.players.filter(function (p) { return p.team_id === team.id; });
    var h = '<a class="back" href="squadre.html">\u2190 Tutte le squadre</a>' +
      '<section class="team-hero card">' + crest(team, 'xl') + '<h1 class="h-display">' + esc(team.name) + '</h1>' +
      (st ? '<div class="chips"><span>' + st.pos + '\u00BA posto</span><span>' + st.pt + ' pt</span><span>' + st.pg + ' PG</span><span>DR ' + (st.dr > 0 ? '+' : '') + st.dr + '</span></div>' : '') +
      '</section><h2 class="h-section sm">Rosa <span class="muted-inline">(' + roster.length + ')</span></h2>';
    if (!roster.length) h += '<p class="empty">Rosa non ancora inserita.</p>';
    else h += '<div class="roster">' + roster.map(function (p) {
      var stats = [];
      if (p.goals) stats.push(p.goals + ' gol');
      if (p.assists) stats.push(p.assists + ' assist');
      if (p.mvp) stats.push(p.mvp + ' MVP');
      return '<article class="p-card">' +
        (p.photo_url ? '<img class="p-photo" src="' + esc(p.photo_url) + '" alt="' + esc(p.first_name + ' ' + p.last_name) + '" loading="lazy">'
          : '<span class="p-photo ph">' + esc(p.first_name.charAt(0) + p.last_name.charAt(0)) + '</span>') +
        (p.number != null ? '<span class="p-num">' + p.number + '</span>' : '') +
        '<strong>' + esc(p.first_name) + ' <b>' + esc(p.last_name) + '</b></strong><small>' + esc(p.role) + '</small>' +
        (stats.length ? '<em>' + stats.join(' \u00B7 ') + '</em>' : '') + '</article>';
    }).join('') + '</div>';
    box.innerHTML = h;
  }

  /* ---------- avvio ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    var page = document.body.dataset.page;
    if (page === 'menu') return;

    var main = $('main');
    POC.request('GET', 'api/public.php').then(function (data) {
      if (page === 'home') {
        renderMatches(data);
        renderTop7(data);
        $('#standings').innerHTML = standingsTable(data.standings);
        document.querySelectorAll('.seg [data-tab]').forEach(function (b) {
          b.addEventListener('click', function () {
            document.querySelectorAll('.seg [data-tab]').forEach(function (x) { x.classList.toggle('on', x === b); });
            document.querySelectorAll('[data-pane]').forEach(function (p) { p.hidden = p.dataset.pane !== b.dataset.tab; });
          });
        });
      }
      if (page === 'standings') $('#standings').innerHTML = standingsTable(data.standings);
      if (page === 'stats') renderStats(data);
      if (page === 'teams') renderTeams(data);
    }).catch(function () {
      var e = document.createElement('p');
      e.className = 'notice err';
      e.textContent = 'Impossibile caricare i dati. Riprova tra poco.';
      main.appendChild(e);
    });
  });
})();
