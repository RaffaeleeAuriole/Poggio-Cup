<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/auth.php';

/** Upload di foto giocatore / logo squadra su Supabase Storage. */

api_boot();
auth_require();
require_method('POST');
csrf_check();

$kind = $_POST['kind'] ?? '';
if (!in_array($kind, ['players', 'teams'], true)) {
    fail('Tipo di upload non valido.');
}
$f = $_FILES['file'] ?? null;
if (!$f || $f['error'] !== UPLOAD_ERR_OK || !is_uploaded_file($f['tmp_name'])) {
    fail('Caricamento non riuscito.');
}
if ($f['size'] > 2 * 1024 * 1024) {
    fail('Immagine troppo grande (max 2 MB).', 413);
}

// Il tipo viene letto dal contenuto del file, non dal nome o dall'header inviato dal browser.
$info = @getimagesize($f['tmp_name']);
$allowed = [IMAGETYPE_JPEG => ['image/jpeg', 'jpg'], IMAGETYPE_PNG => ['image/png', 'png'], IMAGETYPE_WEBP => ['image/webp', 'webp']];
if (!$info || !isset($allowed[$info[2]])) {
    fail('Formato non supportato: usa JPG, PNG o WEBP.', 415);
}
[$mime, $ext] = $allowed[$info[2]];

$bytes = file_get_contents($f['tmp_name']);
$path  = $kind . '/' . date('Ymd') . '-' . bin2hex(random_bytes(8)) . '.' . $ext;
$url   = sb_upload($path, $bytes, $mime);

json_out(['url' => $url], 201);
