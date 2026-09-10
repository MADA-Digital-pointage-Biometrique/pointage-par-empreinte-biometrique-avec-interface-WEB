<?php

namespace App\Core\Biometric;

/**
 * Lecteur R307 + CP2102 (USB-UART) - PHP appelle Python qui manipule le capteur
 * Flux : Frontend -> api/biometric.php|borne_pointage.php -> SdkReader -> exec(python r307_cli.py) -> R307 -> DB via PHP
 * Corrections: slots uniques (biometric_slots), score, timeout, password env, pas de min(999) silencieux
 */
class SdkReader implements FingerprintReader
{
    private string $port;
    private int $baud;
    private string $python;
    private string $cli;
    private int $timeout;
    private string $deviceId;
    private int $threshold;
    private string $password;

    public function __construct(array $config = [])
    {
        $this->port = $config['port'] ?? 'COM3';
        $this->baud = $config['baud'] ?? 57600;
        $this->python = $config['python'] ?? 'python';
        $this->cli = $config['cli'] ?? __DIR__ . '/../../../python/r307_cli.py';
        $this->timeout = $config['timeout'] ?? 15;
        $this->deviceId = $config['device_id'] ?? 'r307_main';
        $this->threshold = $config['threshold'] ?? 60;
        $this->password = $config['password'] ?? (getenv('R307_PASSWORD') ?: '00000000');
        if (isset($config['sdk_path'])) $this->cli = $config['cli'] ?? $this->cli;
    }

