<?php
// Route borne dédiée : POST sans session admin, auth par X-Device-Token (env BORNE_TOKEN) ou IP allowlist
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/PointageService.php';
// SdkReader chargé APRÈS les gates auth/anti-rejeu (évite fatal + paths leak avant 401).
use App\Core\Biometric\SdkReader;
use App\Core\PointageService;

// CSRF exempt pour borne (ajouté à api/db.php) — token par header UNIQUEMENT
// (jamais dans le body JSON : loggable/cachable par proxies).
$token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
// C2 : fail-closed — sans BORNE_TOKEN configuré, TOUT est refusé (pas de fallback devinable).
$expected = getenv('BORNE_TOKEN') ?: '';
if ($expected === '') {
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Borne non configurée (BORNE_TOKEN manquant)']); exit;
}
if (!hash_equals($expected, trim(str_replace('Bearer ','',$token)))) {
    http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Borne non authentifiée (X-Device-Token)']); exit;
}
// H4 : anti-rejeu (ts ±120s + nonce usage unique) + rate-limit (0.8s min + 20 req/min/IP).
$input0 = getJsonInput();
$ts = (int)($input0['ts'] ?? 0);
if ($ts <= 0 || abs(time() - $ts) > 120) {
    http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Requête expirée (ts hors fenêtre ±120s)']); exit;
}
$nonce = (string)($input0['nonce'] ?? '');
if ($nonce === '' || strlen($nonce) > 128) {
    http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Nonce manquant']); exit;
}
$nonceFile = sys_get_temp_dir().'/borne_nonce_'.sha1($nonce).'.json';
if (file_exists($nonceFile)) {
    $nd = json_decode(@file_get_contents($nonceFile), true);
    if (is_array($nd) && ($nd['exp'] ?? 0) > time()) {
        http_response_code(409); echo json_encode(['ok'=>false,'message'=>'Requête déjà traitée (rejeu)']); exit;
    }
}
@file_put_contents($nonceFile, json_encode(['exp' => time() + 300]), LOCK_EX);
// Rate limit par IP : écart min 0.8s + fenêtre glissante 20 req/min
// Rate limit par IP réelle (clientIp : X-Forwarded-For si proxy de confiance)
$ip = clientIp();
$rlFile = sys_get_temp_dir().'/borne_rl_'.md5($ip).'.json';
$now=microtime(true); $hits=[];
if (file_exists($rlFile)) { $hits = json_decode(@file_get_contents($rlFile), true) ?: []; if (!is_array($hits)) $hits = [$hits]; }
$hits = array_values(array_filter($hits, fn($t) => ($now - (float)$t) < 60));
$last = empty($hits) ? 0 : max(array_map('floatval', $hits));
if ($now - $last < 0.8 || count($hits) >= 20) { http_response_code(429); echo json_encode(['ok'=>false,'message'=>'Trop de requêtes']); exit; }
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

$pdo=getDB();
// F4 : scan = attente du doigt (timeout R307) — ne pas tuer le script.
@set_time_limit(120);
try {
    require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
    require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
    $reader = SdkReader::fromConfig();
    // Surveillance daemon (r307_service.py) : l'identification est déjà faite
    // côté capteur (Img2Tz + Search, une seule capture) — le résultat est fourni
    // dans la requête. Le serveur NE FAIT PAS confiance aveuglément : revalidation
    // du slot (0..999) et du score (seuil config) ci-dessous.
    if (!empty($input0['identified'])) {
        $pageId0 = (int)($input0['page_id'] ?? 0);
        $score0 = (int)($input0['score'] ?? 0);
        if ($pageId0 < 0 || $pageId0 > 999) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'page_id invalide']); exit; }
        if ($score0 < $reader->getThreshold()) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>"Score faible {$score0}"]); exit; }
        $res = ['page_id'=>$pageId0, 'score'=>$score0];
    } else {
        $res = $reader->scanWithScore();
    }
    if (!$res) { http_response_code(404); echo json_encode(['ok'=>false,'message'=>'Aucune empreinte']); exit; }
    if ($res['score'] < $reader->getThreshold()) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>"Score faible {$res['score']}"]); exit; }
    // Logique partagée avec l'API web (PointageService) — la borne applique
    // désormais EXACTEMENT la même décision entrée/sortie, pause_fin incluse
    // (bug corrigé : reprise de pause comptée comme sortie au lieu d'une entrée),
    // même anti-double, même verrou transactionnel, même audit.
    $foundId = $res['page_id']; $score = (int)$res['score'];
    $empId = PointageService::resolveEmployeFromSlot($pdo, $reader->getDeviceId(), $foundId);
    try {
        $empRow = PointageService::assertEmployeActif($pdo, $empId);
        PointageService::assertEmpreinteActive($pdo, $empId);
    } catch (\DomainException $e) {
        http_response_code(403); echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); exit;
    }
    $anti = PointageService::antiDoubleSeconds($reader->getDeviceId());
    if ($ad = PointageService::checkAntiDouble($pdo, $empId, $anti)) {
        http_response_code(409); echo json_encode(['ok'=>false,'message'=>$ad['message'],'retry_after'=>$ad['retry_after']]); exit;
    }
    $r = PointageService::recordScanPointage($pdo, $empId, $score, $reader->getDeviceId(),
        fn(string $t) => PointageService::auditBorne($pdo, 'borne_' . $t, $empId, ['slot'=>$foundId,'score'=>$score,'ip'=>$ip]));
    echo json_encode(['ok'=>true,'user_id'=>$empId,'nom'=>$empRow['prenom'].' '.$empRow['nom'],'type'=>$r['type'],'score'=>$score,'heure'=>date('H:i:s')]);
} catch(Throwable $e){ if($pdo->inTransaction()) $pdo->rollBack(); http_response_code(500); echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); }
