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

// ── Autoloader minimal (PSR-4 sans composer) : App\ -> app/ ──
// Chaque point d'entrée API inclut db.php : toute classe App\Core\* est donc
// chargeable sans require explicite. Élimine la famille entière de bugs
// « Class App...\ not found » (Crypto, PointageService, ...).
spl_autoload_register(function (string $class): void {
    if (str_starts_with($class, 'App' . chr(92))) {
        $file = __DIR__ . '/../app/' . str_replace(chr(92), '/', substr($class, 4)) . '.php';
        if (is_file($file)) require_once $file;
    }
});

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

// -- Fuseau applicatif (source de verite unique pour les heures de pointage) --
// La borne et l'entreprise operent en UTC+3 (heure de Madagascar) ; PHP/XAMPP
// etait regle sur Europe/Berlin (UTC+2), ce qui decalait tous les NOW() de la
// session PostgreSQL d'une heure en retard. Definissable via .env (APP_TZ).
$tz = getenv('APP_TZ') ?: 'Indian/Antananarivo';
if (!@date_default_timezone_set($tz)) {
    date_default_timezone_set('UTC');
}

// Helpers CSRF + politique mot de passe centralisés (testables, cf. app/Core/CsrfPasswordPolicy.php)
require_once __DIR__ . '/../app/Core/CsrfPasswordPolicy.php';

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
            $dbgHost = null; $dbgSsl = null;
            // B2 : si config/database.php a lu un .env vide, retente via getenv()
            // (putenv du loader : .env présent mais lu AVANT que getenv ne soit
            //  renseigné, ex. requêtes rapides / race au chargement).
            if ((empty($config['username']) || empty($config['password']))
                && getenv('DB_USERNAME') !== false && getenv('DB_PASSWORD') !== false) {
                $config['username'] = getenv('DB_USERNAME');
                $config['password'] = getenv('DB_PASSWORD');
            }
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
                $dbgHost = $host; $dbgSsl = $ssl;
            } else {
                $dsn = sprintf('mysql:host=%s;dbname=%s;charset=%s', $config['host'], $config['dbname'], $config['charset']);
            }
            $isPgsql = ($driver === 'pgsql');
            $pdo = new PDO($dsn, $config['username'], $config['password'], [
                PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES   => true, // PgBouncer (pooler Supabase distant) : les prepared statements natifs cassent aleatoirement (26000/08P01) - emulation obligatoire (inoffensive en direct interne)
                // CORRECTIF : pas de connexions persistantes vers le pooler Supabase
                // (PgBouncer transaction pooling). Elles provoquent des erreurs
                // aléatoires "prepared statement ... does not exist" / "bind message
                // supplies N parameters" — des prepared statements d'une requête
                // précédente fuient sur la connexion réutilisée par un autre worker.
                PDO::ATTR_PERSISTENT         => false,
                PDO::ATTR_TIMEOUT            => 5,
            ]);
            if ($isPgsql) {
                $pdo->exec("SET statement_timeout = 5000");
                // Cohérence des données : la session PG suit le fuseau PHP.
                // TIMESTAMPTZ est un point absolu, mais les regroupements
                // (date::date, CURRENT_DATE, HH24:MI) dépendent du fuseau de
                // session — sans alignement, un serveur en UTC décale les
                // pointages d'un jour et fausse les fenêtres du dashboard.
                $pdo->exec('SET TIME ZONE ' . $pdo->quote(date_default_timezone_get())); // fuseau applicatif (bloc APP_TZ ci-dessus)
            }
        } catch (Throwable $e) {
            http_response_code(500);
            error_log('DB connect error: ' . $e->getMessage());
            // Diagnostic : require vers hôte interne = DB_SSLMODE à corriger.
            // (Comportement inchangé : on signale, on ne downgrade jamais seul.)
            $isInternalHost = function (?string $h): bool {
                if (!is_string($h) || $h === '') return false;
                if (filter_var($h, FILTER_VALIDATE_IP)) {
                    // Privées (10/8...) + réservées (127/8, ::1...) = interne.
                    return filter_var($h, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE) === false;
                }
                if (strpos($h, '.') === false) return true; // nom de service Docker
                return (bool)preg_match('/internal|localhost|\.local$|docker|database|postgres|^db[\-.]/i', $h);
            };
            if (stripos($e->getMessage(), 'SSL') !== false
                && ($dbgSsl ?? 'require') === 'require' && $isInternalHost($dbgHost ?? null)) {
                error_log('Indice : sslmode=require vers base interne probable (' . ($dbgHost ?? '?') . ') — mettez DB_SSLMODE=disable + redeployez.');
            }
            echo json_encode(['ok' => false, 'message' => 'Erreur de connexion.']);
            exit;
        }
    }
    return $pdo;
}

