<?php

return [
    'driver' => 'simulator',

    'drivers' => [
        // Mode démonstration sans matériel : l'employé saisit son matricule
        // à la place de poser le doigt. Identique au flux réel du pointage.
        'simulator' => [
            'class' => \App\Core\Biometric\SimulatorReader::class,
        ],

        // Exemple d'intégration lecteur réel (à compléter avec le SDK du
        // lecteur utilisé : DigitalPersona, SecuGen, ZKTeco, etc.)
        'usb' => [
            'class'     => \App\Core\Biometric\SdkReader::class,
            'sdk_path'  => 'C:/Program Files/DigitalPersona/SDK/bin',
            'device_id' => 0,
        ],
    ],
];