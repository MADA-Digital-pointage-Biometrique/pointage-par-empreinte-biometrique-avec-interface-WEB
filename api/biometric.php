<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
use App\Core\Biometric\SdkReader;

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];

// RBAC : seul super_admin peut gérer les empreintes
if ($method === 'POST' && !in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) {
    http_response_code(403);
    echo json_encode(['ok' => false, 'message' => 'Accès refusé : seul le Super Administrateur peut gérer les empreintes.']);
    exit;
}
if (!in_array($method, ['POST'])) {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

if ($method === 'POST') {
    $input = getJsonInput();
    $action = $input['action'] ?? '';
    $userId = (int) ($input['userId'] ?? 0);

    if ($userId <= 0) {
        echo json_encode(['ok' => false, 'message' => 'Identifiant employé invalide.']);
        exit;
    }

    try {
        if ($action === 'enroll') {
            // Check if employee exists
            $empStmt = $pdo->prepare('SELECT prenom, nom FROM employes WHERE id_employe = ?');
            $empStmt->execute([$userId]);
            $emp = $empStmt->fetch();

            if (!$emp) {
                echo json_encode(['ok' => false, 'message' => 'Employé introuvable.']);
                exit;
            }

            // WA28 : tentative de capture réelle, fallback simulé si SDK non configuré
            $gabarit = null;
            $waMsg = '';
            try {
                $reader = SdkReader::fromConfig();
                $gabarit = $reader->enroll($userId);
                $waMsg = ' (' . $reader->name() . ')';
            } catch (Throwable $eWa) {
                // SDK WA28 non prêt : génération simulée (pré-prod)
                $gabarit = bin2hex(random_bytes(32));
                $waMsg = ' [SIMULÉ - WA28 non configuré: ' . $eWa->getMessage() . ']';
                error_log('WA28 enroll fallback: ' . $eWa->getMessage());
            }

            // Insert or update biometric data
            $check = $pdo->prepare('SELECT id_biometrie FROM donnees_biometriques WHERE id_employe = ? AND type_biometrie = "empreinte" LIMIT 1');
            $check->execute([$userId]);
            $existing = $check->fetch();

            if ($existing) {
                $update = $pdo->prepare('
                    UPDATE donnees_biometriques 
                    SET gabarit_chiffre = ?, date_enregistrement = NOW(), statut = "actif" 
                    WHERE id_biometrie = ?
                ');
                $update->execute([$gabarit, $existing['id_biometrie']]);
            } else {
                $insert = $pdo->prepare('
                    INSERT INTO donnees_biometriques (id_employe, type_biometrie, gabarit_chiffre, date_enregistrement, statut)
                    VALUES (?, "empreinte", ?, NOW(), "actif")
                ');
                $insert->execute([$userId, $gabarit]);
            }

            echo json_encode(['ok' => true, 'message' => 'Empreinte biométrique enrôlée avec succès pour ' . $emp['prenom'] . ' ' . $emp['nom'] . '.' . $waMsg]);
            exit;

        } else if ($action === 'scan') {
            // WA28 scan pour pointage direct (à brancher quand SDK prêt)
            try {
                $reader = SdkReader::fromConfig();
                $foundId = $reader->scan();
                if ($foundId) {
                    echo json_encode(['ok' => true, 'user_id' => $foundId, 'message' => 'Empreinte reconnue (WA28)']);
                } else {
                    echo json_encode(['ok' => false, 'message' => 'Aucune empreinte reconnue']);
                }
            } catch (Throwable $eWa) {
                http_response_code(501);
                echo json_encode(['ok' => false, 'message' => 'WA28 non prêt: ' . $eWa->getMessage()]);
            }
            exit;
        } else if ($action === 'delete') {
            $delete = $pdo->prepare('DELETE FROM donnees_biometriques WHERE id_employe = ? AND type_biometrie = "empreinte"');
            $delete->execute([$userId]);
            echo json_encode(['ok' => true, 'message' => 'Empreinte biométrique supprimée.']);
            exit;
        }

        http_response_code(400);
        echo json_encode(['ok' => false, 'message' => 'Action biométrique inconnue.']);
    } catch (Throwable $e) {
        http_response_code(500);
        error_log('Biometric error: ' . $e->getMessage());
        echo json_encode(['ok' => false, 'message' => 'Erreur biométrique.']);
    }
    exit;
}
