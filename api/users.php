<?php
require_once __DIR__ . '/db.php';

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── RBAC : seul super_admin peut faire CUD (admin = lecture seule) ──
if (in_array($method, ['POST','PUT','DELETE'])) {
    $role = $_SESSION['role'] ?? '';
    if (!in_array($role, ['super_admin','admin_systeme'])) {
        echo json_encode(['ok' => false, 'message' => 'Accès refusé : seul le Super Administrateur peut effectuer cette action.']);
        exit;
    }
    // CSRF déjà vérifié dans db.php pour POST/PUT/DELETE
}

// ─────────────────────────────────────────────
// GET : liste des employés et administrateurs
// ─────────────────────────────────────────────
if ($method === 'GET') {
    if (!isset($_SESSION['user_id'])) {
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
        exit;
    }
    try {
        // Employés : table employes (matricules EMP/INF/DIR...)
        $stmtEmp = $pdo->query("
            SELECT 
                e.id_employe AS id,
                e.matricule,
                e.nom,
                e.prenom,
                e.email,
                e.telephone,
                e.poste,
                e.date_embauche,
                e.statut,
                e.photo_profil,
                d.nom_departement AS departement,
                d.id_departement,
                'employe' AS role,
                CASE WHEN (
                    SELECT COUNT(*) 
                    FROM donnees_biometriques b 
                    WHERE b.id_employe = e.id_employe AND b.statut = 'actif'
                ) > 0 THEN 1 ELSE 0 END AS empreinte
            FROM employes e
            LEFT JOIN departements d ON e.id_departement = d.id_departement
        ");
        $employes = $stmtEmp->fetchAll();

        // Utilisateurs : table utilisateurs_systeme (matricules ADM, indépendants)
        $stmtUsers = $pdo->query("
            SELECT 
                (u.id_utilisateur + 10000) AS id,
                u.matricule,
                u.nom,
                u.prenom,
                u.email,
                u.telephone,
                'Administrateur' AS poste,
                CURDATE() AS date_embauche,
                u.statut,
                NULL AS photo_profil,
                d.nom_departement AS departement,
                u.id_departement,
                u.role,
                0 AS empreinte
            FROM utilisateurs_systeme u
            LEFT JOIN departements d ON u.id_departement = d.id_departement
        ");
        $usersList = $stmtUsers->fetchAll();

        $users = array_merge($employes, $usersList);
        usort($users, function($a,$b){ return $a['id'] <=> $b['id']; });
        
        foreach ($users as &$u) {
            $u['id']             = (int) $u['id'];
            $u['empreinte']      = (bool) $u['empreinte'];
            $u['id_departement'] = $u['id_departement'] ? (int) $u['id_departement'] : null;
            $u['telephone']      = $u['telephone'] ?? '';
            $u['date_embauche']  = $u['date_embauche'] ?? date('Y-m-d');
            
            if (!$u['role']) {
                $posteLower = strtolower($u['poste'] ?? '');
                if (strpos($posteLower, 'admin') !== false) {
                    $u['role'] = 'admin';
                } else {
                    $u['role'] = 'employe';
                }
            }

            // Construire l'URL complète de la photo si présente
            if ($u['photo_profil']) {
                $u['photo_url'] = '../uploads/photos/' . $u['photo_profil'];
            } else {
                $u['photo_url'] = null;
            }
        }

        echo json_encode(['ok' => true, 'users' => $users]);
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'message' => 'Erreur lors de la récupération des employés: ' . $e->getMessage()]);
    }
    exit;
}

