<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
use App\Core\Biometric\SdkReader;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && !in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé : seul Super Admin (enrôlement/suppression).']); exit; }
if (!in_array($method, ['POST'])) { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée.']); exit; }

function auditLog(PDO $pdo, string $action, ?int $empId, ?int $slot, ?int $score, ?string $device, ?string $motif): void {
    try { $pdo->prepare("INSERT INTO journal_audit (id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, date_heure) VALUES (?,?,?,?,?, NOW())")
        ->execute([$_SESSION['user_id']??null, $action, 'biometrie', $empId, json_encode(['slot'=>$slot,'score'=>$score,'device'=>$device,'motif'=>$motif], JSON_UNESCAPED_UNICODE)]); } catch(Throwable $e){}
}

// gabarit_chiffre est bytea (schéma réel) : on stocke decode(hex) — jamais de
// texte préfixé. Option (a) validée : dump impossible -> bytea vide + actif
// (l'empreinte fonctionne côté capteur, seule la sauvegarde manque).
const GABARIT_ALGO = 'R307_ZFM_UPCHAR_512';
function resolveAppareilId(PDO $pdo): ?int {
    try { $a = $pdo->query("SELECT id_appareil FROM appareils_pointage WHERE type_capteur='empreinte' LIMIT 1")->fetch(); return $a ? (int)$a['id_appareil'] : null; }
    catch (Throwable $e) { return null; }
}
function saveGabarit(PDO $pdo, int $userId, ?string $hex, ?int $appId): bool {
    $dumped = $hex !== null;
    $chk = $pdo->prepare("SELECT id_biometrie FROM donnees_biometriques WHERE id_employe=? AND type_biometrie='empreinte' LIMIT 1");
    $chk->execute([$userId]);
    $ex = $chk->fetch();
    if ($ex) $pdo->prepare("UPDATE donnees_biometriques SET gabarit_chiffre=decode(?,'hex'), algorithme=?, id_appareil_enrolement=?, date_enregistrement=NOW(), statut='actif' WHERE id_biometrie=?")->execute([$hex ?? '', GABARIT_ALGO, $appId, $ex['id_biometrie']]);
    else $pdo->prepare("INSERT INTO donnees_biometriques (id_employe, type_biometrie, gabarit_chiffre, algorithme, id_appareil_enrolement, date_enregistrement, statut) VALUES (?,'empreinte',decode(?,'hex'),?,?,NOW(),'actif')")->execute([$userId, $hex ?? '', GABARIT_ALGO, $appId]);
    return $dumped;
}

if ($method === 'POST') {
    // F4 : enrôlement = 2 captures + retraits doigt (jusqu'à ~60s) — ne pas tuer le script.
    @set_time_limit(120);
    $input = getJsonInput();
    $action = $input['action'] ?? '';
    $userId = (int)($input['userId'] ?? 0);

    try {
        if ($action === 'enroll') {
            if ($userId <=0) { echo json_encode(['ok'=>false,'message'=>'Identifiant employé invalide.']); exit; }
            $empStmt = $pdo->prepare('SELECT prenom, nom, statut FROM employes WHERE id_employe=?');
            $empStmt->execute([$userId]);
            $emp = $empStmt->fetch();
            if (!$emp) { echo json_encode(['ok'=>false,'message'=>'Employé introuvable.']); exit; }
            if (($emp['statut']??'actif')!=='actif') { echo json_encode(['ok'=>false,'message'=>'Employé non actif.']); exit; }

            $pdo->beginTransaction();
            try {
                $reader = SdkReader::fromConfig();
                $res = $reader->enroll($userId);
                $waMsg = ' ('.$reader->name().')';
                $slot = $res['slot'];
                $dumped = saveGabarit($pdo, $userId, $res['hex'], resolveAppareilId($pdo));
                auditLog($pdo,'enrolement',$userId,$slot,null,$reader->getDeviceId(),$dumped?'enroll ok':'enroll ok, UP_CHAR impossible (nodump)');
                $pdo->commit();
                echo json_encode(['ok'=>true,'message'=>"Empreinte enrôlée pour {$emp['prenom']} {$emp['nom']} (slot $slot).$waMsg",'slot'=>$slot,'dumped'=>$dumped]);
            } catch(Throwable $e) { $pdo->rollBack(); throw $e; }
            exit;

        } else if ($action === 'enroll_step1') {
            // Étape 1/2 : 1re capture (bloque jusqu'au doigt posé ou timeout R307).
            if ($userId <=0) { echo json_encode(['ok'=>false,'message'=>'Identifiant employé invalide.']); exit; }
            $empStmt = $pdo->prepare('SELECT prenom, nom, statut FROM employes WHERE id_employe=?');
            $empStmt->execute([$userId]);
            $emp = $empStmt->fetch();
            if (!$emp) { echo json_encode(['ok'=>false,'message'=>'Employé introuvable.']); exit; }
            if (($emp['statut']??'actif')!=='actif') { echo json_encode(['ok'=>false,'message'=>'Employé non actif.']); exit; }
            $reader = SdkReader::fromConfig();
            $slot = $reader->enrollStep1($userId);
            auditLog($pdo,'enrolement_etape1',$userId,$slot,null,$reader->getDeviceId(),'capture 1 ok');
            echo json_encode(['ok'=>true,'step'=>1,'slot'=>$slot,'message'=>"Capture 1 validée pour {$emp['prenom']} {$emp['nom']} — retirez puis reposez le doigt."]);
            exit;

        } else if ($action === 'enroll_step2') {
            // Étape 2/2 : retrait + 2e capture + fusion + stockage + upsert BDD.
            $slot = (int)($input['slot'] ?? 0);
            if ($userId <=0 || $slot <=0) { echo json_encode(['ok'=>false,'message'=>'Étape 2 : employé/slot manquants (reprends à l’étape 1).']); exit; }
            $reader = SdkReader::fromConfig();
            $pdo->beginTransaction();
            try {
                $res = $reader->enrollStep2($userId, $slot);
                $dumped = saveGabarit($pdo, $userId, $res['hex'], resolveAppareilId($pdo));
                auditLog($pdo,'enrolement',$userId,$slot,null,$reader->getDeviceId(),$dumped?'enroll 2 captures ok':'enroll ok, UP_CHAR impossible (nodump)');
                $pdo->commit();
                $msg = "Empreinte enrôlée (slot $slot) — 2 captures validées."
                    . ($dumped ? '' : ' (gabarit non sauvegardé — capteur seul)');
                echo json_encode(['ok'=>true,'step'=>2,'slot'=>$slot,'message'=>$msg,'dumped'=>$dumped]);
            } catch(Throwable $e) { $pdo->rollBack(); throw $e; }
            exit;

        } else if ($action === 'scan') {
            // Scan avec création pointage atomique (super_admin uniquement ici; borne utilise borne_pointage.php)
            $reader = SdkReader::fromConfig();
            $res = $reader->scanWithScore();
            if (!$res) { auditLog($pdo,'scan_refuse',null,null,0,$reader->getDeviceId(),'aucune correspondance'); echo json_encode(['ok'=>false,'message'=>'Aucune empreinte reconnue']); exit; }
            $foundId = $res['page_id']; $score = $res['score'];
            $threshold = $reader->getThreshold();
            if ($score < $threshold) { auditLog($pdo,'scan_refuse',$foundId,$foundId,$score,$reader->getDeviceId(),"score $score < seuil $threshold"); echo json_encode(['ok'=>false,'message'=>"Score trop faible ($score < $threshold)"]); exit; }
            // Résout employé via slot
            $st = $pdo->prepare('SELECT id_employe FROM biometric_slots WHERE slot_number=? AND device_id=?');
            $st->execute([$foundId,$reader->getDeviceId()]);
            $slotRow = $st->fetch();
            $empId = $slotRow ? (int)$slotRow['id_employe'] : $foundId;
            // Vérif employé actif + empreinte active
            $emp = $pdo->prepare('SELECT id_employe, prenom, nom, statut FROM employes WHERE id_employe=?');
            $emp->execute([$empId]); $empRow=$emp->fetch();
            if (!$empRow || ($empRow['statut']??'actif')!=='actif') { auditLog($pdo,'scan_refuse',$empId,$foundId,$score,$reader->getDeviceId(),'employé non actif'); echo json_encode(['ok'=>false,'message'=>'Employé non actif ou introuvable']); exit; }
            $chkBio = $pdo->prepare("SELECT 1 FROM donnees_biometriques WHERE id_employe=? AND type_biometrie='empreinte' AND statut='actif' LIMIT 1"); $chkBio->execute([$empId]); if (!$chkBio->fetch()) { echo json_encode(['ok'=>false,'message'=>'Empreinte révoquée']); exit; }
            // Anti-double 45s
            $cfg = require __DIR__.'/../config/biometric.php'; $anti = $cfg['drivers']['r307']['anti_double_seconds']??45;
            $last = $pdo->prepare('SELECT date_heure FROM pointages WHERE id_employe=? ORDER BY date_heure DESC LIMIT 1'); $last->execute([$empId]); $lr=$last->fetch();
            if ($lr) { $diff = time() - strtotime($lr['date_heure']); if ($diff < $anti) { auditLog($pdo,'scan_refuse',$empId,$foundId,$score,$reader->getDeviceId(),"anti-double ${diff}s"); http_response_code(409); echo json_encode(['ok'=>false,'message'=>"Pointage ignoré (anti-double {$diff}s < {$anti}s)",'retry_after'=>$anti-$diff]); exit; } }
            // Transaction entrée/sortie
            $pdo->beginTransaction();
            // Verrou employé
            $pdo->prepare('SELECT statut FROM employes WHERE id_employe=? FOR UPDATE')->execute([$empId]);
            $today = date('Y-m-d');
            $lastToday = $pdo->prepare("SELECT id_pointage, type_pointage FROM pointages WHERE id_employe=? AND DATE(date_heure)=? ORDER BY date_heure DESC LIMIT 1");
            $lastToday->execute([$empId,$today]); $lt=$lastToday->fetch();
            $type = (!$lt || $lt['type_pointage']==='sortie' || $lt['type_pointage']==='pause_fin') ? 'entree' : 'sortie';
            // id_appareil
            $appId=null; try{ $a=$pdo->query("SELECT id_appareil FROM appareils_pointage WHERE type_capteur='empreinte' LIMIT 1")->fetch(); if($a) $appId=$a['id_appareil']; }catch(Throwable $e){}
            $uuid = sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0x0fff)|0x4000,mt_rand(0,0x3fff)|0x8000,mt_rand(0,0xffff),mt_rand(0,0xffff),mt_rand(0,0xffff));
            $pdo->prepare("INSERT INTO pointages (id_uuid_local, id_employe, id_appareil, type_pointage, date_heure, methode_verification, score_correspondance, source_donnee, synchronise, statut) VALUES (?,?,?,?,NOW(),'empreinte',?,'serveur',true,'valide')")
                ->execute([$uuid,$empId,$appId,$type,$score]);
            auditLog($pdo,'scan_'.$type,$empId,$foundId,$score,$reader->getDeviceId(),$type);
            $pdo->commit();
            echo json_encode(['ok'=>true,'user_id'=>$empId,'page_id'=>$foundId,'score'=>$score,'type'=>$type,'nom'=>$empRow['prenom'].' '.$empRow['nom'],'heure'=>date('H:i:s'),'message'=>"Pointage $type enregistré"]);
            exit;

        } else if ($action === 'delete') {
            if ($userId<=0) { echo json_encode(['ok'=>false,'message'=>'ID invalide']); exit; }
            $reader = SdkReader::fromConfig();
            $slot = $reader->getSlotForUser($userId);
            try { $reader->delete($userId); } catch(Throwable $e) {
                auditLog($pdo,'delete_echec',$userId,$slot,null,$reader->getDeviceId(),$e->getMessage());
                http_response_code(500); echo json_encode(['ok'=>false,'message'=>'R307 échec, base conservée: '.$e->getMessage(),'a_supprimer'=>true]); exit;
            }
            $pdo->prepare('DELETE FROM donnees_biometriques WHERE id_employe=? AND type_biometrie=\'empreinte\'')->execute([$userId]);
            // slot déjà supprimé par SdkReader
            auditLog($pdo,'delete_ok',$userId,$slot,null,$reader->getDeviceId(),'suppression synchrone');
            echo json_encode(['ok'=>true,'message'=>'Empreinte supprimée (R307 + BDD).']);
            exit;
        }
        http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Action inconnue.']);
    } catch(Throwable $e) {
        if ($pdo->inTransaction()) $pdo->rollBack();
        http_response_code($e->getCode()>=400?$e->getCode():500);
        error_log('Biometric error: '.$e->getMessage());
        echo json_encode(['ok'=>false,'message'=>$e->getMessage()]);
    }
    exit;
}
