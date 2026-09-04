<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

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
    'php_version' => PHP_VERSION,
    'session_status' => session_status() === PHP_SESSION_ACTIVE ? 'active' : 'inactive',
    'db' => $dbStatus,
    'error' => $dbError
]);