<?php
require_once __DIR__ . '/db.php';
if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']); exit; }
$input = getJsonInput();
$action = $input['action'] ?? '';
$userId = (int)($input['user_id'] ?? 0);
if (!in_array($action, ['enroll','verify']) || $userId<=0) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Paramètres invalides']); exit; }
// Génère challenge 32 octets
$challenge = random_bytes(32);
$_SESSION['webauthn_challenge'] = rtrim(strtr(base64_encode($challenge), '+/', '-_'), '=');
$_SESSION['webauthn_challenge_time'] = time();
$_SESSION['webauthn_challenge_user'] = $userId;
echo json_encode(['ok'=>true, 'challenge'=>$_SESSION['webauthn_challenge']]);
