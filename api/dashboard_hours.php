<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}
$pdo = getDB();
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();

$cacheKey = 'dash_hours';
$cached = cacheGet($cacheKey, 30);
if (is_array($cached)) { $cached['cached'] = true; echo json_encode($cached); exit; }

try {
    // Heures moyennes par département sur les 30 derniers jours
    // On calcule : pour chaque employé/jour, durée = sortie - entrée (si les deux existent)
    // Puis moyenne par département
    //
    // PERF : UNE seule passe (l'ancienne version scannait les pointages deux
    // fois en sous-requêtes MIN/MAX + double jointure — 2 scans de 30 jours de
    // données, latence ~2× et risque de timeout Supabase). Ici : CTE qui
    // pivote entrée/sortie en une lecture, filtrée avant agrégation.
    $stmt = $pdo->prepare("
        WITH jour AS (
            SELECT
                p.id_employe,
                p.date_heure::date AS jour,
                MIN(p.date_heure) FILTER (WHERE p.type_pointage = 'entree') AS entree,
                MAX(p.date_heure) FILTER (WHERE p.type_pointage = 'sortie') AS sortie
            FROM pointages p
            WHERE p.date_heure >= (CURRENT_DATE - INTERVAL '30 days')
            GROUP BY p.id_employe, p.date_heure::date
        )
        SELECT
            COALESCE(d.nom_departement, 'Sans département') AS departement,
            ROUND(AVG(EXTRACT(EPOCH FROM (j.sortie - j.entree)) / 3600)::numeric, 1) AS heures_moyennes
        FROM jour j
        JOIN employes e ON e.id_employe = j.id_employe AND e.statut = 'actif'
        LEFT JOIN departements d ON e.id_departement = d.id_departement
        WHERE j.entree IS NOT NULL AND j.sortie IS NOT NULL
        GROUP BY d.nom_departement
        ORDER BY heures_moyennes DESC
    ");
    $stmt->execute();
    $rows = $stmt->fetchAll();

    $departements = [];
    $heures = [];
    foreach ($rows as $r) {
        $departements[] = $r['departement'];
        $heures[] = (float)$r['heures_moyennes'];
    }

    // Si aucun département n'a de données, retourner un tableau vide
    if (empty($departements)) {
        // Fallback : lister les départements existants avec 0
        $stmt2 = $pdo->prepare("SELECT nom_departement FROM departements ORDER BY nom_departement");
        $stmt2->execute();
        $allDepts = $stmt2->fetchAll(PDO::FETCH_COLUMN);
        $departements = $allDepts ?: ['Aucun département'];
        $heures = array_fill(0, count($departements), 0.0);
    }

    // Moyenne globale
    $moyenneGlobale = count($heures) > 0 ? round(array_sum($heures) / count($heures), 1) : 0.0;

    $payload = [
        'ok' => true,
        'departements' => $departements,
        'heures' => $heures,
        'moyenne_globale' => $moyenneGlobale
    ];
    cacheSet($cacheKey, $payload);
    echo json_encode($payload);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard hours error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur heures travaillées.']);
}