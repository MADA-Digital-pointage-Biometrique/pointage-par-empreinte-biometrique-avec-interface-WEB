<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// ── GET: Liste tous les départements (avec le nombre d'employés) ──
if ($method === 'GET') {
    try {
        $stmt = $pdo->query('
            SELECT 
                d.id_departement AS id, 
                d.nom_departement AS nom, 
                d.description,
                COUNT(e.id_employe)::int AS nb_employes
            FROM departements d
            LEFT JOIN employes e ON d.id_departement = e.id_departement
            GROUP BY d.id_departement, d.nom_departement, d.description
            ORDER BY d.nom_departement ASC
        ');
        $depts = $stmt->fetchAll();
        foreach ($depts as &$d) {
            $d['id'] = (int) $d['id'];
            $d['nb_employes'] = (int) ($d['nb_employes'] ?? 0);
        }
        echo json_encode(['ok' => true, 'departements' => $depts]);
    } catch (Throwable $e) {
        http_response_code(500);
        error_log('Departements error: ' . $e->getMessage());
        echo json_encode(['ok' => false, 'message' => 'Erreur de chargement.']);
    }
    exit;
}

// ── RBAC : Seul super_admin / admin_systeme peut créer / modifier / supprimer ──
$role = $_SESSION['role'] ?? '';
if (!in_array($role, ['super_admin', 'admin_systeme'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'Accès refusé : privilèges insuffisants.']);
    exit;
}

// ── POST: Créer un département ──
if ($method === 'POST') {
    $input = getJsonInput();
    $nom = trim($input['nom'] ?? $input['nom_departement'] ?? '');
    $description = trim($input['description'] ?? '');

    if (empty($nom)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Le nom du département est obligatoire.']);
        exit;
    }

    try {
        $chk = $pdo->prepare('SELECT 1 FROM departements WHERE LOWER(nom_departement) = LOWER(?)');
        $chk->execute([$nom]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'message' => 'Un département avec ce nom existe déjà.']);
            exit;
        }

        $stmt = $pdo->prepare('INSERT INTO departements (nom_departement, description) VALUES (?, ?) RETURNING id_departement');
        $stmt->execute([$nom, $description ?: null]);
        $newId = (int) $stmt->fetchColumn();
        auditWrite($pdo, 'departement_cree', $newId, 'departements', ['nom' => $nom]);

        echo json_encode([
            'ok' => true,
            'message' => 'Département créé avec succès.',
            'departement' => ['id' => $newId, 'nom' => $nom, 'description' => $description, 'nb_employes' => 0]
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur lors de la création : ' . $e->getMessage()]);
    }
    exit;
}

// ── PUT: Modifier un département ──
if ($method === 'PUT') {
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? 0);
    $nom = trim($input['nom'] ?? $input['nom_departement'] ?? '');
    $description = trim($input['description'] ?? '');

    if ($id <= 0 || empty($nom)) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'ID invalide et nom requis.']);
        exit;
    }

    try {
        $chk = $pdo->prepare('SELECT 1 FROM departements WHERE LOWER(nom_departement) = LOWER(?) AND id_departement != ?');
        $chk->execute([$nom, $id]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['ok' => false, 'message' => 'Un autre département porte déjà ce nom.']);
            exit;
        }

        $stmt = $pdo->prepare('UPDATE departements SET nom_departement = ?, description = ? WHERE id_departement = ?');
        $stmt->execute([$nom, $description ?: null, $id]);
        auditWrite($pdo, 'departement_modifie', $id, 'departements', ['nom' => $nom]);

        echo json_encode([
            'ok' => true,
            'message' => 'Département mis à jour.',
            'departement' => ['id' => $id, 'nom' => $nom, 'description' => $description]
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur lors de la mise à jour : ' . $e->getMessage()]);
    }
    exit;
}

// ── DELETE: Supprimer un département ──
if ($method === 'DELETE') {
    $input = getJsonInput();
    $id = (int) ($input['id'] ?? $_GET['id'] ?? 0);

    if ($id <= 0) {
        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'ID département invalide.']);
        exit;
    }

    try {
        $stmt = $pdo->prepare('DELETE FROM departements WHERE id_departement = ?');
        $stmt->execute([$id]);
        auditWrite($pdo, 'departement_supprime', $id, 'departements');

        echo json_encode(['ok' => true, 'message' => 'Département supprimé.']);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'message' => 'Erreur de suppression : ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
