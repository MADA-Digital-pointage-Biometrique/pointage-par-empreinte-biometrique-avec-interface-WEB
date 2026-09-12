<?php
// B3 : réconciliation identifiants DB <-> dispositif.
// Compare biometric_slots (device) avec les gabarits réellement présents
// (sonde) + comptage. Réparation optionnelle (repair=1) : purge les mappings orphelins
// (gabarit absent côté dispositif) et désactive le gabarit associé.
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/HttpDeviceReader.php';
use App\Core\Biometric\HttpDeviceReader;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié.']); exit; }
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['ok'=>false,'message'=>'Méthode non autorisée.']); exit; }
if (!in_array($_SESSION['role'] ?? '', ['super_admin','admin_systeme'])) { http_response_code(403); echo json_encode(['ok'=>false,'message'=>'Réservé Super Admin.']); exit; }
// CSRF : contrôle central db.php (non exempté).
@set_time_limit(300);

$pdo = getDB();
$reader = HttpDeviceReader::fromConfig();
$device = $reader->getDeviceId();
$input = getJsonInput();
$repair = !empty($input['repair']);

// Slots connus en base (avec identité employé pour le rapport)
$st = $pdo->prepare('SELECT s.slot_number, s.id_employe, e.matricule, e.prenom, e.nom FROM biometric_slots s LEFT JOIN employes e ON e.id_employe = s.id_employe WHERE s.device_id = ? ORDER BY s.slot_number');
$st->execute([$device]);
$dbSlots = $st->fetchAll();
$dbCount = count($dbSlots);

// Capteur joignable ?
try {
    $sensorCount = $reader->sensorCount();
    $sensorOk = true;
} catch (Throwable $e) {
    echo json_encode(['ok'=>false,'sensor_ok'=>false,'message'=>'Dispositif injoignable : '.$e->getMessage(),'db_slots'=>$dbCount]);
    exit;
}

// Sonde page par page (seuls les slots DB, pas de balayage 0..999)
$missing = [];
foreach ($dbSlots as $row) {
    $slot = (int)$row['slot_number'];
    if (!$reader->probeSlot($slot)) {
        $missing[] = [
            'slot' => $slot,
            'id_employe' => (int)$row['id_employe'],
            'matricule' => $row['matricule'] ?? '?',
            'nom' => trim(($row['prenom'] ?? '').' '.($row['nom'] ?? '')),
        ];
    }
}

// Gabarits orphelins côté dispositif (présents mais sans mapping) : estimés par
// différence (pas de balayage exhaustif, trop lent en réseau).
$orphansSuspected = max(0, $sensorCount - ($dbCount - count($missing)));

$repaired = 0;
if ($repair && !empty($missing)) {
    foreach ($missing as $m) {
        try {
            $pdo->prepare('DELETE FROM biometric_slots WHERE id_employe=? AND device_id=?')->execute([$m['id_employe'], $device]);
            $pdo->prepare("UPDATE donnees_biometriques SET statut='inactif' WHERE id_employe=? AND type_biometrie='empreinte'")->execute([$m['id_employe']]);
            $repaired++;
        } catch (Throwable $e) { error_log('reconcile repair: '.$e->getMessage()); }
    }
}

echo json_encode([
    'ok' => true,
    'sensor_ok' => true,
    'device' => $device,
    'db_slots' => $dbCount,
    'sensor_count' => $sensorCount,
    'missing_on_sensor' => $missing,
    'orphans_suspected' => $orphansSuspected,
    'repaired' => $repaired,
    'message' => empty($missing) && $orphansSuspected === 0
        ? "Parfaitement synchronisé : $dbCount mapping(s), $sensorCount gabarit(s) dispositif."
        : (count($missing).' mapping(s) orphelin(s), '.$orphansSuspected.' gabarit(s) dispositif sans mapping.'
            . ($repair ? " $repaired purgé(s)." : ' Relance avec réparation pour purger.')),
]);
