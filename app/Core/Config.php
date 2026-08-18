<?php

namespace App\Core;

abstract class Config
{
    public static function heureDebutOfficielle(): string
    {
        return '09:00:00';
    }

    public static function heureFinOfficielle(): string
    {
        return '17:00:00';
    }

    public static function driverBiometrique(): string
    {
        $config = require App::basePath() . 'config' . DIRECTORY_SEPARATOR . 'biometric.php';
        return $config['driver'];
    }
}