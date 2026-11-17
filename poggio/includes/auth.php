<?php
declare(strict_types=1);

require_once __DIR__ . '/http.php';
require_once __DIR__ . '/supabase.php';

/** Sessioni admin, protezione CSRF e limite ai tentativi di login. */

function auth_start(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https')
        || !empty($_SERVER['HTTP_CF_VISITOR']);
    session_name('poc_sid');
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'secure'   => $https,
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function auth_user(): ?array
{
    auth_start();
    return $_SESSION['admin'] ?? null;
}

function auth_require(): array
{
    $u = auth_user();
    if (!$u) {
        fail('Accesso richiesto.', 401);
    }
    return $u;
}

function csrf_token(): string
{
    auth_start();
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

function csrf_check(): void
{
    auth_start();
    $sent = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';
    if (empty($_SESSION['csrf']) || !hash_equals($_SESSION['csrf'], $sent)) {
        fail('Sessione scaduta. Ricarica la pagina.', 403);
    }
}

/* ---- rate limit su file (5 tentativi / 15 minuti per IP) ---- */

function rl_file(): string
{
    return sys_get_temp_dir() . '/poc_login_' . md5(client_ip()) . '.json';
}

function rl_blocked(): bool
{
    $f = rl_file();
    if (!is_file($f)) {
        return false;
    }
    $d = json_decode((string) @file_get_contents($f), true);
    if (!is_array($d)) {
        return false;
    }
    if (time() - (int) ($d['first'] ?? 0) > 900) {
        @unlink($f);
        return false;
    }
    return (int) ($d['count'] ?? 0) >= 5;
}

function rl_hit(): void
{
    $f = rl_file();
    $d = is_file($f) ? json_decode((string) @file_get_contents($f), true) : null;
    if (!is_array($d) || time() - (int) ($d['first'] ?? 0) > 900) {
        $d = ['first' => time(), 'count' => 0];
    }
    $d['count']++;
    @file_put_contents($f, json_encode($d), LOCK_EX);
}

function rl_clear(): void
{
    @unlink(rl_file());
}

/** Verifica credenziali. Ritorna l'utente oppure null. */
function auth_login(string $username, string $code): ?array
{
    $username = trim($username);
    if ($username === '' || $code === '' || strlen($username) > 60 || strlen($code) > 200) {
        return null;
    }
    $rows = sb_select('admins', [
        'select'   => 'id,username,role,code_hash',
        'username' => 'eq.' . $username,
        'limit'    => '1',
    ]);
    $row = $rows[0] ?? null;
    // Hash fittizio: il tempo di risposta non rivela se lo username esiste.
    $hash = $row['code_hash'] ?? '$2y$10$usesomesillystringforsaltuOq2VdWqjQ6y8m0o3sQbqgYIu1nXa';
    $ok = password_verify($code, $hash);
    if (!$row || !$ok) {
        return null;
    }
    return ['id' => (int) $row['id'], 'username' => $row['username'], 'role' => $row['role']];
}
