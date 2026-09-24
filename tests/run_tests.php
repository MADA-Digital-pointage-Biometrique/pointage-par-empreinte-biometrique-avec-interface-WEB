<?php
/**
 * Tests de la logique métier — runner zéro-dépendance (usage : php tests/run_tests.php).
 *
 * Portée (conforme objectifs semaine) :
 *   1. Décision entrée/sortie (typeForLast) — inclut le bug pause_fin de la borne ;
 *   2. Crypto RGPD (chiffrement/déchiffrement, altération détectée, rétro-compat) ;
 *   3. CSRF + politique mot de passe (extraits de api/db.php, testables) ;
 *   4. Garde-fous statiques de api/sync_offline.php (validations durcies présentes) ;
 *   5. Smoke-test du driver R307 en mode --mock (enrôlement/search/template/delete).
 *
 * Chaque test est une fonction de t*.php : la structure est 1:1 mappable vers
 * PHPUnit (class X extends TestCase { public function testY() ... }) une fois
 * composer install possible — aucun comportement à réécrire.
 */
error_reporting(E_ALL & ~E_DEPRECATED);

use App\Core\Crypto;
use App\Core\PointageService;

$root = dirname(__DIR__);
$passes = 0; $failures = [];
function check(bool $cond, string $name): void {
    global $passes, $failures;
    if ($cond) { $passes++; echo "  ✓ $name\n"; }
    else { $failures[] = $name; echo "  ✗ $name\n"; }
}

echo "── Chargement des unités testables (sans serveur web) ──\n";
require_once $root . '/app/Core/PointageService.php';
require_once $root . '/app/Core/Crypto.php';
require_once $root . '/app/Core/CsrfPasswordPolicy.php';

// ─── 1. Décision entrée/sortie (PointageService::typeForLast) ───
echo "\n[1] Décision entrée/sortie — règle partagée web + borne\n";
check(PointageService::typeForLast(null) === 'entree', 'aucun pointage du jour → entree');
check(PointageService::typeForLast('entree') === 'sortie', 'dernier=entree → sortie');
check(PointageService::typeForLast('sortie') === 'entree', 'dernier=sortie → entree');
check(PointageService::typeForLast('pause_debut') === 'sortie', 'dernier=pause_debut → sortie');
check(PointageService::typeForLast('pause_fin') === 'entree', 'dernier=pause_fin → entree (bug borne corrigé)');
check(PointageService::typeForLast('nimporte') === 'sortie', 'type inconnu (sécurité) → sortie');

// ─── 2. Crypto RGPD (format bytea ENC1, AES-256-GCM) ───
echo "\n[2] Crypto RGPD — gabarits biométriques (Art. 9)\n";
putenv('APP_ENCRYPTION_KEY=' . str_repeat('ab', 32)); // clé de test fixe
$gabaritHex = str_repeat('de.ad.be.ef.', 1); // hex valide arbitraire
$gabaritHex = str_replace('.', '', $gabaritHex);
$enc = Crypto::encryptHex($gabaritHex);
check(str_starts_with($enc, 'ENC1'), 'payload chiffré préfixé ENC1');
check(!str_contains($gabaritHex, bin2hex(substr($enc, 0, 4))) && !str_contains(bin2hex($enc), $gabaritHex), 'gabarit en clair absent du payload chiffré');
check(Crypto::decryptHex($enc) === $gabaritHex, 'round-trip encrypt/decrypt hex');
check(Crypto::encryptBytes($enc) === $enc, 'encrypt idempotent (déjà ENC1 → inchangé)');
$corrupted = $enc; $corrupted[strlen($corrupted) - 1] = $corrupted[strlen($corrupted) - 1] === '0' ? '1' : '0';
try { Crypto::decryptBytes($corrupted); check(false, 'altération détectée (tag GCM)'); }
catch (\RuntimeException $e) { check(true, 'altération détectée (tag GCM)'); }
check(Crypto::decryptHex($gabaritHex) === $gabaritHex, 'rétro-compat : hex legacy en clair lu tel quel');
check(Crypto::decryptHex(null) === null && Crypto::decryptHex('') === null, 'null/chaîne vide → null');
putenv('APP_ENCRYPTION_KEY');
putenv('DB_PASSWORD=testkey');
$enc2 = Crypto::encryptHex($gabaritHex);
check(Crypto::decryptHex($enc2) === $gabaritHex, 'clé de repli (sans APP_ENCRYPTION_KEY) fonctionne aussi');

