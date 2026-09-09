<?php
// Archivage quotidien : pointages (hier) -> historique_pointages, puis efface de pointages
// Appel manuel : GET api/cron_archive.php?key=CRON_SECRET
// Cron pg_cron : SELECT cron.schedule('archive-pointages','0 0 * * *','SELECT archive_pointages()');
require_once __DIR__ . '/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
$key = $_GET['key'] ?? $_POST['key'] ?? '';
// C2 : fail-closed — sans CRON_SECRET configuré, refus (pas de fallback devinable).
$expected = getenv('CRON_SECRET') ?: '';

// H1 : la clé est TOUJOURS exigée en HTTP (même localhost, même session admin) —
// l'ancien code laissait passer 127.0.0.1 sans clé et toute session sans clé.
// Seul le CLI (tâche planifiée serveur) en est dispensé. Comparaison constante.
$isCli = php_sapi_name() === 'cli';
if (!$isCli) {
    if ($expected === '' || !hash_equals($expected, (string)$key)) {
        http_response_code(403);
        echo json_encode(['ok'=>false,'message'=>'Clé cron invalide']);
        exit;
    }
}

try {
    $pdo = getDB();
    // Vérifie que la fonction existe, sinon crée
    $pdo->exec("SELECT archive_pointages()");
    $stmt = $pdo->query("SELECT COUNT(*) FROM historique_pointages");
    $hist = (int)$stmt->fetchColumn();
    $stmt2 = $pdo->query("SELECT COUNT(*) FROM pointages WHERE date_heure::date < CURRENT_DATE");
    $rest = (int)$stmt2->fetchColumn();
    echo json_encode(['ok'=>true,'message'=>"Archivage OK : historique=$hist, restant à archiver=$rest (0 = à jour)"]);
} catch(Throwable $e){
    http_response_code(500);
    error_log('cron_archive: '.$e->getMessage());
    echo json_encode(['ok'=>false,'message'=>$e->getMessage()]);
}