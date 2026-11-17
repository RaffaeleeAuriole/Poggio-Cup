<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';
require_once __DIR__ . '/../includes/data.php';

/**
 * API del back office.
 *   GET    admin.php                              -> tutti i dati (senza cache)
 *   POST   admin.php?resource=players|teams|matches            -> crea
 *   PATCH  admin.php?resource=...&id=N                         -> modifica
 *   DELETE admin.php?resource=...&id=N                         -> elimina (solo superadmin)
 */

api_boot();
$user   = auth_require();
$method = require_method('GET', 'POST', 'PATCH', 'DELETE');

if ($method === 'GET') {
    json_out(build_payload());
}
csrf_check();

$resource = (string) ($_GET['resource'] ?? '');
$table = ['players' => 'players', 'teams' => 'teams', 'matches' => 'matches'][$resource] ?? null;
if (!$table) {
    fail('Risorsa sconosciuta.', 404);
}

/* ------------------------- validatori ------------------------- */

const ROLES = ['Portiere', 'Difensore', 'Centrocampista', 'Attaccante', 'Jolly'];

function v_text($v, string $label, int $max, bool $required = true): ?string
{
    $v = trim((string) ($v ?? ''));
    if ($v === '') {
        if ($required) {
            fail("$label obbligatorio.");
        }
        return null;
    }
    if (mb_strlen($v) > $max) {
        fail("$label troppo lungo (max $max caratteri).");
    }
    return strip_tags($v);
}

function v_int($v, string $label, int $min, int $max, bool $required = true): ?int
{
    if ($v === null || $v === '') {
        if ($required) {
            fail("$label obbligatorio.");
        }
        return null;
    }
    if (!is_numeric($v) || (int) $v != $v || (int) $v < $min || (int) $v > $max) {
        fail("$label non valido ($min-$max).");
    }
    return (int) $v;
}

function v_media_url($v): ?string
{
    $v = trim((string) ($v ?? ''));
    if ($v === '') {
        return null;
    }
    $prefix = rtrim((string) cfg('SUPABASE_URL', ''), '/') . '/storage/v1/object/public/';
    if (!str_starts_with($v, $prefix) || strlen($v) > 400) {
        fail('URL immagine non valido.');
    }
    return $v;
}

/** Costruisce la riga da salvare. Con $partial=true accetta solo i campi presenti. */
function build_row(string $resource, array $in, bool $partial): array
{
    $has = fn(string $k) => !$partial || array_key_exists($k, $in);
    $row = [];

    if ($resource === 'teams') {
        if ($has('name'))  $row['name'] = v_text($in['name'] ?? null, 'Nome squadra', 40);
        if ($has('color')) {
            $c = (string) ($in['color'] ?? '#1d2fe0');
            if (!preg_match('/^#[0-9a-fA-F]{6}$/', $c)) fail('Colore non valido.');
            $row['color'] = strtolower($c);
        }
        if ($has('logo_url')) $row['logo_url'] = v_media_url($in['logo_url'] ?? null);
    }

    if ($resource === 'players') {
        if ($has('first_name')) $row['first_name'] = v_text($in['first_name'] ?? null, 'Nome', 40);
        if ($has('last_name'))  $row['last_name']  = v_text($in['last_name'] ?? null, 'Cognome', 40);
        if ($has('team_id'))    $row['team_id']    = v_int($in['team_id'] ?? null, 'Squadra', 1, PHP_INT_MAX);
        if ($has('number'))     $row['number']     = v_int($in['number'] ?? null, 'Numero maglia', 0, 999, false);
        if ($has('role')) {
            $r = (string) ($in['role'] ?? '');
            if (!in_array($r, ROLES, true)) fail('Ruolo non valido.');
            $row['role'] = $r;
        }
        if ($has('photo_url')) $row['photo_url'] = v_media_url($in['photo_url'] ?? null);
        foreach (['assists' => 'Assist', 'mvp' => 'MVP', 'yellow_cards' => 'Cartellini', 'clean_sheets' => 'Porte inviolate'] as $k => $label) {
            if ($has($k) && array_key_exists($k, $in)) {
                $row[$k] = v_int($in[$k], $label, 0, 9999);
            }
        }
    }

    if ($resource === 'matches') {
        if ($has('home_team_id')) $row['home_team_id'] = v_int($in['home_team_id'] ?? null, 'Squadra di casa', 1, PHP_INT_MAX);
        if ($has('away_team_id')) $row['away_team_id'] = v_int($in['away_team_id'] ?? null, 'Squadra ospite', 1, PHP_INT_MAX);
        if (isset($row['home_team_id'], $row['away_team_id']) && $row['home_team_id'] === $row['away_team_id']) {
            fail('Casa e ospite devono essere squadre diverse.');
        }
        if ($has('date') || $has('time')) {
            $date = (string) ($in['date'] ?? '');
            $time = (string) ($in['time'] ?? '20:00');
            if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !preg_match('/^\d{2}:\d{2}$/', $time)) {
                fail('Data o ora non valide.');
            }
            try {
                $dt = new DateTimeImmutable("$date $time", new DateTimeZone((string) cfg('TIMEZONE', 'Europe/Rome')));
            } catch (Exception $e) {
                fail('Data o ora non valide.');
            }
            $row['match_date'] = $dt->setTimezone(new DateTimeZone('UTC'))->format('Y-m-d\TH:i:s\Z');
        }
        if ($has('matchday')) $row['matchday'] = v_int($in['matchday'] ?? null, 'Giornata', 1, 99, false);
        if ($has('home_goals') || $has('away_goals')) {
            $hg = v_int($in['home_goals'] ?? null, 'Gol casa', 0, 99, false);
            $ag = v_int($in['away_goals'] ?? null, 'Gol ospite', 0, 99, false);
            if (($hg === null) !== ($ag === null)) {
                fail('Inserisci entrambi i punteggi oppure nessuno.');
            }
            $row['home_goals'] = $hg;
            $row['away_goals'] = $ag;
        }
    }
    return $row;
}

