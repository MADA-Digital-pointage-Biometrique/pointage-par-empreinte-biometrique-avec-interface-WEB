<?php

return [
    'driver' => 'usb',

    'drivers' => [
        // Lecteur USB réel (à configurer selon le SDK du matériel : DigitalPersona, SecuGen, ZKTeco, etc.)
        'usb' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => 'C:/Program Files/DigitalPersona/SDK/bin',
            'device_id' => 0,
        ],
    ],
];