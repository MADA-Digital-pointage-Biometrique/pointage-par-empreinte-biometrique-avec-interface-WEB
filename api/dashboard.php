<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}

$pdo = getDB();
$today = date('Y-m-d');

try {
    // Total employes
    $totalStmt = $pdo->query('SELECT COUNT(*) FROM employes WHERE statut = "actif"');
    $total = (int) $totalStmt->fetchColumn();

    // Today pointages
    $ptsStmt = $pdo->prepare('
        SELECT 
            p.id_pointage,
            p.id_employe,
            p.type_pointage,
            TIME(p.date_heure) as heure
        FROM pointages p
        WHERE DATE(p.date_heure) = ?
    ');
    $ptsStmt->execute([$today]);
    $pointages = $ptsStmt->fetchAll();

    $entrees = 0;
    $sorties = 0;
    $retards = 0;
    $heureDebut = '08:30:00';

    $userEntrees = [];
    foreach ($pointages as $p) {
        if ($p['type_pointage'] === 'entree') {
            $entrees++;
            if (!isset($userEntrees[$p['id_employe']])) {
                $userEntrees[$p['id_employe']] = $p['heure'];
                if ($p['heure'] > $heureDebut) {
                    $retards++;
                }
            }
        } elseif ($p['type_pointage'] === 'sortie') {
            $sorties++;
        }
    }

    $isSunday = (date('N', strtotime($today)) == 7);
    $absents = $isSunday ? 0 : max(0, $total - count($userEntrees));

    // Hourly activity
    $activityStmt = $pdo->prepare('
        SELECT HOUR(date_heure) as h, COUNT(*) as count
        FROM pointages
        WHERE DATE(date_heure) = ?
        GROUP BY HOUR(date_heure)
        ORDER BY h ASC
    ');
    $activityStmt->execute([$today]);
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
