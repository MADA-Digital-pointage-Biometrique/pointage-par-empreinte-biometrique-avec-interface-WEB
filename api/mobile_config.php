<?php
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type');
    $pdo = getDB();
    $cfg = $pdo->query('SELECT mode, user_id, updated_at, updated_by as `by` FROM mobile_config WHERE id=1')->fetch();
    if (!$cfg) { $cfg = ['mode'=>'pointage','user_id'=>null,'updated_at'=>date('c'),'by'=>null]; }
    // Normaliser user_id null
    $cfg['user_id'] = $cfg['user_id'] ? (int)$cfg['user_id'] : null;
    echo json_encode(['ok'=>true, 'config'=>$cfg]);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
    if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme','admin'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé']); exit; }
    $input = getJsonInput();
    $mode = $input['mode'] ?? '';
    $userId = isset($input['user_id']) ? (int)$input['user_id'] : null;
    if (!in_array($mode, ['pointage','enrolement'])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Mode invalide (pointage|enrolement)']); exit; }
    if ($mode === 'enrolement' && !$userId) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'user_id requis pour enrôlement']); exit; }
    $pdo = getDB();
    $pdo->prepare('UPDATE mobile_config SET mode=?, user_id=?, updated_by=? WHERE id=1')->execute([$mode, $mode==='enrolement' ? $userId : null, $_SESSION['user_id']]);
    $cfg = $pdo->query('SELECT mode, user_id, updated_at, updated_by as `by` FROM mobile_config WHERE id=1')->fetch();
    $cfg['user_id'] = $cfg['user_id'] ? (int)$cfg['user_id'] : null;
    echo json_encode(['ok'=>true, 'config'=>$cfg]);
    exit;
}

http_response_code(405);
echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']);
