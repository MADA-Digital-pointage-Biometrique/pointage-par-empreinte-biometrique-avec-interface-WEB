<?php
// B11 : lecture du journal d'audit (enrôlements, suppressions, scans refusés...).
// Si la table n'existe pas encore (migration non appliquée) : liste vide + flag.
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme','admin'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé.']); exit; }

$limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
$action = trim($_GET['action'] ?? '');

try {
    $pdo = getDB();
    if ($action !== '') {
        $st = $pdo->prepare("SELECT id_audit, id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, TO_CHAR(date_heure,'YYYY-MM-DD HH24:MI:SS') AS date_heure FROM journal_audit WHERE action LIKE ? ORDER BY date_heure DESC LIMIT ?");
        $st->execute([$action.'%', $limit]);
    } else {
        $st = $pdo->prepare("SELECT id_audit, id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, TO_CHAR(date_heure,'YYYY-MM-DD HH24:MI:SS') AS date_heure FROM journal_audit ORDER BY date_heure DESC LIMIT ?");
        $st->execute([$limit]);
    }
    echo json_encode(['ok'=>true,'entries'=>$st->fetchAll()]);
} catch (Throwable $e) {
    // Table absente (migration non appliquée) : pas de 500, liste vide explicite.
    error_log('audit: '.$e->getMessage());
    echo json_encode(['ok'=>true,'entries'=>[],'missing'=>true,'message'=>'Table journal_audit absente — applique database/migration_journal_audit.sql']);
}
