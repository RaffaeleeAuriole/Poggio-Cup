<?php
declare(strict_types=1);

require_once __DIR__ . '/../includes/http.php';
require_once __DIR__ . '/../includes/data.php';

api_boot();
require_method('GET');

// Cache breve: protegge i limiti del piano gratuito di Supabase quando molte persone aprono il sito.
json_out(build_payload(), 200, 'public, max-age=15, s-maxage=15');
