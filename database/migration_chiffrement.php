<?php
/**
 * Migration RGPD Art.9 : re-chiffre les gabarits biométriques stockés en clair
 * (hex UP_CHAR) vers le format chiffré ENC1 (AES-256-GCM) — cf. app/Core/Crypto.php.
 *
 * Usage (CLI uniquement) :
 *   php database/migration_chiffrement.php            # dry-run (rapport seul)
 *   php database/migration_chiffrement.php --write    # applique les re-chiffrements
 *
 * Idempotent : les lignes déjà au format ENC1 sont ignorées. Définissez
 * APP_ENCRYPTION_KEY dans .env AVANT de lancer la migration (sinon la clé de
 * repli dérivée de DB_PASSWORD sera utilisée — à éviter en production).
 * Les lignes dont le bytea est vide (enrôlement sans dump) sont ignorées.
 */
if (PHP_SAPI !== 'cli') { http_response_code(403); exit('CLI uniquement'); }

require_once __DIR__ . '/../api/db.php';
require_once __DIR__ . '/../app/Core/Crypto.php';

use App\Core\Crypto;

$pdo = getDB();
$write = in_array('--write', $argv, true);

$rows = $pdo->query("SELECT id_biometrie, id_employe, octet_length(gabarit_chiffre) AS len, encode(gabarit_chiffre,'hex') AS hex FROM donnees_biometriques WHERE type_biometrie='empreinte'")->fetchAll();
$dejaChiffres = 0; $aMigrer = 0; $vides = 0; $erreurs = 0;

foreach ($rows as $r) {
    $hex = (string)$r['hex'];
    $bin = @hex2bin($hex);
    if ($bin === false || $bin === '') { $vides++; continue; }
    if (Crypto::isEncrypted($bin)) { $dejaChiffres++; continue; }
    if (!preg_match('/^[0-9a-fA-F]*$/', $hex) || strlen($hex) % 2 !== 0) {
        echo "  ! id_biometrie={$r['id_biometrie']} (employe {$r['id_employe']}) : contenu non hex, ignoré (vérifier manuellement)\n";
        $erreurs++;
        continue;
    }
    $aMigrer++;
    if ($write) {
        try {
            $chiffre = Crypto::encryptHex($hex);
            $pdo->prepare("UPDATE donnees_biometriques SET gabarit_chiffre=?, algorithme=? WHERE id_biometrie=?")
                ->execute([$chiffre, 'R307_ZFM_UPCHAR_512_AESGCM', $r['id_biometrie']]);
            echo "  ✓ id_biometrie={$r['id_biometrie']} (employe {$r['id_employe']}) chiffré (" . strlen($chiffre) . " octets)\n";
        } catch (Throwable $e) {
            echo "  ✗ id_biometrie={$r['id_biometrie']} : " . $e->getMessage() . "\n";
            $erreurs++;
        }
    }
}

echo "\n=== Rapport migration gabarits ===\n";
echo "Total lignes empreinte  : " . count($rows) . "\n";
echo "Déjà chiffrées (ENC1)   : $dejaChiffres\n";
echo "En clair à migrer       : $aMigrer\n";
echo "Vides (pas de dump)     : $vides\n";
echo "Erreurs                 : $erreurs\n";
if (!$write) {
    echo "\nDRY-RUN : rien n'a été modifié. Relancez avec --write pour appliquer.\n";
} else {
    echo "\nMigration appliquée. Conservez APP_ENCRYPTION_KEY précieusement (perte = gabarits illisibles).\n";
}
