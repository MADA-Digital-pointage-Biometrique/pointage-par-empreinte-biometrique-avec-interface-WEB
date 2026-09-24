<?php

namespace App\Core;

use PDO;

/**
 * Heures de travail : calcul des sessions (entrée→sortie, pauses déduites) et
 * du total mensuel par employé, stocké dans heures_mensuelles.
 *
 * Règle de journée : 2 entrées / 2 sorties maximum (2 paires) — imposée par
 * PointageService ; ce calcul sait agréger les 2 paires d'une même journée.
 * Les lectures couvrent pointages + historique_pointages (archive nocturne),
 * donc les totaux survivent à l'archivage.
 */
final class WorkHours
{
    /**
     * Secondes travaillées à partir d'événements chronologiques
     * [['date_heure'=>..., 'type_pointage'=>'entree|sortie|pause_debut|pause_fin'], ...].
     * Les événements hors de la fenêtre [$start, $end) sont ramenés aux bornes
     * (session à cheval sur 2 mois : la part de chaque mois est comptée chez lui).
     */
    public static function secondsFromEvents(array $events, ?string $start = null, ?string $end = null): int
    {
        $tStart = $start !== null ? strtotime($start) : null;
        $tEnd   = $end   !== null ? strtotime($end)   : null;
        $total = 0; $open = null; $inPause = false;
        foreach ($events as $ev) {
            $t = strtotime((string)$ev['date_heure']);
            if ($t === false) continue;
            if ($tStart !== null && $t < $tStart) $t = $tStart;
            if ($tEnd !== null && $t >= $tEnd) $t = $tEnd - 1;
            switch ($ev['type_pointage']) {
                case 'entree':
                    if ($open === null && !$inPause) $open = $t;
                    break;
                case 'pause_debut':
                    if ($open !== null) { $total += $t - $open; $open = null; }
                    $inPause = true;
                    break;
                case 'pause_fin':
                    $inPause = false;
                    if ($open === null) $open = $t;
                    break;
                case 'sortie':
                    if ($open !== null) { $total += $t - $open; $open = null; }
                    $inPause = false;
                    break;
            }
        }
        return max(0, $total);
    }

    /** Secondes d'une journée à partir des 4 créneaux groupés (HH:MM:SS). */
    public static function secondsFromDayTimes(?string $entree, ?string $sortie, ?string $entree2, ?string $sortie2): int
    {
        $total = 0;
        foreach ([[$entree, $sortie], [$entree2, $sortie2]] as [$in, $out]) {
            if ($in && $out) {
                $d = strtotime($out) - strtotime($in);
                if ($d > 0) $total += $d;
            }
        }
        return $total;
    }

    /** Secondes → "7h45" (ou "—"). */
    public static function formatHours(int $seconds): string
    {
        if ($seconds <= 0) return '—';
        $h = intdiv($seconds, 3600);
        $m = intdiv($seconds % 3600, 60);
        return $h . 'h' . str_pad((string)$m, 2, '0', STR_PAD_LEFT);
    }

    /** True si la table d'archive existe (cache statique par process). */
    public static function archiveTableExists(PDO $pdo): bool
    {
        static $cache = null;
        if ($cache === null) {
            try {
                $cache = (bool)$pdo->query("SELECT to_regclass('public.historique_pointages') IS NOT NULL")->fetchColumn();
            } catch (\Throwable $e) { $cache = false; }
        }
        return $cache;
    }

    /**
     * Recalcule et stocke le total du mois pour un employé (totaux cumulés
     * pointages actifs + archives). Retourne le total en secondes.
     */
    public static function recalcMonth(PDO $pdo, int $empId, ?string $month = null): int
    {
        $month = $month ?: date('Y-m-01');
        $start = $month . ' 00:00:00';
        $end   = date('Y-m-01 00:00:00', strtotime($month . ' +1 month'));

        $union = self::archiveTableExists($pdo)
            ? 'SELECT id_employe, type_pointage, date_heure FROM pointages
               UNION ALL
               SELECT id_employe, type_pointage, date_heure FROM historique_pointages'
            : 'SELECT id_employe, type_pointage, date_heure FROM pointages';

        $st = $pdo->prepare("SELECT type_pointage, date_heure FROM ($union) p
                             WHERE p.id_employe = ? AND p.date_heure >= ? AND p.date_heure < ?
                             ORDER BY p.date_heure");
        $st->execute([$empId, $start, $end]);
        $events = $st->fetchAll();

        $secs = self::secondsFromEvents($events, $start, $end);
        // $end peut avoir été borné à l'extrémité droite du mois par le calcul :
        // pour l'upsert on garde la borne exclusive stricte.
        $pdo->prepare("INSERT INTO heures_mensuelles (id_employe, mois, total_secondes, nb_pointages, calcule_le)
                       VALUES (?,?,?,?,NOW())
                       ON CONFLICT (id_employe, mois) DO UPDATE
                       SET total_secondes = EXCLUDED.total_secondes,
                           nb_pointages   = EXCLUDED.nb_pointages,
                           calcule_le     = NOW()")
            ->execute([$empId, $month, $secs, count($events)]);
        return $secs;
    }

    /** Totaux du mois pour tous les employés (panneau UI). */
    public static function monthTotals(PDO $pdo, ?string $month = null): array
    {
        $month = $month ?: date('Y-m-01');
        $st = $pdo->prepare("SELECT h.id_employe, h.total_secondes, h.nb_pointages, h.calcule_le,
                                    e.nom, e.prenom, e.matricule
                             FROM heures_mensuelles h
                             LEFT JOIN employes e ON e.id_employe = h.id_employe
                             WHERE h.mois = ? AND h.total_secondes > 0
                             ORDER BY e.nom, e.prenom");
        $st->execute([$month]);
        $rows = [];
        foreach ($st->fetchAll() as $r) {
            // Employé supprimé de « employes » mais présent dans l'historique :
            // libellé de repli pour ne pas afficher une carte sans nom.
            $label = trim(($r['prenom'] ?? '') . ' ' . ($r['nom'] ?? ''));
            if ($label === '') { $label = 'Employé #' . $r['id_employe']; }
            $rows[] = [
                'id_employe' => (int)$r['id_employe'],
                'nom' => $r['nom'], 'prenom' => $r['prenom'], 'matricule' => $r['matricule'],
                'label' => $label,
                'heures' => self::formatHours((int)$r['total_secondes']),
                'secondes' => (int)$r['total_secondes'],
                'nb_pointages' => (int)$r['nb_pointages'],
                'calcule_le' => $r['calcule_le'],
            ];
        }
        return $rows;
    }
}
