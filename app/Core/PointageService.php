<?php

namespace App\Core;

use PDO;

/**
 * Logique de pointage centralisée — source de vérité unique pour la décision
 * entrée/sortie, l'anti-double, l'insertion d'un pointage scan et la validation
 * d'un pointage hors-ligne.
 * Utilisée par api/biometric.php (web), api/borne_pointage.php (borne) et
 * api/sync_offline.php (synchro hors-ligne) : fin de la duplication « copié
 * simplifié » — corrige notamment le bug où la borne ignorait 'pause_fin' dans
 * la décision (reprise de pause comptée comme sortie au lieu d'une entrée).
 */
final class PointageService
{
    /** Types de pointage acceptés (contrainte CHECK du schéma). */
    public const TYPES = ['entree', 'sortie', 'pause_debut', 'pause_fin'];

    /** Journée complète : 2 entrées + 2 sorties maximum (2 paires). */
    public const MAX_POINTAGES_PAR_JOUR = 4;

    /**
     * Décision entrée/sortie à partir du dernier pointage du jour.
     * Règle : pas de pointage, sortie, OU fin de pause ⇒ prochaine action = entrée
     * (pause_debut/entree ⇒ sortie). Règle UNIQUE partagée web + borne.
     */
    public static function typeForLast(?string $lastType): string
    {
        return (!$lastType || $lastType === 'sortie' || $lastType === 'pause_fin') ? 'entree' : 'sortie';
    }

    /** Dernier type de pointage du jour d'un employé, ou null. */
    public static function lastTypeToday(PDO $pdo, int $empId, ?string $today = null): ?string
    {
        $st = $pdo->prepare("SELECT type_pointage FROM pointages WHERE id_employe=? AND DATE(date_heure)=? ORDER BY date_heure DESC LIMIT 1");
        $st->execute([$empId, $today ?? date('Y-m-d')]);
        $r = $st->fetchColumn();
        return $r === false ? null : (string)$r;
    }

    /** Nombre de pointages du jour (plafond : MAX_POINTAGES_PAR_JOUR = 2 paires). */
    public static function countPointagesToday(PDO $pdo, int $empId, ?string $today = null): int
    {
        $st = $pdo->prepare("SELECT COUNT(*) FROM pointages WHERE id_employe=? AND DATE(date_heure)=?");
        $st->execute([$empId, $today ?? date('Y-m-d')]);
        return (int)$st->fetchColumn();
    }

    /** Dernier pointage (toutes dates) d'un employé — utilisé par l'anti-double. */
    public static function lastPointage(PDO $pdo, int $empId): ?array
    {
        $st = $pdo->prepare('SELECT date_heure FROM pointages WHERE id_employe=? ORDER BY date_heure DESC LIMIT 1');
        $st->execute([$empId]);
        $r = $st->fetch();
        return $r ?: null;
    }

    /** Secondes d'anti-double depuis la config (défaut 45). */
    public static function antiDoubleSeconds(string $deviceId = 'r307'): int
    {
        try {
            $cfg = require __DIR__ . '/../../config/biometric.php';
            return (int)($cfg['drivers'][$deviceId]['anti_double_seconds'] ?? $cfg['drivers']['r307']['anti_double_seconds'] ?? 45);
        } catch (\Throwable $e) {
            return 45;
        }
    }

    /**
     * Contrôle anti-double : null si OK, sinon ['diff','retry_after','message'].
     * Ne doit PAS être appelé pour les pointages hors-ligne (horodatages passés) :
     * ce contrôle a déjà été fait par la borne au moment de la capture.
     */
    public static function checkAntiDouble(PDO $pdo, int $empId, ?int $seconds = null): ?array
    {
        $anti = $seconds ?? 45;
        $last = self::lastPointage($pdo, $empId);
        if (!$last) return null;
        $diff = time() - strtotime($last['date_heure']);
        if ($diff < $anti) {
            return ['diff' => $diff, 'retry_after' => $anti - $diff,
                    'message' => "Pointage ignoré (anti-double {$diff}s < {$anti}s)"];
        }
        return null;
    }