// ─────────────────────────────────────────────
// POST : créer ou modifier un employé (multipart/form-data)
// ─────────────────────────────────────────────
if ($method === 'POST') {
    $action = $_POST['action'] ?? '';
    $id     = (int) ($_POST['id'] ?? 0);

    // ── CASE 1: MODIFICATION (UPDATE VIA POST / FORMDATA) ──────────
    if ($action === 'update' || $id > 0) {
        // Séparation : id > 10000 → utilisateur (admin), sinon employé
        if ($id > 10000) {
            $realId = $id - 10000;
            $matricule    = trim($_POST['matricule'] ?? '');
            $nom          = trim($_POST['nom'] ?? '');
            $prenom       = trim($_POST['prenom'] ?? '');
            $email        = trim($_POST['email'] ?? '');
            $telephone    = trim($_POST['telephone'] ?? '');
            $dateEmbauche = trim($_POST['date_embauche'] ?? '');
            $id_dept      = (int) ($_POST['id_departement'] ?? 0);
            $role         = trim($_POST['role'] ?? 'admin');
            if ($realId <= 0 || empty($nom) || empty($prenom)) {
                echo json_encode(['ok' => false, 'message' => 'Veuillez remplir les champs obligatoires (nom, prénom).']);
                exit;
            }
            try {
                $pdo->beginTransaction();
                // Forcer Direction Générale pour tous les admins
                $deptStmtDG = $pdo->prepare('SELECT id_departement, nom_departement FROM departements WHERE nom_departement = ? LIMIT 1');
                $deptStmtDG->execute(['Direction Générale']);
                $deptDG = $deptStmtDG->fetch();
                if ($deptDG) { $id_dept = (int)$deptDG['id_departement']; $deptName = $deptDG['nom_departement']; }
                else { $id_dept = 0; $deptName = 'Direction Générale'; }
                $updateFields = 'matricule=?, nom=?, prenom=?, email=?, telephone=?, id_departement=?';
                $params = [$matricule, $nom, $prenom, $email ?: null, $telephone ?: null, $id_dept > 0 ? $id_dept : null];
                if (!empty($_POST['password'])) {
                    $updateFields .= ', mot_de_passe_hash=?';
                    $params[] = password_hash($_POST['password'], PASSWORD_BCRYPT);
                }
                $dbRole = ($role === 'super_admin') ? 'admin_systeme' : 'admin';
                $updateFields .= ', role=?';
                $params[] = $dbRole;
                $params[] = $realId;
                $updateStmt = $pdo->prepare("UPDATE utilisateurs_systeme SET $updateFields WHERE id_utilisateur=?");
                $updateStmt->execute($params);
                $pdo->commit();
                echo json_encode([
                    'ok' => true, 'message' => 'Administrateur mis à jour avec succès.',
                    'user' => ['id' => $id, 'matricule' => $matricule, 'nom' => $nom, 'prenom' => $prenom, 'email' => $email, 'telephone' => $telephone, 'departement' => $deptName, 'id_departement' => $id_dept > 0 ? $id_dept : null, 'role' => $role, 'date_embauche' => $dateEmbauche ?: date('Y-m-d'), 'photo_url' => null]
                ]);
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                echo json_encode(['ok' => false, 'message' => 'Erreur lors de la modification: ' . $e->getMessage()]);
            }
            exit;
        }
        $matricule    = trim($_POST['matricule'] ?? '');
        $nom          = trim($_POST['nom'] ?? '');
        $prenom       = trim($_POST['prenom'] ?? '');
        $email        = trim($_POST['email'] ?? '');
        $telephone    = trim($_POST['telephone'] ?? '');
        $dateEmbauche = trim($_POST['date_embauche'] ?? '');
        $id_dept      = (int) ($_POST['id_departement'] ?? 0);
        $role         = trim($_POST['role'] ?? 'employe');

        if ($id <= 0 || empty($nom) || empty($prenom)) {
            echo json_encode(['ok' => false, 'message' => 'Veuillez remplir les champs obligatoires (nom, prénom).']);
            exit;
        }

        try {
            $pdo->beginTransaction();

            // Résoudre le département si passé par son nom
            $deptName = null;
            if ($id_dept <= 0 && !empty($_POST['departement'])) {
                $deptStmt = $pdo->prepare('SELECT id_departement, nom_departement FROM departements WHERE nom_departement = ? LIMIT 1');
                $deptStmt->execute([trim($_POST['departement'])]);
                $dept = $deptStmt->fetch();
                if ($dept) {
                    $id_dept  = (int) $dept['id_departement'];
                    $deptName = $dept['nom_departement'];
                }
            } else if ($id_dept > 0) {
                $deptStmt = $pdo->prepare('SELECT nom_departement FROM departements WHERE id_departement = ?');
                $deptStmt->execute([$id_dept]);
                $dept = $deptStmt->fetch();
                if ($dept) $deptName = $dept['nom_departement'];
            }

            // Récupérer la photo actuelle
            $stmtPrev = $pdo->prepare('SELECT photo_profil FROM employes WHERE id_employe = ?');
            $stmtPrev->execute([$id]);
            $prevEmp = $stmtPrev->fetch();
            $photoFilename = $prevEmp['photo_profil'] ?? null;

            // Enregistrement de la nouvelle photo si fournie
            if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../uploads/photos/';
                if (!is_dir($uploadDir)) {
                    mkdir($uploadDir, 0755, true);
                }

                $ext = strtolower(pathinfo($_FILES['photo']['name'], PATHINFO_EXTENSION));
                $allowed = ['jpg', 'jpeg', 'png', 'webp', 'gif'];
                if (!in_array($ext, $allowed)) {
                    echo json_encode(['ok' => false, 'message' => 'Format de photo non autorisé (jpg, png, webp acceptés).']);
                    exit;
                }

                if ($_FILES['photo']['size'] > 3 * 1024 * 1024) {
                    echo json_encode(['ok' => false, 'message' => 'Photo trop volumineuse (3 Mo maximum).']);
                    exit;
                }

                $newPhoto = ($matricule ?: 'EMP' . $id) . '_' . time() . '.' . $ext;
                if (move_uploaded_file($_FILES['photo']['tmp_name'], $uploadDir . $newPhoto)) {
                    if ($photoFilename && file_exists($uploadDir . $photoFilename)) {
                        @unlink($uploadDir . $photoFilename);
                    }
                    $photoFilename = $newPhoto;
                }
            }

            $poste = 'Employé';
            $updateStmt = $pdo->prepare('
                UPDATE employes 
                SET matricule=?, nom=?, prenom=?, email=?, telephone=?, id_departement=?, poste=?, date_embauche=?, photo_profil=?
                WHERE id_employe=?
            ');
            $updateStmt->execute([
                $matricule,
                $nom,
                $prenom,
                $email ?: null,
                $telephone ?: null,
                $id_dept > 0 ? $id_dept : null,
                $poste,
                $dateEmbauche ?: date('Y-m-d'),
                $photoFilename,
                $id
            ]);

            $pdo->commit();

            echo json_encode([
                'ok'      => true,
                'message' => 'Employé mis à jour avec succès.',
                'user'    => [
                    'id'             => $id,
                    'matricule'      => $matricule,
                    'nom'            => $nom,
                    'prenom'         => $prenom,
                    'email'          => $email,
                    'telephone'      => $telephone,
                    'departement'    => $deptName,
                    'id_departement' => $id_dept > 0 ? $id_dept : null,
                    'role'           => $role,
                    'date_embauche'  => $dateEmbauche ?: date('Y-m-d'),
                    'photo_url'      => $photoFilename ? '../uploads/photos/' . $photoFilename : null,
                ]
            ]);

        } catch (Exception $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            echo json_encode(['ok' => false, 'message' => 'Erreur lors de la modification: ' . $e->getMessage()]);
        }
        exit;
    }

    // ── CASE 2: CREATION D'UN NOUVEL EMPLOYE ──────────────────────
    $nom          = trim($_POST['nom'] ?? '');
    $prenom       = trim($_POST['prenom'] ?? '');
    $email        = trim($_POST['email'] ?? '');
    $telephone    = trim($_POST['telephone'] ?? '');
    $dateEmbauche = trim($_POST['date_embauche'] ?? date('Y-m-d'));
    $id_dept      = (int) ($_POST['id_departement'] ?? 0);
    $role         = trim($_POST['role'] ?? 'employe');
    $password     = $_POST['password'] ?? null;

    if (empty($dateEmbauche)) {
        $dateEmbauche = date('Y-m-d');
    }

    if (empty($nom) || empty($prenom)) {
        echo json_encode(['ok' => false, 'message' => 'Veuillez remplir les champs obligatoires (nom, prénom).']);
        exit;
    }

    try {
        // ── 1. Résoudre le département ───────────────────────────────
        $deptName = null;
        if ($id_dept > 0) {
            $deptStmt = $pdo->prepare('SELECT nom_departement FROM departements WHERE id_departement = ?');
            $deptStmt->execute([$id_dept]);
            $dept = $deptStmt->fetch();
            if (!$dept) {
                echo json_encode(['ok' => false, 'message' => 'Département introuvable.']);
                exit;
            }
            $deptName = $dept['nom_departement'];
        }

        // ── 2. Générer le matricule et insérer selon le rôle (séparation Employé / Utilisateur) ──
        if (in_array($role, ['admin', 'super_admin', 'admin_systeme'])) {
            // ── ADMIN → table utilisateurs_systeme, préfixe ADM, département forcé Direction Générale ──
            $prefix = 'ADM';
            // Forcer Direction Générale pour tous les admins
            $deptStmtDG = $pdo->prepare('SELECT id_departement, nom_departement FROM departements WHERE nom_departement = ? LIMIT 1');
            $deptStmtDG->execute(['Direction Générale']);
            $deptDG = $deptStmtDG->fetch();
            if ($deptDG) { $id_dept = (int)$deptDG['id_departement']; $deptName = $deptDG['nom_departement']; }
            else { $id_dept = 0; $deptName = 'Direction Générale'; }
            $lastStmt = $pdo->prepare("SELECT matricule FROM utilisateurs_systeme WHERE matricule LIKE ? ORDER BY CAST(SUBSTRING(matricule, 4) AS UNSIGNED) DESC, matricule DESC LIMIT 1");
            $lastStmt->execute([$prefix . '%']);
            $lastRow = $lastStmt->fetch();
            $nextNum = 1;
            if ($lastRow && preg_match('/(\d+)$/', $lastRow['matricule'], $m)) { $nextNum = (int)$m[1] + 1; }
            $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
            $attempts = 0;
            while ($attempts < 100) {
                $chk = $pdo->prepare('SELECT 1 FROM utilisateurs_systeme WHERE matricule = ?');
                $chk->execute([$matricule]);
                if (!$chk->fetch()) break;
                $nextNum++; $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT); $attempts++;
            }
            if (empty($password)) {
                echo json_encode(['ok' => false, 'message' => 'Le mot de passe est requis pour un administrateur.']);
                exit;
            }
            $pdo->beginTransaction();
            $hash = password_hash($password, PASSWORD_BCRYPT);
            $dbRole = ($role === 'super_admin') ? 'admin_systeme' : 'admin';
            $userEmail = $email ?: $matricule . '@mada-digital.mg';
            $insertUser = $pdo->prepare('INSERT INTO utilisateurs_systeme (matricule, nom, prenom, email, telephone, id_departement, mot_de_passe_hash, role, statut) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "actif")');
            $insertUser->execute([$matricule, $nom, $prenom, $userEmail, $telephone ?: null, $id_dept > 0 ? $id_dept : null, $hash, $dbRole]);
            $newId = $pdo->lastInsertId();
            $pdo->commit();
            echo json_encode([
                'ok' => true, 'message' => 'Administrateur créé avec succès.',
                'user' => [
                    'id' => (int)$newId + 10000, 'matricule' => $matricule, 'nom' => $nom, 'prenom' => $prenom,
                    'email' => $userEmail, 'telephone' => $telephone, 'departement' => $deptName, 'id_departement' => $id_dept > 0 ? $id_dept : null,
                    'role' => $role, 'date_embauche' => $dateEmbauche, 'photo_url' => null
                ]
            ]);
        } else {
            // ── EMPLOYÉ → table employes, préfixe département ou EMP ──
            $prefix = 'EMP';
            if ($deptName) {
                $clean = preg_replace('/[^A-Za-z]/', '', $deptName);
                $prefix = strtoupper(substr($clean, 0, 3));
                if (strlen($prefix) < 2) $prefix = 'EMP';
            }
            $lastStmt = $pdo->prepare("SELECT matricule FROM employes WHERE matricule LIKE ? ORDER BY CAST(SUBSTRING(matricule, 4) AS UNSIGNED) DESC, matricule DESC LIMIT 1");
            $lastStmt->execute([$prefix . '%']);
            $lastRow = $lastStmt->fetch();
            $nextNum = 1;
            if ($lastRow && preg_match('/(\d+)$/', $lastRow['matricule'], $m)) { $nextNum = (int)$m[1] + 1; }
            $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT);
            $attempts = 0;
            while ($attempts < 100) {
                $chk = $pdo->prepare('SELECT 1 FROM employes WHERE matricule = ?');
                $chk->execute([$matricule]);
                if (!$chk->fetch()) break;
                $nextNum++; $matricule = $prefix . str_pad($nextNum, 3, '0', STR_PAD_LEFT); $attempts++;
            }
            $photoFilename = null;
            if (!empty($_FILES['photo']) && $_FILES['photo']['error'] === UPLOAD_ERR_OK) {
                $uploadDir = __DIR__ . '/../uploads/photos/';
                if (!is_dir($uploadDir) && !mkdir($uploadDir, 0755, true)) { http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Erreur serveur.']); exit; }
                $finfo = new finfo(FILEINFO_MIME_TYPE);
                $mime = $finfo->file($_FILES['photo']['tmp_name']);
                $allowedMimes = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp'];
                if (!isset($allowedMimes[$mime])) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Format de photo non autorisé (jpg, png, webp acceptés).']); exit; }
                $ext = $allowedMimes[$mime];
                if ($_FILES['photo']['size'] > 3*1024*1024) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Photo trop volumineuse (3 Mo maximum).']); exit; }
                $photoFilename = $matricule.'_'.bin2hex(random_bytes(8)).'.'.$ext;
                if (!move_uploaded_file($_FILES['photo']['tmp_name'], $uploadDir.$photoFilename)) { http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Erreur lors de l\'enregistrement de la photo.']); exit; }
            }
            $pdo->beginTransaction();
            $insertEmp = $pdo->prepare('INSERT INTO employes (matricule, nom, prenom, email, telephone, id_departement, poste, date_embauche, statut, photo_profil) VALUES (?, ?, ?, ?, ?, ?, ?, ?, "actif", ?)');
            $poste = 'Employé';
            $insertEmp->execute([$matricule, $nom, $prenom, $email ?: null, $telephone ?: null, $id_dept > 0 ? $id_dept : null, $poste, $dateEmbauche, $photoFilename]);
            $empId = $pdo->lastInsertId();
            $pdo->commit();
            echo json_encode([
                'ok' => true, 'message' => 'Employé créé avec succès.',
                'user' => [
                    'id' => (int)$empId, 'matricule' => $matricule, 'nom' => $nom, 'prenom' => $prenom,
                    'email' => $email, 'telephone' => $telephone, 'departement' => $deptName, 'id_departement' => $id_dept > 0 ? $id_dept : null,
                    'role' => $role, 'date_embauche' => $dateEmbauche, 'photo_url' => $photoFilename ? '../uploads/photos/'.$photoFilename : null
                ]
            ]);
        }

    } catch (Exception $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        echo json_encode(['ok' => false, 'message' => 'Erreur lors de l\'ajout: ' . $e->getMessage()]);
    }
    exit;
}

