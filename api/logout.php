<?php
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

$_SESSION = [];
if (ini_get("session.use_cookies")) {
    $params = session_get_cookie_params();
    setcookie(session_name(), '', [
        'expires' => time() - 42000,
        'path' => $params["path"],
        'domain' => $params["domain"],
        'secure' => $params["secure"],
        'httponly' => true,
        'samesite' => $params["samesite"] ?? 'Lax'
    ]);
}
session_destroy();
// M3 : repart sur une session vierge à ID neuf (l'ancien PHPSESSID ne ressuscite jamais).
session_start();
session_regenerate_id(true);
$_SESSION['session_created'] = time();
$_SESSION['last_activity'] = time();
$_SESSION['csrf_token'] = bin2hex(random_bytes(32));

echo json_encode(['ok' => true, 'message' => 'Déconnexion réussie.']);