    /** id_appareil du capteur d'empreinte (null si table absente). */
    public static function resolveAppareilId(PDO $pdo): ?int
    {
        // Si appele DANS une transaction, un echec SQL ici ne doit pas laisser la
        // transaction abortee en silence (sinon 25P02 sur la requete suivante, qui
        // masque l'erreur primaire) : SAVEPOINT encadre la lecture et restaure.
        $sp = $pdo->inTransaction();
        if ($sp) { try { $pdo->exec('SAVEPOINT appareil_sp'); } catch (\Throwable $e) { $sp = false; } }
        try {
            $a = $pdo->query("SELECT id_appareil FROM appareils_pointage WHERE type_capteur='empreinte' LIMIT 1")->fetch();
            if ($sp) { try { $pdo->exec('RELEASE SAVEPOINT appareil_sp'); } catch (\Throwable $e2) {} }
            return $a ? (int)$a['id_appareil'] : null;
        } catch (\Throwable $e) {
            if ($sp) { try { $pdo->exec('ROLLBACK TO SAVEPOINT appareil_sp'); } catch (\Throwable $e2) {} }
            error_log('resolveAppareilId: ' . $e->getMessage());
            return null;
        }
    }

    /** Résout l'employé à partir du slot R307 reconnu (mapping biometric_slots). */
    public static function resolveEmployeFromSlot(PDO $pdo, string $deviceId, int $pageId): int
    {
        $st = $pdo->prepare('SELECT id_employe FROM biometric_slots WHERE slot_number=? AND device_id=?');
        $st->execute([$pageId, $deviceId]);
        $r = $st->fetch();
        return $r ? (int)$r['id_employe'] : $pageId;
    }

    /** Vérifie que l'employé existe et est actif → ligne employé, sinon DomainException. */
    public static function assertEmployeActif(PDO $pdo, int $empId): array
    {
        $st = $pdo->prepare('SELECT id_employe, prenom, nom, statut FROM employes WHERE id_employe=?');
        $st->execute([$empId]);
        $row = $st->fetch();
        if (!$row || ($row['statut'] ?? 'actif') !== 'actif') {
            throw new \DomainException('Employé non actif ou introuvable');
        }
        return $row;
    }

    /** Vérifie qu'une empreinte ACTIVE existe pour l'employé, sinon DomainException. */
    public static function assertEmpreinteActive(PDO $pdo, int $empId): void
    {
        $st = $pdo->prepare("SELECT 1 FROM donnees_biometriques WHERE id_employe=? AND type_biometrie='empreinte' AND statut='actif' LIMIT 1");
        $st->execute([$empId]);
        if (!$st->fetchColumn()) {
            throw new \DomainException('Empreinte révoquée');
        }
    }