// ─── 3. CSRF + politique mot de passe (extraits de api/db.php) ───
echo "\n[3] CSRF + politique mot de passe\n";
$_SESSION = [];
$tok = csrfToken();
check(strlen($tok) === 64, 'token CSRF 64 car. hex');
check(verifyCsrf($tok), 'verifyCsrf accepte le bon token');
check(!verifyCsrf(str_repeat('0', 64)), 'verifyCsrf rejette un mauvais token');
check(!verifyCsrf(null), 'verifyCsrf rejette null');
check(passwordPolicyCheck('Abcdef123456') === null, 'politique : 12 car. + casse + chiffre → OK');
check(passwordPolicyCheck('Abcdef12345') !== null, 'politique : 11 car. → refusé');
check(passwordPolicyCheck('abcdef123456') !== null, 'politique : sans majuscule → refusé');
check(passwordPolicyCheck('ABCDEF123456') !== null, 'politique : sans minuscule → refusé');
check(passwordPolicyCheck('Abcdefghijkl') !== null, 'politique : sans chiffre → refusé');
$hash = hashPassword('Abcdef123456');
check(password_verify('Abcdef123456', $hash), 'hashPassword bcrypt vérifiable');

// ─── 4. Garde-fous statiques de sync_offline.php ───
echo "\n[4] api/sync_offline.php — garde-fous durcis présents\n";
$sync = file_get_contents($root . '/api/sync_offline.php');
$svc = file_get_contents($root . '/app/Core/PointageService.php');
check(str_contains($sync, 'PointageService::syncOfflineItem'), 'insertion via service validé (plus d\'INSERT brut)');
check(str_contains($svc, 'assertEmployeActif'), 'validation employé actif présente');
check(str_contains($sync, 'auditBorne') || str_contains($sync, "PointageService::auditBorne"), 'journal d\'audit écrit');
check(str_contains($sync, '429'), 'rate-limit présent');
check(!preg_match('/INSERT INTO pointages/', $sync), 'aucun INSERT direct dans l\'endpoint');
check(str_contains($svc, 'date_heure dans le futur'), 'refus des dates futures');

// ─── 5. Driver R307 en mode --mock (smoke-test chaîne PHP→Python) ───
echo "\n[5] Driver R307 mode --mock (chaîne CLI)\n";
$py = strtoupper(substr(PHP_OS, 0, 3)) === 'WIN' ? 'py' : 'python3';
$cli = $root . '/python/r307_cli.py';
$mk = function(string $args) use ($py, $cli): array {
    $cmd = sprintf('%s %s %s 2>&1', $py, escapeshellarg($cli), $args);
    exec($cmd, $out, $code);
    $j = json_decode(implode('', $out), true);
    return [$j, $code];
};
foreach ([['--action enroll --id 5', fn($j) => ($j['ok'] ?? false) && ($j['page_id'] ?? 0) === 5, 'mock enroll id=5 → ok'],
          ['--action search', fn($j) => ($j['ok'] ?? true) === false, 'mock search → aucune empreinte (échec attendu)'],
          ['--action template --id 7', fn($j) => ($j['size'] ?? 0) === 512, 'mock template → 512 octets'],
          ['--action delete --id 5', fn($j) => ($j['ok'] ?? false) === true, 'mock delete → ok'],
          ['--action status', fn($j) => array_key_exists('count', $j), 'mock status → count']] as $i => [$args, $cond, $name]) {
    [$j, $code] = $mk('--mock ' . $args);
    check(is_array($j) && $cond($j), $name . (is_array($j) ? '' : " (sortie non-JSON, code $code)"));
}

// ─── Bilan ───
echo "\n════════════════════════════════════\n";
echo "Résultat : $passes réussis, " . count($failures) . " échoués\n";
foreach ($failures as $f) echo "  ✗ $f\n";
echo "════════════════════════════════════\n";
exit(count($failures) === 0 ? 0 : 1);
