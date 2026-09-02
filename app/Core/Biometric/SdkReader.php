<?php

namespace App\Core\Biometric;

/**
 * Lecteur R307 + CP2102 (USB-UART) - PHP appelle Python qui manipule le capteur
 * Flux : Frontend -> api/biometric.php -> SdkReader -> exec(python r307_cli.py) -> R307 -> DB via PHP
 */
class SdkReader implements FingerprintReader
{
    private string $port;
    private int $baud;
    private string $python;
    private string $cli;
    private int $timeout;

    public function __construct(array $config = [])
    {
        $this->port = $config['port'] ?? 'COM3';
        $this->baud = $config['baud'] ?? 57600;
        $this->python = $config['python'] ?? 'python';
        $this->cli = $config['cli'] ?? __DIR__ . '/../../../python/r307_cli.py';
        $this->timeout = $config['timeout'] ?? 15;
        // legacy
        if (isset($config['sdk_path'])) $this->cli = $config['cli'] ?? $this->cli;
    }

    private function callPython(string $action, int $pageId = 0): array
    {
        $py = escapeshellarg($this->python);
        $cli = escapeshellarg($this->cli);
        $port = escapeshellarg($this->port);
        $baud = (int)$this->baud;
        $cmd = "$py $cli --port $port --baud $baud --action " . escapeshellarg($action);
        if ($pageId > 0) $cmd .= " --id " . (int)$pageId;
        $cmd .= " 2>&1";
        $out = [];
        $code = 0;
        exec($cmd, $out, $code);
        $json = implode("\n", $out);
        $data = json_decode($json, true);
        if (!is_array($data)) {
            throw new \RuntimeException("R307 réponse invalide: $json (code $code) cmd: $cmd");
        }
        if (empty($data['ok'])) {
            throw new \RuntimeException($data['message'] ?? 'Erreur R307');
        }
        return $data;
    }

    public function scan(): ?int
    {
        // Mode pointage : Python fait GenImg+Search sur R307, retourne page_id = id_employe
        $data = $this->callPython('search');
        return isset($data['page_id']) ? (int)$data['page_id'] : null;
    }

    public function enroll(int $userId): string
    {
        // Mode enrôlement : 2 poses sur R307, store page_id = userId
        $pageId = max(1, min(999, $userId)); // R307 pages 0..999
        $data = $this->callPython('enroll', $pageId);
        // On retourne un gabarit fictif mais traçable (le vrai est dans le module R307)
        return 'R307:' . $pageId . ':' . bin2hex(random_bytes(16));
    }

    public function delete(int $pageId): void
    {
        $this->callPython('delete', $pageId);
    }

    public function name(): string
    {
        return 'R307 CP2102 (' . $this->port . '@' . $this->baud . ')';
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