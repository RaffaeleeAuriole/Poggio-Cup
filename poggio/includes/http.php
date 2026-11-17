<?php
declare(strict_types=1);

/** Risposte JSON e utilità HTTP comuni a tutte le API. */

function security_headers(): void
{
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
}

function json_out($data, int $code = 200, string $cache = 'no-store'): void
{
    http_response_code($code);
    security_headers();
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: ' . $cache);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $message, int $code = 400): void
{
    json_out(['error' => $message], $code);
}

function json_in(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }
    if (strlen($raw) > 100_000) {
        fail('Richiesta troppo grande.', 413);
    }
    $data = json_decode($raw, true);
    if (!is_array($data)) {
        fail('JSON non valido.');
    }
    return $data;
}

function require_method(string ...$allowed): string
{
    $m = $_SERVER['REQUEST_METHOD'] ?? 'GET';
    if (!in_array($m, $allowed, true)) {
        header('Allow: ' . implode(', ', $allowed));
        fail('Metodo non consentito.', 405);
    }
    return $m;
}

function client_ip(): string
{
    return preg_replace('/[^0-9a-fA-F:\.]/', '', $_SERVER['REMOTE_ADDR'] ?? '0.0.0.0') ?: '0.0.0.0';
}

/** Cattura qualsiasi errore non gestito e restituisce JSON pulito (niente dettagli interni). */
function api_boot(): void
{
    set_exception_handler(function (Throwable $e) {
        error_log('[PoggioOpenCup] ' . get_class($e) . ': ' . $e->getMessage());
        if ($e instanceof SupabaseError && $e->pgCode === '23503') {
            fail('Impossibile completare: ci sono dati collegati (es. giocatori o partite di questa squadra).', 409);
        }
        if ($e instanceof SupabaseError && $e->pgCode === '23505') {
            fail('Esiste già un elemento con questi dati.', 409);
        }
        fail('Errore del server. Riprova tra poco.', 500);
    });
}