    /** Quote compatible Windows (escapeshellarg = quotes simples, invalides sous cmd.exe). */
    private function q(string $s): string
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            return '"' . str_replace('"', '', $s) . '"';
        }
        return escapeshellarg($s);
    }

    private function callPython(string $action, int $pageId = 0): array
    {
        // F7 : quoting Windows en doubles quotes (chemin python avec espaces).
        $cmd = $this->q($this->python) . ' ' . $this->q($this->cli)
            . ' --port ' . $this->q($this->port)
            . ' --baud ' . (int)$this->baud
            . ' --timeout ' . (int)$this->timeout
            . ' --password ' . $this->q($this->password)
            . ' --action ' . $this->q($action);
        if ($pageId > 0) $cmd .= " --id " . (int)$pageId;
        $cmd .= " 2>&1";
        $out = [];
        $code = 0;
        exec($cmd, $out, $code);
        $json = implode("\n", $out);
        $data = json_decode($json, true);
        // F1 : le message remonte au client via biometric.php — JAMAIS le password.
        $safeCmd = preg_replace("/--password\s+\S+/", '--password ***', $cmd);
        if (!is_array($data)) {
            throw new \RuntimeException("R307 réponse invalide (code $code) cmd: $safeCmd. Détail: " . substr($json, 0, 300));
        }
        if (empty($data['ok'])) {
            // F2 : aucun match = code 404 (scanWithScore → null, message propre, pas de 500).
            $isNoMatch = ($action === 'search' || $action === 'verify')
                && isset($data['message']) && stripos($data['message'], 'correspondance') !== false;
            throw new \RuntimeException($data['message'] ?? 'Erreur R307', $isNoMatch ? 404 : 500);
        }
        return $data;
    }

    /** Retourne [page_id, score] ou null (F2 : aucun match = null, pas d'exception/500) */
    public function scanWithScore(): ?array
    {
        try {
            $data = $this->callPython('search');
        } catch (\RuntimeException $e) {
            if ($e->getCode() === 404) return null;
            throw $e;
        }
        if (!isset($data['page_id'])) return null;
        return ['page_id' => (int)$data['page_id'], 'score' => (int)($data['score'] ?? 0)];
    }

    /** Télécharge le gabarit réel du slot (UP_CHAR) — hex 512 octets. */
    public function downloadTemplate(int $slot): string
    {
        $data = $this->callPython('template', $slot);
        if (empty($data['template'])) throw new \RuntimeException('Gabarit vide (UP_CHAR)');
        return (string)$data['template'];
    }

    public function scan(): ?int
    {
        $r = $this->scanWithScore();
        if (!$r) return null;
        if ($r['score'] < $this->threshold) {
            throw new \RuntimeException("Score trop faible: {$r['score']} < seuil {$this->threshold}");
        }
        return $r['page_id'];
    }

    public function getThreshold(): int { return $this->threshold; }
    public function getDeviceId(): string { return $this->deviceId; }

    /** Alloue un slot unique (biometric_slots) — refuse si >999 */
    public function allocateSlot(int $userId): int
    {
        if ($userId < 1) throw new \InvalidArgumentException("slot invalide $userId (1..999)");
        $pdo = \getDB();
        // Déjà alloué ?
        $st = $pdo->prepare('SELECT slot_number FROM biometric_slots WHERE id_employe=? AND device_id=?');
        $st->execute([$userId, $this->deviceId]);
        $row = $st->fetch();
        if ($row) return (int)$row['slot_number'];
        // Tente id_employe si libre et <=999
        if ($userId <= 999) {
            $chk = $pdo->prepare('SELECT 1 FROM biometric_slots WHERE device_id=? AND slot_number=?');
            $chk->execute([$this->deviceId, $userId]);
            if (!$chk->fetch()) {
                $ins = $pdo->prepare('INSERT INTO biometric_slots (id_employe, device_id, slot_number) VALUES (?,?,?)');
                $ins->execute([$userId, $this->deviceId, $userId]);
                return $userId;
            }
        }
        // Plus petit libre 1..999
        $all = $pdo->prepare('SELECT slot_number FROM biometric_slots WHERE device_id=? ORDER BY slot_number');
        $all->execute([$this->deviceId]);
        $used = array_map(fn($r)=>(int)$r['slot_number'], $all->fetchAll());
        for ($i=1;$i<=999;$i++) if (!in_array($i,$used,true)) {
            $ins = $pdo->prepare('INSERT INTO biometric_slots (id_employe, device_id, slot_number) VALUES (?,?,?)');
            $ins->execute([$userId, $this->deviceId, $i]);
            return $i;
        }
        throw new \RuntimeException("Capacité R307 atteinte (999 slots sur {$this->deviceId})", 507);
    }

    public function getSlotForUser(int $userId): ?int
    {
        $pdo = \getDB();
        $st = $pdo->prepare('SELECT slot_number FROM biometric_slots WHERE id_employe=? AND device_id=?');
        $st->execute([$userId, $this->deviceId]);
        $row = $st->fetch();
        return $row ? (int)$row['slot_number'] : null;
    }

    /** Enrôlement complet en un appel (compat) = étape 1 + étape 2. */
    public function enroll(int $userId): array
    {
        $slot = $this->enrollStep1($userId);
        return $this->enrollStep2($userId, $slot);
    }

    /** Étape 1/2 : alloue le slot + 1re capture (bloque jusqu'au doigt ou timeout). */
    public function enrollStep1(int $userId): int
    {
        if ($userId < 1 || $userId > 9999) throw new \InvalidArgumentException("userId invalide $userId");
        $slot = $this->allocateSlot($userId);
        $this->callPython('enroll1');
        return $slot;
    }

    /**
     * Étape 2/2 : retrait + 2e capture + fusion + stockage.
     * Retourne ['slot'=>N, 'hex'=>?string] — hex brut UP_CHAR (512 o) ou null
     * si le dump est impossible (bytea réel : pas de marqueur texte possible).
     */
    public function enrollStep2(int $userId, int $slot): array
    {
        if ($slot < 1 || $slot > 999) throw new \InvalidArgumentException("slot invalide $slot");
        // Le slot doit appartenir à cet employé (anti-confusion inter-utilisateurs).
        if ($this->getSlotForUser($userId) !== $slot) {
            throw new \RuntimeException("Slot $slot non alloué à l'employé $userId (reprends à l'étape 1)");
        }
        $this->callPython('enroll2', $slot);
        try {
            $hex = $this->downloadTemplate($slot);
            if (!preg_match('/^[0-9a-fA-F]+$/', $hex) || (strlen($hex) % 2) !== 0) {
                throw new \RuntimeException('Gabarit non-hexadécimal');
            }
            return ['slot' => $slot, 'hex' => strtolower($hex)];
        } catch (\Throwable $e) {
            error_log("SdkReader enroll slot $slot: UP_CHAR impossible (" . $e->getMessage() . ")");
            return ['slot' => $slot, 'hex' => null];
        }
    }

    public function delete(int $userId): void
    {
        $slot = $this->getSlotForUser($userId);
        if ($slot === null) {
            // fallback: si pas de mapping, tente userId si <=999
            if ($userId >=1 && $userId <=999) $slot = $userId; else return;
        }
        $this->callPython('delete', $slot);
        // Nettoie mapping seulement après succès Python
        try { $pdo=\getDB(); $pdo->prepare('DELETE FROM biometric_slots WHERE id_employe=? AND device_id=?')->execute([$userId,$this->deviceId]); } catch(\Throwable $e){}
    }

    public function deleteSlot(int $slot): void { $this->callPython('delete', $slot); }

    public function name(): string { return 'R307 CP2102 (' . $this->port . '@' . $this->baud . ')'; }

    public static function fromConfig(): self
    {
        $cfg = require __DIR__ . '/../../../config/biometric.php';
        $driver = $cfg['driver'] ?? 'r307';
        $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['r307'] ?? [];
        return new self($conf);
    }
}
