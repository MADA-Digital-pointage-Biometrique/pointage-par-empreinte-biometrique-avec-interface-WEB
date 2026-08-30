<?php
require_once __DIR__ . '/db.php';

if (isset($_SESSION['user']) && isset($_SESSION['user_id'])) {
    echo json_encode([
        'ok'   => true,
        'user' => $_SESSION['user']
    ]);
} else {
    http_response_code(401);
    echo json_encode([
        'ok'   => false,
        'user' => null,
        'message' => 'Non authentifié.'
    ]);
}
