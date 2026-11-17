<?php
// Copia questo file in "config.local.php" e inserisci i tuoi valori.
// config.local.php NON va mai condiviso o caricato su GitHub.
return [
    // Supabase -> Project Settings -> API
    'SUPABASE_URL'         => 'https://XXXXXXXXXXXX.supabase.co',
    // Chiave "service_role" (legacy) oppure "secret" (sb_secret_...). SEGRETA: resta solo sul server.
    'SUPABASE_SERVICE_KEY' => 'INCOLLA_QUI_LA_CHIAVE_SEGRETA',
    // Nome del bucket pubblico creato su Supabase Storage
    'SUPABASE_BUCKET'      => 'media',

    // Password temporanea per usare setup.php (crea il primo superadmin). Poi cancella setup.php.
    'SETUP_TOKEN'          => 'scegli-una-frase-lunga-e-casuale',

    'TIMEZONE'             => 'Europe/Rome',
];
