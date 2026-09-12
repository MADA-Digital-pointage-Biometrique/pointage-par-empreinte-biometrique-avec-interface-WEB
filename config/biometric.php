<?php

// Dispositif biométrique générique (HTTP / Wi-Fi).
// Le Frontend et les API sont agnostiques du matériel : seul ce fichier
// désigne le transport (ici HTTP vers le dispositif, ex. circuit Wi-Fi).
// Variables : voir .env.example (DEVICE_*).
return [
    'driver' => 'device',

    'drivers' => [
        'device' => [
            'class'         => \App\Core\Biometric\HttpDeviceReader::class,
            // URL de base du dispositif (sans préfixe d'API).
            'base_url'      => getenv('DEVICE_BASE_URL') ?: '',
            // Préfixe des routes côté firmware (ex. /api).
            'api_prefix'    => getenv('DEVICE_API_PREFIX') ?: '/api',
            // Jeton Bearer optionnel (Authorization: Bearer ...).
            'token'         => getenv('DEVICE_TOKEN') ?: null,
            // Attente doigt / captures (secondes).
            'timeout'       => (int)(getenv('DEVICE_TIMEOUT') ?: 15),
            // Requêtes rapides (état, comptage, sonde).
            'quick_timeout' => (int)(getenv('DEVICE_QUICK_TIMEOUT') ?: 4),
            // Score minimal (0..100) pour accepter un pointage.
            'threshold'     => (int)(getenv('DEVICE_THRESHOLD') ?: 60),
            // Identifiant logique du dispositif (colonne biometric_slots.device_id).
            'device_id'     => getenv('DEVICE_ID') ?: 'device_main',
            // Anti-double pointage (secondes).
            'anti_double_seconds' => 45,
        ],
    ],
];
