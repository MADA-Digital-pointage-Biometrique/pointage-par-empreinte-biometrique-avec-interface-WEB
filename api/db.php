<?php
// ── Chargeur de variables d'environnement (.env) ──
(function() {
    $envPath = __DIR__ . '/../.env';
    if (!file_exists($envPath)) return;
    $lines = file($envPath, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
    foreach ($lines as $line) {
        $line = trim($line);
        if ($line === '' || str_starts_with($line, '#')) continue;
        if (str_contains($line, '=')) {
            list($name, $value) = explode('=', $line, 2);
            $name = trim($name);
            $value = trim($value, " \t\n\r\0\x0B\"'");
            if (getenv($name) === false) {
                putenv("$name=$value");
                $_ENV[$name] = $value;
                $_SERVER[$name] = $value;
            }
        }
    }
})();

// ── Session durcie centralisée (HttpOnly + SameSite, voir config/session.php) ──
require_once __DIR__ . '/../config/session.php';

header('Content-Type: application/json; charset=utf-8');
// Pas de CORS : frontend 100 % même origine (fetch relatifs, connect-src 'self').
// Aucun en-tête Access-Control-* émis → le navigateur applique strictement la SOP.
// (L'ancien code reflétait Origin quand il égalait Host, or Host est falsifiable
//  par l'attaquant → réflexion abusive signalée par ZAP.)
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 0');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");
header('Strict-Transport-Security: max-age=31536000; includeSubDomains; preload');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// CSRF helper
function csrfToken(): string {
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf_token'];
}
function verifyCsrf(?string $token): bool {
    return isset($_SESSION['csrf_token']) && hash_equals($_SESSION['csrf_token'], $token ?? '');
}

// H3 : politique mot de passe centralisée — 12 car. min, majuscule, minuscule, chiffre.
// Retourne null si OK, sinon le message d'erreur à afficher.
const PASSWORD_BCRYPT_COST = 12;
function passwordPolicyCheck(string $pwd): ?string {
    if (strlen($pwd) < 12) return 'Le mot de passe doit contenir au moins 12 caractères.';
    if (!preg_match('/[A-Z]/', $pwd) || !preg_match('/[a-z]/', $pwd) || !preg_match('/[0-9]/', $pwd)) {
        return 'Le mot de passe doit contenir majuscule, minuscule et chiffre.';
    }
    return null;
}
function hashPassword(string $pwd): string {
    return password_hash($pwd, PASSWORD_BCRYPT, ['cost' => PASSWORD_BCRYPT_COST]);
}

function getDB(): PDO {
    static $pdo = null;
    if ($pdo === null) {
        $configFile = __DIR__ . '/../config/database.php';
        if (!file_exists($configFile)) {
            http_response_code(500);
            echo json_encode(['ok' => false, 'message' => 'Configuration indisponible.']);
            exit;
        }
        try {
            $config = require $configFile;
            // C2 : refuse de connecter sans identifiants explicites (.env).
            if (empty($config['username']) || !isset($config['password']) || $config['password'] === '') {
                error_log('DB config: DB_USERNAME/DB_PASSWORD manquants (.env).');
                http_response_code(500);
                echo json_encode(['ok' => false, 'message' => 'Configuration indisponible.']);
                exit;
            }
            $driver = $config['driver'] ?? 'mysql';
            if ($driver === 'pgsql') {
                $host = $config['host']; $port = $config['port'] ?? 5432; $db = $config['dbname']; $ssl = $config['sslmode'] ?? 'require';
                $dsn = sprintf('pgsql:host=%s;port=%d;dbname=%s;sslmode=%s', $host, $port, $db, $ssl);
            } else {
                $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['dbname'], $config['charset']);
            }
            $isPgsql = ($driver === 'pgsql');
            $pdo = new PDO($dsn, $config['username'], $config['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => false,
                PDO::ATTR_PERSISTENT         => $isPgsql, // réutilise connexion TLS vers Supabase pooler
                PDO::ATTR_TIMEOUT            => 5,
            ]);
            if ($isPgsql) $pdo->exec("SET statement_timeout = 5000");
        } catch (Throwable $e) {
            http_response_code(500);
            error_log('DB connect error: ' . $e->getMessage());
            echo json_encode(['ok' => false, 'message' => 'Erreur de connexion.']);
            exit;
        }
    }
    return $pdo;
}

function getJsonInput(): array {
    $raw = file_get_contents('php://input');
    if ($raw) {
        $decoded = json_decode($raw, true);
        if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
            return $decoded;
        }
    }
    return $_POST;
}

// CSRF central : vérifie automatiquement POST/PUT/DELETE sauf login/logout/csrf/me.
// bornes (borne_pointage/sync_offline) : exemptées car auth par X-Device-Token.
// sensor_status : GET uniquement, le contrôle ne s'applique pas.
// H2 : sensor_mode.php N'EST PLUS exempté (POST admin) — le JS envoie X-CSRF-Token.
$__method = $_SERVER['REQUEST_METHOD'] ?? '';
$__csrfExempt = ['/api/login.php', '/api/logout.php', '/api/csrf.php', '/api/me.php', '/api/sensor_status.php', '/api/borne_pointage.php', '/api/sync_offline.php'];
$__requestUri = $_SERVER['REQUEST_URI'] ?? '';
$__scriptName = $_SERVER['SCRIPT_NAME'] ?? '';
$__isExempt = false;
foreach ($__csrfExempt as $__ex) {
    if (str_contains($__requestUri, $__ex) || str_contains($__scriptName, $__ex)) {
        $__isExempt = true; break;
    }
}
if (in_array($__method, ['POST','PUT','DELETE']) && !$__isExempt) {
    $__token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? ($_POST['csrf_token'] ?? null);
    if (empty($__token)) {
        $__json = getJsonInput();
        $__token = $__json['csrf_token'] ?? null;
    }
    if (!verifyCsrf($__token)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Jeton CSRF invalide ou manquant.']);
        exit;
    }
}
