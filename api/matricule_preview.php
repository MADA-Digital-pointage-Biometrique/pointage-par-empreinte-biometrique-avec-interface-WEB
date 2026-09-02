<?php
/**
 * GET /api/matricule_preview.php?id_departement=3
 * Retourne le prochain matricule qui serait généré pour un département donné.
 */
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.', 'matricule' => 'EMP001']);
    exit;
}
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.', 'matricule' => 'EMP001']);
    exit;
}

$pdo      = getDB();
$id_dept  = (int) ($_GET['id_departement'] ?? 0);
$role     = trim($_GET['role'] ?? 'employe');

 // ── Préfixe ADM pour les administrateurs, sinon préfixe département ou EMP
if (in_array($role, ['admin', 'super_admin', 'admin_systeme'])) {
    $prefix = 'ADM';
} else {
    if ($id_dept <= 0) {
        echo json_encode(['ok' => false, 'matricule' => 'EMP001']);
        exit;
    }
    try {
        $deptStmt = $pdo->prepare('SELECT nom_departement FROM departements WHERE id_departement = ?');
        $deptStmt->execute([$id_dept]);
        $dept = $deptStmt->fetch();

        if (!$dept) {
            echo json_encode(['ok' => false, 'matricule' => 'EMP001']);
            exit;
        }

        $deptName = $dept['nom_departement'];
        $clean    = preg_replace('/[^A-Za-z]/', '', $deptName);
        $prefix   = strtoupper(substr($clean, 0, 3));
        if (strlen($prefix) < 2) $prefix = 'EMP';
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'matricule' => 'EMP001', 'message' => $e->getMessage()]);
        exit;
    }
}

try {
    $table = in_array($role, ['admin', 'super_admin', 'admin_systeme']) ? 'utilisateurs_systeme' : 'employes';
    $lastStmt = $pdo->prepare(
        "SELECT matricule FROM $table WHERE matricule LIKE ? ORDER BY CAST(SUBSTRING(matricule FROM 4) AS INTEGER) DESC, matricule DESC LIMIT 1"
    );
    $lastStmt->execute([$prefix . '%']);
    $lastRow = $lastStmt->fetch();

    $nextNum = 1;
    if ($lastRow && preg_match('/(\d+)$/', $lastRow['matricule'], $m)) {
        $nextNum = (int)$m[1] + 1;
    }

    $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
    // Vérifier collision
    $chk = $pdo->prepare("SELECT 1 FROM $table WHERE matricule = ?");
    $chk->execute([$matricule]);
    $attempts = 0;
    while ($chk->fetch() && $attempts < 10) {
        $nextNum++; $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
        $chk->execute([$matricule]); $attempts++;
    }
    echo json_encode(['ok' => true, 'matricule' => $matricule, 'prefix' => $prefix]);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Matricule preview error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'matricule' => 'EMP001', 'message' => 'Erreur.']);
}
exit;
