<?php
require_once __DIR__ . '/db.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Fichier miroir pour Python (R307) : python/mode.json
$modeFile = __DIR__ . '/../python/mode.json';

if ($method === 'GET') {
    if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
    $data = ['mode'=>'pointage','target_id'=>null,'updated_at'=>null];
    if (file_exists($modeFile)) {
        $j = json_decode(@file_get_contents($modeFile), true);
        if (is_array($j)) $data = array_merge($data, $j);
    }
    // Enrichir avec nom employé si target
    if (!empty($data['target_id'])) {
        $stmt = $pdo->prepare('SELECT id_employe, matricule, nom, prenom FROM employes WHERE id_employe = ?');
        $stmt->execute([(int)$data['target_id']]);
        $emp = $stmt->fetch();
        if ($emp) $data['target'] = $emp;
    }
    echo json_encode(['ok'=>true,'mode'=>$data]);
    exit;
}

if ($method === 'POST') {
    if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
    if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Seul Super Admin peut changer le mode']); exit; }
    $input = getJsonInput();
    $mode = $input['mode'] ?? '';
    $targetId = isset($input['target_id']) ? (int)$input['target_id'] : null;
    if (!in_array($mode, ['pointage','enrolement'])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Mode invalide (pointage|enrolement)']); exit; }
    if ($mode === 'enrolement' && empty($targetId)) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Sélectionne un employé à enrôler']); exit; }
    if ($mode === 'enrolement') {
        $chk = $pdo->prepare('SELECT id_employe FROM employes WHERE id_employe = ?');
        $chk->execute([$targetId]);
        if (!$chk->fetch()) { http_response_code(404); echo json_encode(['ok'=>false,'message'=>'Employé introuvable']); exit; }
    } else {
        $targetId = null;
    }
    $payload = ['mode'=>$mode,'target_id'=>$targetId,'updated_at'=>date('c'),'updated_by'=>$_SESSION['user_id']];
    @file_put_contents($modeFile, json_encode($payload, JSON_PRETTY_PRINT));
    // Notifie Python si dispo : touche un fichier trigger
    @touch(__DIR__ . '/../python/.mode_trigger');
    echo json_encode(['ok'=>true,'mode'=>$payload,'message'=> $mode==='enrolement' ? "Mode enrôlement activé pour #$targetId" : "Mode pointage activé"]);
    exit;
}

http_response_code(405);
echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']);