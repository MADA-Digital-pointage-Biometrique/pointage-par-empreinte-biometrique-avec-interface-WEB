<?php
// B11 : lecture du journal d'audit (enrôlements, suppressions, scans refusés...).
// Si la table n'existe pas encore (migration non appliquée) : liste vide + flag.
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé.']); exit; }

// ── DELETE : purge d'entrées cochées (super_admin seul, CSRF via gate central db.php) ──
if (($_SERVER['REQUEST_METHOD'] ?? '') === 'DELETE') {
    if (($_SESSION['role'] ?? '') !== 'super_admin') { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Suppression réservée au Super Admin.']); exit; }
    $in = getJsonInput();
    $ids = $in['ids'] ?? [];
    if (!is_array($ids) || empty($ids)) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Aucune entrée sélectionnée.']); exit; }
    $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn($v) => $v > 0)));
    if (empty($ids) || count($ids) > 200) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Sélection invalide (1 à 200 entrées).']); exit; }
    try {
        $pdo = getDB();
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $del = $pdo->prepare("DELETE FROM journal_audit WHERE id_audit IN ($ph)");
        $del->execute($ids);
        $n = $del->rowCount();
        auditWrite($pdo, 'audit_purge', null, 'journal_audit', ['supprimes' => $n, 'ids' => $ids]);
        echo json_encode(['ok'=>true,'deleted'=>$n]);
    } catch (Throwable $e) {
        error_log('audit DELETE: '.$e->getMessage());
        http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Suppression impossible.']);
    }
    exit;
}

$limit = min(200, max(1, (int)($_GET['limit'] ?? 50)));
$action = trim($_GET['action'] ?? '');

try {
    $pdo = getDB();
    if ($action !== '') {
        $st = $pdo->prepare("SELECT j.id_audit, j.id_utilisateur, j.action, j.table_concernee, j.id_enregistrement_concerne, j.details, TO_CHAR(j.date_heure,'YYYY-MM-DD HH24:MI:SS') AS date_heure, NULLIF(TRIM(COALESCE(u.prenom,'') || ' ' || COALESCE(u.nom,'')), '') AS admin_nom, u.matricule AS admin_matricule FROM journal_audit j LEFT JOIN utilisateurs_systeme u ON u.id_utilisateur = j.id_utilisateur WHERE j.action LIKE ? ORDER BY j.date_heure DESC LIMIT ?");
        $st->execute([$action.'%', $limit]);
    } else {
        $st = $pdo->prepare("SELECT j.id_audit, j.id_utilisateur, j.action, j.table_concernee, j.id_enregistrement_concerne, j.details, TO_CHAR(j.date_heure,'YYYY-MM-DD HH24:MI:SS') AS date_heure, NULLIF(TRIM(COALESCE(u.prenom,'') || ' ' || COALESCE(u.nom,'')), '') AS admin_nom, u.matricule AS admin_matricule FROM journal_audit j LEFT JOIN utilisateurs_systeme u ON u.id_utilisateur = j.id_utilisateur ORDER BY j.date_heure DESC LIMIT ?");
        $st->execute([$limit]);
    }
    echo json_encode(['ok'=>true,'entries'=>$st->fetchAll()]);
} catch (Throwable $e) {
    // Table absente (migration non appliquée) : pas de 500, liste vide explicite.
    error_log('audit: '.$e->getMessage());
    echo json_encode(['ok'=>true,'entries'=>[],'missing'=>true,'message'=>'Table journal_audit absente — applique database/migration_journal_audit.sql']);
}
