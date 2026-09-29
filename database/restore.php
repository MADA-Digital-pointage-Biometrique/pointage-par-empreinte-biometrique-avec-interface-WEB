<?php
/**
 * Restauration BDD MADA Digital : rejoue database/schema.sql puis database/data.sql.
 *
 * Usage (CLI uniquement) :
 *   php database/restore.php --dry-run   # compte les ordres, n'exécute rien
 *   php database/restore.php --auto      # schema toujours + data SEULEMENT si tables vides
 *   php database/restore.php --force     # DANGER : TRUNCATE (ordre FK) + recharge complète
 *   php database/restore.php --schema-only | --data-only   # combinables avec les modes ci-dessus
 *
 * Garde-fous :
 * - schema.sql est idempotent (IF NOT EXISTS) : rejouable sans risque.
 * - data.sql (INSERTs bruts) n'est chargé qu'en base vide, sauf --force.
 * - Découpeur conscient des corps dollar-quotés ($$...$$) et des strings.
 * - Jamais via HTTP (403 sinon) ; secrets via .env (jamais affichés).
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI uniquement'); }

require_once __DIR__ . '/../api/db.php';

$args = $argv;
$dryRun = in_array('--dry-run', $args, true);
$force = in_array('--force', $args, true);
$auto = in_array('--auto', $args, true);
$onlySchema = in_array('--schema-only', $args, true);
$onlyData = in_array('--data-only', $args, true);
if (!$dryRun && !$auto && !$force && !$onlySchema && !$onlyData) {
    echo "Usage : php database/restore.php --dry-run | --auto | --force [--schema-only|--data-only]\n";
    exit(1);
}

/** Découpe un script SQL en ordres en respectant '...', "..." et $tag$...$tag$.
 *  Les lignes 100 % commentaires (--) sont retirées AVANT découpage : sinon
 *  un paquet "commentaires + ordre" serait jeté avec l'ordre (bug vécu :
 *  première table et INSERTs suivant un commentaire ignorés silencieusement). */
function splitSql(string $sql): array {
    $lines = [];
    foreach (explode("\n", $sql) as $l) {
        if (!preg_match('/^\s*--/', $l)) $lines[] = $l;
    }
    $sql = implode("\n", $lines);
    $stmts = []; $buf = ''; $len = strlen($sql);
    $inS = false; $inD = false; $inBlock = false; $dtag = null;
    for ($i = 0; $i < $len; $i++) {
        $c = $sql[$i]; $n = $i + 1 < $len ? $sql[$i + 1] : '';
        if ($inBlock) {
            $buf .= $c;
            if ($c === '*' && $n === '/') { $buf .= $n; $i++; $inBlock = false; }
            continue;
        }
        if ($dtag !== null) {
            $buf .= $c;
            if (substr($sql, $i, strlen($dtag)) === $dtag) { $buf .= substr($dtag, 1); $i += strlen($dtag) - 1; $dtag = null; }
            continue;
        }
        if ($inS) {
            $buf .= $c;
            if ($c === "'" && $n === "'") { $buf .= $n; $i++; } elseif ($c === "'") $inS = false;
            continue;
        }
        if ($inD) {
            $buf .= $c;
            if ($c === '"') $inD = false;
            continue;
        }
        if ($c === '/' && $n === '*') { $buf .= $c . $n; $i++; $inBlock = true; continue; }
        if ($c === "'") { $buf .= $c; $inS = true; continue; }
        if ($c === '"') { $buf .= $c; $inD = true; continue; }
        if ($c === '$' && preg_match('/^\$[A-Za-z_][A-Za-z_0-9]*\$|\$\$/', substr($sql, $i), $m)) {
            $buf .= $m[0]; $i += strlen($m[0]) - 1; $dtag = $m[0]; continue;
        }
        if ($c === ';') {
            $s = trim($buf);
            if ($s !== '' && !preg_match('/^(--.*)?$/s', $s)) $stmts[] = $s . ';';
            $buf = '';
            continue;
        }
        $buf .= $c;
    }
    $s = trim($buf);
    if ($s !== '' && !preg_match('/^(--.*)?$/s', $s)) $stmts[] = $s . ';';
    return $stmts;
}

$pdo = getDB();
$pdo->exec("SET statement_timeout = '120000'");

$schemaFile = __DIR__ . '/schema.sql';
$dataFile = __DIR__ . '/data.sql';
if (!is_file($schemaFile) || !is_file($dataFile)) { echo "Fichiers schema.sql/data.sql introuvables.\n"; exit(1); }

$isEmpty = function () use ($pdo): bool {
    foreach (['employes', 'utilisateurs_systeme'] as $t) {
        try {
            if ((int)$pdo->query("SELECT COUNT(*) FROM public.\"$t\"")->fetchColumn() > 0) return false;
        } catch (Throwable $e) { return true; } // table absente = vide
    }
    return true;
};

$runSchema = !$onlyData;
$runData = !$onlySchema;
if ($runData && $auto && !$force && !$isEmpty()) {
    echo "Base déjà chargée (employes/utilisateurs présents) : data.sql ignoré (relancez avec --force pour recharger).\n";
    $runData = false;
}
if ($runData && $force) {
    echo "ATTENTION --force : purge + recharge complète.\n";
}

$exec = function (string $file, bool $isData) use ($pdo, $dryRun, $force): array {
    $stmts = splitSql((string)file_get_contents($file));
    echo basename($file) . " : " . count($stmts) . " ordre(s)" . ($dryRun ? " [dry-run]" : "") . "\n";
    if ($dryRun) return [count($stmts), 0];
    $done = 0;
    $pdo->beginTransaction();
    try {
        foreach ($stmts as $s) { $pdo->exec($s); $done++; }
        $pdo->commit();
    } catch (Throwable $e) {
        $pdo->rollBack();
        echo "  ECHEC après $done ordre(s) : " . $e->getMessage() . "\n";
        exit(1);
    }
    return [count($stmts), $done];
};

[$ns] = $runSchema ? $exec($schemaFile, false) : [0, 0];
if ($runData && $force) {
    // Purge dans l'ordre inverse des dépendances (enfants d'abord).
    $order = ['journal_audit', 'donnees_biometriques', 'biometric_slots', 'pointages', 'historique_pointages', 'heures_mensuelles', 'horaires_travail', 'employes', 'utilisateurs_systeme', 'departements', 'appareils_pointage'];
    if (!$dryRun) {
        foreach ($order as $t) {
            try { $pdo->exec("TRUNCATE public.\"$t\" RESTART IDENTITY CASCADE"); } catch (Throwable $e) {}
        }
        echo "Tables purgées (CASCADE).\n";
    } else {
        echo "Tables qui seraient purgées : " . implode(', ', $order) . "\n";
    }
}
[$nd] = $runData ? $exec($dataFile, true) : [0, 0];
echo "OK : schema=$ns ordre(s), data=$nd ordre(s).\n";
