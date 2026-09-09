<?php
require_once __DIR__.'/db.php';
// C1 : endpoint d'écriture — exige le token borne (comme borne_pointage.php).
// Sans quoi n'importe qui injecte des pointages arbitraires.
$token = $_SERVER['HTTP_X_DEVICE_TOKEN'] ?? $_SERVER['HTTP_AUTHORIZATION'] ?? '';
$expected = getenv('BORNE_TOKEN') ?: '';
if ($expected === '' || !hash_equals($expected, trim(str_replace('Bearer ','',$token)))) {
    http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Borne non authentifiée (X-Device-Token)']); exit;
}
$pdo=getDB();
$input=getJsonInput();
$points=$input['pointages'] ?? $input ?? [];
if (!is_array($points) || isset($points['id_uuid_local'])) $points=[$points];
$ok=0;
foreach($points as $p){
    $uuid=$p['id_uuid_local']??null; $emp=$p['id_employe']??null; $type=$p['type_pointage']??'entree'; $dt=$p['date_heure']??date('Y-m-d H:i:s'); $score=$p['score_correspondance']??null;
    if(!$uuid||!$emp) continue;
    $chk=$pdo->prepare('SELECT 1 FROM pointages WHERE id_uuid_local=?'); $chk->execute([$uuid]); if($chk->fetch()){ $ok++; continue; }
    $pdo->prepare("INSERT INTO pointages (id_uuid_local,id_employe,type_pointage,date_heure,methode_verification,score_correspondance,source_donnee,synchronise,statut) VALUES (?,?,?,?,'empreinte',?,'local',true,'valide')")->execute([$uuid,$emp,$type,$dt,$score]);
    $ok++;
}
echo json_encode(['ok'=>true,'synced'=>$ok]);
