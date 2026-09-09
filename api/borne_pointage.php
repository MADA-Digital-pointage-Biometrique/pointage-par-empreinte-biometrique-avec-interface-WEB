<?php
// Route borne dédiée : POST sans session admin, auth par X-Device-Token (env BORNE_TOKEN) ou IP allowlist
require_once __DIR__ . '/db.php';
// SdkReader chargé APRÈS les gates auth/anti-rejeu (évite fatal + paths leak avant 401).
use App\Core\Biometric\SdkReader;

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
$ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
$rlFile = sys_get_temp_dir().'/borne_rl_'.md5($ip).'.json';
$now=microtime(true); $hits=[];
if (file_exists($rlFile)) { $hits = json_decode(@file_get_contents($rlFile), true) ?: []; if (!is_array($hits)) $hits = [$hits]; }
$hits = array_values(array_filter($hits, fn($t) => ($now - (float)$t) < 60));
$last = empty($hits) ? 0 : max(array_map('floatval', $hits));
if ($now - $last < 0.8 || count($hits) >= 20) { http_response_code(429); echo json_encode(['ok'=>false,'message'=>'Trop de requêtes']); exit; }
$hits[] = $now;
@file_put_contents($rlFile, json_encode($hits), LOCK_EX);

$pdo=getDB();
try {
    require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
    require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
    $reader = SdkReader::fromConfig();
    $res = $reader->scanWithScore();
    if (!$res) { http_response_code(404); echo json_encode(['ok'=>false,'message'=>'Aucune empreinte']); exit; }
    if ($res['score'] < $reader->getThreshold()) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>"Score faible {$res['score']}"]); exit; }
    // Reuse même transaction que biometric.php scan (copié simplifié)
    $foundId=$res['page_id']; $score=$res['score'];
    $st=$pdo->prepare('SELECT id_employe FROM biometric_slots WHERE slot_number=? AND device_id=?'); $st->execute([$foundId,$reader->getDeviceId()]); $r=$st->fetch(); $empId=$r?(int)$r['id_employe']:$foundId;
    $emp=$pdo->prepare('SELECT prenom,nom,statut FROM employes WHERE id_employe=?'); $emp->execute([$empId]); $er=$emp->fetch();
    if(!$er || ($er['statut']??'actif')!=='actif'){ http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Employé non actif']); exit; }
    $anti=45; $last=$pdo->prepare('SELECT date_heure FROM pointages WHERE id_employe=? ORDER BY date_heure DESC LIMIT 1'); $last->execute([$empId]); $lr=$last->fetch();
    if($lr && (time()-strtotime($lr['date_heure'])) < $anti){ http_response_code(409); echo json_encode(['ok'=>false,'message'=>'Anti-double']); exit; }
    $pdo->beginTransaction();
    $today=date('Y-m-d'); $lt=$pdo->prepare("SELECT type_pointage FROM pointages WHERE id_employe=? AND DATE(date_heure)=? ORDER BY date_heure DESC LIMIT 1"); $lt->execute([$empId,$today]); $t=$lt->fetch();
    $type = (!$t || $t['type_pointage']==='sortie') ? 'entree' : 'sortie';
    $uuid=sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
    $appId=null; try{ $a=$pdo->query("SELECT id_appareil FROM appareils_pointage WHERE type_capteur='empreinte' LIMIT 1")->fetch(); if($a) $appId=$a['id_appareil']; }catch(Throwable $e){}
    $pdo->prepare("INSERT INTO pointages (id_uuid_local, id_employe, id_appareil, type_pointage, date_heure, methode_verification, score_correspondance, source_donnee, synchronise, statut) VALUES (?,?,?,?,NOW(),'empreinte',?,'serveur',true,'valide')")->execute([$uuid,$empId,$appId,$type,$score]);
    $pdo->prepare("INSERT INTO journal_audit (id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, date_heure) VALUES (NULL,?,?,?,?,NOW())")->execute(['borne_'.$type,'pointages',$empId,json_encode(['slot'=>$foundId,'score'=>$score,'ip'=>$ip])]);
    $pdo->commit();
    echo json_encode(['ok'=>true,'user_id'=>$empId,'nom'=>$er['prenom'].' '.$er['nom'],'type'=>$type,'score'=>$score,'heure'=>date('H:i:s')]);
} catch(Throwable $e){ if($pdo->inTransaction()) $pdo->rollBack(); http_response_code(500); echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); }
