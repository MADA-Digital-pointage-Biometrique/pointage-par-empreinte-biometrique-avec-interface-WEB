<?php

return [
    // Capteur cible : R307 + CP2102 (USB-UART). PHP -> Python -> capteur
    'driver' => 'r307',

    'drivers' => [
        // R307 + CP2102 — relié direct PC, piloté par python/r307_cli.py (PHP -> Python -> capteur)
        'r307' => [
            'class'      => \App\Core\Biometric\SdkReader::class,
            'port'       => 'COM3', // à ajuster : COM3/COM4 (CP2102). Mets 'auto' pour détection CP2102
            'baud'       => 57600,
            'python'     => 'py', // Windows: 'py', sinon 'python' ou 'C:/Python312/python.exe'
            'cli'        => __DIR__ . '/../python/r307_cli.py',
            'timeout'    => 15,
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