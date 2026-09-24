<?php

namespace App\Core\Biometric;

/**
 * Superviseur du daemon r307_service.py (127.0.0.1:8765).
 * - isUp()          : sonde /status (timeout court, silencieux)
 * - ensureRunning() : démarre le daemon en tâche de fond s'il est absent
 *                     (spawn détaché sans fenêtre, cooldown 60 s, log
 *                     python/r307_service.log, sonde de confirmation)
 * Utilisé par api/sensor_watch.php (toggle surveillance).
 */
final class R307Supervisor
{
    private const SERVICE_URL = 'http://127.0.0.1:8765';
    private const COOLDOWN_SECONDS = 60;

    /** Daemon joignable ? Retourne sa réponse /status (null sinon). */
    public static function isUp(): ?array
    {
        $ctx = stream_context_create(['http' => [
            'method' => 'GET',
            'timeout' => 2,
            'ignore_errors' => true,
        ]]);
        $resp = @file_get_contents(self::SERVICE_URL . '/status', false, $ctx);
        if ($resp === false) return null;
        $data = json_decode($resp, true);
        return (is_array($data) && !empty($data['ok'])) ? $data : null;
    }

    /**
     * Démarre le daemon s'il ne tourne pas. Retourne
     * ['up'=>bool, 'started'=>bool, 'message'=>string].
     */
    public static function ensureRunning(): array
    {
        if (self::isUp() !== null) {
            return ['up' => true, 'started' => false, 'message' => 'Service déjà actif'];
        }

        // Cooldown : évite de respammer si le démarrage échoue (matériel absent,
        // Python manquant...). Le marqueur expire tout seul.
        $marker = sys_get_temp_dir() . '/r307_spawn_cooldown.json';
        if (is_file($marker)) {
            $m = json_decode((string)@file_get_contents($marker), true);
            if (is_array($m) && ($m['until'] ?? 0) > time()) {
                return ['up' => false, 'started' => false,
                        'message' => 'Démarrage récemment tenté et échoué — réessayez dans ' . max(1, (int)ceil(($m['until'] - time()))) . ' s'];
            }
        }

        $py = self::findPython();
        if ($py === null) {
            self::setCooldown($marker);
            return ['up' => false, 'started' => false,
                    'message' => 'Interpréteur Python introuvable (R307_PYTHON_PATH, py, python)'];
        }

        $dir = dirname(__DIR__, 3) . '/python';
        $script = $dir . '/r307_service.py';
        if (!is_file($script)) {
            return ['up' => false, 'started' => false, 'message' => 'python/r307_service.py introuvable'];
        }

        self::spawn($py, $script, $dir);

        // Sonde de confirmation (≤ 4 s).
        $deadline = microtime(true) + 4.0;
        do {
            if (self::isUp() !== null) {
                return ['up' => true, 'started' => true, 'message' => 'Service de surveillance démarré'];
            }
            usleep(300000);
        } while (microtime(true) < $deadline);

        self::setCooldown($marker);
        $log = $dir . '/r307_service.log';
        $hint = is_file($log) ? ' — voir python/r307_service.log' : '';
        return ['up' => false, 'started' => false,
                'message' => 'Le service ne répond pas après démarrage' . $hint];
    }

    /**
     * Interpréteur Python : R307_PYTHON_PATH → py → python.
     * Validation par EXÉCUTION RÉELLE ("<bin> -c print(1)") et non par `where` :
     * sous le service Apache, le launcher `py` peut résoudre mais échouer à
     * l'exécution ("No installed Python found" — installation par-utilisateur),
     * et le PATH du service diffère de celui du shell.
     */
    private static function findPython(): ?string
    {
        $candidates = [];
        $env = getenv('R307_PYTHON_PATH');
        if ($env && trim($env) !== '' && strtolower(trim($env)) !== 'auto') $candidates[] = trim($env);
        $candidates[] = 'py';
        $candidates[] = 'python';

        foreach ($candidates as $bin) {
            $probe = $bin . ' -c "print(1)" 2>NUL';
            $out = @shell_exec($probe);
            if (trim((string)$out) === '1') return $bin;
        }
        return null;
    }

    /**
     * Spawn détaché Windows (pas de fenêtre, survit au PHP) :
     * cmd /c start "" /b python r307_service.py > log 2>&1
     */
    private static function spawn(string $python, string $script, string $cwd): void
    {
        if (DIRECTORY_SEPARATOR === '\\') {
            $cmd = 'cd /d ' . escapeshellarg($cwd)
                . ' && start "" /b ' . escapeshellarg($python)
                . ' ' . escapeshellarg($script)
                . ' --port auto --baud 57600'
                . ' > ' . escapeshellarg($cwd . '/r307_service.log') . ' 2>&1';
            pclose(popen('cmd /c "' . str_replace('"', '""', $cmd) . '"', 'r'));
        } else {
            $cmd = 'cd ' . escapeshellarg($cwd)
                . ' && nohup ' . escapeshellarg($python) . ' ' . escapeshellarg($script)
                . ' --port auto --baud 57600'
                . ' > ' . escapeshellarg($cwd . '/r307_service.log') . ' 2>&1 &';
            pclose(popen($cmd, 'r'));
        }
    }

    private static function setCooldown(string $marker): void
    {
        @file_put_contents($marker, json_encode(['until' => time() + self::COOLDOWN_SECONDS]));
    }
}
