<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
use App\Core\Biometric\SdkReader;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }

try {
    $cfg = require __DIR__ . '/../config/biometric.php';
    $driver = $cfg['driver'] ?? 'r307';
    $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['r307'] ?? [];
    $port = $conf['port'] ?? 'COM3';
    $isAuto = ($port === 'auto');

    // Vérifie R307 via Python (status = template_num / verify)
    $reader = SdkReader::fromConfig();
    $name = $reader->name();
    // F6 : interprète depuis la config (R307_PYTHON_PATH) + fallbacks standards.
    // Plus de chemin absolu en dur (machine-dépendant).
    $candidates = array_unique([$conf['python'] ?? 'py', getenv('R307_PYTHON_PATH') ?: 'py', 'py', 'python']);
    $cli = $conf['cli'] ?? __DIR__ . '/../python/r307_cli.py';
    $baud = $conf['baud'] ?? 57600;
    $timeout = $conf['timeout'] ?? 15;
    $pwd = $conf['password'] ?? '00000000';
    $portArg = escapeshellarg($port);
    $data = null; $json=''; $out=[];
    foreach($candidates as $py){
        if(!$py) continue;
        $cmd = '"' . str_replace('"','',$py) . '" "' . str_replace('"','',$cli) . "\" --port $portArg --baud $baud --timeout $timeout --password ".escapeshellarg($pwd)." --action status 2>&1";
        $out=[]; $code=0; exec($cmd,$out,$code);
        $json=implode("\n",$out);
        $data=json_decode($json,true);
        if(is_array($data)) break;
    }

    if (is_array($data) && !empty($data['ok'])) {
        // Capteur répond — alimente derniere_connexion de l'appareil si la table existe.
        $count = $data['count'] ?? 0;
        try {
            $pdo = getDB();
            $pdo->prepare("UPDATE appareils_pointage SET derniere_connexion=NOW() WHERE type_capteur='empreinte'")->execute();
        } catch (Throwable $e) {}
        echo json_encode(['ok'=>true,'status'=>'en_service','label'=>'En service','detail'=>"R307 $port OK ($count empreintes)",'count'=>$count,'reader'=>$name]);
    } else {
        $msg = $data['message'] ?? $json ?: 'Capteur non joignable';
        // Cas mock sans matériel : on considère En service simulé, mais on signale HS si vrai capteur attendu
        if (strpos($msg,'could not open port')!==false || strpos($msg,'FileNotFound')!==false) {
            echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>"Port $port introuvable — R307 débranché",'reader'=>$name]);
        } else {
            echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>$msg,'reader'=>$name]);
        }
    }
} catch(Throwable $e){
    error_log('sensor_status: '.$e->getMessage());
    echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>$e->getMessage()]);
}