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

// ── Helpers archive ────────────────────────────────────────────────────────

// Détection tolérante de la table d'archive (migration_historique.sql peut ne
// pas être appliquée — l'union ne doit jamais casser l'API).
function archiveTableExists(PDO $pdo): bool {
    try {
        return (bool) $pdo->query("SELECT to_regclass('public.historique_pointages') IS NOT NULL")->fetchColumn();
    } catch (Throwable $e) {
        return false;
    }
}

// Retrouve la ligne d'origine d'un pointage groupé dans la table active OU
// dans l'archive (les ids proviennent de la même séquence → pas de collision).
function pointageOrigin(PDO $pdo, int $id, bool $hasArchive): ?array {
    $st = $pdo->prepare('SELECT id_employe, (date_heure::date) AS date FROM pointages WHERE id_pointage = ?');
    $st->execute([$id]);
    $row = $st->fetch();
    if ($row) return ['row' => $row, 'table' => 'pointages'];
    if ($hasArchive) {
        $st = $pdo->prepare('SELECT id_employe, (date_heure::date) AS date FROM historique_pointages WHERE id_pointage = ?');
        $st->execute([$id]);
        $row = $st->fetch();
        if ($row) return ['row' => $row, 'table' => 'historique_pointages'];
    }
    return null;
}

// ── GET ?totals=1 : totaux d'heures de travail du mois (table heures_mensuelles) ──
if ($method === 'GET' && isset($_GET['totals'])) {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    $mois = preg_match('/^\d{4}-\d{2}$/', $_GET['mois'] ?? '') ? ($_GET['mois'] . '-01') : date('Y-m-01');
    echo json_encode(['ok' => true, 'mois' => substr($mois, 0, 7), 'totals' => \App\Core\WorkHours::monthTotals($pdo, $mois)]);
    exit;
}

