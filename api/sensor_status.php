<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/HttpDeviceReader.php';
use App\Core\Biometric\HttpDeviceReader;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }

try {
    $cfg = require __DIR__ . '/../config/biometric.php';
    $driver = $cfg['driver'] ?? 'device';
    $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['device'] ?? [];
    $label = $conf['base_url'] ?? '';

    // Interroge le dispositif via le reader (HTTP) : aucun appel système local.
    $reader = HttpDeviceReader::fromConfig();
    $name = $reader->name();
    $count = $reader->sensorCount();

    // Dispositif répond — alimente derniere_connexion de l'appareil si la table existe.
    try {
        $pdo = getDB();
        $pdo->prepare("UPDATE appareils_pointage SET derniere_connexion=NOW() WHERE type_capteur='empreinte'")->execute();
    } catch (Throwable $e) {}
    echo json_encode(['ok'=>true,'status'=>'en_service','label'=>'En service','detail'=>"Dispositif OK ($count gabarit(s))",'count'=>$count,'port'=>$label,'reader'=>$name]);
} catch(Throwable $e){
    error_log('sensor_status: '.$e->getMessage());
    echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>$e->getMessage(),'port'=>($label ?? null)]);
}