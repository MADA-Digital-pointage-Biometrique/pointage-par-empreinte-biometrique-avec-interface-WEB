<?php
/**
 * Seed : crée le compte administrateur par défaut dans utilisateurs_systeme.
 * Usage : php database/seed.php
 */

require_once dirname(__DIR__) . '/api/db.php';

try {
    $pdo = getDB();

    $stmt = $pdo->prepare('SELECT COUNT(*) FROM utilisateurs_systeme WHERE matricule = ? OR email = ?');
    $stmt->execute(['ADM001', 'admin@mada.com']);
    $count = (int) $stmt->fetchColumn();

    if ($count === 0) {
        $hash = password_hash('admin123', PASSWORD_BCRYPT);
        
        // Résoudre ou créer le département Direction Générale
        $deptStmt = $pdo->query("SELECT id_departement FROM departements WHERE nom_departement = 'Direction Générale' LIMIT 1");
        $deptId = $deptStmt->fetchColumn();
        if (!$deptId) {
            $insDept = $pdo->prepare("INSERT INTO departements (nom_departement, description) VALUES ('Direction Générale', 'Direction et Administration')");
            $insDept->execute();
            $deptId = $pdo->lastInsertId();
        }

        $insert = $pdo->prepare("
            INSERT INTO utilisateurs_systeme 
            (matricule, nom, prenom, email, mot_de_passe_hash, role, statut, id_departement) 
            VALUES (?, ?, ?, ?, ?, 'admin_systeme', 'actif', ?)
        ");
        $insert->execute(['ADM001', 'Administrateur', 'Système', 'admin@mada.com', $hash, $deptId]);
        echo "Admin créé avec succès : ADM001 / admin123 (email: admin@mada.com)\n";
    } else {
        echo "L'administrateur ADM001 (ou admin@mada.com) existe déjà.\n";
    }
} catch (Throwable $e) {
    echo "Erreur lors du seed : " . $e->getMessage() . "\n";
    exit(1);
}