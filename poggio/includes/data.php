<?php
declare(strict_types=1);

require_once __DIR__ . '/supabase.php';
require_once __DIR__ . '/standings.php';

/** Dati completi del torneo, usati sia dal sito pubblico sia dal back office. */
function build_payload(): array
{
    $teams = sb_select('teams', [
        'select' => 'id,name,color,logo_url',
        'order'  => 'name.asc',
    ]);
    $players = sb_select('players', [
        'select' => 'id,first_name,last_name,team_id,number,role,photo_url,goals,assists,mvp,yellow_cards,clean_sheets',
        'order'  => 'team_id.asc,number.asc.nullslast,id.asc',
    ]);
    $matches = sb_select('matches', [
        'select' => 'id,home_team_id,away_team_id,match_date,matchday,home_goals,away_goals',
        'order'  => 'match_date.asc,id.asc',
    ]);

    $goals = sb_select('goals', [
        'select' => 'id,match_id,player_id,minute,own_goal',
        'order'  => 'match_id.asc,minute.asc.nullslast,id.asc',
    ]);

    // I gol di ogni giocatore sono contati dai marcatori delle partite (autogol esclusi).
    $count = [];
    foreach ($goals as $g) {
        if (!$g['own_goal']) {
            $count[$g['player_id']] = ($count[$g['player_id']] ?? 0) + 1;
        }
    }
    foreach ($players as &$p) {
        $p['goals'] = $count[$p['id']] ?? 0;
    }
    unset($p);

    return [
        'teams'     => $teams,
        'goals'     => $goals,
        'players'   => $players,
        'matches'   => $matches,
        'standings' => compute_standings($teams, $matches),
        'top7'      => compute_top7($players),
        'generated' => gmdate('c'),
    ];
}
