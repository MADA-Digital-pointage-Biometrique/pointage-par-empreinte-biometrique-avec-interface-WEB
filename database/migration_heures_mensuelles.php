<?php
/**
 * Migration : table heures_mensuelles — total d'heures de travail par employé
 * et par mois (stocké en base, recalculé à chaque pointage).
 *
 * Usage (CLI uniquement) :
 *   php database/migration_heures_mensuelles.php            # crée la table
 *   php database/migration_heures_mensuelles.php --backfill # + recalcule tous les mois passés
 *
 * Idempotent : CREATE TABLE IF NOT EXISTS ; le backfill écrase les totaux existants.
 * Les lectures couvrent pointages + historique_pointages (archive nocturne),
 * donc les totaux restent corrects après archivage.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI uniquement'); }

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../app/Core/WorkHours.php';

use App\Core\WorkHours;

$pdo = getDB();

$pdo->exec("
    CREATE TABLE IF NOT EXISTS heures_mensuelles (
        id_employe      INTEGER     NOT NULL,
        mois            DATE        NOT NULL,
        total_secondes  INTEGER     NOT NULL DEFAULT 0,
        nb_pointages    INTEGER     NOT NULL DEFAULT 0,
        calcule_le      TIMESTAMP   NOT NULL DEFAULT NOW(),
        CONSTRAINT pk_heures_mensuelles PRIMARY KEY (id_employe, mois)
    )
");
echo "Table heures_mensuelles : OK\n";

if (in_array('--backfill', $argv, true)) {
    // Mois distincts présents dans l'historique (union des 2 tables)
    $has = $pdo->query("SELECT to_regclass('public.historique_pointages') IS NOT NULL AS ok")->fetch()['ok'];
    $union = $has
        ? 'SELECT id_employe, date_heure FROM pointages UNION ALL SELECT id_employe, date_heure FROM historique_pointages'
        : 'SELECT id_employe, date_heure FROM pointages';
    $months = $pdo->query("SELECT DISTINCT to_char(date_heure, 'YYYY-MM-01') AS mois FROM ($union) p ORDER BY 1")->fetchAll();
    $n = 0;
    foreach ($months as $m) {
        $emps = $pdo->prepare("SELECT DISTINCT id_employe FROM ($union) p WHERE date_heure >= ? AND date_heure < ?");
        $emps->execute([$m['mois'], date('Y-m-01 00:00:00', strtotime($m['mois'] . ' +1 month'))]);
        foreach ($emps->fetchAll() as $e) {
            WorkHours::recalcMonth($pdo, (int)$e['id_employe'], $m['mois']);
            $n++;
        }
    }
    echo "Backfill : $n totaux (employé × mois) recalculés\n";
}
echo "Migration terminée.\n";
