<?php
require_once __DIR__ . '/db.php';

header('Content-Type: application/json; charset=utf-8');

echo json_encode([
    'ok' => true,
    'status' => 'healthy',
    'timestamp' => date('c'),
    'php_version' => PHP_VERSION,
    'session_status' => session_status() === PHP_SESSION_ACTIVE ? 'active' : 'inactive',
    'db' => 'connected'
]);