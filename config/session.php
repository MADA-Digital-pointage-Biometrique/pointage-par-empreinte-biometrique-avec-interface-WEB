<?php
require_once __DIR__ . '/asset.php';
// Bootstrap session centralisé — TOUTES les pages/API doivent passer par ici
// (jamais de session_start() nu, sinon PHPSESSID sans HttpOnly/SameSite).
// Garantit : HttpOnly + SameSite=Lax (ou None+Secure en HTTPS) + timeout 30 min.
ini_set('session.cookie_httponly', '1');
ini_set('session.cookie_secure', '0');
ini_set('session.use_only_cookies', '1');
ini_set('session.use_strict_mode', '1');
ini_set('session.gc_maxlifetime', '43200');
ini_set('expose_php', '0');
// M1 : jamais de stack trace / paths vers le client — tout en error.log Apache.
ini_set('display_errors', '0');
ini_set('log_errors', '1');
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
    // Timeout inactivité 30 min + DURÉE ABSOLUE 12h (re-login obligatoire,
    // même si activité continue) + fixation
    $timeout = 1800;
    $absoluteMax = 43200;
    if (empty($_SESSION['session_created'])) {
        $_SESSION['session_created'] = time();
    }
    if ((time() - (int)$_SESSION['session_created'] > $absoluteMax)
        || (isset($_SESSION['last_activity']) && (time() - $_SESSION['last_activity'] > $timeout))) {
        session_unset();
        session_destroy();
        session_start();
        session_regenerate_id(true);
        $_SESSION['session_created'] = time();
    }
    // NOTE : pas de session_regenerate_id() ici volontairement. La régénération
    // n'a lieu qu'au login (api/login.php) et au logout. Un regenerate concurrent
    // (requêtes parallèles du dashboard) détruisait l'ancien fichier de session
    // pendant que d'autres requêtes l'utilisaient encore → 401 aléatoires →
    // boucle infinie dashboard <-> login.
    $_SESSION['last_activity'] = time();
    if (empty($_SESSION['csrf_token'])) {
        $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
    }
}
