<?php
declare(strict_types=1);

require_once __DIR__ . '/config.php';

/**
 * Client minimale per Supabase (PostgREST + Storage) tramite cURL.
 * La chiave segreta vive solo qui, sul server: il browser non la vede mai.
 */
class SupabaseError extends RuntimeException
{
    public string $pgCode;
    public function __construct(string $message, int $httpCode = 0, string $pgCode = '')
    {
        parent::__construct($message, $httpCode);
        $this->pgCode = $pgCode;
    }
}

function sb_base(): string
{
    $url = rtrim((string) cfg('SUPABASE_URL', ''), '/');
    if ($url === '' || !cfg('SUPABASE_SERVICE_KEY')) {
        throw new SupabaseError('Supabase non configurato (config.local.php).');
    }
    return $url;
}

function sb_headers(bool $json = true): array
{
    $key = (string) cfg('SUPABASE_SERVICE_KEY');
    $h = ['apikey: ' . $key, 'Accept: application/json'];
    // Le chiavi legacy sono JWT (eyJ...) e vanno anche in Authorization; le nuove sb_secret_ no.
    if (str_starts_with($key, 'eyJ')) {
        $h[] = 'Authorization: Bearer ' . $key;
    }
    if ($json) {
        $h[] = 'Content-Type: application/json';
    }
    return $h;
}

function sb_curl(string $method, string $url, array $headers, ?string $body = null): array
{
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    if ($body !== null) {
        curl_setopt($ch, CURLOPT_POSTFIELDS, $body);
    }
    $res  = curl_exec($ch);
    $err  = curl_error($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($res === false) {
        throw new SupabaseError('Connessione a Supabase fallita: ' . $err);
    }
    return [$code, (string) $res];
}

/** Richiesta REST generica. Ritorna l'array decodificato. */
function sb_request(string $method, string $table, array $query = [], $body = null, bool $returnRows = false)
{
    $url = sb_base() . '/rest/v1/' . $table;
    if ($query) {
        $url .= '?' . http_build_query($query, '', '&', PHP_QUERY_RFC3986);
    }
    $headers = sb_headers();
    if ($returnRows) {
        $headers[] = 'Prefer: return=representation';
    }
    [$code, $res] = sb_curl($method, $url, $headers, $body === null ? null : json_encode($body, JSON_UNESCAPED_UNICODE));
    $data = $res === '' ? [] : json_decode($res, true);
    if ($code >= 400) {
        $msg = is_array($data) ? ($data['message'] ?? 'Errore Supabase') : 'Errore Supabase';
        $pg  = is_array($data) ? (string) ($data['code'] ?? '') : '';
        throw new SupabaseError("HTTP $code su $table: $msg", $code, $pg);
    }
    return is_array($data) ? $data : [];
}

function sb_select(string $table, array $query = []): array
{
    return sb_request('GET', $table, $query);
}

function sb_insert(string $table, array $row): array
{
    $rows = sb_request('POST', $table, [], $row, true);
    return $rows[0] ?? [];
}

function sb_update(string $table, int $id, array $row): ?array
{
    $rows = sb_request('PATCH', $table, ['id' => 'eq.' . $id], $row, true);
    return $rows[0] ?? null;
}

function sb_insert_many(string $table, array $rows): array
{
    return $rows ? sb_request('POST', $table, [], $rows, true) : [];
}

function sb_delete_where(string $table, array $filters): void
{
    sb_request('DELETE', $table, $filters);
}

function sb_delete(string $table, int $id): void
{
    sb_request('DELETE', $table, ['id' => 'eq.' . $id]);
}

/** Carica un file nel bucket pubblico e ritorna l'URL pubblico. */
function sb_upload(string $path, string $bytes, string $mime): string
{
    $bucket = rawurlencode((string) cfg('SUPABASE_BUCKET', 'media'));
    $url = sb_base() . '/storage/v1/object/' . $bucket . '/' . $path;
    $headers = sb_headers(false);
    $headers[] = 'Content-Type: ' . $mime;
    $headers[] = 'Cache-Control: max-age=31536000';
    [$code, $res] = sb_curl('POST', $url, $headers, $bytes);
    if ($code >= 400) {
        throw new SupabaseError("Upload fallito ($code): $res", $code);
    }
    return sb_base() . '/storage/v1/object/public/' . $bucket . '/' . $path;
}
