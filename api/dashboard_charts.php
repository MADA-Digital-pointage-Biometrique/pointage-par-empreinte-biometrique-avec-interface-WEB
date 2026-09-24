<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

// PERF : libère le verrou de session AVANT les requêtes (le bundle stats
// dashboard.php fait pareil) → les autres fetchs parallèles ne sont pas
// sérialisés derrière celui-ci.
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();

// PERF : UN seul aller-retour HTTP remplace les 2 anciens (dashboard_trends.php
// + dashboard_hours.php). Cache serveur 30s identique.
$cacheKey = 'dash_charts';
$cached = cacheGet($cacheKey, 30);
if (is_array($cached)) { $cached['cached'] = true; echo json_encode($cached); exit; }

$pdo = getDB();

try {
    // ── 1) Tendances 7 jours glissants (J-6 → aujourd'hui) ──
    $rows7 = $pdo->query("
        SELECT
            p.date_heure::date AS d,
            COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS presents,
            COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree'
                AND TO_CHAR(p.date_heure, 'HH24:MI:SS') > '08:30:00'
                THEN p.id_employe END) AS retards
        FROM pointages p
        WHERE p.date_heure >= (CURRENT_DATE - INTERVAL '6 days') AND p.date_heure < (CURRENT_DATE + INTERVAL '1 day')
        GROUP BY p.date_heure::date
        ORDER BY p.date_heure::date ASC
    ")->fetchAll();

    $totalActifs = (int)$pdo->query("SELECT COUNT(*) FROM employes WHERE statut='actif'")->fetchColumn();

    $daysMap = [];
    foreach ($rows7 as $r) {
        $daysMap[date('Y-m-d', strtotime($r['d']))] = [
            'presents' => (int)$r['presents'],
            'retards' => (int)$r['retards']
        ];
    }

    $labels7 = []; $presents7 = []; $retards7 = []; $absents7 = [];
    for ($i = 6; $i >= 0; $i--) {
        $ts = strtotime("-$i days");
        $key = date('Y-m-d', $ts);
        $labels7[] = date('d/m', $ts);
        $d = $daysMap[$key] ?? null;
        if ($d) {
            $presents7[] = $d['presents'];
            $retards7[] = $d['retards'];
            $absents7[] = max(0, $totalActifs - $d['presents']);
        } else {
            // Jour sans pointage : tout l'effectif actif est compté absent
            $presents7[] = 0;
            $retards7[] = 0;
            $absents7[] = $totalActifs;
        }
    }

    // ── 2) Tendances 4 dernières semaines (semaines complètes Lundi-Dimanche) ──
    $rows30 = $pdo->query("
        SELECT
            date_trunc('week', p.date_heure)::date AS week_start,
            COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS presents,
            COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree'
                AND TO_CHAR(p.date_heure, 'HH24:MI:SS') > '08:30:00'
                THEN p.id_employe END) AS retards
        FROM pointages p
        WHERE p.date_heure >= (CURRENT_DATE - INTERVAL '27 days') AND p.date_heure < (CURRENT_DATE + INTERVAL '1 day')
        GROUP BY date_trunc('week', p.date_heure)
        ORDER BY week_start ASC
    ")->fetchAll();

    $weeksMap = [];
    foreach ($rows30 as $r) {
        $weeksMap[(int)date('W', strtotime($r['week_start']))] = [
            'presents' => (int)$r['presents'],
            'retards' => (int)$r['retards']
        ];
    }

    $labels30 = []; $presents30 = []; $retards30 = []; $absents30 = [];
    for ($i = 3; $i >= 0; $i--) {
        $targetDate = date('Y-m-d', strtotime("-$i weeks Monday this week"));
        $weekNum = (int)date('W', strtotime($targetDate));
        $labels30[] = 'Sem ' . $weekNum;
        $d = $weeksMap[$weekNum] ?? null;
        if ($d) {
            $presents30[] = $d['presents'];
            $retards30[] = $d['retards'];
            $absents30[] = max(0, $totalActifs - $d['presents']);
        } else {
            $presents30[] = 0;
            $retards30[] = 0;
            $absents30[] = 0;
        }
    }

    // ── 3) Heures moyennes par département (30 jours, single-pass CTE) ──
    $rowsH = $pdo->query("
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
    ")->fetchAll();

    $departements = [];
    $heures = [];
    foreach ($rowsH as $r) {
        $departements[] = $r['departement'];
        $heures[] = (float)$r['heures_moyennes'];
    }
    if (empty($departements)) {
        $allDepts = $pdo->query("SELECT nom_departement FROM departements ORDER BY nom_departement")->fetchAll(PDO::FETCH_COLUMN);
        $departements = $allDepts ?: ['Aucun département'];
        $heures = array_fill(0, count($departements), 0.0);
    }
    $moyenneGlobale = count($heures) > 0 ? round(array_sum($heures) / count($heures), 1) : 0.0;

    $payload = [
        'ok' => true,
        'labels_7d' => $labels7, 'presents_7d' => $presents7,
        'retards_7d' => $retards7, 'absents_7d' => $absents7,
        'labels_30d' => $labels30, 'presents_30d' => $presents30,
        'retards_30d' => $retards30, 'absents_30d' => $absents30,
        'departements' => $departements,
        'heures' => $heures,
        'moyenne_globale' => $moyenneGlobale
    ];
    cacheSet($cacheKey, $payload);
    echo json_encode($payload);
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard charts error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur graphiques.']);
}