// IP cliente réelle derrière un reverse-proxy (rate-limit login/borne).
// X-Forwarded-For n'est honoré QUE si REMOTE_ADDR appartient aux proxys de
// confiance (env TRUSTED_PROXIES, ex. "172.18.0.0/16"). Sans cela, un client
// direct pourrait spoofeer XFF et contourner les throttles. Défaut : aucune
// confiance (comportement historique = REMOTE_ADDR).
function clientIp(): string {
    $direct = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $xff = $_SERVER['HTTP_X_FORWARDED_FOR'] ?? '';
    if ($xff === '') return $direct;
    $trusted = array_filter(array_map('trim', explode(',', (string)(getenv('TRUSTED_PROXIES') ?: ''))));
    if (empty($trusted)) return $direct;
    foreach ($trusted as $cidr) {
        if (strpos($cidr, '/') === false) {
            if (strcasecmp($direct, $cidr) === 0) {
                $first = trim(strtok($xff, ','));
                return filter_var($first, FILTER_VALIDATE_IP) ? $first : $direct;
            }
            continue;
        }
        [$net, $bits] = explode('/', $cidr, 2) + [null, null];
        $netL = ip2long($net); $ipL = ip2long($direct);
        if ($netL !== false && $ipL !== false && is_numeric($bits) && (int)$bits >= 0 && (int)$bits <= 32) {
            $mask = (int)$bits === 0 ? 0 : (~0 << (32 - (int)$bits));
            if (($netL & $mask) === ($ipL & $mask)) {
                $first = trim(strtok($xff, ','));
                return filter_var($first, FILTER_VALIDATE_IP) ? $first : $direct;
            }
        }
    }
    return $direct;
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

// Cache serveur fichier (TTL secondes) — absorbe la latence du pooler Supabase
// distant (~1s/requête depuis MG ; gain moindre en direct interne, inoffensif)
// sur les lectures agrégées (dashboard). Pas de stampede : écriture atomique
// via LOCK_EX, lecture tolérante aux expirations.
function cacheGet(string $key, int $ttl) {
    $f = sys_get_temp_dir() . '/mada_cache_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    if (!is_file($f) || (time() - @filemtime($f) > $ttl)) return null;
    $j = json_decode(@file_get_contents($f), true);
    return is_array($j) ? $j : null;
}
function cacheSet(string $key, $value): void {
    $f = sys_get_temp_dir() . '/mada_cache_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    @file_put_contents($f, json_encode($value), LOCK_EX);
}
function cacheClear(string $key): void {
    $f = sys_get_temp_dir() . '/mada_cache_' . preg_replace('/[^a-z0-9_]/i', '_', $key) . '.json';
    @unlink($f);
}

// Journal d'audit générique (toutes écritures métier : RH, pointages manuels,
// connexions, départements, mots de passe — la biométrie garde son auditLog
// dédié avec slot/score). Ne fait JAMAIS échouer l'opération appelante :
// table absente (migration non appliquée) = log seul.
function auditWrite(PDO $pdo, string $action, $recordId = null, ?string $table = null, $details = null, ?int $actorId = null): void {
    try {
        $actor = $actorId ?? (isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : null);
        $rec = is_numeric($recordId) ? (int)$recordId : null;
        $det = $details === null ? null : (is_string($details) ? $details : json_encode($details, JSON_UNESCAPED_UNICODE));
        $pdo->prepare("INSERT INTO journal_audit (id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, date_heure) VALUES (?,?,?,?,?,NOW())")
            ->execute([$actor, $action, $table, $rec, $det]);
    } catch (Throwable $e) {
        error_log('auditWrite(' . $action . '): ' . $e->getMessage());
    }
}

// CSRF central : vérifie automatiquement POST/PUT/DELETE sauf login/logout/csrf/me.
// bornes (borne_pointage/sync_offline) : exemptées car auth par X-Device-Token.
// sensor_status : GET uniquement, le contrôle ne s'applique pas.
// H2 : sensor_mode.php N'EST PLUS exempté (POST admin) — le JS envoie X-CSRF-Token.
$__method = $_SERVER['REQUEST_METHOD'] ?? '';
// M3 : logout.php N'EST PLUS exempté (le JS envoie X-CSRF-Token, anti-déconnexion forcée).
$__csrfExempt = ['/api/login.php', '/api/csrf.php', '/api/me.php', '/api/sensor_status.php', '/api/borne_pointage.php', '/api/sync_offline.php'];
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
