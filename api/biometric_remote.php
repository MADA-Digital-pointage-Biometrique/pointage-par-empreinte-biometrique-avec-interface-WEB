<?php
// Enrôlement à distance (borne distante / VPS sans COM).
// Les captures sont pilotées par le NAVIGATEUR directement vers le daemon
// local (http://127.0.0.1:8765 — contexte sécurisé, autorisé depuis HTTPS) ;
// ce endpoint ne touche JAMAIS le capteur, seulement la BDD :
//   POST {op:'allocate', userId} → réserve le slot (avant captures, anti-orphelins)
//   POST {op:'commit', userId, slot, hex} → vérifie, chiffre (ENC1), upsert, audit
// Mêmes règles que biometric.php (employé actif, slot possédé, gabarit 512 o).
// Super admin uniquement + CSRF via gate central db.php (non exempté).
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
require_once __DIR__ . '/../app/Core/PointageService.php';
use App\Core\Biometric\SdkReader;
use App\Core\Crypto;
use App\Core\PointageService;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Accès refusé : seul Super Admin (enrôlement).']); exit; }
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée.']); exit; }

const REMOTE_GABARIT_ALGO = 'R307_ZFM_UPCHAR_512_AESGCM';

$pdo = getDB();
$input = getJsonInput();
$op = $input['op'] ?? '';
$userId = (int)($input['userId'] ?? 0);

function remoteEmploye(PDO $pdo, int $userId): array {
    if ($userId <= 0) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Identifiant employé invalide.']); exit; }
    $st = $pdo->prepare('SELECT prenom, nom, statut FROM employes WHERE id_employe=?');
    $st->execute([$userId]);
    $emp = $st->fetch();
    if (!$emp) { http_response_code(404); echo json_encode(['ok'=>false,'message'=>'Employé introuvable.']); exit; }
    if (($emp['statut'] ?? 'actif') !== 'actif') { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Employé non actif.']); exit; }
    return $emp;
}

try {
    $reader = SdkReader::fromConfig(); // Config seule (device_id, seuils) : aucun accès matériel ici.

    if ($op === 'allocate') {
        $emp = remoteEmploye($pdo, $userId);
        try {
            $slot = $reader->allocateSlot($userId);
        } catch (InvalidArgumentException $e) {
            http_response_code(400); echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); exit;
        } catch (RuntimeException $e) {
            $code = $e->getCode() === 507 ? 507 : 500;
            http_response_code($code); echo json_encode(['ok'=>false,'message'=>$e->getMessage()]); exit;
        }
        auditWrite($pdo, 'enrolement_distant_etape1', $userId, 'biometrie',
            ['slot' => $slot, 'device' => $reader->getDeviceId(), 'motif' => 'slot reserve (borne distante)']);
        echo json_encode(['ok'=>true,'step'=>1,'slot'=>$slot,
            'message'=>"Slot $slot réservé pour {$emp['prenom']} {$emp['nom']} — posez le doigt sur la borne locale."]);
        exit;
    }

    if ($op === 'commit') {
        $emp = remoteEmploye($pdo, $userId);
        $slot = (int)($input['slot'] ?? 0);
        $hex = strtolower(trim((string)($input['hex'] ?? '')));
        if ($slot < 1 || $slot > 999) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Slot invalide (1..999).']); exit; }
        // Gabarit UP_CHAR R307 : 512 octets = 1024 caractères hexadécimaux.
        if (!preg_match('/^[0-9a-f]{1024}$/', $hex)) { http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Gabarit invalide (512 octets hexadécimaux attendus).']); exit; }
        // Le slot doit appartenir à cet employé (anti-confusion, miroir enrollStep2).
        if ($reader->getSlotForUser($userId) !== $slot) {
            http_response_code(400); echo json_encode(['ok'=>false,'message'=>"Slot $slot non alloué à l'employé $userId (reprends à l'étape 1)."]); exit;
        }
        $appId = PointageService::resolveAppareilId($pdo);
        $pdo->beginTransaction();
        try {
            $hexChiffre = bin2hex(Crypto::encryptHex($hex));
            $chk = $pdo->prepare("SELECT id_biometrie FROM donnees_biometriques WHERE id_employe=? AND type_biometrie='empreinte' LIMIT 1");
            $chk->execute([$userId]);
            $ex = $chk->fetch();
            if ($ex) $pdo->prepare("UPDATE donnees_biometriques SET gabarit_chiffre=decode(?,'hex'), algorithme=?, id_appareil_enrolement=?, date_enregistrement=NOW(), statut='actif' WHERE id_biometrie=?")->execute([$hexChiffre, REMOTE_GABARIT_ALGO, $appId, $ex['id_biometrie']]);
            else $pdo->prepare("INSERT INTO donnees_biometriques (id_employe, type_biometrie, gabarit_chiffre, algorithme, id_appareil_enrolement, date_enregistrement, statut) VALUES (?,'empreinte',decode(?,'hex'),?,?,NOW(),'actif')")->execute([$userId, $hexChiffre, REMOTE_GABARIT_ALGO, $appId]);
            auditWrite($pdo, 'enrolement_distant', $userId, 'biometrie',
                ['slot' => $slot, 'device' => $reader->getDeviceId(), 'motif' => 'enroll 2 captures ok (borne distante)']);
            $pdo->commit();
            echo json_encode(['ok'=>true,'step'=>2,'slot'=>$slot,'dumped'=>true,
                'message'=>"Empreinte enrôlée pour {$emp['prenom']} {$emp['nom']} (slot $slot, borne distante)."]);
        } catch (Throwable $e) { $pdo->rollBack(); throw $e; }
        exit;
    }

    http_response_code(400); echo json_encode(['ok'=>false,'message'=>'Opération inconnue (allocate|commit).']);
} catch (Throwable $e) {
    error_log('biometric_remote: '.$e->getMessage());
    http_response_code(500); echo json_encode(['ok'=>false,'message'=>'Enrôlement distant impossible.']);
}
