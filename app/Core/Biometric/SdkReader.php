<?php

namespace App\Core\Biometric;

/**
 * Lecteur biométrique pour matériel USB réel (DigitalPersona, SecuGen, ZKTeco, etc.).
 * 
 * Nécessite l'installation du SDK du fabricant et la configuration du chemin
 * vers les bibliothèques natives dans config/biometric.php.
 */
class SdkReader implements FingerprintReader
{
    private string $sdkPath;
    private int $deviceId;

    public function __construct(array $config = [])
    {
        $this->sdkPath = $config['sdk_path'] ?? '';
        $this->deviceId = $config['device_id'] ?? 0;
    }

    public function scan(): ?int
    {
        if (empty($this->sdkPath) || !is_dir($this->sdkPath)) {
            throw new \RuntimeException(
                'SDK biométrique non configuré. Configurez le chemin du SDK dans config/biometric.php.'
            );
        }

        // TODO: Implémenter l'appel au SDK natif selon le matériel utilisé
        // Exemple pour DigitalPersona / HID Global:
        // $template = $this->sdk->Capture();
        // $userId = $this->matchTemplate($template);

        // Pour l'instant, on lance une exception claire
        throw new \RuntimeException(
            'Lecteur biométrique USB non implémenté. '
            . 'Implémentez l\'intégration SDK dans SdkReader::scan().'
        );
    }

    public function enroll(int $userId): string
    {
        if (empty($this->sdkPath) || !is_dir($this->sdkPath)) {
            throw new \RuntimeException(
                'SDK biométrique non configuré. Configurez le chemin du SDK dans config/biometric.php.'
            );
        }

        // TODO: Implémenter l'enrôlement via SDK natif
        throw new \RuntimeException(
            'Enrôlement USB non implémenté. '
            . 'Implémentez l\'intégration SDK dans SdkReader::enroll().'
        );
    }

    public function name(): string
    {
        return 'Lecteur USB (SDK non configuré)';
    }
}