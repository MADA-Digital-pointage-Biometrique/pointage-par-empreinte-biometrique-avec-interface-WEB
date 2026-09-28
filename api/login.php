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

    // ── Rate limiting : 5 essais / 15 min par IP + 10 essais / 15 min par compte ──
    // (le compteur par compte résiste à la rotation d'IP ; même message 429 sinon oracle)
    $throttleFail = function() {
        http_response_code(429);
        header('Retry-After: 900');
        echo json_encode(['ok' => false, 'message' => 'Trop de tentatives. Réessayez dans 15 minutes.']);
        exit;
    };
    $throttleRead = function(string $file): array {
        $a = ['count' => 0, 'first' => time()];
        if (file_exists($file)) {
            $a = json_decode(@file_get_contents($file), true) ?: $a;
            if (time() - $a['first'] > 900) { $a = ['count' => 0, 'first' => time()]; }
        }
        return $a;
    };
    $ip = clientIp();
    $attemptFile = sys_get_temp_dir() . '/mada_login_' . md5($ip) . '.json';
    $attempts = $throttleRead($attemptFile);
    if ($attempts['count'] >= 5) { $throttleFail(); }
    $acctFile = sys_get_temp_dir() . '/mada_login_acct_' . md5(strtolower($matricule)) . '.json';
    $acctAttempts = $throttleRead($acctFile);
    if ($acctAttempts['count'] >= 10) { $throttleFail(); }
    $throttleBump = function() use ($attemptFile, &$attempts, $acctFile, &$acctAttempts) {
        $attempts['count']++; @file_put_contents($attemptFile, json_encode($attempts), LOCK_EX);
        $acctAttempts['count']++; @file_put_contents($acctFile, json_encode($acctAttempts), LOCK_EX);
    };

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

    // C3 : anti-énumération — TOUS les échecs (inconnu, MDP faux, inactif,
    // rôle non autorisé) retournent le MÊME code + message. Le verify tourne
    // toujours (hash factice si inconnu) pour un timing comparable.
    $userExists = ($user && !empty($user['id_utilisateur']));
    $dummyHash = '$2y$10$usesomesillystringfore7hnbRJHxXVLeLyQ6F9GB5Q7e9M9u';
    $hash = $userExists ? $user['mot_de_passe_hash'] : $dummyHash;
    $validPassword = @password_verify($password, $hash);

    $allowedRoles = ['admin_systeme', 'admin', 'super_admin'];
    $loginOk = $userExists && $validPassword
        && (!isset($user['user_statut']) || $user['user_statut'] === 'actif')
        && in_array($user['role'], $allowedRoles);

    if (!$loginOk) {
        $throttleBump();
        // Traçabilité des échecs (table super_admin uniquement : pas d'oracle
        // pour l'attaquant). Throttle existant => pas de risque d'inondation.
        // Acteur = compte visé (attribuable au filtrage) même sans session.
        $failUid = $userExists ? (int)$user['id_utilisateur'] : null;
        auditWrite($pdo, 'connexion_echec', $failUid, 'utilisateurs_systeme', ['matricule' => $matricule], $failUid);
        http_response_code(401);
        echo json_encode(['ok' => false, 'message' => 'Matricule ou mot de passe incorrect.']);
        exit;
    }
    // Succès : reset compteurs + rehash transparent si ancien cost
    if (file_exists($attemptFile)) @unlink($attemptFile);
    if (file_exists($acctFile)) @unlink($acctFile);
    if (password_needs_rehash($hash, PASSWORD_BCRYPT, ['cost' => PASSWORD_BCRYPT_COST])) {
        try { $pdo->prepare('UPDATE utilisateurs_systeme SET mot_de_passe_hash = ? WHERE id_utilisateur = ?')->execute([hashPassword($password), $user['id_utilisateur']]); } catch (Throwable $e) {}
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
    auditWrite($pdo, 'connexion', $userData['id'], 'utilisateurs_systeme', ['matricule' => $userData['matricule'], 'role' => $roleMapped]);

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
