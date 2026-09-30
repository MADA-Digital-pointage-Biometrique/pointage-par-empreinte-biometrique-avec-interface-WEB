<?php
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/../app/Core/Biometric/FingerprintReader.php';
require_once __DIR__ . '/../app/Core/Biometric/SdkReader.php';
use App\Core\Biometric\SdkReader;

if (!isset($_SESSION['user_id'])) { http_response_code(401); echo json_encode(['ok'=>false,'message'=>'Non authentifié']); exit; }
if (session_status() === PHP_SESSION_ACTIVE) session_write_close();

try {
    $cfg = require __DIR__ . '/../config/biometric.php';
    $driver = $cfg['driver'] ?? 'r307';
    $conf = $cfg['drivers'][$driver] ?? $cfg['drivers']['r307'] ?? [];
    $port = $conf['port'] ?? 'COM3';

    $reader = SdkReader::fromConfig();
    $name = $reader->name();
    // NOTE : pas d'appel SdkReader ici (il retomberait sur le CLI) — le ping
    // brut ci-dessous décide seul du transport.

    // daemon-first : si le daemon répond HTTP (même ok:false), on ne lance
    // JAMAIS le CLI direct — le daemon tient le port COM et sur CP2102 deux
    // handles peuvent coexister : les écritures s'entremêlent et corrompent
    // le périphérique. Le CLI n'est autorisé que si le daemon est INJOIGNABLE.
    // daemon-first : URL configurable (R307_SERVICE_URL) pour supporter le
    // pont Docker (host.docker.internal:8765 vers le daemon Windows) ;
    // défaut 127.0.0.1:8765 en local XAMPP.
    $serviceUrl = rtrim(getenv('R307_SERVICE_URL') ?: 'http://127.0.0.1:8765', '/');
    $raw = @file_get_contents($serviceUrl . '/status', false, stream_context_create(['http' => ['method' => 'GET', 'timeout' => 2, 'ignore_errors' => true]]));
    $daemonUp = $raw !== false;
    $data = $daemonUp ? json_decode((string)$raw, true) : null;

    if (!$daemonUp) {
        // Daemon arrêté → fallback CLI direct (comportement historique).
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
    }

    $watching = (bool)($data['watching'] ?? false);
    $watchEnabled = (bool)($data['watch_enabled'] ?? false);
    $count = (int)($data['count'] ?? 0);

    if (is_array($data) && !empty($data['ok'])) {
        // Capteur répond — alimente derniere_connexion de l'appareil si la table existe.
        try {
            $pdo = getDB();
            $pdo->prepare("UPDATE appareils_pointage SET derniere_connexion=NOW() WHERE type_capteur='empreinte'")->execute();
        } catch (Throwable $e) {}

        if ($daemonUp) {
            // Daemon lancé : status matériel consolidé par le daemon.
            $watchLabel = $watching ? 'Surveillance active' : ($watchEnabled ? 'Surveillance en pause (mode enrôlement ou capture en cours)' : 'Surveillance inactive — lancez le service');
            echo json_encode([
                'ok'=>true,'status'=>'en_service','label'=>'En service',
                'detail'=>"R307 $port OK ($count empreintes) — $watchLabel",
                'count'=>$count,'port'=>$port,'reader'=>$name,
                'watching'=>$watching,'watch_enabled'=>$watchEnabled,
                'watch_user_enabled'=>(bool)($data['watch_user_enabled'] ?? true),
                'last_detection'=>$data['last_detection'] ?? null,
                'last_result'=>$data['last_result'] ?? null,
                'last_error'=>$data['last_error'] ?? null,
                'transport'=>'daemon',
            ]);
        } else {
            // CLI direct sans daemon : le port COM est libre → pas de surveillance.
            echo json_encode([
                'ok'=>true,'status'=>'en_service','label'=>'En service',
                'detail'=>"R307 $port OK ($count empreintes) — Surveillance inactive (service arrêté)",
                'count'=>$count,'port'=>$port,'reader'=>$name,
                'watching'=>false,'watch_enabled'=>false,
                'transport'=>'cli',
            ]);
        }
    } else {
        // Borne distante (VPS/Dokploy sans COM) : heartbeat poussé par le daemon
        // du PC (~15 s). Frais (< 60 s) = En service via borne, même sans
        // daemon local. Périmé/absent = HS (capteur débranché ou daemon éteint).
        try {
            $pdoB = getDB();
            $hb = $pdoB->query("SELECT device_id, EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - last_seen)) AS age_s, empreintes, hw_ok, watching FROM borne_etat ORDER BY last_seen DESC LIMIT 1")->fetch();
            if (is_array($hb) && ($hb['age_s'] !== null) && ((float)$hb['age_s'] < 60)) {
                $age = max(0, (int)$hb['age_s']);
                echo json_encode(['ok'=>true,'status'=>'en_service','label'=>'En service',
                    'detail'=>"Borne {$hb['device_id']} vue il y a {$age}s (" . (int)$hb['empreintes'] . " empreintes) — via borne",
                    'count'=>(int)$hb['empreintes'],'port'=>null,'reader'=>$name,
                    'watching'=>(bool)$hb['watching'],'watch_enabled'=>true,
                    'watch_user_enabled'=>true,'transport'=>'borne','borne_age_s'=>$age]);
                exit;
            }
        } catch (Throwable $e) {}
        $msg = $data['message'] ?? ($json ?? 'Capteur non joignable');
        $detail = $daemonUp
            ? ("Daemon actif — capteur HS : " . $msg)
            : ("Service de surveillance arrêté — " . $msg);
        // Messages lisibles (inspirés de l'ancienne version) pour les cas connus :
        // port introuvable = débranché ; PermissionError = pilote USB bloqué
        // (déconnexion surprise, faux contact) → redémarrage PC ou rebranchage.
        if (stripos($msg,'PermissionError')!==false || stripos($msg,'Accès refusé')!==false) {
            echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>'R307 bloqué par Windows (déconnexion USB instable) — rebranche le capteur ou redémarre le PC','port'=>$port,'reader'=>$name,'watching'=>false,'watch_enabled'=>false,'transport'=>$daemonUp?'daemon':'cli']);
        } elseif (strpos($msg,'could not open port')!==false || strpos($msg,'FileNotFound')!==false) {
            echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>"Port $port introuvable — R307 débranché",'port'=>$port,'reader'=>$name,'watching'=>false,'watch_enabled'=>false,'transport'=>$daemonUp?'daemon':'cli']);
        } else {
            echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>$msg,'port'=>$port,'reader'=>$name,'watching'=>false,'watch_enabled'=>false,'transport'=>$daemonUp?'daemon':'cli']);
        }
    }
} catch(Throwable $e){
    error_log('sensor_status: '.$e->getMessage());
    echo json_encode(['ok'=>true,'status'=>'hs','label'=>'HS','detail'=>'Capteur momentanément indisponible — réessayez.','port'=>($port ?? null)]);
}