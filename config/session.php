<?php
// Bootstrap session centralisé — TOUTES les pages/API doivent passer par ici
// (jamais de session_start() nu, sinon PHPSESSID sans HttpOnly/SameSite).
// Garantit : HttpOnly + SameSite=Lax (ou None+Secure en HTTPS) + timeout 30 min.
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
