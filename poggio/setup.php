<?php
declare(strict_types=1);

/**
 * SETUP UNA TANTUM: crea il primo superadmin.
 * Dopo l'uso CANCELLA questo file dal server.
 */
require_once __DIR__ . '/includes/http.php';
require_once __DIR__ . '/includes/supabase.php';

security_headers();
header('Content-Type: text/html; charset=utf-8');
header('Cache-Control: no-store');

function h(string $s): string { return htmlspecialchars($s, ENT_QUOTES, 'UTF-8'); }

$message = '';
$done = false;
$token = (string) cfg('SETUP_TOKEN', '');

try {
    if ($token === '') {
        $message = 'Setup disabilitato: imposta SETUP_TOKEN in includes/config.local.php.';
    } else {
        $existing = sb_select('admins', ['select' => 'id', 'limit' => '1']);
        if ($existing) {
            $message = 'Esiste già un amministratore. Per sicurezza cancella setup.php dal server.';
        } elseif ($_SERVER['REQUEST_METHOD'] === 'POST') {
            $u = trim((string) ($_POST['username'] ?? ''));
            $c = (string) ($_POST['code'] ?? '');
            if (!hash_equals($token, (string) ($_POST['token'] ?? ''))) {
                $message = 'Token di setup errato.';
            } elseif (!preg_match('/^[a-zA-Z0-9._-]{3,40}$/', $u)) {
                $message = 'Username: 3-40 caratteri (lettere, numeri, . _ -).';
            } elseif (strlen($c) < 8) {
                $message = 'Il codice di accesso deve avere almeno 8 caratteri.';
            } else {
                sb_insert('admins', [
                    'username'  => $u,
                    'code_hash' => password_hash($c, PASSWORD_DEFAULT),
                    'role'      => 'superadmin',
                ]);
                $done = true;
                $message = 'Superadmin creato. ORA cancella setup.php dal server.';
            }
        }
    }
} catch (Throwable $e) {
    error_log('[setup] ' . $e->getMessage());
    $message = 'Errore di connessione a Supabase: controlla config.local.php e di aver creato le tabelle.';
}
?><!doctype html>
<html lang="it"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Setup</title>
<link rel="stylesheet" href="assets/css/style.css"></head>
<body class="setup-page"><main class="setup-card card">
<h1 class="h-display">Setup</h1>
<?php if ($message): ?><p class="notice <?= $done ? 'ok' : 'err' ?>"><?= h($message) ?></p><?php endif; ?>
<?php if (!$done && $token !== '' && strpos($message, 'Esiste già') === false): ?>
<form method="post" class="form">
  <label>Token di setup<input type="password" name="token" required autocomplete="off"></label>
  <label>Username<input type="text" name="username" required autocomplete="off"></label>
  <label>Codice di accesso<input type="password" name="code" required minlength="8" autocomplete="new-password"></label>
  <button class="btn btn-primary" type="submit">Crea superadmin</button>
</form>
<?php endif; ?>
</main></body></html>
