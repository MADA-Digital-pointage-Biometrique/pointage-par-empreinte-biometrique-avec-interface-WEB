<?php
require_once __DIR__ . '/db.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── RBAC & CSRF pour toutes les actions d'écriture (POST, PUT, DELETE) ──
if (in_array($method, ['POST', 'PUT', 'DELETE'])) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    
    $role = $_SESSION['role'] ?? '';
    if (!in_array($role, ['super_admin', 'admin_systeme'])) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Accès refusé : réservé exclusivement aux Super Administrateurs.']);
        exit;
    }

    $token = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? getJsonInput()['csrf_token'] ?? null;
    if (!verifyCsrf($token)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Jeton CSRF invalide ou manquant.']);
        exit;
    }
}

// ── GET: Liste des pointages (Groupés par employé + date) ──
if ($method === 'GET') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    try {
        // PERF : ?today=1 restreint au jour (plage indexée) au lieu d'agréger
        // tout l'historique — utilisé par la table "derniers pointages" du dashboard.
        $todayOnly = isset($_GET['today']) && $_GET['today'] !== '0' && $_GET['today'] !== '';
        $where = '';
        $params = [];
        if ($todayOnly) {
            $d1 = date('Y-m-d') . ' 00:00:00';
            $d2 = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
            $where = 'WHERE p.date_heure >= ? AND p.date_heure < ?';
            $params = [$d1, $d2];
        }
        $stmt = $pdo->prepare("
            SELECT
                MIN(p.id_pointage) AS id,
                p.id_employe AS user_id,
                (p.date_heure::date) AS date,
                MIN(CASE WHEN p.type_pointage = 'entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                MAX(CASE WHEN p.type_pointage = 'sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie,
                MIN(e.matricule) AS matricule,
                MIN(e.nom) AS nom,
                MIN(e.prenom) AS prenom,
                MIN(d.nom_departement) AS departement
            FROM pointages p
            LEFT JOIN employes e ON p.id_employe = e.id_employe
            LEFT JOIN departements d ON e.id_departement = d.id_departement
            $where
            GROUP BY p.id_employe, p.date_heure::date
            ORDER BY date DESC, entree DESC
            LIMIT 200
        ");
        $stmt->execute($params);
        $rows = $stmt->fetchAll();
        $pointages = [];
        foreach ($rows as $r) {
            $pointages[] = [
                'id' => (int) $r['id'],
                'user_id' => (int) $r['user_id'],
                'date' => $r['date'],
                'entree' => $r['entree'] ? substr($r['entree'], 0, 8) : null,
                'sortie' => $r['sortie'] ? substr($r['sortie'], 0, 8) : null,
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
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur chargement pointages: ' . $e->getMessage()]);
    }
    exit;
}

// ── POST: Création manuelle d'un nouveau pointage (Entrée / Sortie) ──
if ($method === 'POST') {
    $input   = getJsonInput();
    $userId  = (int) ($input['user_id'] ?? $input['id_employe'] ?? 0);
    $date    = trim($input['date'] ?? '');
    $entree  = trim($input['entree'] ?? '');
    $sortie  = trim($input['sortie'] ?? '');

    if ($userId <= 0 || empty($date)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Employé et date obligatoires.']);
        exit;
    }
    if (empty($entree) && empty($sortie)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Veuillez saisir au moins une heure d\'entrée ou de sortie.']);
        exit;
    }

    try {
        // Vérifier l'existence de l'employé
        $chkEmp = $pdo->prepare('SELECT id_employe FROM employes WHERE id_employe = ?');
        $chkEmp->execute([$userId]);
        if (!$chkEmp->fetch()) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'message' => 'Employé introuvable.']);
            exit;
        }

        $pdo->beginTransaction();

        if (!empty($entree)) {
            $newDateTime = $date . ' ' . $entree;
            $ins = $pdo->prepare("
                INSERT INTO pointages (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, source_donnee, statut) 
                VALUES (gen_random_uuid(), ?, 'entree', ?, 'manuel', 'serveur', 'valide')
            ");
            $ins->execute([$userId, $newDateTime]);
        }

        if (!empty($sortie)) {
            $newDateTime = $date . ' ' . $sortie;
            $ins = $pdo->prepare("
                INSERT INTO pointages (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, source_donnee, statut) 
                VALUES (gen_random_uuid(), ?, 'sortie', ?, 'manuel', 'serveur', 'valide')
            ");
            $ins->execute([$userId, $newDateTime]);
        }

        $pdo->commit();

        // Récupérer le pointage groupé créé
        $stmt = $pdo->prepare("
            SELECT MIN(p.id_pointage) AS id, p.id_employe AS user_id, (p.date_heure::date) AS date,
                   MIN(CASE WHEN p.type_pointage='entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                   MAX(CASE WHEN p.type_pointage='sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie
            FROM pointages p WHERE p.id_employe = ? AND p.date_heure::date = ? GROUP BY p.id_employe, p.date_heure::date LIMIT 1
        ");
        $stmt->execute([$userId, $date]);
        $row = $stmt->fetch();

        cacheClear('dash_' . date('Y-m-d'));
        echo json_encode([
            'ok' => true,
            'message' => 'Pointage créé avec succès.',
            'pointage' => $row ? [
                'id' => (int)$row['id'],
                'user_id' => (int)$row['user_id'],
                'date' => $row['date'],
                'entree' => $row['entree'] ? substr($row['entree'], 0, 8) : null,
                'sortie' => $row['sortie'] ? substr($row['sortie'], 0, 8) : null
            ] : null
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur lors de la création du pointage: ' . $e->getMessage()]);
    }
    exit;
}

// ── PUT: Modification d'un pointage existant ──
if ($method === 'PUT') {
    $input  = getJsonInput();
    $id     = (int) ($input['id'] ?? 0);
    $date   = trim($input['date'] ?? '');
    $entree = trim($input['entree'] ?? '');
    $sortie = trim($input['sortie'] ?? '');

    if ($id <= 0 || empty($date)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'ID pointage et date d\'origine valides requis.']);
        exit;
    }

    try {
        // Retrouver l'employé et la date d'origine via l'id groupé
        $origStmt = $pdo->prepare('SELECT id_employe, (date_heure::date) as date FROM pointages WHERE id_pointage = ?');
        $origStmt->execute([$id]);
        $orig = $origStmt->fetch();
        if (!$orig) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'message' => 'Pointage introuvable.']);
            exit;
        }

        $userId  = (int) $orig['id_employe'];
        $oldDate = $orig['date'];

        $upsert = function($type, $time) use ($pdo, $userId, $oldDate, $date) {
            if (empty($time)) {
                $del = $pdo->prepare('DELETE FROM pointages WHERE id_employe = ? AND (date_heure::date) = ? AND type_pointage = ?');
                $del->execute([$userId, $oldDate, $type]);
                return;
            }
            $newDateTime = $date . ' ' . $time;
            $chk = $pdo->prepare('SELECT id_pointage FROM pointages WHERE id_employe = ? AND (date_heure::date) = ? AND type_pointage = ? LIMIT 1');
            $chk->execute([$userId, $oldDate, $type]);
            $existing = $chk->fetch();
            if ($existing) {
                $upd = $pdo->prepare('UPDATE pointages SET date_heure = ?, type_pointage = ? WHERE id_pointage = ?');
                $upd->execute([$newDateTime, $type, $existing['id_pointage']]);
            } else {
                $ins = $pdo->prepare("INSERT INTO pointages (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, source_donnee, statut) VALUES (gen_random_uuid(), ?, ?, ?, 'manuel', 'serveur', 'valide')");
                $ins->execute([$userId, $type, $newDateTime]);
            }
        };

        $pdo->beginTransaction();
        $upsert('entree', $entree);
        $upsert('sortie', $sortie);
        $pdo->commit();

        $stmt = $pdo->prepare("
            SELECT MIN(p.id_pointage) AS id, p.id_employe AS user_id, (p.date_heure::date) AS date,
                   MIN(CASE WHEN p.type_pointage='entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                   MAX(CASE WHEN p.type_pointage='sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie
            FROM pointages p WHERE p.id_employe = ? AND p.date_heure::date = ? GROUP BY p.id_employe, p.date_heure::date LIMIT 1
        ");
        $stmt->execute([$userId, $date]);
        $row = $stmt->fetch();

        cacheClear('dash_' . date('Y-m-d'));
        echo json_encode([
            'ok' => true,
            'message' => 'Pointage mis à jour avec succès.',
            'pointage' => $row ? [
                'id' => (int)$row['id'],
                'user_id' => (int)$row['user_id'],
                'date' => $row['date'],
                'entree' => $row['entree'] ? substr($row['entree'], 0, 8) : null,
                'sortie' => $row['sortie'] ? substr($row['sortie'], 0, 8) : null
            ] : null
        ]);
    } catch (Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur de mise à jour: ' . $e->getMessage()]);
    }
    exit;
}

// ── DELETE: Suppression définitive d'un pointage (Entrée & Sortie de la journée) ──
if ($method === 'DELETE') {
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'ID pointage invalide.']);
        exit;
    }

    try {
        $origStmt = $pdo->prepare('SELECT id_employe, (date_heure::date) as date FROM pointages WHERE id_pointage = ?');
        $origStmt->execute([$id]);
        $orig = $origStmt->fetch();

        if (!$orig) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'message' => 'Pointage introuvable.']);
            exit;
        }

        $del = $pdo->prepare('DELETE FROM pointages WHERE id_employe = ? AND (date_heure::date) = ?');
        $del->execute([(int)$orig['id_employe'], $orig['date']]);

        cacheClear('dash_' . date('Y-m-d'));
        echo json_encode(['ok' => true, 'message' => 'Pointage supprimé avec succès.']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur de suppression: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
