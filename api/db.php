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

// ── Session durcie : httponly, samesite, lifetime ──
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '0');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_strict_mode', '1');
ini_set('expose_php', '0');
if (session_status() === PHP_SESSION_NONE) {
    $isHttps = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (isset($_SERVER['HTTP_X_FORWARDED_PROTO']) && $_SERVER['HTTP_X_FORWARDED_PROTO'] === 'https');
    $samesite = $isHttps ? 'None' : 'Lax';
    // Pour SameSite=None, Secure doit être true
    $secure = $isHttps;
    if ($samesite === 'None' && !$secure) $samesite = 'Lax';
    ini_set('session.cookie_httponly', '1');
    ini_set('session.cookie_secure', $secure ? '1' : '0');
    session_set_cookie_params([
        'lifetime' => 0,
        'path' => '/',
        'domain' => '',
        'secure' => $secure,
        'httponly' => true,
        'samesite' => $samesite
    ]);
    session_start();
    // Timeout inactivité 30 min + fixation
    $timeout = 1800;
    if (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $timeout)) {
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
    } elseif (isset($_SESSION['user_id']) && empty($_SESSION['regenerated'])) {
        session_regenerate_id(true);
        $_SESSION['regenerated'] = true;
    }
    $_SESSION['last_activity'] = time();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}

header('Content-Type: application/json; charset=utf-8');
// CORS strict même origine uniquement (pas de localhost wildcards)
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$host = $_SERVER['HTTP_HOST'] ?? '';
$allowedOrigins = [];
if ($host) {
    $allowedOrigins[] = 'http://' . $host;
    $allowedOrigins[] = 'https://' . $host;
}
if ($origin && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Access-Control-Allow-Credentials: true');
    header('Vary: Origin');
}
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-CSRF-Token, Authorization');
header('Access-Control-Max-Age: 86400');
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: DENY');
header('X-XSS-Protection: 0');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; style-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://fonts.googleapis.com https://fonts.gstatic.com; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com data:; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'");

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

// CSRF central : vérifie automatiquement POST/PUT/DELETE sauf login/logout/csrf/me + sensor_mode/status (borne mobile sans session admin)
$__method = $_SERVER['REQUEST_METHOD'] ?? '';
$__csrfExempt = ['/api/login.php', '/api/logout.php', '/api/csrf.php', '/api/me.php', '/api/sensor_mode.php', '/api/sensor_status.php', '/api/borne_pointage.php', '/api/sync_offline.php'];
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
