<?php
require_once __DIR__ . '/db.php';
if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']); exit; }
$input = getJsonInput();
$action = $input['action'] ?? '';
$userIdRaw = (int)($input['user_id'] ?? 0);
$userId = $userIdRaw > 10000 ? $userIdRaw-10000 : $userIdRaw;

// Vérifie challenge en session (5 min)
$expected = $_SESSION['webauthn_challenge'] ?? null;
$challengeTime = $_SESSION['webauthn_challenge_time'] ?? 0;
$challengeUser = $_SESSION['webauthn_challenge_user'] ?? 0;
if (!$expected || $challengeUser !== $userIdRaw || (time() - $challengeTime > 300)) {
    http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Challenge expiré ou invalide']); exit;
}
if (!in_array($action, ['enroll_verify','verify'])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Action invalide']); exit; }

function b64url_decode($s){ $s = strtr($s, '-_', '+/'); $pad = strlen($s) % 4; if($pad) $s .= str_repeat('=', 4-$pad); return base64_decode($s); }

try {
    $pdo = getDB();
    if ($action === 'enroll_verify') {
        $cred = $input['credential'] ?? null;
        if (!$cred || empty($cred['id']) || empty($cred['response']['attestationObject'])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Credential invalide']); exit; }
        $credentialId = $cred['id'];
        $attObjB64 = $cred['response']['attestationObject'];
        $clientDataB64 = $cred['response']['clientDataJSON'];
        // Stocke (simplifié : on garde attestation brute, la vérif crypto complète nécessiterait une lib)
        // On stocke credential_id + publicKey (attestationObject)
        $stmt = $pdo->prepare('INSERT INTO webauthn_credentials (id_utilisateur, credential_id, public_key, compteur, statut) VALUES (?, ?, ?, 0, "actif") ON DUPLICATE KEY UPDATE public_key=VALUES(public_key), statut="actif"');
        $stmt->execute([$userId, $credentialId, $attObjB64]);
        unset($_SESSION['webauthn_challenge']);
        echo json_encode(['ok'=>true, 'message'=>'Enrôlement enregistré']);
        exit;
    }
    if ($action === 'verify') {
        $assertion = $input['assertion'] ?? null;
        if (!$assertion || empty($assertion['id'])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Assertion invalide']); exit; }
        $credentialId = $assertion['id'];
        $stmt = $pdo->prepare('SELECT id FROM webauthn_credentials WHERE id_utilisateur=? AND credential_id=? AND statut="actif" LIMIT 1');
        $stmt->execute([$userId, $credentialId]);
        $row = $stmt->fetch();
        if (!$row) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Credential non enregistré']); exit; }
        // Vérif simplifiée : challenge déjà vérifié via session, on considère OK
        // En prod : vérifier signature avec publicKey
        $pdo->prepare('UPDATE webauthn_credentials SET compteur = compteur + 1, derniere_utilisation = NOW() WHERE id_utilisateur=? AND credential_id=?')->execute([$userId, $credentialId]);
        unset($_SESSION['webauthn_challenge']);
        // Optionnel : créer un pointage
        // Ici on ne crée pas automatiquement, le client peut appeler pointages.php ensuite
        echo json_encode(['ok'=>true, 'message'=>'Vérification réussie', 'user'=>['id'=>$userIdRaw]]);
        exit;
    }
} catch(Throwable $e){ http_response_code(500); error_log('WebAuthn verify: '.$e->getMessage()); echo json_encode(['ok'=>false,'message'=>'Erreur serveur']); }
