<?php
// Heartbeat borne → serveur : état capteur pour le badge « En service » distant.
// POST sans session admin, auth X-Device-Token (env BORNE_TOKEN) + anti-rejeu.
// Le daemon appelle toutes les ~15 s ; sensor_status.php considère la borne
// en service si last_seen < 60 s. Aucun secret renvoyé.
require_once __DIR__ . '/db.php';

$token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$expected = getenv('BORNE_TOKEN') ?: '';
if ($expected === '') {
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Borne non configurée (BORNE_TOKEN manquant)']); exit;
}
if (!hash_equals($expected, trim(str_replace('Bearer ','',$token)))) {
    http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Borne non authentifiée (X-Device-Token)']); exit;
}
$input = getJsonInput();
$ts = (int)($input['ts'] ?? 0);
if ($ts <= 0 || abs(time() - $ts) > 120) {
    http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Requête expirée (ts hors fenêtre ±120s)']); exit;
}
$nonce = (string)($input['nonce'] ?? '');
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

// Rate-limit doux : 1 heartbeat / 5 s min par IP (daemon = ~15 s).
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir().'/borne_hb_'.md5($ip).'.json';
$last = is_file($rlFile) ? (float)@file_get_contents($rlFile) : 0;
if (microtime(true) - $last < 5) { http_response_code(429); echo json_encode(['ok'=>false,'message'=>'Trop de requêtes']); exit; }
@file_put_contents($rlFile, (string)microtime(true), LOCK_EX);

$device = substr(trim((string)($input['device_id'] ?? 'r307_main')), 0, 50) ?: 'r307_main';
$count = max(0, (int)($input['count'] ?? 0));
$hwOk = array_key_exists('hw_ok', $input) ? ($input['hw_ok'] === null ? null : (bool)$input['hw_ok']) : null;
$watching = !empty($input['watching']);

// Dernier événement détection (widget d'un autre appareil) : seq monotone +
// détails bornés. Absent/null = aucun événement (colonnes inchangées en NULL).
$lastSeq = null; $lastDet = null; $lastRes = null;
if (array_key_exists('last_result', $input) && is_array($input['last_result'])) {
    $lr = $input['last_result'];
    $seq = (int)($lr['seq'] ?? 0);
    if ($seq > 0) {
        $keep = [];
        foreach (['page_id','score','http','ok','message','seq','at','nom','type','heure','retry_after','user_id'] as $k) {
            if (array_key_exists($k, $lr)) $keep[$k] = $lr[$k];
        }
        $keep['seq'] = $seq;
        $json = json_encode($keep, JSON_UNESCAPED_UNICODE);
        if (is_string($json) && strlen($json) <= 2048) {
            $lastSeq = $seq;
            $lastRes = $json;
            $dt = (string)($input['last_detection'] ?? ($lr['at'] ?? ''));
            if (preg_match('/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?$/', $dt)) {
                $lastDet = str_replace('T', ' ', $dt) . (strlen($dt) === 16 ? ':00' : '');
            }
        }
    }
}

try {
    $pdo = getDB();
    $pdo->prepare("INSERT INTO borne_etat (device_id, last_seen, empreintes, hw_ok, watching, last_seq, last_detection, last_result)
        VALUES (?, NOW(), ?, ?, ?, ?, ?::timestamp, ?::jsonb)
        ON CONFLICT (device_id) DO UPDATE SET last_seen=NOW(), empreintes=EXCLUDED.empreintes, hw_ok=EXCLUDED.hw_ok, watching=EXCLUDED.watching, last_seq=EXCLUDED.last_seq, last_detection=EXCLUDED.last_detection, last_result=EXCLUDED.last_result")
        ->execute([$device, $count, $hwOk === null ? null : ($hwOk ? 1 : 0), $watching ? 1 : 0, $lastSeq, $lastDet, $lastRes]);
    echo json_encode(['ok'=>true,'message'=>'État enregistré']);
} catch (Throwable $e) {
    error_log('sensor_heartbeat: '.$e->getMessage());
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Enregistrement impossible.']);
}
