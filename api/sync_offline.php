<?php
require_once __DIR__.'/db.php';
require_once __DIR__.'/../app/Core/PointageService.php';
use App\Core\PointageService;

// C1 : endpoint d'écriture — exige le token borne (comme borne_pointage.php).
// Sans quoi n'importe qui injecte des pointages arbitraires.
$token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$expected = getenv('BORNE_TOKEN') ?: '';
if ($expected === '' || !hash_equals($expected, trim(str_replace('Bearer ','',$token)))) {
    http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Borne non authentifiée (X-Device-Token)']); exit;
}

// H4 : rate-limit simple par IP réelle (cf. clientIp), cohérent avec la borne.
$ip = clientIp();
$rlFile = sys_get_temp_dir().'/sync_rl_'.md5($ip).'.json';
$now = microtime(true);
$hits = [];
if (file_exists($rlFile)) { $hits = json_decode(@file_get_contents($rlFile), true) ?: []; if (!is_array($hits)) $hits = []; }
$hits = array_values(array_filter($hits, fn($t) => ($now - (float)$t) < 60));
if (count($hits) >= 20) { http_response_code(429); echo json_encode(['ok'=>false,'message'=>'Trop de requêtes']); exit; }
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

$pdo = getDB();
$input = getJsonInput();
$points = $input['pointages'] ?? $input ?? [];
if (!is_array($points) || isset($points['id_uuid_local'])) $points = [$points];

$anti = PointageService::antiDoubleSeconds('r307');
$ok = 0; $rejets = [];
foreach ($points as $p) {
    if (!is_array($p)) { $rejets[] = 'élément invalide'; continue; }
    $uuid = (string)($p['id_uuid_local'] ?? '');
    try {
        // Validation complète AVANT insertion : UUID, employé actif, type du
        // schéma, date parsable non future, score borné, anti-double récent,
        // idempotence UUID. Un pointage hors-ligne déjà passé (horodatage ancien)
        // n'est PAS soumis à l'anti-double (contrôle fait par la borne à la capture).
        $r = PointageService::syncOfflineItem($pdo, $p, $anti);
        if ($r === 'inserted' || $r === 'duplicate') {
            $ok++;
            if ($r === 'inserted') {
                PointageService::auditBorne($pdo, 'sync_offline', (int)($p['id_employe'] ?? 0), [
                    'uuid' => $uuid, 'type' => $p['type_pointage'] ?? null,
                    'date_heure' => $p['date_heure'] ?? null, 'ip' => $ip,
                ]);
                foreach (['today', '7d', '30d'] as $p) cacheClear('dash_' . $p);
            }
        }
    } catch (\DomainException $e) {
        $rejets[] = ($uuid !== '' ? substr($uuid, 0, 8) : '?') . ': ' . $e->getMessage();
    } catch (Throwable $e) {
        error_log('sync_offline: ' . $e->getMessage());
        $rejets[] = ($uuid !== '' ? substr($uuid, 0, 8) : '?') . ': erreur base';
    }
}
echo json_encode(['ok' => true, 'synced' => $ok, 'rejected' => count($rejets), 'motifs' => array_slice($rejets, 0, 10)]);
