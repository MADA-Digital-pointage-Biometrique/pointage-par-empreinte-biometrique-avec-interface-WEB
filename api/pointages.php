<?php
require_once __DIR__ . '/db.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// Vérification auth + RBAC pour les opérations sensibles
if (in_array($method, ['POST','PUT','DELETE']) && !isset($_SESSION['user_id'])) {
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}
if (in_array($method, ['POST','PUT','DELETE'])) {
    $role = $_SESSION['role'] ?? '';
    if (!in_array($role, ['super_admin','admin_systeme'])) {
        echo json_encode(['ok' => false, 'message' => 'Accès refusé : seul le Super Administrateur peut modifier les pointages.']);
        exit;
    }
    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? getJsonInput()['csrf_token'] ?? null;
    if (!verifyCsrf($token)) {
        echo json_encode(['ok' => false, 'message' => 'Jeton CSRF invalide.']);
        exit;
    }
}

if ($method === 'GET') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    try {
        // Groupé par employé + date : combine entree/sortie en une ligne
        $stmt = $pdo->query('
            SELECT 
                MIN(p.id_pointage) AS id,
                p.id_employe AS user_id,
                DATE(p.date_heure) AS date,
                MIN(CASE WHEN p.type_pointage = "entree" THEN TIME(p.date_heure) END) AS entree,
                MAX(CASE WHEN p.type_pointage = "sortie" THEN TIME(p.date_heure) END) AS sortie,
                MIN(e.matricule) AS matricule,
                MIN(e.nom) AS nom,
                MIN(e.prenom) AS prenom,
                MIN(d.nom_departement) AS departement
            FROM pointages p
            LEFT JOIN employes e ON p.id_employe = e.id_employe
            LEFT JOIN departements d ON e.id_departement = d.id_departement
            GROUP BY p.id_employe, DATE(p.date_heure)
            ORDER BY date DESC, entree DESC
            LIMIT 200
        ');
        $rows = $stmt->fetchAll();
        $pointages = [];
        foreach ($rows as $r) {
            $pointages[] = [
                'id' => (int) $r['id'],
                'user_id' => (int) $r['user_id'],
                'date' => $r['date'],
                'entree' => $r['entree'] ? substr($r['entree'],0,8) : null,
                'sortie' => $r['sortie'] ? substr($r['sortie'],0,8) : null,
                'user' => [
                    'id' => (int) $r['user_id'],
                    'matricule' => $r['matricule'],
                    'nom' => $r['nom'],
                    'prenom' => $r['prenom'],
                    'departement' => $r['departement']
                ]
            ];
        }
        echo json_encode(['ok' => true, 'pointages' => $pointages]);
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'message' => 'Erreur pointages: ' . $e->getMessage()]);
    }
    exit;
}

if ($method === 'PUT') {
    $input = getJsonInput();
    $id = (int)($input['id'] ?? 0);
    $date = trim($input['date'] ?? '');
    $entree = trim($input['entree'] ?? '');
    $sortie = trim($input['sortie'] ?? '');
    if ($id <= 0 || empty($date)) {
        echo json_encode(['ok' => false, 'message' => 'Données invalides.']);
        exit;
    }
    try {
        // Retrouver l'employé et la date d'origine via l'id groupé
        $origStmt = $pdo->prepare('SELECT id_employe, DATE(date_heure) as date FROM pointages WHERE id_pointage = ?');
        $origStmt->execute([$id]);
        $orig = $origStmt->fetch();
        if (!$orig) {
            echo json_encode(['ok' => false, 'message' => 'Pointage introuvable.']);
            exit;
        }
        $userId = (int)$orig['id_employe'];
        $oldDate = $orig['date'];
        // Helper pour upsert entree/sortie
        $upsert = function($type, $time) use ($pdo, $userId, $oldDate, $date) {
            if (empty($time)) {
                // Supprimer si vide
                $del = $pdo->prepare('DELETE FROM pointages WHERE id_employe = ? AND DATE(date_heure) = ? AND type_pointage = ?');
                $del->execute([$userId, $oldDate, $type]);
                // Si date changée et time vide, rien à créer
                return;
            }
            $newDateTime = $date . ' ' . $time;
            // Chercher existant sur ancienne date
            $chk = $pdo->prepare('SELECT id_pointage FROM pointages WHERE id_employe = ? AND DATE(date_heure) = ? AND type_pointage = ? LIMIT 1');
            $chk->execute([$userId, $oldDate, $type]);
            $existing = $chk->fetch();
            if ($existing) {
                $upd = $pdo->prepare('UPDATE pointages SET date_heure = ?, type_pointage = ? WHERE id_pointage = ?');
                $upd->execute([$newDateTime, $type, $existing['id_pointage']]);
            } else {
                $ins = $pdo->prepare('INSERT INTO pointages (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, source_donnee, statut) VALUES (UUID(), ?, ?, ?, "manuel", "serveur", "valide")');
                $ins->execute([$userId, $type, $newDateTime]);
            }
        };
        $pdo->beginTransaction();
        $upsert('entree', $entree);
        $upsert('sortie', $sortie);
        // Si la date a changé, les nouvelles lignes sont déjà à la nouvelle date via upsert
        $pdo->commit();
        // Retourner le pointage mis à jour groupé
        $stmt = $pdo->prepare('
            SELECT MIN(p.id_pointage) AS id, p.id_employe AS user_id, DATE(p.date_heure) AS date,
                   MIN(CASE WHEN p.type_pointage="entree" THEN TIME(p.date_heure) END) AS entree,
                   MAX(CASE WHEN p.type_pointage="sortie" THEN TIME(p.date_heure) END) AS sortie
            FROM pointages p WHERE p.id_employe = ? AND DATE(p.date_heure) = ? GROUP BY p.id_employe, DATE(p.date_heure) LIMIT 1
        ');
        $stmt->execute([$userId, $date]);
        $row = $stmt->fetch();
        echo json_encode(['ok' => true, 'message' => 'Pointage mis à jour.', 'pointage' => $row ? [
            'id' => (int)$row['id'], 'user_id' => (int)$row['user_id'], 'date' => $row['date'], 'entree' => $row['entree'] ? substr($row['entree'],0,8) : null, 'sortie' => $row['sortie'] ? substr($row['sortie'],0,8) : null
        ] : null]);
    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['ok' => false, 'message' => 'Erreur mise à jour: ' . $e->getMessage()]);
    }
    exit;
}
