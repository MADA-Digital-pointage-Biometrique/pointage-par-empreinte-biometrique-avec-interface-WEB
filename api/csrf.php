<?php
require_once __DIR__ . '/db.php';
echo json_encode(['ok' => true, 'csrf_token' => csrfToken()]);
