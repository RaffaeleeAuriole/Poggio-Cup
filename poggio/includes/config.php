<?php
declare(strict_types=1);

/**
 * Configurazione: legge includes/config.local.php, oppure le variabili d'ambiente.
 */
function cfg(string $key, $default = null)
{
    static $conf = null;
    if ($conf === null) {
        $conf = [
            'SUPABASE_BUCKET' => 'media',
            'TIMEZONE'        => 'Europe/Rome',
        ];
        $local = __DIR__ . '/config.local.php';
        if (is_file($local)) {
            $loaded = require $local;
            if (is_array($loaded)) {
                $conf = array_merge($conf, $loaded);
            }
        }
    }
    if (isset($conf[$key]) && $conf[$key] !== '') {
        return $conf[$key];
    }
    $env = getenv($key);
    return ($env !== false && $env !== '') ? $env : $default;
}

date_default_timezone_set((string) cfg('TIMEZONE', 'Europe/Rome'));
mb_internal_encoding('UTF-8');
