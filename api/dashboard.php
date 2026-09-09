<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

$pdo = getDB();
$today = date('Y-m-d');
$dayStart = $today . ' 00:00:00';
$dayEnd = date('Y-m-d', strtotime($today . ' +1 day')) . ' 00:00:00';

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

    $isSunday = (date('N', strtotime($today)) == 7);
    $absents = $isSunday ? 0 : max(0, $total - $presents);

    // Activité horaire (2e et dernier aller-retour)
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

    echo json_encode([
        'ok' => true,
        'stats' => [
            'total' => $total,
            'entrees' => $entrees,
            'sorties' => $sorties,
            'retards' => $retards,
            'absents' => $absents,
            'evenements' => $entrees + $sorties
        ],
        'activite' => $activite
    ]);

} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur dashboard.']);
}
