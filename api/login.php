<?php
require_once __DIR__ . '/db.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'message' => 'Méthode non autorisée.']);
    exit;
}

$input = getJsonInput();
$matricule = trim($input['matricule'] ?? '');
$password  = $input['password'] ?? '';

if (empty($matricule) || empty($password)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Veuillez renseigner le matricule et le mot de passe.']);
    exit;
}
if (!preg_match('/^[A-Za-z0-9@._+\-]{3,100}$/', $matricule)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'message' => 'Format de matricule invalide.']);
    exit;
}

try {
    $pdo = getDB();

    // ── Rate limiting : 5 essais / 15 min par IP ──
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $attemptFile = sys_get_temp_dir() . '/mada_login_' . md5($ip) . '.json';
    $attempts = ['count' => 0, 'first' => time()];
    if (file_exists($attemptFile)) {
        $attempts = json_decode(@file_get_contents($attemptFile), true) ?: $attempts;
        if (time() - $attempts['first'] > 900) { $attempts = ['count' => 0, 'first' => time()]; }
        if ($attempts['count'] >= 5) {
            http_response_code(429);
            header('Retry-After: 900');
            echo json_encode(['ok' => false, 'message' => 'Trop de tentatives. Réessayez dans 15 minutes.']);
            exit;
        }
    }

    $stmt = $pdo->prepare('
        SELECT 
            u.id_utilisateur,
            u.matricule,
            u.nom,
            u.prenom,
            u.email AS user_email,
            u.mot_de_passe_hash,
            u.role,
            u.statut AS user_statut,
            u.telephone,
            d.nom_departement AS departement
        FROM utilisateurs_systeme u
        LEFT JOIN departements d ON u.id_departement = d.id_departement
        WHERE (u.matricule = :mat1 OR u.email = :mat2)
        LIMIT 1
    ');

    $stmt->execute(['mat1' => $matricule, 'mat2' => $matricule]);
    $user = $stmt->fetch();

    if (!$user || empty($user['id_utilisateur'])) {
        $attempts['count']++; @file_put_contents($attemptFile, json_encode($attempts), LOCK_EX);
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Matricule ou mot de passe incorrect.']);
        exit;
    }

    if (isset($user['user_statut']) && $user['user_statut'] !== 'actif') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => 'Ce compte est inactif ou suspendu.']);
        exit;
    }

    $hash = $user['mot_de_passe_hash'];
    $validPassword = password_verify($password, $hash);

    if (!$validPassword) {
        $attempts['count']++; @file_put_contents($attemptFile, json_encode($attempts), LOCK_EX);
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Matricule ou mot de passe incorrect.']);
        exit;
    }
    // Succès : reset compteur
    if (file_exists($attemptFile)) @unlink($attemptFile);

    $allowedRoles = ['admin_systeme', 'admin', 'super_admin'];
    if (!in_array($user['role'], $allowedRoles)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'message' => "Accès réservé. Les employés n'ont pas de compte d'accès au tableau de bord."]);
        exit;
    }

    // Update derniere_connexion timestamp in database
    try {
        $updateStmt = $pdo->prepare('UPDATE utilisateurs_systeme SET derniere_connexion = NOW() WHERE id_utilisateur = ?');
        $updateStmt->execute([$user['id_utilisateur']]);
    } catch (Exception $e) {
        // Ignore timestamp update failure
    }

    // Régénération anti-fixation + CSRF
    session_regenerate_id(true);
    $_SESSION['csrf_token'] = bin2hex(random_bytes(32));

    $roleMapped = ($user['role'] === 'admin_systeme') ? 'super_admin' : $user['role'];

    $userData = [
        'id'             => (int) $user['id_utilisateur'],
        'id_utilisateur' => (int) $user['id_utilisateur'],
        'matricule'      => $user['matricule'] ?? $matricule,
        'nom'            => $user['nom'] ?? 'Administrateur',
        'prenom'         => $user['prenom'] ?? 'Système',
        'email'          => $user['user_email'],
        'telephone'      => $user['telephone'] ?? '',
        'role'           => $roleMapped,
        'departement'    => $user['departement'] ?? 'Direction Général',
        'poste'          => 'Administrateur'
    ];

    $_SESSION['user'] = $userData;
    $_SESSION['user_id'] = $userData['id'];
    $_SESSION['role'] = $roleMapped;

    echo json_encode([
        'ok'      => true,
        'message' => 'Connexion réussie.',
        'user'    => $userData
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Login error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur serveur.']);
}
