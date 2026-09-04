<?php

return [
    // Capteur cible : R307 + CP2102 (USB-UART). PHP -> Python -> capteur
    'driver' => 'r307',

    'drivers' => [
        // R307 + CP2102 — relié direct PC, piloté par python/r307_cli.py (PHP -> Python -> capteur)
        // R307 + CP2102 — relié direct PC, piloté par python/r307_cli.py (PHP -> Python -> capteur)
        'r307' => [
            'class'      => \App\Core\Biometric\SdkReader::class,
            'port'       => getenv('R307_PORT') ?: 'COM3', // à ajuster : COM3/COM4 (CP2102). Mets 'auto' pour détection CP2102
            'baud'       => (int)(getenv('R307_BAUD') ?: 57600),
            'python'     => getenv('R307_PYTHON_PATH') ?: 'python',
            'cli'        => __DIR__ . '/../python/r307_cli.py',
            'timeout'    => 15,
            'threshold'  => 60, // score minimal R307 (0..100) pour accepter pointage
            'device_id'  => 'r307_main',
            'anti_double_seconds' => 45,
            'password'   => getenv('R307_PASSWORD') ?: '00000000', // remplace défaut 0x00000000
        ],
        // Fallback générique (legacy)
        'wa28' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => '',
            'device_id' => 0,
            'port'      => 'COM3',
            'baud'      => 57600,
        ],
        'usb' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => 'C:/Program Files/DigitalPersona/SDK/bin',
            'device_id' => 0,
        ],
    ],
];