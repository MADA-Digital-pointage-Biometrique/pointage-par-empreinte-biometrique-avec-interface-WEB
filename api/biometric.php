<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
require_once __DIR__ . '/../app/Core/PointageService.php';
use App\Core\Biometric\SdkReader;
use App\Core\Crypto;
use App\Core\PointageService;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
$pdo = getDB();
$method = $_SERVER['REQUEST_METHOD'];
if ($method === 'POST' && !in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé : seul Super Admin (enrôlement/suppression).']); exit; }
if (!in_array($method, ['POST'])) { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée.']); exit; }

function auditLog(PDO $pdo, string $action, ?int $empId, ?int $slot, ?int $score, ?string $device, ?string $motif): void {
    // Savepoint-safe : un echec d'audit DANS une transaction ne doit pas l'aborter
    // en silence (sinon 25P02 masque l'erreur primaire sur la requete suivante).
    $sp = $pdo->inTransaction();
    if ($sp) { try { $pdo->exec('SAVEPOINT auditlog_sp'); } catch (Throwable $e) { $sp = false; } }
    try { $pdo->prepare("INSERT INTO journal_audit (id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, date_heure) VALUES (?,?,?,?,?, NOW())")
        ->execute([$_SESSION['user_id']??null, $action, 'biometrie', $empId, json_encode(['slot'=>$slot,'score'=>$score,'device'=>$device,'motif'=>$motif], JSON_UNESCAPED_UNICODE)]); }
    catch (Throwable $e) {
        if ($sp) { try { $pdo->exec('ROLLBACK TO SAVEPOINT auditlog_sp'); } catch (Throwable $e2) {} }
        error_log('auditLog(' . $action . '): ' . $e->getMessage());
        return;
    }
    if ($sp) { try { $pdo->exec('RELEASE SAVEPOINT auditlog_sp'); } catch (Throwable $e2) {} }
}

// RGPD Art.9 : le gabarit UP_CHAR (512 octets) est chiffré applicativement
// (AES-256-GCM, app/Core/Crypto.php) AVANT stockage dans le bytea gabarit_chiffre.
// Les anciennes lignes en clair restent lisibles (rétro-compat Crypto::decryptHex)
// et sont re-chiffrées au prochain enrôlement ou via database/migration_chiffrement.php.
// Dump impossible -> bytea vide + actif (l'empreinte fonctionne côté capteur).
const GABARIT_ALGO = 'R307_ZFM_UPCHAR_512_AESGCM';
function saveGabarit(PDO $pdo, int $userId, ?string $hex, ?int $appId): bool {
    $dumped = $hex !== null;
    // decode('hex') : la colonne reste bytea, mais le binaire décodé est
    // désormais le chiffré ENC1 (IV+TAG+CT), plus le gabarit en clair.
    $hexChiffre = $dumped ? bin2hex(Crypto::encryptHex($hex)) : '';
    $chk = $pdo->prepare("SELECT id_biometrie FROM donnees_biometriques WHERE id_employe=? AND type_biometrie='empreinte' LIMIT 1");
    $chk->execute([$userId]);
    $ex = $chk->fetch();
    if ($ex) $pdo->prepare("UPDATE donnees_biometriques SET gabarit_chiffre=decode(?,'hex'), algorithme=?, id_appareil_enrolement=?, date_enregistrement=NOW(), statut='actif' WHERE id_biometrie=?")->execute([$hexChiffre, GABARIT_ALGO, $appId, $ex['id_biometrie']]);
    else $pdo->prepare("INSERT INTO donnees_biometriques (id_employe, type_biometrie, gabarit_chiffre, algorithme, id_appareil_enrolement, date_enregistrement, statut) VALUES (?,'empreinte',decode(?,'hex'),?,?,NOW(),'actif')")->execute([$userId, $hexChiffre, GABARIT_ALGO, $appId]);
    return $dumped;
}

if ($method === 'POST') {
    // F4 : enrôlement = 2 captures (boucle auto jusqu'à ~105 s chacune) + fusion +
    // stockage + dump gabarit — ne pas tuer le script pendant une longue attente doigt.
    @set_time_limit(240);
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

            $appId = PointageService::resolveAppareilId($pdo); // HORS transaction (lecture seule)
            $pdo->beginTransaction();
            try {
                $reader = SdkReader::fromConfig();
                $res = $reader->enroll($userId, $_SESSION['user_id'] ?? null);
                $waMsg = ' ('.$reader->name().')';
                $slot = $res['slot'];
                $dumped = saveGabarit($pdo, $userId, $res['hex'], $appId);
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
            $cfg = require __DIR__ . '/../config/biometric.php';
            $slot = $reader->enrollStep1($userId, $_SESSION['user_id'] ?? null);
            auditLog($pdo,'enrolement_etape1',$userId,$slot,null,$reader->getDeviceId(),'capture 1 ok');
            echo json_encode(['ok'=>true,'step'=>1,'slot'=>$slot,'timeout'=>($cfg['drivers']['r307']['timeout'] ?? 15),'message'=>"Capture 1 validée pour {$emp['prenom']} {$emp['nom']} — retirez puis reposez le doigt."]);
            exit;

        } else if ($action === 'enroll_step2') {
            // Étape 2/2 : retrait + 2e capture + fusion + stockage + upsert BDD.
            $slot = (int)($input['slot'] ?? 0);
            if ($userId <=0 || $slot <=0) { echo json_encode(['ok'=>false,'message'=>'Étape 2 : employé/slot manquants (reprends à l’étape 1).']); exit; }
            $reader = SdkReader::fromConfig();
            $appId = PointageService::resolveAppareilId($pdo); // HORS transaction (lecture seule)
            $pdo->beginTransaction();
            try {
                $res = $reader->enrollStep2($userId, $slot);
                $dumped = saveGabarit($pdo, $userId, $res['hex'], $appId);
                auditLog($pdo,'enrolement',$userId,$slot,null,$reader->getDeviceId(),$dumped?'enroll 2 captures ok':'enroll ok, UP_CHAR impossible (nodump)');
                $pdo->commit();
                $msg = "Empreinte enrôlée (slot $slot) — 2 captures validées."
                    . ($dumped ? '' : ' (gabarit non sauvegardé — capteur seul)');
                echo json_encode(['ok'=>true,'step'=>2,'slot'=>$slot,'message'=>$msg,'dumped'=>$dumped]);
            } catch(Throwable $e) { $pdo->rollBack(); throw $e; }
            exit;

        } else if ($action === 'enroll_cancel') {
            // Abandon après l'étape 1 (l'utilisateur ne va jamais jusqu'à l'étape 2) :
            // sans ça le terminal resterait bloqué en mode enrolement.
            $reader = SdkReader::fromConfig();
            $reader->setMode('pointage');
            auditLog($pdo,'enrolement_annule',$userId?:null,null,null,$reader->getDeviceId(),'annulation manuelle');
            echo json_encode(['ok'=>true,'message'=>'Enrôlement annulé, terminal repassé en mode pointage.']);
            exit;

        } else if ($action === 'mode_status') {
            // Permet à l'interface d'afficher le mode courant du terminal (pointage/enrolement + cible).
            $reader = SdkReader::fromConfig();
            $mode = $reader->getMode();
            echo json_encode(['ok'=>true] + $mode);
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
            // Employé résolu via slot + validations partagées (PointageService)
            $empId = PointageService::resolveEmployeFromSlot($pdo, $reader->getDeviceId(), $foundId);
            try {
                $empRow = PointageService::assertEmployeActif($pdo, $empId);
                PointageService::assertEmpreinteActive($pdo, $empId);
            } catch (\DomainException $e) {
                auditLog($pdo,'scan_refuse',$empId,$foundId,$score,$reader->getDeviceId(),$e->getMessage());
                echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); exit;
            }
            // Anti-double (config, défaut 45s)
            $anti = PointageService::antiDoubleSeconds($reader->getDeviceId());
            if ($ad = PointageService::checkAntiDouble($pdo, $empId, $anti)) {
                auditLog($pdo,'scan_refuse',$empId,$foundId,$score,$reader->getDeviceId(),"anti-double {$ad['diff']}s");
                http_response_code(409);
                echo json_encode(['ok'=>false,'message'=>$ad['message'],'retry_after'=>$ad['retry_after']]); exit;
            }
            // Transaction entrée/sortie + insertion + cache : logique partagée web/borne
            $type = null;
            PointageService::recordScanPointage($pdo, (int)$empId, (int)$score, $reader->getDeviceId(),
                function(string $t) use ($pdo,$empId,$foundId,$score,$reader,&$type) {
                    $type = $t;
                    auditLog($pdo,'scan_'.$t,(int)$empId,(int)$foundId,(int)$score,$reader->getDeviceId(),$t);
                });
            echo json_encode(['ok'=>true,'user_id'=>$empId,'page_id'=>$foundId,'score'=>$score,'type'=>$type,'nom'=>$empRow['prenom'].' '.$empRow['nom'],'heure'=>date('H:i:s'),'message'=>"Pointage $type enregistré"]);
            exit;

        } else if ($action === 'purge_all') {
            // Purge TOTALE de la biométrie : bibliothèque flash R307 vidée (empty) +
            // mapping biometric_slots + gabarits donnees_biometriques (RGPD Art.9).
            // Super Admin déjà exigé en tête de fichier. $userId inutilisé ici.
            $reader = SdkReader::fromConfig();
            $res = $reader->emptyLibrary();
            try {
                $nSlots = $pdo->exec('DELETE FROM biometric_slots');
                $nBio = $pdo->exec("DELETE FROM donnees_biometriques WHERE type_biometrie='empreinte'");
                auditLog($pdo, 'purge_totale_biometrie', null, null, null, $reader->getDeviceId(),
                    'capteur=' . var_export($res['purged'], true) . ', slots=' . (int)$nSlots . ', gabarits=' . (int)$nBio);
            } catch (Throwable $e) {
                auditLog($pdo, 'purge_totale_biometrie', null, null, null, $reader->getDeviceId(), 'erreur BDD: ' . $e->getMessage());
                http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Capteur vidé mais échec BDD : ' . $e->getMessage(), 'partial'=>true]); exit;
            }
            if (!$res['ok']) {
                // BDD purgée, capteur pas atteint → l'état du capteur (compteur) reste source de vérité.
                echo json_encode(['ok'=>false,'partial'=>true,'message'=>'Base de données purgée mais capteur injoignable : ' . $res['message'] . ' — le compteur du capteur se corrigera dès qu\'il sera de nouveau en service.']);
                exit;
            }
            echo json_encode(['ok'=>true,'message'=>"Biométrie purgée : capteur vidé ({$res['purged']} gabarits) + " . (int)$nSlots . ' slot(s) + ' . (int)$nBio . " gabarit(s) BDD supprimés."]);
            exit;

        } else if ($action === 'enroll_status') {
            // Temps réel enrôlement : proxy GET léger vers le daemon (/enroll_status).
            // Lecture seule, aucune écriture capteur — cf. r307_service.py ENROLL_STATE.
            $raw = @file_get_contents('http://127.0.0.1:8765/enroll_status', false,
                stream_context_create(['http' => ['method' => 'GET', 'timeout' => 2, 'ignore_errors' => true]]));
            if ($raw === false) {
                echo json_encode(['ok' => false, 'message' => 'Daemon injoignable — service de surveillance arrêté ?']); exit;
            }
            echo $raw; exit;

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
        // err=timeout/nofinger : échec transient (pas de doigt / délai dépassé) →
        // le front relance la capture automatiquement au lieu d'afficher une erreur bloquante.
        echo json_encode(['ok'=>false,'message'=>$e->getMessage(),'err'=>($e->getCode()===422?'timeout':null)]);
    }
    exit;
}
