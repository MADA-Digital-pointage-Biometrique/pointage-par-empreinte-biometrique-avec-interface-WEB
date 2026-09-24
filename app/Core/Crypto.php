<?php

namespace App\Core;

/**
 * Chiffrement applicatif des données biométriques (RGPD Art. 9 — données
 * sensibles). La colonne `gabarit_chiffre` (bytea) contient désormais le
 * gabarit R307 CHIFFRÉ, et non plus le gabarit en clair via decode(hex).
 *
 * Format stocké dans le bytea : "ENC1" (4 octets) || IV(12) || TAG(16) || CHIFFRE
 *  - AES-256-GCM authentifié : toute altération du gabarit est détectée ;
 *  - IV 96 bits unique par enregistrement (CSPRNG) ;
 *  - clé = APP_ENCRYPTION_KEY (.env, hex 64 = 32 octets) ; sans cette variable,
 *    clé de repli dérivée de DB_PASSWORD — à considérer comme transitoire.
 *
 * Compatibilité : decryptHex() accepte l'ancien format (hex en clair, présent
 * dans les lignes pré-migration) pour ne rien casser à la lecture. Les lignes
 * legacy sont re-chiffrées au prochain enrôlement ou via
 * database/migration_chiffrement.php.
 */
final class Crypto
{
    private const PREFIX = 'ENC1';
    private const CIPHER = 'aes-256-gcm';
    private const IV_LEN = 12;
    private const TAG_LEN = 16;

    /** Clé brute 32 octets (APP_ENCRYPTION_KEY hex, sinon repli dérivé). */
    private static function key(): string
    {
        $env = getenv('APP_ENCRYPTION_KEY') ?: '';
        if ($env !== '') {
            $k = @hex2bin($env);
            if ($k !== false && strlen($k) === 32) return $k;
            // Clé fournie mais invalide : on refuse de chiffrer avec (fail-closed).
            throw new \RuntimeException('APP_ENCRYPTION_KEY invalide : 64 caractères hex attendus.');
        }
        error_log('Crypto: APP_ENCRYPTION_KEY absente — clé de repli dérivée (ajoutez APP_ENCRYPTION_KEY au .env).');
        return hash('sha256', 'mada-digital|repli|' . (getenv('DB_PASSWORD') ?: 'unset'), true);
    }

    /** Chiffre des octets bruts → binaire "ENC1|IV|TAG|CT". Idempotent. */
    public static function encryptBytes(string $raw): string
    {
        if (str_starts_with($raw, self::PREFIX)) return $raw; // déjà chiffré
        $iv  = random_bytes(self::IV_LEN);
        $tag = '';
        $ct  = openssl_encrypt($raw, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag, '', self::TAG_LEN);
        if ($ct === false) throw new \RuntimeException('Chiffrement gabarit impossible (openssl).');
        return self::PREFIX . $iv . $tag . $ct;
    }

    /** Déchiffre un payload encryptBytes() → octets bruts. Throws si altéré/clé changée. */
    public static function decryptBytes(string $stored): string
    {
        if (strlen($stored) < self::IV_LEN + self::TAG_LEN + 4) {
            throw new \RuntimeException('Gabarit chiffré illisible (trop court).');
        }
        $iv  = substr($stored, 4, self::IV_LEN);
        $tag = substr($stored, 4 + self::IV_LEN, self::TAG_LEN);
        $ct  = substr($stored, 4 + self::IV_LEN + self::TAG_LEN);
        $pt  = openssl_decrypt($ct, self::CIPHER, self::key(), OPENSSL_RAW_DATA, $iv, $tag);
        if ($pt === false) throw new \RuntimeException('Déchiffrement gabarit impossible (clé modifiée ou données altérées).');
        return $pt;
    }

    /**
     * Chiffre un gabarit hexadécimal (UP_CHAR R307, 512 octets = 1024 car.) →
     * binaire prêt pour la colonne bytea `gabarit_chiffre`.
     */
    public static function encryptHex(string $hex): string
    {
        $raw = @hex2bin($hex);
        if ($raw === false) throw new \RuntimeException('Gabarit hexadécimal invalide.');
        return self::encryptBytes($raw);
    }

    /**
     * Déchiffre une valeur de `gabarit_chiffre` → gabarit hexadécimal.
     * - binaire "ENC1..." → hex déchiffré (throws si altéré/clé changée) ;
     * - hex en clair (legacy pré-migration) → renvoyé tel quel ;
     * - null/'' → null.
     */
    public static function decryptHex(?string $stored): ?string
    {
        if ($stored === null || $stored === '') return null;
        if (str_starts_with($stored, self::PREFIX)) {
            return bin2hex(self::decryptBytes($stored));
        }
        // Legacy : gabarit en clair stocké avant migration (hex uniquement).
        if (preg_match('/^[0-9a-fA-F]*$/', $stored) && strlen($stored) % 2 === 0) {
            return $stored;
        }
        throw new \RuntimeException('Gabarit au format inattendu — migration requise.');
    }

    /** true si la valeur est au format chiffré v1. */
    public static function isEncrypted(?string $stored): bool
    {
        return $stored !== null && str_starts_with($stored, self::PREFIX);
    }
}
