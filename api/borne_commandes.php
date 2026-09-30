<?php
// Boîte aux lettres serveur → borne (commandes set_mode / watch_on / watch_off).
// Le daemon vient les chercher (poll ~3 s, sortant seul — NAT-safe) puis ACK.
// GET  : ?device_id=xxx → [{id,type,payload}] pending (auth token seul).
// POST : {ack_ids:[...]} (+ts/nonce) → marquées acked.
// Écriture des ordres : sensor_mode.php / sensor_watch.php (super_admin + CSRF).
require_once __DIR__ . '/db.php';

$token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$expected = getenv('BORNE_TOKEN') ?: '';
if ($expected === '') {
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Borne non configurée (BORNE_TOKEN manquant)']); exit;
}
if (!hash_equals($expected, trim(str_replace('Bearer ','',$token)))) {
    http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Borne non authentifiée (X-Device-Token)']); exit;
}
$method = $_SERVER['REQUEST_METHOD'] ?? '';

try {
    $pdo = getDB();
} catch (Throwable $e) {
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Erreur de connexion.']); exit;
}

if ($method === 'GET') {
    $device = substr(trim((string)($_GET['device_id'] ?? 'r307_main')), 0, 50) ?: 'r307_main';
    try {
        $st = $pdo->prepare("SELECT id, type, payload FROM borne_commandes WHERE statut='pending' AND (device_id=? OR device_id='*') ORDER BY id ASC LIMIT 20");
        $st->execute([$device]);
        $rows = $st->fetchAll();
        foreach ($rows as &$r) {
            $d = json_decode((string)$r['payload'], true);
            $r['payload'] = is_array($d) ? $d : [];
            $r['id'] = (int)$r['id'];
        }
        echo json_encode(['ok'=>true,'commandes'=>$rows]);
    } catch (Throwable $e) {
        error_log('borne_commandes GET: '.$e->getMessage());
        http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Lecture impossible.']);
    }
    exit;
}

if ($method === 'POST') {
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
    $ids = array_values(array_unique(array_filter(array_map('intval', (array)($input['ack_ids'] ?? [])), fn($v) => $v > 0)));
    $ids = array_slice($ids, 0, 20);
    $n = 0;
    if (!empty($ids)) {
        try {
            $ph = implode(',', array_fill(0, count($ids), '?'));
            $up = $pdo->prepare("UPDATE borne_commandes SET statut='acked' WHERE id IN ($ph) AND statut='pending'");
            $up->execute($ids);
            $n = $up->rowCount();
        } catch (Throwable $e) {
            error_log('borne_commandes ACK: '.$e->getMessage());
            http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Enregistrement impossible.']); exit;
        }
    }
    echo json_encode(['ok'=>true,'acked'=>$n]);
    exit;
}

http_response_code(405);
echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée']);