// ── GET: Liste des pointages (Groupés par employé + date) ──
if ($method === 'GET') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    if (session_status() === PHP_SESSION_ACTIVE) session_write_close();
    try {
        $hasArchive = archiveTableExists($pdo);

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

        // Historique complet : l'union avec la table d'archive est indispensable —
        // archive_pointages() déplace chaque nuit les pointages passés dans
        // historique_pointages ; sans l'union, la page Historique perdrait tout
        // ce qui est antérieur à aujourd'hui. Pas de LIMIT : tout afficher.
        $cols = 'id_pointage, id_employe, type_pointage, date_heure, methode_verification, source_donnee';
        $source = $hasArchive
            ? "SELECT $cols FROM pointages UNION ALL SELECT $cols FROM historique_pointages"
            : "SELECT $cols FROM pointages";

        $stmt = $pdo->prepare("
            SELECT
                MIN(p.id_pointage) AS id,
                p.id_employe AS user_id,
                (p.date_heure::date) AS date,
                MIN(CASE WHEN p.rn = 1 AND p.type_pointage = 'entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                MIN(CASE WHEN p.rn = 2 AND p.type_pointage = 'sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie,
                MIN(CASE WHEN p.rn = 3 AND p.type_pointage = 'entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree2,
                MIN(CASE WHEN p.rn = 4 AND p.type_pointage = 'sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie2,
                MIN(e.matricule) AS matricule,
                MIN(e.nom) AS nom,
                MIN(e.prenom) AS prenom,
                MIN(d.nom_departement) AS departement,
                MIN(p.methode_verification) AS methode_verification,
                MIN(p.source_donnee) AS source_donnee
            FROM (
                SELECT q.*, ROW_NUMBER() OVER (PARTITION BY q.id_employe, (q.date_heure::date) ORDER BY q.date_heure, q.id_pointage) AS rn
                FROM ($source) q
            ) p
            LEFT JOIN employes e ON p.id_employe = e.id_employe
            LEFT JOIN departements d ON e.id_departement = d.id_departement
            $where
            GROUP BY p.id_employe, p.date_heure::date
            ORDER BY date DESC, entree DESC
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
                'entree2' => $r['entree2'] ? substr($r['entree2'], 0, 8) : null,
                'sortie2' => $r['sortie2'] ? substr($r['sortie2'], 0, 8) : null,
                'total_secondes' => \App\Core\WorkHours::secondsFromDayTimes($r['entree'], $r['sortie'], $r['entree2'], $r['sortie2']),
                'methode_verification' => $r['methode_verification'],
                'source_donnee' => $r['source_donnee'],
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
    // Heure de sortie doit être après l'entrée
    if (!empty($entree) && !empty($sortie) && $sortie <= $entree) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'L\'heure de sortie doit être après l\'heure d\'entrée.']);
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
        // Plafond : 2 entrées / 2 sorties (4 pointages) par employé et par jour
        $dup = $pdo->prepare('SELECT COUNT(*) FROM pointages WHERE id_employe = ? AND (date_heure::date) = ?::date');
        $dup->execute([$userId, $date]);
        if ((int) $dup->fetchColumn() >= 4) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'message' => 'Un pointage existe déjà pour cet employé à cette date. Modifiez-le au lieu d\'en créer un nouveau.']);
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
        auditWrite($pdo, 'pointage_manuel_cree', $userId, 'pointages', ['date' => $date, 'entree' => $entree ?: null, 'sortie' => $sortie ?: null]);

        // Recalcule le total d'heures du mois (totaux cumulés actif + archive)
        try { \App\Core\WorkHours::recalcMonth($pdo, $userId, substr($date, 0, 7) . '-01'); } catch (\Throwable $e) { error_log('recalcMonth(post): ' . $e->getMessage()); }

        // Récupérer le pointage groupé créé
        $stmt = $pdo->prepare("
            SELECT MIN(p.id_pointage) AS id, p.id_employe AS user_id, (p.date_heure::date) AS date,
                   MIN(CASE WHEN p.type_pointage='entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                   MAX(CASE WHEN p.type_pointage='sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie
            FROM pointages p WHERE p.id_employe = ? AND p.date_heure::date = ? GROUP BY p.id_employe, p.date_heure::date LIMIT 1
        ");
        $stmt->execute([$userId, $date]);
        $row = $stmt->fetch();

        foreach (['today', '7d', '30d'] as $p) cacheClear('dash_' . $p);
        echo json_encode([
            'ok' => true,
            'message' => 'Pointage créé avec succès.',
            'pointage' => $row ? [
                'id' => (int)$row['id'],
                'user_id' => (int)$row['user_id'],
                'date' => $row['date'],
                'entree' => $row['entree'] ? substr($row['entree'], 0, 8) : null,
                'sortie' => $row['sortie'] ? substr($row['sortie'], 0, 8) : null,
                'entree2' => $row['entree2'] ? substr($row['entree2'], 0, 8) : null,
                'sortie2' => $row['sortie2'] ? substr($row['sortie2'], 0, 8) : null
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
    $entree2 = trim($input['entree2'] ?? '');
    $sortie2 = trim($input['sortie2'] ?? '');

    if ($id <= 0 || empty($date)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'ID pointage et date d\'origine valides requis.']);
        exit;
    }
    if (!empty($entree) && !empty($sortie) && $sortie <= $entree) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'L\'heure de sortie doit être après l\'heure d\'entrée.']);
        exit;
    }        // Sémantique PUT : clés absentes = champs non envoyés = inchangés
        // (l'éditeur de l'Historique n'a pas les champs 2e paire ; il ne doit
        // donc PAS vider la 2e paire en POSTant sans ces clés).
        $hasPair2 = array_key_exists('entree2', $input) || array_key_exists('sortie2', $input);
        if (!$hasPair2) { $entree2 = null; $sortie2 = null; }

        // Paire 2 : la sortie 2 doit être après l'entrée 2, elle-même après la 1re sortie
    if (!empty($entree2) && !empty($sortie2) && $sortie2 <= $entree2) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'La 2e heure de sortie doit être après la 2e heure d\'entrée.']);
        exit;
    }
    if (!empty($entree2) && !empty($sortie) && $entree2 <= $sortie) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'La 2e entrée doit être après la première sortie.']);
        exit;
    }

    try {
        // Retrouver l'employé et la date d'origine via l'id groupé — la ligne
        // peut vivre dans pointages OU dans historique_pointages (archivée).
        $hasArchive = archiveTableExists($pdo);
        $origin = pointageOrigin($pdo, $id, $hasArchive);
        if (!$origin) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'message' => 'Pointage introuvable.']);
            exit;
        }

        $userId  = (int) $origin['row']['id_employe'];
        $oldDate = $origin['row']['date'];
        // Toutes les écritures restent dans la table d'origine de la ligne.
        $target  = $origin['table'];
        // Si la date change, vérifier qu'aucun autre pointage n'existe déjà à la nouvelle date
        if ($date !== $oldDate) {
            foreach (['pointages', 'historique_pointages'] as $dupTable) {
                if ($dupTable === 'historique_pointages' && !$hasArchive) continue;
                $dup = $pdo->prepare("SELECT 1 FROM $dupTable WHERE id_employe = ? AND (date_heure::date) = ?::date LIMIT 1");
                $dup->execute([$userId, $date]);
                if ($dup->fetch()) {
                    http_response_code(409);
                    echo json_encode(['ok' => false, 'message' => 'Un pointage existe déjà à la nouvelle date pour cet employé.']);
                    exit;
                }
            }
        }

        $upsert = function($type, $time, $ord) use ($pdo, $userId, $oldDate, $date, $target) {
            // Lignes existantes de ce type, ordonnées → index 0 = paire 1, index 1 = paire 2
            $lst = $pdo->prepare("SELECT id_pointage FROM $target WHERE id_employe = ? AND (date_heure::date) = ? AND type_pointage = ? ORDER BY date_heure, id_pointage");
            $lst->execute([$userId, $oldDate, $type]);
            $rows = $lst->fetchAll();
            if (empty($time)) {
                // Champ vidé : supprime la ligne de l'emplacement visé
                if (isset($rows[$ord])) {
                    $pdo->prepare("DELETE FROM $target WHERE id_pointage = ?")->execute([$rows[$ord]['id_pointage']]);
                }
                return;
            }
            $newDateTime = $date . ' ' . $time;
            if (isset($rows[$ord])) {
                $upd = $pdo->prepare("UPDATE $target SET date_heure = ?, type_pointage = ? WHERE id_pointage = ?");
                $upd->execute([$newDateTime, $type, $rows[$ord]['id_pointage']]);
            } else {
                $ins = $pdo->prepare("INSERT INTO $target (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, source_donnee, statut) VALUES (gen_random_uuid(), ?, ?, ?, 'manuel', 'serveur', 'valide')");
                $ins->execute([$userId, $type, $newDateTime]);
            }
        };

        // Plafond 2 paires : au plus 2 entrées et 2 sorties par jour (avant ouverture de tx)
        foreach ([['entree', 'entrées', $entree], ['entree', 'entrées', $entree2], ['sortie', 'sorties', $sortie], ['sortie', 'sorties', $sortie2]] as [$t, $label, $v]) {
            if (empty($v)) continue;
            $c = $pdo->prepare("SELECT COUNT(*) FROM $target WHERE id_employe = ? AND (date_heure::date) = ? AND type_pointage = ?");
            $c->execute([$userId, $oldDate, $t]);
            if ((int) $c->fetchColumn() >= 2) {
                http_response_code(409);
                echo json_encode(['ok' => false, 'message' => "Journée complète : 2 $label maximum pour cet employé à cette date."]);
                exit;
            }
        }

        $pdo->beginTransaction();
        if ($entree2 === null) {
            $upsert('entree',  $entree,  0);
            $upsert('sortie',  $sortie,  0);
        } else {
            $upsert('entree',  $entree,  0);
            $upsert('sortie',  $sortie,  0);
            $upsert('entree',  $entree2, 1);
            $upsert('sortie',  $sortie2, 1);
        }
        $pdo->commit();
        auditWrite($pdo, 'pointage_manuel_modifie', $userId, $target, ['date' => $date, 'entree' => $entree ?: null, 'sortie' => $sortie ?: null]);

        // Recalcule le total d'heures du mois (totaux cumulés actif + archive)
        try { \App\Core\WorkHours::recalcMonth($pdo, $userId, substr($date, 0, 7) . '-01'); } catch (\Throwable $e) { error_log('recalcMonth(put): ' . $e->getMessage()); }

        // Récupérer le pointage groupé créé (4 créneaux) pour rafraîchir la ligne
        $stmt = $pdo->prepare("
            SELECT MIN(p.id_pointage) AS id, p.id_employe AS user_id, (p.date_heure::date) AS date,
                   MIN(CASE WHEN p.rn = 1 AND p.type_pointage='entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree,
                   MIN(CASE WHEN p.rn = 2 AND p.type_pointage='sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie,
                   MIN(CASE WHEN p.rn = 3 AND p.type_pointage='entree' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS entree2,
                   MIN(CASE WHEN p.rn = 4 AND p.type_pointage='sortie' THEN TO_CHAR(p.date_heure, 'HH24:MI:SS') END) AS sortie2
            FROM (
                SELECT q.*, ROW_NUMBER() OVER (PARTITION BY q.id_employe, (q.date_heure::date) ORDER BY q.date_heure, q.id_pointage) AS rn
                FROM pointages q WHERE q.id_employe = ? AND q.date_heure::date = ?::date
            ) p GROUP BY p.id_employe, p.date_heure::date LIMIT 1
        ");
        $stmt->execute([$userId, $date]);
        $row = $stmt->fetch();

        foreach (['today', '7d', '30d'] as $p) cacheClear('dash_' . $p);
        echo json_encode([
            'ok' => true,
            'message' => 'Pointage mis à jour avec succès.',
            'pointage' => $row ? [
                'id' => (int)$row['id'],
                'user_id' => (int)$row['user_id'],
                'date' => $row['date'],
                'entree' => $row['entree'] ? substr($row['entree'], 0, 8) : null,
                'sortie' => $row['sortie'] ? substr($row['sortie'], 0, 8) : null,
                'entree2' => $row['entree2'] ? substr($row['entree2'], 0, 8) : null,
                'sortie2' => $row['sortie2'] ? substr($row['sortie2'], 0, 8) : null
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
        // La ligne peut vivre dans pointages OU dans historique_pointages (archivée)
        $origin = pointageOrigin($pdo, $id, archiveTableExists($pdo));

        if (!$origin) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'message' => 'Pointage introuvable.']);
            exit;
        }

        $del = $pdo->prepare("DELETE FROM {$origin['table']} WHERE id_employe = ? AND (date_heure::date) = ?");
        $del->execute([(int)$origin['row']['id_employe'], $origin['row']['date']]);
        auditWrite($pdo, 'pointage_supprime', (int)$origin['row']['id_employe'], $origin['table'], ['date' => $origin['row']['date']]);

        foreach (['today', '7d', '30d'] as $p) cacheClear('dash_' . $p);
        echo json_encode(['ok' => true, 'message' => 'Pointage supprimé avec succès.']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur de suppression: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