// ─────────────────────────────────────────────
// PUT : mettre à jour (JSON body) - gère Employé et Utilisateur séparément
// ─────────────────────────────────────────────
if ($method === 'PUT') {
    $input        = getJsonInput();
    $id           = (int) ($input['id'] ?? 0);
    $matricule    = trim($input['matricule'] ?? '');
    $nom          = trim($input['nom'] ?? '');
    $prenom       = trim($input['prenom'] ?? '');
    $email        = trim($input['email'] ?? '');
    $telephone    = trim($input['telephone'] ?? '');
    $departement  = trim($input['departement'] ?? '');
    $role         = trim($input['role'] ?? 'employe');
    $dateEmbauche = trim($input['date_embauche'] ?? '');

    if ($id <= 0 || empty($nom) || empty($prenom)) {
        echo json_encode(['ok' => false, 'message' => 'Données invalides.']);
        exit;
    }

    try {
        $deptStmt = $pdo->prepare('SELECT id_departement FROM departements WHERE nom_departement = ? LIMIT 1');
        $deptStmt->execute([$departement]);
        $dept   = $deptStmt->fetch();
        $deptId = $dept ? (int) $dept['id_departement'] : null;

        if ($id > 10000) {
            // Utilisateur (admin)
            $realId = $id - 10000;
            $stmt = $pdo->prepare('UPDATE utilisateurs_systeme SET matricule=?, nom=?, prenom=?, email=?, telephone=?, id_departement=?, role=? WHERE id_utilisateur=?');
            $dbRole = ($role === 'super_admin') ? 'admin_systeme' : 'admin';
            $stmt->execute([$matricule, $nom, $prenom, $email ?: null, $telephone ?: null, $deptId, $dbRole, $realId]);
            echo json_encode(['ok' => true, 'message' => 'Administrateur mis à jour.', 'user' => [
                'id' => $id, 'matricule' => $matricule, 'nom' => $nom, 'prenom' => $prenom, 'email' => $email, 'telephone' => $telephone, 'departement' => $departement, 'role' => $role, 'date_embauche' => $dateEmbauche ?: date('Y-m-d')
            ]]);
        } else {
            $stmt = $pdo->prepare('UPDATE employes SET matricule=?, nom=?, prenom=?, email=?, telephone=?, id_departement=?, poste=?, date_embauche=? WHERE id_employe=?');
            $poste = 'Employé';
            $stmt->execute([$matricule, $nom, $prenom, $email ?: null, $telephone ?: null, $deptId, $poste, $dateEmbauche ?: date('Y-m-d'), $id]);
            echo json_encode(['ok' => true, 'message' => 'Employé mis à jour.', 'user' => [
                'id' => $id, 'matricule' => $matricule, 'nom' => $nom, 'prenom' => $prenom, 'email' => $email, 'telephone' => $telephone, 'departement' => $departement, 'role' => $role, 'date_embauche' => $dateEmbauche ?: date('Y-m-d')
            ]]);
        }
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'message' => 'Erreur de mise à jour: ' . $e->getMessage()]);
    }
    exit;
}

