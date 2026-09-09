<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

// M2 : sonde non publique — session admin OU clé (monitoring) OU CLI.
// Un scan anonyme ne doit ni tester la DB ni lire le statut session.
$isCli = php_sapi_name() === 'cli';
$key = $_GET['key'] ?? '';
$expected = getenv('CRON_SECRET') ?: '';
$authed = isset($_SESSION['user_id']) || $isCli
    || ($expected !== '' && hash_equals($expected, (string)$key));
if (!$authed) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'Accès refusé.']);
    exit;
}

$dbStatus = 'disconnected';
$dbError = null;

try {
    $pdo = getDB();
    $pdo->query('SELECT 1');
    $dbStatus = 'connected';
} catch (Throwable $e) {
    $dbError = $e->getMessage();
    http_response_code(500);
}

echo json_encode([
    'ok' => ($dbStatus === 'connected'),
    'status' => ($dbStatus === 'connected') ? 'healthy' : 'unhealthy',
    'timestamp' => date('c'),
    'session_status' => session_status() === PHP_SESSION_ACTIVE ? 'active' : 'inactive',
    'db' => $dbStatus,
    'error' => $dbError
]);