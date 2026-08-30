<?php
require_once __DIR__ . '/db.php';
if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']); exit; }
$input = getJsonInput();
$userId = (int)($input['user_id'] ?? 0);
if ($userId<=0) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'user_id invalide']); exit; }
try {
    $pdo = getDB();
    $stmt = $pdo->prepare('SELECT credential_id FROM webauthn_credentials WHERE id_utilisateur = ? AND statut="actif"');
    $stmt->execute([$userId > 10000 ? $userId-10000 : $userId]);
    $rows = $stmt->fetchAll();
    $creds = array_map(fn($r)=>['credential_id'=>$r['credential_id']], $rows);
    echo json_encode(['ok'=>true, 'credentials'=>$creds]);
} catch(Throwable $e){ http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Erreur serveur']); }
