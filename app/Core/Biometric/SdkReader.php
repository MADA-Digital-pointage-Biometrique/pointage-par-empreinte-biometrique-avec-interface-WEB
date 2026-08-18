<?php

namespace App\Core\Biometric;

/**
 * Modèle de branchement d'un lecteur réel via son SDK.
 * À adapter selon le constructeur (DigitalPersona, SecuGen, ZKTeco...).
 */
class SdkReader implements FingerprintReader
{
    public function scan(): ?int
    {
        // Exemple : le SDK retourne un identifiant après comparaison locale.
        // $template = $this->capture();
        // $user_id = $this->match($template);
        // return $user_id;
        throw new \RuntimeException('Driver "usb" non implémenté : intégrer le SDK de votre lecteur.');
    }

    public function enroll(int $userId): string
    {
        // Exemple : capture du template puis stockage chiffré.
        // return base64_encode($this->capture());
        throw new \RuntimeException('Driver "usb" non implémenté : intégrer le SDK de votre lecteur.');
    }

    public function name(): string
    {
        return 'Lecteur USB (SDK)';
    }
}