// ─────────────────────────────────────────────
// DELETE : supprimer (gère Employé et Utilisateur séparément)
// ─────────────────────────────────────────────
if ($method === 'DELETE') {
    $input = getJsonInput();
    $id    = (int) ($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        echo json_encode(['ok' => false, 'message' => 'ID invalide.']);
        exit;
    }

    try {
        if ($id > 10000) {
            $realId = $id - 10000;
            $stmt = $pdo->prepare('DELETE FROM utilisateurs_systeme WHERE id_utilisateur = ?');
            $stmt->execute([$realId]);
            echo json_encode(['ok' => true, 'message' => 'Administrateur supprimé avec succès.']);
        } else {
            $row = $pdo->prepare('SELECT photo_profil FROM employes WHERE id_employe = ?');
            $row->execute([$id]);
            $emp = $row->fetch();
            if (!$emp) {
                echo json_encode(['ok' => false, 'message' => 'Employé introuvable.']);
                exit;
            }
            if ($emp['photo_profil']) {
                $photoPath = __DIR__ . '/../uploads/photos/' . $emp['photo_profil'];
                if (file_exists($photoPath)) unlink($photoPath);
            }
            // CASCADE manuel : pointages est en RESTRICT, on doit purger les dépendances
            $pdo->beginTransaction();
            try {
                $pdo->prepare('DELETE FROM pointages WHERE id_employe = ?')->execute([$id]);
                // les autres tables sont en CASCADE mais on purge explicitement par sécurité
                $pdo->prepare('DELETE FROM donnees_biometriques WHERE id_employe = ?')->execute([$id]);
                $pdo->prepare('DELETE FROM affectations_horaire WHERE id_employe = ?')->execute([$id]);
                $pdo->prepare('DELETE FROM absences_conges WHERE id_employe = ?')->execute([$id]);
                $stmt = $pdo->prepare('DELETE FROM employes WHERE id_employe = ?');
                $stmt->execute([$id]);
                $pdo->commit();
            } catch (Exception $e) {
                if ($pdo->inTransaction()) $pdo->rollBack();
                throw $e;
            }
            echo json_encode(['ok' => true, 'message' => 'Employé supprimé avec succès.']);
        }
    } catch (Exception $e) {
        echo json_encode(['ok' => false, 'message' => 'Erreur de suppression: ' . $e->getMessage()]);
    }
    exit;
}
