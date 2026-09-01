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
    private string $port;
    private int $baud;

    public function __construct(array $config = [])
    {
        $this->sdkPath = $config['sdk_path'] ?? '';
        $this->deviceId = $config['device_id'] ?? 0;
        $this->port = $config['port'] ?? 'COM3';
        $this->baud = $config['baud'] ?? 57600;
    }

    public function scan(): ?int
    {
        // WA28 : vérif SDK/port
        if (empty($this->sdkPath) || !is_dir($this->sdkPath)) {
            throw new \RuntimeException(
                'SDK WA28 non configuré. Renseignez sdk_path et port dans config/biometric.php (ex: C:/WA28/SDK, COM3).'
            );
        }
        // TODO WA28 : brancher le SDK réel
        // Exemple WA28 UART :
        // $wa = new \WA28\Device($this->port, $this->baud);
        // $template = $wa->capture(5000);
        // return $this->matchTemplate($template);
        // Exemple WA28 DLL :
        // $dll = FFI::load($this->sdkPath.'/WA28.dll');
        // $buf = $dll->WA28_Capture($this->deviceId);
        throw new \RuntimeException(
            'Lecteur WA28 non implémenté. Ajoutez l\'appel SDK dans SdkReader::scan() dès réception du SDK.'
        );
    }

    public function enroll(int $userId): string
    {
        if (empty($this->sdkPath) || !is_dir($this->sdkPath)) {
            throw new \RuntimeException(
                'SDK WA28 non configuré. Renseignez sdk_path dans config/biometric.php.'
            );
        }
        // TODO WA28 : capturer template et le retourner pour stockage
        // $wa = new \WA28\Device($this->port, $this->baud);
        // $template = $wa->enroll($userId);
        // return bin2hex($template);
        throw new \RuntimeException(
            'Enrôlement WA28 non implémenté. Ajoutez l\'appel SDK dans SdkReader::enroll() dès réception du SDK.'
        );
    }

    public function name(): string
    {
        if (!empty($this->sdkPath) && is_dir($this->sdkPath)) {
            return 'WA28 (' . $this->port . ')';
        }
        return 'WA28 (SDK non configuré)';
    }

    /** Factory helper : crée le reader depuis config/biometric.php */
    public static function fromConfig(): self
    {
        $cfg = require __DIR__ . '/../../../config/biometric.php';
        $driver = $cfg['driver'] ?? 'wa28';
        $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['wa28'] ?? [];
        return new self($conf);
    }
}