    /** UUID v4 (CHAR(36) — pooler Supabase : pas de lastInsertId). */
    public static function makeUuid(): string
    {
        return sprintf('%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000, mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff));
    }

    /**
     * Cœur transactionnel d'un pointage scan : verrou FOR UPDATE sur l'employé
     * (sérialise les scans concurrents web + borne), décision entrée/sortie,
     * insertion, commit, invalidation du cache dashboard. → ['type','uuid']
     * $audit: fn(string $type, int $empId, ?int $score, string $device): void
     */
    public static function recordScanPointage(PDO $pdo, int $empId, ?int $score, string $device, ?callable $audit = null): array
    {
        $pdo->beginTransaction();
        try {
            $pdo->prepare('SELECT statut FROM employes WHERE id_employe=? FOR UPDATE')->execute([$empId]);
            // Journée complète : 2 entrées / 2 sorties maximum — refus net du 5e pointage.
            if (self::countPointagesToday($pdo, $empId) >= self::MAX_POINTAGES_PAR_JOUR) {
                throw new \DomainException('Journée complète (2 entrées / 2 sorties) — aucun pointage supplémentaire ne peut être enregistré');
            }
            $type = self::typeForLast(self::lastTypeToday($pdo, $empId));
            $appId = self::resolveAppareilId($pdo);
            $uuid = self::makeUuid();
            $pdo->prepare("INSERT INTO pointages (id_uuid_local, id_employe, id_appareil, type_pointage, date_heure, methode_verification, score_correspondance, source_donnee, synchronise, statut) VALUES (?,?,?,?,NOW(),'empreinte',?,'serveur',true,'valide')")
                ->execute([$uuid, $empId, $appId, $type, $score]);
            if ($audit) { $audit($type, $empId, $score, $device); }
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        // Invalide les 3 fenêtres du dashboard (cache serveur par période).
        foreach (['today', '7d', '30d'] as $p) cacheClear('dash_' . $p);
        // Recalcule le total d'heures du mois (table heures_mensuelles) —
        // non bloquant : un échec de calcul ne doit jamais invalider un pointage.
        try { WorkHours::recalcMonth($pdo, $empId); } catch (\Throwable $e) { error_log('recalcMonth(scan): ' . $e->getMessage()); }
        return ['type' => $type, 'uuid' => $uuid];
    }

    /**
     * Valide et insère UN pointage hors-ligne (api/sync_offline.php).
     * Durcissement : id_uuid_local obligatoire, employé actif, type dans la
     * liste du schéma, date parsable et non future, score borné 0..100,
     * anti-double uniquement pour les horodatages récents, idempotence sur
     * l'UUID. → 'inserted' | 'duplicate' ; DomainException si rejeté.
     */
    public static function syncOfflineItem(PDO $pdo, array $p, int $anti = 45): string
    {
        $uuid = $p['id_uuid_local'] ?? null;
        $emp  = (int)($p['id_employe'] ?? 0);
        $type = strtolower(trim((string)($p['type_pointage'] ?? '')));
        $dt   = (string)($p['date_heure'] ?? '');

        if (!is_string($uuid) || strlen($uuid) === 0 || strlen($uuid) > 36) {
            throw new \DomainException('id_uuid_local manquant ou invalide');
        }
        if ($emp <= 0) throw new \DomainException('id_employe manquant ou invalide');
        if (!in_array($type, self::TYPES, true)) throw new \DomainException("type_pointage invalide ({$type})");
        $ts = strtotime($dt);
        if ($ts === false) throw new \DomainException('date_heure invalide');
        if ($ts > time() + 300) throw new \DomainException('date_heure dans le futur (refusée)');
        $score = null;
        if (isset($p['score_correspondance']) && $p['score_correspondance'] !== null && $p['score_correspondance'] !== '') {
            $score = max(0, min(100, (int)$p['score_correspondance']));
        }

        // Employé doit exister ET être actif (anciennement absent → injection possible)
        self::assertEmployeActif($pdo, $emp);

        $pdo->beginTransaction();
        try {
            $chk = $pdo->prepare('SELECT 1 FROM pointages WHERE id_uuid_local=?');
            $chk->execute([$uuid]);
            if ($chk->fetch()) { $pdo->rollBack(); return 'duplicate'; }

            // Anti-double : uniquement si l'horodatage est proche de maintenant
            // (pour un lot en retard, le contrôle a été fait par la borne à la capture).
            if (abs(time() - $ts) <= $anti) {
                $last = self::lastPointage($pdo, $emp);
                if ($last) {
                    $gap = abs(strtotime($last['date_heure']) - $ts);
                    if ($gap < $anti) {
                        throw new \DomainException("Anti-double (écart {$gap}s < {$anti}s)");
                    }
                }
            }
            $pdo->prepare("INSERT INTO pointages (id_uuid_local, id_employe, type_pointage, date_heure, methode_verification, score_correspondance, source_donnee, synchronise, statut) VALUES (?,?,?,?,'empreinte',?,'local',true,'valide')")
                ->execute([$uuid, $emp, $type, date('Y-m-d H:i:s', $ts), $score]);
            $pdo->commit();
        } catch (\Throwable $e) {
            if ($pdo->inTransaction()) $pdo->rollBack();
            throw $e;
        }
        return 'inserted';
    }

    /** Audit borne/synchro : non-bloquant, acteur NULL (pas de session admin). */
    public static function auditBorne(PDO $pdo, string $action, ?int $empId, array $details): void
    {
        try {
            $pdo->prepare("INSERT INTO journal_audit (id_utilisateur, action, table_concernee, id_enregistrement_concerne, details, date_heure) VALUES (NULL,?,?,?,?,NOW())")
                ->execute([$action, 'pointages', $empId, json_encode($details, JSON_UNESCAPED_UNICODE)]);
        } catch (\Throwable $e) {
            error_log('auditBorne(' . $action . '): ' . $e->getMessage());
        }
    }
}
