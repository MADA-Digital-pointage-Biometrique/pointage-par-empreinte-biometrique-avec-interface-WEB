<?php

namespace App\Core\Biometric;

/**
 * Lecteur R307 + CP2102 (USB-UART)
 * Transport : 1) daemon HTTP local r307_service.py (127.0.0.1:8765, propriétaire
 * unique du port COM, surveillance continue en mode pointage) — 2) fallback
 * exec(python r307_cli.py) si le daemon ne répond pas (dev sans daemon).
 * Flux : Frontend -> api/biometric.php|borne_pointage.php -> SdkReader
 *        -> daemon|CLI -> R307 -> DB via PHP.
 * Corrections: slots uniques (biometric_slots), score, timeout, password env,
 * pas de min(999) silencieux, interpréteur Python multi-candidats (stub
 * Microsoft Store ignoré), quoting Windows.
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
    private string $serviceUrl;

    /** Timeouts HTTP par action (le daemon bloque jusqu'au doigt pour search/enroll). */
    private const DAEMON_TIMEOUTS = [
        'status' => 10, 'count' => 10, 'get-mode' => 5, 'set-mode' => 5,
        'probe' => 20, 'delete' => 20, 'empty' => 30, 'template' => 30,
        'search' => 25, 'verify' => 25,
        // enroll1/2 : le daemon scrute le doigt jusqu'à ~timeout+90 s (boucle de
        // capture automatique) — PHP doit attendre AUSSI LONGTEMPS que le daemon.
        'enroll1' => 130, 'enroll2' => 130, 'enroll' => 120,
    ];

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
        $this->serviceUrl = rtrim(
            $config['service_url'] ?? (getenv('R307_SERVICE_URL') ?: 'http://127.0.0.1:8765'),
            '/'
        );
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

    // ---------------------------------------------------------------------
    // Transport
    // ---------------------------------------------------------------------

    /**
     * Appelle le daemon HTTP local. Retourne null si injoignable (fallback CLI).
     * POST http://127.0.0.1:8765/<action> {"id": N} — le daemon sérialise via
     * son lock série : plus aucun conflit d'accès au port COM.
     */
    private function callDaemon(string $action, int $pageId = 0, ?array $extra = null): ?array
    {
        if ($this->serviceUrl === '') return null;
        $timeout = self::DAEMON_TIMEOUTS[$action] ?? 30;
        $payload = $extra ?? ($pageId > 0 ? ['id' => $pageId] : new \stdClass());
        $ctx = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => json_encode($payload),
            'timeout' => $timeout,
            'ignore_errors' => true, // 4xx/5xx du daemon = JSON {ok:false,...} lisible
        ]]);
        $resp = @file_get_contents($this->serviceUrl . '/' . $action, false, $ctx);
        if ($resp === false) return null;
        $data = json_decode($resp, true);
        return is_array($data) ? $data : null;
    }

    /** Interprète la réponse daemon/CLI : exception codée si échec (404 = aucun match).
     * Rejette les réponses "mock": true pour forcer l'usage du daemon distant. */
    private function interpret(array $data, string $action): array
    {
        // Rejet explicite des réponses mock (CLI fallback sans matériel)
        if (isset($data['mock']) && $data['mock'] === true) {
            throw new \RuntimeException(
                'Réponse mock détectée — R307_SERVICE_URL doit pointer vers le daemon sur l\'hôte (ex: http://host.docker.internal:8765). '
                . 'Le fallback CLI mock est désactivé pour les opérations critiques.',
                503
            );
        }
        if (empty($data['ok'])) {
            // F2 : aucun match = code 404 (scanWithScore → null, message propre, pas de 500).
            $isNoMatch = ($action === 'search' || $action === 'verify')
                && isset($data['message']) && stripos($data['message'], 'correspondance') !== false;
            throw new \RuntimeException($data['message'] ?? 'Erreur R307', $isNoMatch ? 404 : 500);
        }
        return $data;
    }

    /** Liste mémoïsée des interpréteurs Python candidats (stub Store exclu si possible). */
    private function pythonCandidates(): array
    {
        static $cache = null;
        if ($cache !== null) return $cache;
        $raw = array_values(array_unique(array_filter([
            $this->python,
            getenv('R307_PYTHON_PATH') ?: null,
            'py',
            'python',
        ], fn($v) => $v !== null && $v !== '' && strtolower((string)$v) !== 'auto')));
        $validated = [];
        $unvalidated = [];
        foreach ($raw as $bin) {
            $isPath = strpbrk((string)$bin, '/\\') !== false;
            if ($isPath) {
                if (is_file($bin)) $validated[] = $bin;
                else $unvalidated[] = $bin; // chemin relatif : on tente quand même
                continue;
            }
            // Nom nu : vérifie la présence réelle (stub WindowsApps de 'python' muet sinon).
            $found = trim((string)shell_exec('where ' . escapeshellarg($bin) . ' 2>NUL'));
            if ($found === '') $found = trim((string)shell_exec('which ' . escapeshellarg($bin) . ' 2>/dev/null'));
            if ($found !== '') $validated[] = $bin;
        }
        $cache = array_merge($validated, $unvalidated) ?: $raw ?: [$this->python];
        return $cache;
    }

    /** Exécute le CLI avec chaque interpréteur jusqu'à obtenir un JSON. Null si rien. */
    private function execCli(string $cliArgs): ?array
    {
        foreach ($this->pythonCandidates() as $bin) {
            $cmd = $this->q((string)$bin) . ' ' . $this->q($this->cli) . $cliArgs . ' 2>&1';
            $out = [];
            $code = 0;
            exec($cmd, $out, $code);
            $data = json_decode(implode("\n", $out), true);
            if (is_array($data)) return $data;
        }
        return null;
    }

    private function callPython(string $action, int $pageId = 0): array
    {
        // 1) Daemon (propriétaire du COM) — silence si non lancé.
        $data = $this->callDaemon($action, $pageId);
        if ($data !== null) return $this->interpret($data, $action);

        // 2) Fallback CLI direct (dev sans daemon — mêmes sémantiques qu'avant).
        $args = ' --port ' . $this->q($this->port)
            . ' --baud ' . (int)$this->baud
            . ' --timeout ' . (int)$this->timeout
            . ' --password ' . $this->q($this->password)
            . ' --action ' . $this->q($action);
        if ($pageId > 0) $args .= ' --id ' . (int)$pageId;
        $data = $this->execCli($args);
        if ($data === null) {
            throw new \RuntimeException('R307 injoignable (daemon arrêté et CLI sans réponse Python)');
        }
        return $this->interpret($data, $action);
    }

    /** État du daemon + surveillance (UI page Capteur). Null si daemon arrêté. */
    public function getStatus(): ?array
    {
        $data = $this->callDaemon('status');
        if ($data === null || empty($data['ok'])) return null;
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

    /** B3 : true si la page est occupée côté capteur (LOAD, sans téléchargement). */
    public function probeSlot(int $slot): bool
    {
        if ($slot < 0 || $slot > 999) return false;
        try {
            $data = $this->callPython('probe', $slot);
        } catch (\Throwable $e) {
            return false;
        }
        return !empty($data['present']);
    }

    /** B3 : nombre de gabarits stockés côté capteur (TEMPLATE_NUM). */
    public function sensorCount(): int
    {
        $data = $this->callPython('status');
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

    /**
     * Bascule le terminal en mode "enrolement" (pour $targetId) ou "pointage".
     * Aucun accès matériel : écrit python/mode.json (daemon ou CLI, tous deux
     * traitent set-mode/get-mode hors port série).
     */
    public function setMode(string $mode, ?int $targetId = null, ?int $updatedBy = null): array
    {
        if (!in_array($mode, ['enrolement', 'pointage'], true)) {
            throw new \InvalidArgumentException("mode invalide: $mode");
        }
        if ($mode === 'enrolement' && !$targetId) {
            throw new \InvalidArgumentException('target_id requis pour passer en mode enrolement');
        }
        $args = ' --action set-mode --mode ' . $this->q($mode);
        if ($mode === 'enrolement') $args .= ' --target-id ' . (int)$targetId;
        if ($updatedBy) $args .= ' --updated-by ' . (int)$updatedBy;

        $payload = ['mode' => $mode];
        if ($mode === 'enrolement') $payload['target_id'] = (int)$targetId;
        if ($updatedBy) $payload['updated_by'] = (int)$updatedBy;
        $data = $this->callDaemon('set-mode', 0, $payload);
        if ($data === null) {
            $data = $this->execCli($args);
        }
        if (!is_array($data) || empty($data['ok'])) {
            throw new \RuntimeException('Changement de mode R307 échoué: ' . ($data['message'] ?? 'pas de réponse'));
        }
        return $data;
    }

    /** Lit le mode courant du terminal (python/mode.json via daemon ou CLI). */
    public function getMode(): array
    {
        $data = $this->callDaemon('get-mode');
        if ($data === null) $data = $this->execCli(' --action get-mode');
        return is_array($data) ? $data : ['ok' => false, 'mode' => 'pointage', 'target_id' => null];
    }

    /** Enrôlement complet en un appel (compat) = étape 1 + étape 2. */
    public function enroll(int $userId, ?int $updatedBy = null): array
    {
        $slot = $this->enrollStep1($userId, $updatedBy);
        return $this->enrollStep2($userId, $slot);
    }

    /** Étape 1/2 : alloue le slot, passe le terminal en mode enrolement, puis 1re capture. */
    public function enrollStep1(int $userId, ?int $updatedBy = null): int
    {
        if ($userId < 1 || $userId > 9999) throw new \InvalidArgumentException("userId invalide $userId");
        $slot = $this->allocateSlot($userId);
        $this->setMode('enrolement', $userId, $updatedBy);
        try {
            $this->callPython('enroll1');
        } catch (\Throwable $e) {
            // Capture 1 échouée : libère le terminal plutôt que de le laisser bloqué en enrôlement.
            try { $this->setMode('pointage'); } catch (\Throwable $e2) {}
            throw $e;
        }
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
        // Toujours repasser en mode pointage après cette étape (succès ou échec) :
        // sinon le terminal reste bloqué en enrolement si enroll2 échoue.
        try {
            $this->callPython('enroll2', $slot);
        } finally {
            try { $this->setMode('pointage'); } catch (\Throwable $e2) {}
        }
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

    /**
     * Vide TOTALEMENT la bibliothèque du capteur (PgEmpty : 999 pages).
     * Retourne ['ok'=>bool, 'purged'=>int, 'message'=>string] — jamais d'exception,
     * l'appelant (purge_all) décide du message selon le résultat capteur/BDD.
     */
    public function emptyLibrary(): array
    {
        $before = 0;
        try { $before = $this->sensorCount(); } catch (\Throwable $e) { /* capteur absent */ }
        try {
            $this->callPython('empty');
            return ['ok' => true, 'purged' => $before, 'message' => 'Bibliothèque capteur vidée'];
        } catch (\Throwable $e) {
            return ['ok' => false, 'purged' => 0, 'message' => $e->getMessage()];
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
