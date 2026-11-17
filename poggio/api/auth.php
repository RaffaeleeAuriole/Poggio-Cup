<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

api_boot();
$action = $_GET['action'] ?? 'me';

if ($action === 'me') {
    require_method('GET');
    $u = auth_user();
    json_out(['user' => $u, 'csrf' => $u ? csrf_token() : null]);
}

if ($action === 'login') {
    require_method('POST');
    auth_start();
    if (rl_blocked()) {
        fail('Troppi tentativi. Riprova tra 15 minuti.', 429);
    }
    $in = json_in();
    $user = auth_login((string) ($in['username'] ?? ''), (string) ($in['code'] ?? ''));
    if (!$user) {
        rl_hit();
        usleep(600_000);
        fail('Username o codice di accesso non corretti.', 401);
    }
    rl_clear();
    session_regenerate_id(true);
    $_SESSION['admin'] = $user;
    unset($_SESSION['csrf']);
    json_out(['user' => $user, 'csrf' => csrf_token()]);
}

if ($action === 'logout') {
    require_method('POST');
    auth_start();
    csrf_check();
    $_SESSION = [];
    session_destroy();
    json_out(['ok' => true]);
}

fail('Azione sconosciuta.', 404);
