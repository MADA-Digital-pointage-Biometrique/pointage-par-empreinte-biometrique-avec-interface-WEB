<?php

namespace App\Core\Biometric;

/**
 * Lecteur biométrique générique via HTTP (dispositif réseau / Wi-Fi).
 *
 * Remplace le pilote R307+Python : le Frontend et les API sont INCHANGÉS
 * (mêmes endpoints, mêmes contrats JSON). Seul le transport vers le
 * matériel change : ici des appels HTTP JSON vers le dispositif configuré
 * dans config/biometric.php (DEVICE_BASE_URL).
 *
 * Contrat attendu côté dispositif (firmware) — préfixe configuré par
 * 'api_prefix' (défaut '/api') :
 *   POST {base}/api/enroll1  {template_id}            -> {ok}
 *   POST {base}/api/enroll2  {template_id}            -> {ok, template_hex?}
 *   POST {base}/api/search   {}                       -> {ok, template_id, score}
 *                                                      ou {ok:false} si aucun match
 *   POST {base}/api/delete   {template_id}            -> {ok}
 *   GET  {base}/api/probe?template_id=N               -> {ok, present}
 *   GET  {base}/api/count                             -> {ok, count}
 *   GET  {base}/api/template?template_id=N            -> {ok, template}
 *
 * Sans dispositif joignable : RuntimeException explicite (les API
 * affichent alors HS / message propre, jamais de 500 brut).
 * Dump de gabarit non supporté : hex=null (les API enregistrent le
 * mapping + statut actif, comme le cas "nodump").
 */
class HttpDeviceReader implements FingerprintReader
{
    private string $baseUrl;
    private string $apiPrefix;
    private ?string $token;
    private int $timeout;
    private int $quickTimeout;
    private string $deviceId;
    private int $threshold;

    public function __construct(array $config = [])
    {
        $this->baseUrl = rtrim($config['base_url'] ?? '', '/');
        $this->apiPrefix = '/' . trim($config['api_prefix'] ?? '/api', '/');
        $this->token = $config['token'] ?? null;
        if ($this->token === '') $this->token = null;
        $this->timeout = (int)($config['timeout'] ?? 15);
        $this->quickTimeout = (int)($config['quick_timeout'] ?? 4);
        $this->deviceId = $config['device_id'] ?? 'device_main';
        $this->threshold = (int)($config['threshold'] ?? 60);
    }

