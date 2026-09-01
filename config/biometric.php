<?php

return [
    // Capteur cible : WA28 (USB). Changer en 'usb' pour autre matériel.
    'driver' => 'wa28',

    'drivers' => [
        // WA28 - capteur cible (à compléter dès réception du SDK)
        'wa28' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => '', // ex: C:/WA28/SDK  ou C:/Program Files/WA28/bin
            'device_id' => 0,
            'port'      => 'COM3', // port série si WA28 en mode UART
            'baud'      => 57600,
            'timeout'   => 5000,
        ],
        // Fallback générique USB
        'usb' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => 'C:/Program Files/DigitalPersona/SDK/bin',
            'device_id' => 0,
        ],
    ],
];