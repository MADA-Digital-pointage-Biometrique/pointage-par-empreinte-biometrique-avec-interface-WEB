<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

$pdo = getDB();

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

try {
    $stmt = $pdo->query('SELECT id_departement AS id, nom_departement AS nom FROM departements ORDER BY nom_departement ASC');
    $depts = $stmt->fetchAll();
    foreach ($depts as &$d) {
        $d['id'] = (int) $d['id'];
    }
    echo json_encode(['ok' => true, 'departements' => $depts]);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Departements error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur.']);
}
exit;
