<?php
declare(strict_types=1);

/** Calcolo classifica (girone unico) e Top 7 giocatori. */

function match_is_played(array $m): bool
{
    return $m['home_goals'] !== null && $m['away_goals'] !== null;
}

function compute_standings(array $teams, array $matches): array
{
    $t = [];
    foreach ($teams as $team) {
        $t[$team['id']] = [
            'team_id' => (int) $team['id'], 'name' => $team['name'],
            'color' => $team['color'], 'logo_url' => $team['logo_url'],
            'pg' => 0, 'v' => 0, 'n' => 0, 'p' => 0, 'gf' => 0, 'gs' => 0, 'dr' => 0, 'pt' => 0,
        ];
    }
    foreach ($matches as $m) {
        if (!match_is_played($m)) {
            continue;
        }
        $h = $m['home_team_id'];
        $a = $m['away_team_id'];
        if (!isset($t[$h], $t[$a])) {
            continue;
        }
        $hg = (int) $m['home_goals'];
        $ag = (int) $m['away_goals'];
        foreach ([[$h, $hg, $ag], [$a, $ag, $hg]] as [$id, $for, $against]) {
            $t[$id]['pg']++;
            $t[$id]['gf'] += $for;
            $t[$id]['gs'] += $against;
            if ($for > $against) {
                $t[$id]['v']++;
                $t[$id]['pt'] += 3;
            } elseif ($for === $against) {
                $t[$id]['n']++;
                $t[$id]['pt'] += 1;
            } else {
                $t[$id]['p']++;
            }
        }
    }
    foreach ($t as &$row) {
        $row['dr'] = $row['gf'] - $row['gs'];
    }
    unset($row);
    $rows = array_values($t);
    usort($rows, fn($x, $y) => [$y['pt'], $y['dr'], $y['gf'], $x['name']] <=> [$x['pt'], $x['dr'], $x['gf'], $y['name']]);
    foreach ($rows as $i => &$row) {
        $row['pos'] = $i + 1;
    }
    return $rows;
}

function player_score(array $p): int
{
    return (int) $p['goals'] * 3 + (int) $p['assists'] * 2 + (int) $p['mvp'] * 4
        + (int) $p['clean_sheets'] * 2 - (int) $p['yellow_cards'];
}

function compute_top7(array $players): array
{
    $scored = [];
    foreach ($players as $p) {
        $s = player_score($p);
        if ($s > 0) {
            $p['score'] = $s;
            $scored[] = $p;
        }
    }
    usort($scored, fn($a, $b) => [$b['score'], $b['goals']] <=> [$a['score'], $a['goals']]);
    return array_slice($scored, 0, 7);
}