    /** Appel HTTP JSON vers le dispositif. Lève RuntimeException si injoignable. */
    private function callDevice(string $method, string $path, array $payload = [], ?int $timeout = null): array
    {
        if ($this->baseUrl === '') {
            throw new \RuntimeException('Dispositif biométrique non configuré (DEVICE_BASE_URL vide).');
        }
        $url = $this->baseUrl . $this->apiPrefix . $path;
        if ($method === 'GET' && $payload) $url .= '?' . http_build_query($payload);
        $headers = ['Content-Type: application/json'];
        if ($this->token !== null) $headers[] = 'Authorization: Bearer ' . $this->token;
        $ctx = stream_context_create(['http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $method === 'GET' ? null : json_encode($payload, JSON_UNESCAPED_UNICODE),
            'timeout' => $timeout ?? $this->timeout,
            'ignore_errors' => true,
        ]]);
        $raw = @file_get_contents($url, false, $ctx);
        if ($raw === false) {
            throw new \RuntimeException('Dispositif biométrique injoignable (' . $this->baseUrl . ').');
        }
        $data = json_decode($raw, true);
        if (!is_array($data)) {
            throw new \RuntimeException('Réponse invalide du dispositif biométrique.');
        }
        return $data;
    }

    /** Retourne [template_id, score] ou null (aucun match = null, pas d'exception/500). */
    public function scanWithScore(): ?array
    {
        try {
            $data = $this->callDevice('POST', '/search');
        } catch (\RuntimeException $e) {
            throw $e;
        }
        if (empty($data['ok'])) return null;
        if (!isset($data['template_id'])) return null;
        return ['page_id' => (int)$data['template_id'], 'score' => (int)($data['score'] ?? 0)];
    }

    /** Télécharge le gabarit du slot — hex ou exception si non supporté (=> nodump). */
    public function downloadTemplate(int $slot): string
    {
        $data = $this->callDevice('GET', '/template', ['template_id' => $slot], $this->timeout);
        if (empty($data['ok']) || empty($data['template'])) throw new \RuntimeException('Gabarit indisponible (dump non supporté)');
        return (string)$data['template'];
    }

    /** true si le gabarit est présent côté dispositif. Erreur transport = false. */
    public function probeSlot(int $slot): bool
    {
        if ($slot < 0 || $slot > 999) return false;
        try {
            $data = $this->callDevice('GET', '/probe', ['template_id' => $slot], $this->quickTimeout);
        } catch (\Throwable $e) {
            return false;
        }
        return !empty($data['ok']) && !empty($data['present']);
    }

    /** Nombre de gabarits stockés côté dispositif. */
    public function sensorCount(): int
    {
        $data = $this->callDevice('GET', '/count', [], $this->quickTimeout);
        if (empty($data['ok'])) throw new \RuntimeException('Comptage impossible (dispositif).');
        return (int)($data['count'] ?? 0);
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

    /** Alloue un identifiant de gabarit unique (biometric_slots) — refuse si >999. */
    public function allocateSlot(int $userId): int
    {
        if ($userId < 1) throw new \InvalidArgumentException("slot invalide $userId (1..999)");
        $pdo = \getDB();
        $st = $pdo->prepare('SELECT slot_number FROM biometric_slots WHERE id_employe=? AND device_id=?');
        $st->execute([$userId, $this->deviceId]);
        $row = $st->fetch();
        if ($row) return (int)$row['slot_number'];
        if ($userId <= 999) {
            $chk = $pdo->prepare('SELECT 1 FROM biometric_slots WHERE device_id=? AND slot_number=?');
            $chk->execute([$this->deviceId, $userId]);
            if (!$chk->fetch()) {
                $ins = $pdo->prepare('INSERT INTO biometric_slots (id_employe, device_id, slot_number) VALUES (?,?,?)');
                $ins->execute([$userId, $this->deviceId, $userId]);
                return $userId;
            }
        }
        $all = $pdo->prepare('SELECT slot_number FROM biometric_slots WHERE device_id=? ORDER BY slot_number');
        $all->execute([$this->deviceId]);
        $used = array_map(fn($r)=>(int)$r['slot_number'], $all->fetchAll());
        for ($i=1;$i<=999;$i++) if (!in_array($i,$used,true)) {
            $ins = $pdo->prepare('INSERT INTO biometric_slots (id_employe, device_id, slot_number) VALUES (?,?,?)');
            $ins->execute([$userId, $this->deviceId, $i]);
            return $i;
        }
        throw new \RuntimeException("Capacité du dispositif atteinte (999 gabarits sur {$this->deviceId})", 507);
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

    /** Étape 1/2 : alloue l'identifiant + 1re capture (bloque jusqu'au doigt ou timeout). */
    public function enrollStep1(int $userId): int
    {
        if ($userId < 1 || $userId > 9999) throw new \InvalidArgumentException("userId invalide $userId");
        $slot = $this->allocateSlot($userId);
        $data = $this->callDevice('POST', '/enroll1', ['template_id' => $slot]);
        if (empty($data['ok'])) throw new \RuntimeException($data['message'] ?? 'Capture 1 refusée par le dispositif.');
        return $slot;
    }

    /**
     * Étape 2/2 : 2e capture + fusion + stockage côté dispositif.
     * Retourne ['slot'=>N, 'hex'=>?string] — hex ou null si dump impossible.
     */
    public function enrollStep2(int $userId, int $slot): array
    {
        if ($slot < 1 || $slot > 999) throw new \InvalidArgumentException("slot invalide $slot");
        if ($this->getSlotForUser($userId) !== $slot) {
            throw new \RuntimeException("Slot $slot non alloué à l'employé $userId (reprends à l'étape 1)");
        }
        $data = $this->callDevice('POST', '/enroll2', ['template_id' => $slot]);
        if (empty($data['ok'])) throw new \RuntimeException($data['message'] ?? 'Capture 2 refusée par le dispositif.');
        $hex = $data['template_hex'] ?? null;
        try {
            if ($hex === null) $hex = $this->downloadTemplate($slot);
            if (!preg_match('/^[0-9a-fA-F]+$/', (string)$hex) || (strlen((string)$hex) % 2) !== 0) {
                throw new \RuntimeException('Gabarit non-hexadécimal');
            }
            return ['slot' => $slot, 'hex' => strtolower((string)$hex)];
        } catch (\Throwable $e) {
            error_log("HttpDeviceReader enroll slot $slot: dump impossible (" . $e->getMessage() . ")");
            return ['slot' => $slot, 'hex' => null];
        }
    }

    public function delete(int $userId): void
    {
        $slot = $this->getSlotForUser($userId);
        if ($slot === null) {
            if ($userId >=1 && $userId <=999) $slot = $userId; else return;
        }
        $data = $this->callDevice('POST', '/delete', ['template_id' => $slot]);
        if (empty($data['ok'])) throw new \RuntimeException($data['message'] ?? 'Suppression refusée par le dispositif.');
        try { $pdo=\getDB(); $pdo->prepare('DELETE FROM biometric_slots WHERE id_employe=? AND device_id=?')->execute([$userId,$this->deviceId]); } catch(\Throwable $e){}
    }

    public function deleteSlot(int $slot): void
    {
        $data = $this->callDevice('POST', '/delete', ['template_id' => $slot]);
        if (empty($data['ok'])) throw new \RuntimeException($data['message'] ?? 'Suppression refusée par le dispositif.');
    }

    public function name(): string { return 'Dispositif biométrique HTTP (' . ($this->baseUrl !== '' ? $this->baseUrl : 'non configuré') . ')'; }

    public static function fromConfig(): self
    {
        $cfg = require __DIR__ . '/../../../config/biometric.php';
        $driver = $cfg['driver'] ?? 'device';
        $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['device'] ?? [];
        return new self($conf);
    }
}
