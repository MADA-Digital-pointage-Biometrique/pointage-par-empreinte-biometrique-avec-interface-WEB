<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}
$input = getJsonInput();
$current = $input['currentPassword'] ?? $input['current_password'] ?? '';
$new = $input['newPassword'] ?? $input['new_password'] ?? '';

if (empty($current) || empty($new)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Mot de passe actuel et nouveau requis.']);
    exit;
}
$policyErr = passwordPolicyCheck($new);
if ($policyErr !== null) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => $policyErr]);
    exit;
}
try {
    $pdo = getDB();
    $uid = (int) $_SESSION['user_id'];
    // Vérifie que l'utilisateur existe dans utilisateurs_systeme (admin) ou employes avec compte ?
    $stmt = $pdo->prepare('SELECT mot_de_passe_hash FROM utilisateurs_systeme WHERE id_utilisateur = ? LIMIT 1');
    $stmt->execute([$uid]);
    $row = $stmt->fetch();
    if (!$row) {
        http_response_code(404);
        echo json_encode(['ok' => false, 'message' => 'Utilisateur introuvable.']);
        exit;
    }
    $hash = $row['mot_de_passe_hash'];
    if (!password_verify($current, $hash)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Mot de passe actuel incorrect.']);
        exit;
    }
    $newHash = hashPassword($new);
    $pdo->prepare('UPDATE utilisateurs_systeme SET mot_de_passe_hash = ? WHERE id_utilisateur = ?')->execute([$newHash, $uid]);
    echo json_encode(['ok' => true, 'message' => 'Mot de passe mis à jour avec succès.']);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('change_password: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur serveur.']);
}