/* ------------------------- marcatori ------------------------- */

function parse_scorers($raw): array
{
    if (!is_array($raw) || count($raw) > 60) {
        fail('Marcatori non validi.');
    }
    $out = [];
    foreach ($raw as $s) {
        if (!is_array($s)) {
            fail('Marcatori non validi.');
        }
        $out[] = [
            'player_id' => v_int($s['player_id'] ?? null, 'Marcatore', 1, PHP_INT_MAX),
            'minute'    => v_int($s['minute'] ?? null, 'Minuto', 0, 130, false),
            'own_goal'  => !empty($s['own_goal']),
        ];
    }
    return $out;
}

/** Ogni marcatore deve giocare in una delle due squadre e i gol non possono superare il punteggio. */
function check_scorers(array $sc, int $home, int $away, ?int $hg, ?int $ag): void
{
    if (!$sc) {
        return;
    }
    if ($hg === null || $ag === null) {
        fail('Inserisci il risultato prima dei marcatori.');
    }
    $ids = array_values(array_unique(array_column($sc, 'player_id')));
    $rows = sb_select('players', ['select' => 'id,team_id', 'id' => 'in.(' . implode(',', $ids) . ')']);
    $team = [];
    foreach ($rows as $r) {
        $team[(int) $r['id']] = (int) $r['team_id'];
    }
    $h = 0;
    $a = 0;
    foreach ($sc as $s) {
        $t = $team[$s['player_id']] ?? null;
        if ($t !== $home && $t !== $away) {
            fail('Un marcatore non appartiene alle due squadre della partita.');
        }
        // autogol: il gol va all'avversario
        if (($t === $home) !== $s['own_goal']) {
            $h++;
        } else {
            $a++;
        }
    }
    if ($h > $hg || $a > $ag) {
        fail("I marcatori ($h-$a) superano il punteggio ($hg-$ag).");
    }
}

function save_scorers(int $matchId, array $sc): void
{
    sb_delete_where('goals', ['match_id' => 'eq.' . $matchId]);
    sb_insert_many('goals', array_map(fn($s) => $s + ['match_id' => $matchId], $sc));
}

/* ------------------------- azioni ------------------------- */

if ($method === 'POST') {
    $in = json_in();
    $row = build_row($resource, $in, false);
    $scorers = null;
    if ($resource === 'matches' && array_key_exists('scorers', $in)) {
        $scorers = parse_scorers($in['scorers']);
        check_scorers($scorers, $row['home_team_id'], $row['away_team_id'], $row['home_goals'] ?? null, $row['away_goals'] ?? null);
    }
    $item = sb_insert($table, $row);
    if ($scorers !== null) {
        save_scorers((int) $item['id'], $scorers);
    }
    json_out(['item' => $item], 201);
}

$id = v_int($_GET['id'] ?? null, 'ID', 1, PHP_INT_MAX);

if ($method === 'PATCH') {
    $in = json_in();
    $row = build_row($resource, $in, true);
    if (!$row) {
        fail('Nessun campo da aggiornare.');
    }
    $scorers = null;
    if ($resource === 'matches' && array_key_exists('scorers', $in)) {
        $cur = sb_select('matches', ['select' => '*', 'id' => 'eq.' . $id, 'limit' => '1'])[0] ?? null;
        if (!$cur) {
            fail('Elemento non trovato.', 404);
        }
        $m = array_merge($cur, $row);
        $scorers = parse_scorers($in['scorers']);
        check_scorers($scorers, (int) $m['home_team_id'], (int) $m['away_team_id'],
            $m['home_goals'] === null ? null : (int) $m['home_goals'],
            $m['away_goals'] === null ? null : (int) $m['away_goals']);
    }
    $item = sb_update($table, $id, $row);
    if (!$item) {
        fail('Elemento non trovato.', 404);
    }
    if ($scorers !== null) {
        save_scorers($id, $scorers);
    }
    json_out(['item' => $item]);
}

if ($method === 'DELETE') {
    if ($user['role'] !== 'superadmin') {
        fail('Solo il superadmin può eliminare.', 403);
    }
    sb_delete($table, $id);
    json_out(['ok' => true]);
}
