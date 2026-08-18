<?php

namespace App\Core\Biometric;

use App\Core\App;

/**
 * Point d'entrée pour utiliser le lecteur d'empreintes.
 * Le driver actif est défini dans config/biometric.php.
 */
class BiometricReader
{
    private static ?FingerprintReader $instance = null;

    public static function reader(): FingerprintReader
    {
        if (self::$instance === null) {
            $config = require App::basePath() . 'config' . DIRECTORY_SEPARATOR . 'biometric.php';
            $driver = $config['drivers'][$config['driver']] ?? null;

            if ($driver === null || !is_subclass_of($driver['class'], FingerprintReader::class)) {
                throw new \RuntimeException('Driver biométrique invalide : ' . ($config['driver'] ?? ''));
            }

            self::$instance = new $driver['class']();
        }

        return self::$instance;
    }
}