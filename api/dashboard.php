<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

// PERF : libère le verrou de session AVANT les requêtes (sinon les fetchs
// parallèles dashboard_trends.php / dashboard_hours.php restaient bloqués sur
// session_start() pendant tout l'agrégat → graphiques qui n'apparaissent qu'en
// dernier). session_write_close() autorise le parallélisme HTTP des requêtes.
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();

// ── Période d'analyse (pills du dashboard) : today (défaut) / 7d / 30d ──
// Les filtres rechargent KPI, donut et flux horaire sur la fenêtre choisie.
$period = $_GET['period'] ?? 'today';
if (!in_array($period, ['today', '7d', '30d'], true)) $period = 'today';

// PERF : cache serveur 30s — clé PAR PÉRIODE (sinon un filtre renvoyait
// le cache d'une autre fenêtre et les graphiques semblaient "figés").
$cacheKey = 'dash_' . $period;
$cached = cacheGet($cacheKey, 30);
if (is_array($cached)) {
    $cached['cached'] = true;
    echo json_encode($cached);
    exit;
}

$pdo = getDB();

// Fenêtre [start, end) — le fuseau de session PG est aligné sur PHP par getDB()
// (SET TIME ZONE), donc les comparaisons de dates tombent sur les bons jours.
$dayEnd = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
if ($period === '7d') {
    $dayStart = date('Y-m-d', strtotime('-6 days')) . ' 00:00:00';
} elseif ($period === '30d') {
    $dayStart = date('Y-m-d', strtotime('-29 days')) . ' 00:00:00';
} else {
    $dayStart = date('Y-m-d') . ' 00:00:00';
}

try {
    // PERF : 1 seul aller-retour pour tous les agrégats (plages >= / < sur
    // idx_pointages_date au lieu de date_heure::date qui tuait l'index).
    $agg = $pdo->prepare("
        SELECT
            (SELECT COUNT(*) FROM employes WHERE statut = 'actif') AS total,
            (SELECT COUNT(*) FROM pointages
              WHERE date_heure >= ? AND date_heure < ? AND type_pointage = 'entree') AS entrees,
            (SELECT COUNT(*) FROM pointages
              WHERE date_heure >= ? AND date_heure < ? AND type_pointage = 'sortie') AS sorties,
            (SELECT COUNT(DISTINCT id_employe) FROM pointages
              WHERE date_heure >= ? AND date_heure < ? AND type_pointage = 'entree') AS presents,
            (SELECT COUNT(*) FROM (
                SELECT id_employe FROM pointages
                WHERE date_heure >= ? AND date_heure < ? AND type_pointage = 'entree'
                GROUP BY id_employe
                HAVING MIN(TO_CHAR(date_heure, 'HH24:MI:SS')) > '08:30:00'
            ) r) AS retards
    ");
    $agg->execute([$dayStart, $dayEnd, $dayStart, $dayEnd, $dayStart, $dayEnd, $dayStart, $dayEnd]);
    $a = $agg->fetch() ?: [];
    $total = (int)($a['total'] ?? 0);
    $entrees = (int)($a['entrees'] ?? 0);
    $sorties = (int)($a['sorties'] ?? 0);
    $presents = (int)($a['presents'] ?? 0);
    $retards = (int)($a['retards'] ?? 0);

    // Dimanche = jour non travaillé : absents forcé à 0 UNIQUEMENT pour la
    // vue "Aujourd'hui" (sur 7d/30d la fenêtre couvre des jours ouvrés).
    $isSunday = ($period === 'today' && date('N') == 7);
    $absents = $isSunday ? 0 : max(0, $total - $presents);

    // Activité horaire de la fenêtre (2e et dernier aller-retour).
    // today : volume réel par heure. 7d/30d : volume CUMULÉ par heure (le pic
    // reste lisible) — les barres sont normalisées côté PHP comme avant.
    $activityStmt = $pdo->prepare("
        SELECT EXTRACT(HOUR FROM date_heure)::int as h, COUNT(*) as count
        FROM pointages
        WHERE date_heure >= ? AND date_heure < ?
        GROUP BY EXTRACT(HOUR FROM date_heure)
        ORDER BY h ASC
    ");
    $activityStmt->execute([$dayStart, $dayEnd]);
    $actRows = $activityStmt->fetchAll();

    $actMap = [];
    foreach ($actRows as $r) {
        $actMap[sprintf('%02dh', $r['h'])] = (int) $r['count'];
    }

    $activite = [];
    for ($h = 6; $h <= 18; $h++) {
        $k = sprintf('%02dh', $h);
        $activite[] = ['heure' => $k, 'count' => $actMap[$k] ?? 0];
    }

    $maxCount = 1;
    foreach ($activite as $a) {
        if ($a['count'] > $maxCount) $maxCount = $a['count'];
    }
    foreach ($activite as &$a) {
        $a['height'] = (int) round(($a['count'] / $maxCount) * 100);
    }
    unset($a);

    $payload = [
        'ok' => true,
        'period' => $period,
        'stats' => [
            'total' => $total,
            'entrees' => $entrees,
            'sorties' => $sorties,
            'retards' => $retards,
            'absents' => $absents,
            'evenements' => $entrees + $sorties
        ],
        'activite' => $activite
    ];
    cacheSet($cacheKey, $payload);
    echo json_encode($payload);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur dashboard.']);
}
