<?php
require_once __DIR__ . '/db.php';

if (!isset($_SESSION['user_id'])) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'message' => 'Non authentifié.']);
    exit;
}
// Libère le verrou de session (évite 401 aléatoires sur requêtes parallèles du dashboard)
$pdo = getDB();
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();

$view = $_GET['view'] ?? '7d';
$cacheKey = 'dash_trends_' . $view;
$cached = cacheGet($cacheKey, 30);
if (is_array($cached)) { $cached['cached'] = true; echo json_encode($cached); exit; }

try {
    if ($view === '7d') {
        // Derniers 7 jours GLISSANTS (chronologiques J-6 → aujourd'hui), libellés
        // = dates réelles. L'ancien code mappait les résultats sur des libellés
        // fixes Lun..Dim : le week-end de la semaine précédente s'affichait comme
        // s'il appartenait à la semaine courante (timeline fausse).
        $stmt = $pdo->prepare("
            SELECT 
                p.date_heure::date AS d,
                COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS presents,
                COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' 
                    AND TO_CHAR(p.date_heure, 'HH24:MI:SS') > '08:30:00' 
                    THEN p.id_employe END) AS retards,
                (
                    SELECT COUNT(*) FROM employes e WHERE e.statut = 'actif'
                ) - COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS absents
            FROM pointages p
            WHERE p.date_heure >= (CURRENT_DATE - INTERVAL '6 days') AND p.date_heure < (CURRENT_DATE + INTERVAL '1 day')
            GROUP BY p.date_heure::date
            ORDER BY p.date_heure::date ASC
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        // Grille chronologique J-6 → aujourd'hui (jours sans pointage : absents = effectif actif)
        $totalActifs = (int)($pdo->query("SELECT COUNT(*) FROM employes WHERE statut='actif'")->fetchColumn());
        $daysMap = [];
        foreach ($rows as $r) {
            $daysMap[date('Y-m-d', strtotime($r['d']))] = [
                'presents' => (int)$r['presents'],
                'retards' => (int)$r['retards'],
                'absents' => max(0, (int)$r['absents'])
            ];
        }
        $presentsData = [];
        $retardsData = [];
        $absentsData = [];
        $outLabels = [];

        for ($i = 6; $i >= 0; $i--) {
            $ts = strtotime("-$i days");
            $key = date('Y-m-d', $ts);
            $outLabels[] = date('d/m', $ts);
            $d = $daysMap[$key] ?? ['presents' => 0, 'retards' => 0, 'absents' => $totalActifs];
            $presentsData[] = $d['presents'];
            $retardsData[] = $d['retards'];
            $absentsData[] = $d['absents'];
        }

        $payload = [
            'ok' => true,
            'labels' => $outLabels,
            'presents' => $presentsData,
            'retards' => $retardsData,
            'absents' => $absentsData
        ];
        cacheSet($cacheKey, $payload);
        echo json_encode($payload);
    } else {
        // 4 dernières semaines (semaines complètes Lundi-Dimanche)
        $stmt = $pdo->prepare("
            SELECT 
                date_trunc('week', p.date_heure)::date AS week_start,
                COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS presents,
                COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' 
                    AND TO_CHAR(p.date_heure, 'HH24:MI:SS') > '08:30:00' 
                    THEN p.id_employe END) AS retards,
                (
                    SELECT COUNT(*) FROM employes e WHERE e.statut = 'actif'
                ) - COUNT(DISTINCT CASE WHEN p.type_pointage = 'entree' THEN p.id_employe END) AS absents
            FROM pointages p
            WHERE p.date_heure >= (CURRENT_DATE - INTERVAL '27 days') AND p.date_heure < (CURRENT_DATE + INTERVAL '1 day')
            GROUP BY date_trunc('week', p.date_heure)
            ORDER BY week_start ASC
        ");
        $stmt->execute();
        $rows = $stmt->fetchAll();

        $weeksMap = [];
        foreach ($rows as $r) {
            $weekNum = (int)date('W', strtotime($r['week_start']));
            $weeksMap[$weekNum] = [
                'presents' => (int)$r['presents'],
                'retards' => (int)$r['retards'],
                'absents' => max(0, (int)$r['absents'])
            ];
        }

        $labels = [];
        $presentsData = [];
        $retardsData = [];
        $absentsData = [];

        // 4 dernières semaines
        for ($i = 3; $i >= 0; $i--) {
            $targetDate = date('Y-m-d', strtotime("-$i weeks Monday this week"));
            $weekNum = (int)date('W', strtotime($targetDate));
            $labels[] = 'Sem ' . $weekNum;
            $d = $weeksMap[$weekNum] ?? ['presents' => 0, 'retards' => 0, 'absents' => 0];
            $presentsData[] = $d['presents'];
            $retardsData[] = $d['retards'];
            $absentsData[] = $d['absents'];
        }

        $payload = [
            'ok' => true,
            'labels' => $labels,
            'presents' => $presentsData,
            'retards' => $retardsData,
            'absents' => $absentsData
        ];
        cacheSet($cacheKey, $payload);
        echo json_encode($payload);
    }
} catch (Throwable $e) {
    http_response_code(500);
    error_log('Dashboard trends error: ' . $e->getMessage());
    echo json_encode(['ok' => false, 'message' => 'Erreur tendances.']);
}